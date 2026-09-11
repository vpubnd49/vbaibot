import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createLogger } from "../shared/logger.js";
import type { SpeechToTextResult } from "./stt-client.js";

const execFileAsync = promisify(execFile);
const log = createLogger("stt-chunker");

const CHUNK_DURATION_SEC = 300; // 5 phút mỗi đoạn để Gemini bóc băng siêu tốc (~10-15s)
const MAX_CONCURRENT = 3; // Chạy song song tối đa 3 đoạn để không nghẽn mạng/rate limit

export async function canUseFfmpeg(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    await execFileAsync("ffprobe", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

export async function getAudioDurationSec(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const duration = parseFloat(stdout.trim());
    return Number.isFinite(duration) ? duration : null;
  } catch {
    return null;
  }
}

async function extractAudioChunk(
  inputPath: string,
  startSec: number,
  durationSec: number,
  outputPath: string,
): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-ss", String(startSec),
    "-i", inputPath,
    "-t", String(durationSec),
    "-ac", "1",
    "-ar", "16000",
    "-b:a", "32k",
    outputPath,
  ]);
}

/**
 * Bóc băng file âm thanh dài (>5 phút hoặc >10MB) bằng cách tự động chia đoạn 5 phút
 * và gửi song song lên Gemini 2.5 Flash, tránh lỗi timeout và giới hạn 20MB inlineData.
 */
export async function transcribeLongAudio(
  filePath: string,
  fileName: string,
  apiKey: string,
  model = "gemini-2.5-flash",
  baseUrl = "https://generativelanguage.googleapis.com/v1beta",
): Promise<SpeechToTextResult | null> {
  const stats = fs.statSync(filePath);
  const duration = await getAudioDurationSec(filePath);

  // Chỉ chunk khi file dài > 300s hoặc nặng > 10MB
  if ((!duration || duration <= CHUNK_DURATION_SEC) && stats.size <= 10 * 1024 * 1024) {
    return null;
  }

  const totalDuration = duration ?? 3600;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stt-chunks-"));

  try {
    const chunkDefs: Array<{ index: number; start: number; end: number; file: string }> = [];
    let start = 0;
    let idx = 0;

    while (start < totalDuration) {
      const end = Math.min(start + CHUNK_DURATION_SEC, totalDuration);
      const chunkFile = path.join(tmpDir, `chunk_${idx}.mp3`);
      await extractAudioChunk(filePath, start, CHUNK_DURATION_SEC, chunkFile);
      chunkDefs.push({ index: idx, start, end, file: chunkFile });
      start += CHUNK_DURATION_SEC;
      idx++;
    }

    log.info({ fileName, totalDuration, chunks: chunkDefs.length }, "Đã chia đoạn âm thanh dài để bóc băng");

    const geminiBase = baseUrl.replace(/\/openai\/?$/i, "").replace(/\/+$/, "");
    const endpoint = `${geminiBase.includes("/v1beta") ? geminiBase : `${geminiBase}/v1beta`}/models/${model}:generateContent?key=${apiKey}`;

    const results: Array<{ index: number; text: string; start: number; end: number }> = [];

    // Chạy batch để kiểm soát concurrency
    for (let i = 0; i < chunkDefs.length; i += MAX_CONCURRENT) {
      const batch = chunkDefs.slice(i, i + MAX_CONCURRENT);
      const batchPromises = batch.map(async (chunk) => {
        try {
          const bytes = fs.readFileSync(chunk.file);
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: "Chép nguyên văn toàn bộ nội dung file ghi âm bằng tiếng Việt. Chỉ trả về transcript, không tóm tắt, không giải thích, không tự đoán; chỗ không rõ ghi [không rõ].",
                    },
                    {
                      inlineData: {
                        mimeType: "audio/mp3",
                        data: bytes.toString("base64"),
                      },
                    },
                  ],
                },
              ],
            }),
            signal: AbortSignal.timeout(120_000),
          });

          if (!response.ok) {
            log.warn({ chunk: chunk.index, status: response.status }, "Lỗi khi bóc băng đoạn âm thanh");
            return { index: chunk.index, start: chunk.start, end: chunk.end, text: "" };
          }

          const payload = (await response.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
          return { index: chunk.index, start: chunk.start, end: chunk.end, text };
        } catch (err) {
          log.warn({ chunk: chunk.index, err }, "Timeout hoặc lỗi kết nối khi bóc băng đoạn");
          return { index: chunk.index, start: chunk.start, end: chunk.end, text: "" };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    results.sort((a, b) => a.index - b.index);

    const fmt = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    const validResults = results.filter((r) => r.text.length > 0);
    if (validResults.length === 0) return null;

    const fullTranscript = validResults
      .map((r) => `[${fmt(r.start)} - ${fmt(r.end)}]\n${r.text}`)
      .join("\n\n");

    return {
      text: fullTranscript,
      provider: "openai-compatible",
      model,
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

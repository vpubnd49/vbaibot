import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { getEffectiveLlmSettings } from "../config/runtime-llm-settings.js";
import { getGoogleSettings } from "../config/runtime-google-settings.js";
import { createLogger } from "../shared/logger.js";
import { canUseFfmpeg, transcribeLongAudio } from "./stt-chunker.js";
import { AUDIO_TRANSCRIPTION_MODEL } from "../config/model-roles.js";

const log = createLogger("stt-client");

const AUDIO_MIME_BY_EXT: Record<string, string> = {
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".flac": "audio/flac",
  ".amr": "audio/amr",
  ".webm": "audio/webm",
};

const AUDIO_FORMAT_BY_EXT: Record<string, string> = {
  ".m4a": "mp4",
  ".mp3": "mp3",
  ".wav": "wav",
  ".aac": "aac",
  ".ogg": "ogg",
  ".opus": "ogg",
  ".flac": "flac",
  ".amr": "amr",
  ".webm": "webm",
};

export type SpeechToTextResult = {
  text: string;
  provider: "openai-compatible";
  model: string;
};

export type SpeechToTextOptions = {
  baseUrl?: string;
  apiKey?: string;
  /** Deprecated: retained for source compatibility but always ignored. */
  model?: string;
  protocol?: "audio-chat" | "transcriptions";
  language?: string;
  timeoutMs?: number;
};

import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function transcribeAudioFile(
  filePath: string,
  fileName = path.basename(filePath),
  options: SpeechToTextOptions = {},
): Promise<SpeechToTextResult | null> {
  const llm = getEffectiveLlmSettings();
  const google = getGoogleSettings();
  const defaultBaseUrl = google.apiKey
    ? (google.baseUrl || "https://generativelanguage.googleapis.com/v1beta")
    : (env.STT_BASE_URL || (llm.provider === "google" ? "https://generativelanguage.googleapis.com/v1beta" : llm.baseUrl));
  const defaultApiKey = google.apiKey || env.STT_API_KEY || (llm.provider === "google" ? llm.apiKey : "");
  const baseUrl = options.baseUrl ?? defaultBaseUrl;
  const apiKey = options.apiKey ?? defaultApiKey;

  if (!baseUrl || !apiKey) return null;

  // Real Google direct key (AIza... or AQ...) and NOT third-party gateway (sk-...)
  const isGemini =
    !apiKey.startsWith("sk-") &&
    (baseUrl.includes("generativelanguage.googleapis.com") ||
      apiKey.startsWith("AQ.") ||
      apiKey.startsWith("AIza"));

  // 9Router / OpenAI-compat gateway requires ag/gemini-3-flash; Google native uses AUDIO_TRANSCRIPTION_MODEL
  let model = AUDIO_TRANSCRIPTION_MODEL;
  if (!isGemini && (baseUrl.includes("9router") || apiKey.startsWith("sk-"))) {
    model = "ag/gemini-3-flash";
  }

  const protocol = options.protocol ?? env.STT_PROTOCOL;
  const language = options.language ?? env.STT_LANGUAGE;
  const timeoutMs = options.timeoutMs ?? env.STT_TIMEOUT_MS;

  const maxAudioBytes = 200 * 1024 * 1024;
  const fileStats = fs.statSync(filePath);
  if (fileStats.size === 0) throw new Error("Audio rỗng");
  if (fileStats.size > maxAudioBytes) throw new Error("Audio vượt giới hạn 200 MiB");

  const extension = path.extname(fileName).toLowerCase();
  const mimeType = AUDIO_MIME_BY_EXT[extension] ?? "application/octet-stream";
  let bytes = fs.readFileSync(filePath);

  let tempConvertedPath: string | null = null;
  let sendFormat = AUDIO_FORMAT_BY_EXT[extension] ?? "mp3";

  // Normalize audio to 16kHz mono mp3 if using audio-chat and ffmpeg is available
  if (!isGemini && protocol === "audio-chat" && (await canUseFfmpeg())) {
    try {
      const tmpPath = path.join(os.tmpdir(), `stt-conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`);
      await execFileAsync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", filePath,
        "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k",
        "-f", "mp3", tmpPath,
      ]);
      if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 0) {
        bytes = fs.readFileSync(tmpPath);
        sendFormat = "mp3";
        tempConvertedPath = tmpPath;
      }
    } catch (ffmpegErr) {
      log.warn({ ffmpegErr }, "Không thể convert audio bằng ffmpeg, gửi file gốc");
    }
  }

  try {
    if (isGemini) {
      if (await canUseFfmpeg()) {
        try {
          const longResult = await transcribeLongAudio(filePath, fileName, apiKey, model, baseUrl);
          if (longResult) return longResult;
        } catch (err) {
          log.warn({ err }, "Lỗi khi bóc băng chia đoạn, thử cách đơn lẻ");
        }
      }
      const geminiBase = baseUrl.replace(/\/openai\/?$/i, "").replace(/\/+$/, "");
      const endpoint = `${geminiBase.includes("/v1beta") ? geminiBase : `${geminiBase}/v1beta`}/models/${model}:generateContent?key=${apiKey}`;
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
                    mimeType: mimeType === "audio/mpeg" ? "audio/mp3" : mimeType,
                    data: bytes.toString("base64"),
                  },
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`STT HTTP ${response.status}: ${await response.text()}`);
      const payload = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      if (!text) return null;
      return { text, provider: "openai-compatible", model };
    }

    if (protocol === "audio-chat") {
      let response: Response | undefined;
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            temperature: 0,
            messages: [{
              role: "user",
              content: [
                { type: "text", text: "Chép nguyên văn toàn bộ nội dung file ghi âm bằng tiếng Việt. Chỉ trả về transcript, không tóm tắt, không giải thích, không tự đoán; chỗ không rõ ghi [không rõ]." },
                { type: "input_audio", input_audio: { data: bytes.toString("base64"), format: sendFormat } },
              ],
            }],
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (response.ok) break;

        if ((response.status === 429 || response.status === 503) && attempt < maxAttempts) {
          log.warn({ attempt, status: response.status }, "AI Gateway bận (429/503), chờ 2.5s rồi thử lại");
          await new Promise((r) => setTimeout(r, 2500));
          continue;
        }
        break;
      }

      if (!response || !response.ok) {
        throw new Error(`STT HTTP ${response?.status}: ${response ? await response.text() : "No response"}`);
      }

      const rawText = await response.text();
      const trimmed = rawText.trim();
      let text = "";
      if (trimmed.startsWith("data:") || trimmed.includes("\ndata:")) {
        for (const line of trimmed.split("\n")) {
          const l = line.trim();
          if (!l || l === "data: [DONE]") continue;
          if (l.startsWith("data:")) {
            try {
              const chunk = JSON.parse(l.slice(5).trim());
              const delta = chunk?.choices?.[0]?.delta?.content || chunk?.choices?.[0]?.message?.content || "";
              text += delta;
            } catch {
              // ignore
            }
          }
        }
        text = text.trim();
      } else {
        try {
          const payload = JSON.parse(trimmed) as { text?: unknown; choices?: Array<{ message?: { content?: unknown } }> };
          text = typeof payload.text === "string"
            ? payload.text.trim()
            : typeof payload.choices?.[0]?.message?.content === "string"
              ? payload.choices[0].message.content.trim()
              : "";
        } catch {
          text = trimmed;
        }
      }
      if (!text) return null;
      return { text, provider: "openai-compatible", model };
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: (() => {
        const form = new FormData();
        form.append("file", new Blob([bytes], { type: mimeType }), fileName);
        form.append("model", model);
        form.append("language", language);
        form.append("audio_format", AUDIO_FORMAT_BY_EXT[extension] ?? "");
        form.append("response_format", "json");
        form.append("prompt", "Chép nguyên văn tiếng Việt, giữ dấu, không dịch, không tóm tắt, không thêm nội dung.");
        return form;
      })(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`STT HTTP ${response.status}: ${await response.text()}`);
    const payload = (await response.json()) as { text?: unknown; choices?: Array<{ message?: { content?: unknown } }> };
    const text = typeof payload.text === "string"
      ? payload.text.trim()
      : typeof payload.choices?.[0]?.message?.content === "string"
        ? payload.choices[0].message.content.trim()
        : "";
    if (!text) return null;
    return { text, provider: "openai-compatible", model };
  } finally {
    if (tempConvertedPath) {
      try {
        fs.unlinkSync(tempConvertedPath);
      } catch {}
    }
  }
}

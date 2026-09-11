import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

const AUDIO_MIME_BY_EXT: Record<string, string> = {
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus",
  ".flac": "audio/flac",
  ".amr": "audio/amr",
};

export type SpeechToTextResult = {
  text: string;
  provider: "openai-compatible";
  model: string;
};

export type SpeechToTextOptions = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  language?: string;
  timeoutMs?: number;
};

export async function transcribeAudioFile(
  filePath: string,
  fileName = path.basename(filePath),
  options: SpeechToTextOptions = {},
): Promise<SpeechToTextResult | null> {
  const baseUrl = options.baseUrl ?? env.STT_BASE_URL;
  const apiKey = options.apiKey ?? env.STT_API_KEY;
  const model = options.model ?? env.STT_MODEL;
  const language = options.language ?? env.STT_LANGUAGE;
  const timeoutMs = options.timeoutMs ?? env.STT_TIMEOUT_MS;
  if (!baseUrl || !apiKey) return null;
  const maxAudioBytes = 200 * 1024 * 1024;
  const fileStats = fs.statSync(filePath);
  if (fileStats.size === 0) throw new Error("Audio rỗng");
  if (fileStats.size > maxAudioBytes) throw new Error("Audio vượt giới hạn 200 MiB");
  const form = new FormData();
  const extension = path.extname(fileName).toLowerCase();
  const mimeType = AUDIO_MIME_BY_EXT[extension] ?? "application/octet-stream";
  form.append("file", new Blob([fs.readFileSync(filePath)], { type: mimeType }), fileName);
  form.append("model", model);
  form.append("language", language);
  form.append("response_format", "json");
  form.append("prompt", "Chép nguyên văn tiếng Việt, giữ dấu, không dịch, không tóm tắt, không thêm nội dung.");

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`STT HTTP ${response.status}: ${await response.text()}`);
  const payload = await response.json() as { text?: unknown };
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) return null;
  return { text, provider: "openai-compatible", model };
}

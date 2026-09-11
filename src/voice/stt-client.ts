import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { getEffectiveLlmSettings } from "../config/runtime-llm-settings.js";
import { getGoogleSettings } from "../config/runtime-google-settings.js";

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
  model?: string;
  protocol?: "audio-chat" | "transcriptions";
  language?: string;
  timeoutMs?: number;
};

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
  const defaultModel = google.apiKey
    ? (google.model || "gemini-2.5-flash")
    : (env.STT_MODEL || (llm.provider === "google" ? "gemini-2.5-flash" : llm.model));

  const baseUrl = options.baseUrl ?? defaultBaseUrl;
  const apiKey = options.apiKey ?? defaultApiKey;
  const model = options.model ?? defaultModel;
  const protocol = options.protocol ?? env.STT_PROTOCOL;
  const language = options.language ?? env.STT_LANGUAGE;
  const timeoutMs = options.timeoutMs ?? env.STT_TIMEOUT_MS;
  if (!baseUrl || !apiKey) return null;
  const maxAudioBytes = 200 * 1024 * 1024;
  const fileStats = fs.statSync(filePath);
  if (fileStats.size === 0) throw new Error("Audio rỗng");
  if (fileStats.size > maxAudioBytes) throw new Error("Audio vượt giới hạn 200 MiB");
  const extension = path.extname(fileName).toLowerCase();
  const mimeType = AUDIO_MIME_BY_EXT[extension] ?? "application/octet-stream";
  const bytes = fs.readFileSync(filePath);

  const isGemini =
    baseUrl.includes("generativelanguage.googleapis.com") ||
    apiKey.startsWith("AQ.") ||
    apiKey.startsWith("AIza") ||
    (model.toLowerCase().startsWith("gemini") && options.protocol !== "transcriptions");

  if (isGemini) {
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

  const response = protocol === "audio-chat"
    ? await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Chép nguyên văn toàn bộ nội dung file ghi âm bằng tiếng Việt. Chỉ trả về transcript, không tóm tắt, không giải thích, không tự đoán; chỗ không rõ ghi [không rõ]." },
              { type: "input_audio", input_audio: { data: bytes.toString("base64"), format: AUDIO_FORMAT_BY_EXT[extension] ?? "mp4" } },
            ],
          }],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    : await fetch(`${baseUrl.replace(/\/$/, "")}/audio/transcriptions`, {
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
  const payload = await response.json() as { text?: unknown; choices?: Array<{ message?: { content?: unknown } }> };
  const text = typeof payload.text === "string"
    ? payload.text.trim()
    : typeof payload.choices?.[0]?.message?.content === "string"
      ? payload.choices[0].message.content.trim()
      : "";
  if (!text) return null;
  return { text, provider: "openai-compatible", model };
}

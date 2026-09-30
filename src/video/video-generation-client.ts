import { getVideoSettings, getKieVideoConfig, isVideoGenConfigured } from "../config/runtime-video-settings.js";
import { getTuning } from "../config/runtime-tuning-settings.js";
import { generateVideoViaKie } from "./kie-video-adapter.js";
import { createLogger } from "../shared/logger.js";

const log = createLogger("video-gen");

export type GenerateVideoParams = {
  prompt: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  durationSec?: 5 | 8;
};

export type GeneratedVideo = {
  data: Buffer;
  ext: "mp4";
};

/**
 * Phát hiện key/baseUrl có phải Google trực tiếp không.
 * Google key: AIzaSy..., AQ.xxx  hoặc không có baseUrl.
 * 9Router/proxy: sk-xxx + baseUrl chứa domain khác Google.
 */
function isGoogleDirect(settings: { apiKey: string; baseUrl?: string }): boolean {
  if (settings.apiKey.startsWith("AIza") || settings.apiKey.startsWith("AQ.")) return true;
  if (!settings.baseUrl) return true;
  if (settings.baseUrl.includes("googleapis.com")) return true;
  return false;
}

export async function generateVideo(
  params: GenerateVideoParams,
  settings = getVideoSettings(),
  fetchImpl = globalThis.fetch
): Promise<GeneratedVideo> {
  // KIE code path
  const kieConfig = getKieVideoConfig();
  if (kieConfig) {
    return generateVideoViaKie(params, kieConfig, fetchImpl);
  }

  if (!isVideoGenConfigured(settings)) {
    throw new Error("Chưa cấu hình API key để tạo video");
  }

  // 9Router / proxy path: dùng Gemini :generateContent qua proxy
  if (!isGoogleDirect(settings)) {
    return generateVideoViaProxy(params, settings, fetchImpl);
  }

  // Google trực tiếp: dùng endpoint generateVideos
  return generateVideoViaGoogle(params, settings, fetchImpl);
}

/**
 * Tạo video qua 9Router / OpenAI-compatible proxy.
 * Gọi endpoint `:generateVideos` nhưng prefix bằng baseUrl thay vì hardcode Google.
 */
async function generateVideoViaProxy(
  params: GenerateVideoParams,
  settings: { apiKey: string; model: string; baseUrl?: string },
  fetchImpl: typeof fetch,
): Promise<GeneratedVideo> {
  const timeoutMs = getTuning("VIDEO_GEN_TIMEOUT_MS");
  const abort = AbortSignal.timeout(timeoutMs);
  const base = (settings.baseUrl || "").replace(/\/v1\/?$/, "").replace(/\/$/, "");

  // Thử endpoint Gemini generateVideos qua proxy
  const startUrl = `${base}/v1beta/models/${settings.model}:generateVideos`;
  const startBody = {
    instances: [{ prompt: params.prompt }],
    generationConfig: {
      aspectRatio: params.aspectRatio ?? "16:9",
      durationSeconds: params.durationSec ?? 5,
    },
  };

  log.info({ model: settings.model, baseUrl: base }, "Tạo video qua proxy");

  let operationName = "";
  try {
    const startRes = await fetchImpl(startUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(startBody),
      signal: abort,
    });
    if (!startRes.ok) {
      const errBody = (await startRes.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(errBody.error?.message || `Lỗi HTTP ${startRes.status}`);
    }
    const startData = await startRes.json() as { name: string };
    operationName = startData.name;
    if (!operationName) throw new Error("API không trả về mã tác vụ (operation name)");
  } catch (error) {
    if (abort.aborted) throw new Error(`Tạo video quá lâu (hơn ${Math.round(timeoutMs / 1000)} giây) nên đã dừng`);
    throw error;
  }

  // Poll qua proxy
  const pollUrl = `${base}/v1beta/${operationName}`;
  while (!abort.aborted) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const pollRes = await fetchImpl(pollUrl, {
      headers: { "Authorization": `Bearer ${settings.apiKey}` },
      signal: abort,
    });
    if (!pollRes.ok) {
      const errBody = (await pollRes.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(errBody.error?.message || `Lỗi HTTP ${pollRes.status} khi kiểm tra trạng thái`);
    }
    const pollData = await pollRes.json() as any;
    if (pollData.error) {
      throw new Error(pollData.error.message || "Lỗi tạo video");
    }
    if (pollData.done) {
      const uri = pollData.response?.generatedVideos?.[0]?.video?.uri;
      if (!uri) throw new Error("API báo xong nhưng không có link video");
      // Download có thể cần auth
      const dlHeaders: Record<string, string> = {};
      if (!uri.includes("googleapis.com")) {
        dlHeaders["Authorization"] = `Bearer ${settings.apiKey}`;
      }
      const downloadRes = await fetchImpl(uri, { signal: abort, headers: dlHeaders });
      if (!downloadRes.ok) throw new Error(`Lỗi tải file MP4: ${downloadRes.status}`);
      const arrayBuffer = await downloadRes.arrayBuffer();
      return { data: Buffer.from(arrayBuffer), ext: "mp4" };
    }
  }

  throw new Error(`Tạo video quá lâu (hơn ${Math.round(timeoutMs / 1000)} giây) nên đã dừng`);
}

/**
 * Tạo video qua Google API trực tiếp (endpoint gốc, key trong query string).
 */
async function generateVideoViaGoogle(
  params: GenerateVideoParams,
  settings: { apiKey: string; model: string },
  fetchImpl: typeof fetch,
): Promise<GeneratedVideo> {
  const timeoutMs = getTuning("VIDEO_GEN_TIMEOUT_MS");
  const abort = AbortSignal.timeout(timeoutMs);

  const startUrl = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateVideos?key=${settings.apiKey}`;
  const startBody = {
    instances: [{ prompt: params.prompt }],
    generationConfig: {
      aspectRatio: params.aspectRatio ?? "16:9",
      durationSeconds: params.durationSec ?? 5,
    },
  };

  let operationName = "";
  try {
    const startRes = await fetchImpl(startUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(startBody),
      signal: abort,
    });
    if (!startRes.ok) {
      const errBody = (await startRes.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(errBody.error?.message || `Lỗi HTTP ${startRes.status}`);
    }
    const startData = await startRes.json() as { name: string };
    operationName = startData.name;
    if (!operationName) throw new Error("API không trả về mã tác vụ (operation name)");
  } catch (error) {
    if (abort.aborted) throw new Error(`Tạo video quá lâu (hơn ${Math.round(timeoutMs / 1000)} giây) nên đã dừng`);
    throw error;
  }

  const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${settings.apiKey}`;
  while (!abort.aborted) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const pollRes = await fetchImpl(pollUrl, { signal: abort });
    if (!pollRes.ok) {
      const errBody = (await pollRes.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(errBody.error?.message || `Lỗi HTTP ${pollRes.status} khi kiểm tra trạng thái`);
    }
    const pollData = await pollRes.json() as any;
    if (pollData.error) {
      throw new Error(pollData.error.message || "Lỗi tạo video từ Google Veo");
    }
    if (pollData.done) {
      const uri = pollData.response?.generatedVideos?.[0]?.video?.uri;
      if (!uri) throw new Error("API báo xong nhưng không có link video");
      const dlUrl = uri.includes("?") ? `${uri}&key=${settings.apiKey}` : `${uri}?key=${settings.apiKey}`;
      const downloadRes = await fetchImpl(dlUrl, { signal: abort });
      if (!downloadRes.ok) throw new Error(`Lỗi tải file MP4: ${downloadRes.status}`);
      const arrayBuffer = await downloadRes.arrayBuffer();
      return { data: Buffer.from(arrayBuffer), ext: "mp4" };
    }
  }

  throw new Error(`Tạo video quá lâu (hơn ${Math.round(timeoutMs / 1000)} giây) nên đã dừng`);
}


import { getVideoSettings, getKieVideoConfig, isVideoGenConfigured } from "../config/runtime-video-settings.js";
import { getTuning } from "../config/runtime-tuning-settings.js";
import { generateVideoViaKie } from "./kie-video-adapter.js";

export type GenerateVideoParams = {
  prompt: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  durationSec?: 5 | 8;
};

export type GeneratedVideo = {
  data: Buffer;
  ext: "mp4";
};

export async function generateVideo(
  params: GenerateVideoParams,
  settings = getVideoSettings(),
  fetchImpl = globalThis.fetch
): Promise<GeneratedVideo> {
  // KIE code path: khi Video Gen riêng chưa cấu hình nhưng KIE provider đã có
  const kieConfig = getKieVideoConfig();
  if (kieConfig) {
    return generateVideoViaKie(params, kieConfig, fetchImpl);
  }

  if (!isVideoGenConfigured(settings)) {
    throw new Error("Chưa cấu hình API key để tạo video");
  }

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

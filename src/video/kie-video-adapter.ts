/**
 * Adapter KIE cho Seedance 2.0 — chuyển GenerateVideoParams thành KIE task.
 */

import type { GenerateVideoParams, GeneratedVideo } from "./video-generation-client.js";
import { createKieTask, pollKieTaskUntilDone, downloadKieResult, type KieTaskSettings } from "../shared/kie-task-client.js";
import { resolveVideoModelId } from "../shared/kie-model-map.js";
import { getTuning } from "../config/runtime-tuning-settings.js";
import { createLogger } from "../shared/logger.js";

const log = createLogger("kie-video");

export type KieVideoConfig = KieTaskSettings & {
  model: string;
};

export async function generateVideoViaKie(
  params: GenerateVideoParams,
  config: KieVideoConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<GeneratedVideo> {
  const modelId = resolveVideoModelId(config.model);

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio ?? "16:9",
    duration: params.durationSec ?? 5,
    resolution: "720p",
    generate_audio: true,
  };

  const timeoutMs = getTuning("VIDEO_GEN_TIMEOUT_MS");

  log.info({ model: modelId, duration: input.duration }, "Bắt đầu tạo video qua KIE");

  const taskId = await createKieTask(
    { baseUrl: config.baseUrl, apiKey: config.apiKey },
    modelId,
    input,
    fetchImpl,
  );

  const result = await pollKieTaskUntilDone(
    { baseUrl: config.baseUrl, apiKey: config.apiKey },
    taskId,
    timeoutMs,
    fetchImpl,
  );

  if (result.state !== "success" || result.resultUrls.length === 0) {
    throw new Error(`KIE tạo video thất bại: ${result.failMsg ?? "không có video kết quả"}`);
  }

  const videoUrl = result.resultUrls[0]!;
  const data = await downloadKieResult(videoUrl, fetchImpl);

  log.info({ taskId, kb: Math.round(data.length / 1024) }, "Đã tải video KIE");

  return { data, ext: "mp4" };
}

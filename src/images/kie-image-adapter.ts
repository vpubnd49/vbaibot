/**
 * Adapter KIE cho Nano Banana 2 — chuyển GenerateImageParams thành KIE task.
 *
 * Trả về cùng type GeneratedImage để code gọi không cần biết đang dùng
 * provider nào.
 */

import type { GenerateImageParams, GeneratedImage, ImageExt } from "./image-generation-client.js";
import { createKieTask, pollKieTaskUntilDone, downloadKieResult, type KieTaskSettings } from "../shared/kie-task-client.js";
import { resolveImageModelId } from "../shared/kie-model-map.js";
import { getTuning } from "../config/runtime-tuning-settings.js";
import { createLogger } from "../shared/logger.js";

const log = createLogger("kie-image");

export type KieImageConfig = KieTaskSettings & {
  model: string;
};

export async function generateImageViaKie(
  params: GenerateImageParams,
  config: KieImageConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<GeneratedImage> {
  const modelId = resolveImageModelId(config.model);
  const outputFormat = params.transparentBackground ? "png" : "png"; // KIE mặc định PNG cho chất lượng

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    aspect_ratio: "auto",
    resolution: "2K",
    output_format: outputFormat,
  };

  if (params.refImage) {
    input.image_input = [`data:${params.refImage.mediaType};base64,${params.refImage.base64}`];
  } else {
    input.image_input = [];
  }

  const timeoutMs = getTuning("IMAGE_GEN_TIMEOUT_MS");

  log.info({ model: modelId, hasRef: Boolean(params.refImage) }, "Bắt đầu tạo ảnh qua KIE");

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
    throw new Error(`KIE tạo ảnh thất bại: ${result.failMsg ?? "không có ảnh kết quả"}`);
  }

  const imageUrl = result.resultUrls[0]!;
  const data = await downloadKieResult(imageUrl, fetchImpl);

  // Xác định extension từ URL
  const ext = detectExt(imageUrl);
  log.info({ taskId, kb: Math.round(data.length / 1024), ext }, "Đã tải ảnh KIE");

  return { data, ext };
}

function detectExt(url: string): ImageExt {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "png";
  if (lower.includes(".webp")) return "webp";
  return "png"; // KIE mặc định PNG
}

/**
 * Model BACKUP khi router chính trả completion rỗng liên tiếp.
 *
 * Đọc cấu hình Google Gemini bổ sung (google_base_url, google_model, google_api_key)
 * từ runtime_settings - cùng nguồn mà vision sidecar và STT dùng. Trả
 * `LanguageModel` nếu có đủ config, `null` nếu chưa cấu hình.
 *
 * KHÔNG gộp vào `llm-provider.ts`: module đó là đường ĐI CHÍNH (mỗi lượt đều
 * gọi), còn đây là đường CỨU NGUY (chỉ chạy khi router hỏng). Gộp lại là pha
 * hai mối quan tâm và test phải mock cả hai đường cùng lúc.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { getGoogleSettings, isGoogleConfigured } from "../config/runtime-google-settings.js";
import { cacheSessionHeaders } from "./cache-session-id.js";
import { reasoningProviderOptions, type ReasoningEffort } from "./reasoning-options.js";
import { getTuning } from "../config/runtime-tuning-settings.js";
import { createLogger } from "../shared/logger.js";

const log = createLogger("backup-provider");

/**
 * Base URL cho provider Google: gỡ đuôi `/openai` nếu có.
 *
 * Runtime settings lưu `google_base_url` với đuôi `/openai` (dùng cho vision
 * sidecar qua shim OpenAI), nhưng `@ai-sdk/google` nói API riêng, trỏ vào
 * shim là 404. Cùng logic với `baseUrlChoGoogle` trong `llm-provider.ts` nhưng
 * ở đây base URL LUÔN LÀ của Google nên không cần kiểm tra hostname.
 */
function googleBaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const clean = raw.trim().replace(/\/+$/, "").replace(/\/openai$/i, "");
  return clean || undefined;
}

export type BackupModel = {
  model: LanguageModel;
  providerOptions: ReturnType<typeof reasoningProviderOptions>;
  label: string; // cho log
};

/**
 * Trả model backup Google Gemini nếu đã cấu hình, null nếu không.
 *
 * Gọi mỗi khi router trả rỗng liên tiếp - đọc lại settings mỗi lần để đổi
 * key từ dashboard có hiệu lực ngay, không cần restart.
 */
export function getBackupModel(
  thread?: { accountId: string; threadId: string; contextEpoch?: number },
  effort?: ReasoningEffort,
): BackupModel | null {
  const settings = getGoogleSettings();
  if (!isGoogleConfigured(settings)) {
    log.warn("Không có cấu hình Google backup - bỏ qua");
    return null;
  }

  const sessionHeaders = thread
    ? cacheSessionHeaders(
        getTuning("LLM_CACHE_SESSION_ENABLED"),
        thread.accountId,
        thread.threadId,
        thread.contextEpoch ?? 0,
      )
    : {};

  const baseUrl = googleBaseUrl(settings.baseUrl);

  const provider = createGoogleGenerativeAI({
    apiKey: settings.apiKey,
    headers: sessionHeaders,
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  });

  const resolvedEffort = effort ?? getTuning("LLM_REASONING_EFFORT");

  return {
    model: provider(settings.model),
    providerOptions: reasoningProviderOptions("google", resolvedEffort),
    label: `google/${settings.model}`,
  };
}

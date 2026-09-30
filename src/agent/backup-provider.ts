/**
 * Model BACKUP khi router chính trả completion rỗng liên tiếp.
 *
 * Đọc cấu hình bổ sung (google_base_url, google_model, google_api_key) từ
 * runtime_settings - cùng nguồn mà vision sidecar dùng. Trả `LanguageModel`
 * nếu có đủ config, `null` nếu chưa cấu hình.
 *
 * Hỗ trợ 2 chế độ:
 * - **OpenAI-compatible** (Cashop, 9Router...): khi base URL KHÔNG phải
 *   googleapis.com → dùng `createOpenAICompatible` + Bearer auth.
 * - **Google native**: khi base URL là googleapis.com hoặc rỗng → dùng
 *   `createGoogleGenerativeAI` + API key trực tiếp.
 *
 * KHÔNG gộp vào `llm-provider.ts`: module đó là đường ĐI CHÍNH (mỗi lượt đều
 * gọi), còn đây là đường CỨU NGUY (chỉ chạy khi router hỏng). Gộp lại là pha
 * hai mối quan tâm và test phải mock cả hai đường cùng lúc.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { getGoogleSettings, isGoogleConfigured } from "../config/runtime-google-settings.js";
import { cacheSessionHeaders } from "./cache-session-id.js";
import {
  reasoningProviderOptions,
  ROUTER_PROVIDER_OPTIONS_KEY,
  type ReasoningEffort,
} from "./reasoning-options.js";
import { getTuning } from "../config/runtime-tuning-settings.js";
import { createLogger } from "../shared/logger.js";

const log = createLogger("backup-provider");

/** Kiểm tra base URL có phải Google trực tiếp không */
function isGoogleDirect(baseUrl: string | undefined): boolean {
  if (!baseUrl) return true; // mặc định = Google
  return /googleapis\.com/i.test(baseUrl);
}

/**
 * Base URL cho provider Google native: gỡ đuôi `/openai` nếu có.
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
 * Trả model backup nếu đã cấu hình, null nếu không.
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
    log.warn("Không có cấu hình backup - bỏ qua");
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

  const resolvedEffort = effort ?? getTuning("LLM_REASONING_EFFORT");
  const useProxy = !isGoogleDirect(settings.baseUrl);

  if (useProxy) {
    // ── OpenAI-compatible proxy (Cashop, 9Router...) ──────────────
    const baseUrl = settings.baseUrl.trim().replace(/\/+$/, "");
    const provider = createOpenAICompatible({
      name: ROUTER_PROVIDER_OPTIONS_KEY,
      baseURL: baseUrl,
      apiKey: settings.apiKey,
      headers: sessionHeaders,
    });
    log.info({ baseUrl, model: settings.model }, "Backup dùng proxy OpenAI-compatible");
    return {
      model: provider.chatModel(settings.model),
      providerOptions: reasoningProviderOptions("openai-compatible", resolvedEffort),
      label: `backup-proxy/${settings.model}`,
    };
  }

  // ── Google native (googleapis.com) ─────────────────────────────
  const baseUrl = googleBaseUrl(settings.baseUrl);
  const provider = createGoogleGenerativeAI({
    apiKey: settings.apiKey,
    headers: sessionHeaders,
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  });

  return {
    model: provider(settings.model),
    providerOptions: reasoningProviderOptions("google", resolvedEffort),
    label: `google/${settings.model}`,
  };
}

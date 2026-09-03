import { updateLlmSettings, getEffectiveLlmSettings } from "../src/config/runtime-llm-settings.js";
import { resolveLanguageModel } from "../src/agent/llm-provider.js";
import { streamText } from "ai";
import { chayStream } from "../src/agent/stream-text-result.js";
import type { LlmProviderKind } from "../src/config/llm-provider-kind.js";

async function main() {
  const provider = process.env.LLM_PROVIDER;
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  const apiKey = process.env.LLM_API_KEY;

  if (!provider || !model || !apiKey || (provider === "openai-compatible" && !baseUrl)) {
    throw new Error(
      "Thiếu cấu hình. Đặt LLM_PROVIDER, LLM_MODEL, LLM_API_KEY và LLM_BASE_URL nếu dùng openai-compatible.",
    );
  }

  console.log("Cấu hình model mới vào runtime_settings...");
  updateLlmSettings({ provider: provider as LlmProviderKind, baseUrl, model, apiKey });

  const effective = getEffectiveLlmSettings();
  console.log("Cấu hình hiệu lực:", {
    provider: effective.provider,
    baseUrl: effective.baseUrl,
    model: effective.model,
    hasOverride: effective.hasOverride,
  });

  console.log("Đang kiểm tra kết nối gọi model...");
  try {
    const model = resolveLanguageModel();
    const result = await chayStream((onError) =>
      streamText({
        model,
        prompt: "Xin chào, hãy giới thiệu ngắn gọn trong 1 câu.",
        maxOutputTokens: 100,
        onError,
      }),
    );
    console.log("KẾT NỐI MODEL THÀNH CÔNG!");
    console.log("Phản hồi từ model:", result.text);
  } catch (err) {
    console.error("LỖI KẾT NỐI MODEL:", err);
  }
}

main().catch(console.error);

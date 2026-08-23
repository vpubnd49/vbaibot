import { updateLlmSettings, getEffectiveLlmSettings } from "../src/config/runtime-llm-settings.js";

updateLlmSettings({
  provider: "openai-compatible",
  baseUrl: "https://9router.flowgiare.com/v1",
  model: "gemini-3.7-flash-high",
  apiKey: "sk-906c221b9f63be63-u7zpys-6ab593e0",
});

const result = getEffectiveLlmSettings();

console.log("Cấu hình LLM đã được cập nhật thành công:", {
  provider: result.provider,
  baseUrl: result.baseUrl,
  model: result.model,
  hasApiKey: Boolean(result.apiKey),
});

import { updateLlmSettings, getEffectiveLlmSettings } from "../src/config/runtime-llm-settings.js";
import { resolveLanguageModel } from "../src/agent/llm-provider.js";
import { streamText } from "ai";
import { chayStream } from "../src/agent/stream-text-result.js";

async function main() {
  console.log("Cấu hình model mới...");
  updateLlmSettings({
    provider: "openai-compatible",
    baseUrl: "https://9router.flowgiare.com/v1",
    model: "gemini-3.7-flash-high",
    apiKey: "sk-906c221b9f63be63-u7zpys-6ab593e0",
  });

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

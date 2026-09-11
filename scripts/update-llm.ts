import { updateLlmSettings, getEffectiveLlmSettings } from "../src/config/runtime-llm-settings.js";
import { updateVisionSettings, getVisionSettings } from "../src/config/runtime-vision-settings.js";
import { updateGoogleSettings, getGoogleSettings } from "../src/config/runtime-google-settings.js";
import { resolveLanguageModel } from "../src/agent/llm-provider.js";
import { streamText } from "ai";
import { chayStream } from "../src/agent/stream-text-result.js";

async function main() {
  const mainProvider = process.env.LLM_PROVIDER || "openai-compatible";
  const mainBaseUrl = process.env.LLM_BASE_URL || "https://9router.flowgiare.com/v1";
  const mainModel = process.env.LLM_MODEL || "omni/antigravity/gemini-3.8-flash-high";
  const mainApiKey = process.env.LLM_API_KEY || "";

  const googleBaseUrl = process.env.GOOGLE_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai";
  const googleModel = process.env.GOOGLE_MODEL || "gemini-2.5-flash";
  const googleApiKey = process.env.GOOGLE_API_KEY || "";

  console.log("1. Cấu hình LLM CHAT CHÍNH (9Router)...");
  updateLlmSettings({
    provider: mainProvider as "openai-compatible",
    baseUrl: mainBaseUrl,
    model: mainModel,
    apiKey: mainApiKey,
  });

  console.log("2. Cấu hình GOOGLE GEMINI BỔ SUNG (STT & OCR/Vision)...");
  updateGoogleSettings({
    baseUrl: googleBaseUrl,
    model: googleModel,
    apiKey: googleApiKey,
  });

  console.log("3. Cấu hình VISION SIDECAR (Gemini 2.5 Flash)...");
  updateVisionSettings({
    mode: "auto",
    sidecarBaseUrl: googleBaseUrl,
    sidecarModel: googleModel,
    sidecarApiKey: googleApiKey,
  });

  const effective = getEffectiveLlmSettings();
  console.log("Cấu hình Chat hiệu lực:", {
    provider: effective.provider,
    baseUrl: effective.baseUrl,
    model: effective.model,
    hasOverride: effective.hasOverride,
  });
  console.log("Cấu hình Google bổ sung:", getGoogleSettings());
  console.log("Cấu hình Vision Sidecar:", getVisionSettings());

  console.log("Đang kiểm tra kết nối gọi model chat chính...");
  try {
    const model = resolveLanguageModel();
    const result = await chayStream((onError) =>
      streamText({
        model,
        prompt: "Xin chào, hãy trả lời '9router kết nối tốt' trong 1 câu ngắn.",
        maxOutputTokens: 100,
        onError,
      }),
    );
    console.log("KẾT NỐI CHAT CHÍNH THÀNH CÔNG!");
    console.log("Phản hồi:", result.text);
  } catch (err) {
    console.error("LỖI KẾT NỐI CHAT CHÍNH:", err);
  }
}

main().catch(console.error);

import { updateImageSettings, isImageGenConfigured } from "../src/config/runtime-image-settings.js";

const settings = updateImageSettings({
  baseUrl: "https://9router.flowgiare.com/v1",
  model: "cx/gpt-5.5-image",
  apiKey: "sk-906c221b9f63be63-u7zpys-6ab593e0",
});

console.log("Image Gen Settings:", {
  baseUrl: settings.baseUrl,
  model: settings.model,
  configured: isImageGenConfigured(settings),
});
console.log("✅ Image generation configured successfully!");

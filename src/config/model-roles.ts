/** Model cố định theo nghiệp vụ, tránh dùng chung model giữa OCR và bóc băng. */
export const DOCUMENT_EXTRACTION_MODEL = "omni/antigravity/gemini-3.8-flash-high";
export const AUDIO_TRANSCRIPTION_MODEL = "gemini-2.5-flash";

/**
 * Endpoint riêng cho vision (đọc ảnh / OCR tài liệu).
 * Tách hoàn toàn khỏi main LLM và audio transcription.
 * Model omni/antigravity/gemini-3.8-flash-high chỉ có tại endpoint này.
 */
export const VISION_ENDPOINT = {
  baseUrl: "https://9router.flowgiare.com/v1",
  apiKey: "sk-906c221b9f63be63-u7zpys-6ab593e0",
  model: DOCUMENT_EXTRACTION_MODEL,
} as const;

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { getVisionSettings } from "../config/runtime-vision-settings.js";
import { getEffectiveLlmSettings } from "../config/runtime-llm-settings.js";
import { chayStream } from "../agent/stream-text-result.js";

export type SheetMusicInfo = {
  title?: string;
  composer?: string;
  timeSignature?: string;
  tempoMood?: string;
  lyrics?: string;
  styleTags?: string;
};

export async function parseSheetMusic(image: { base64: string; mediaType: string }): Promise<SheetMusicInfo> {
  const vision = getVisionSettings();
  const llm = getEffectiveLlmSettings();

  const baseUrl = vision.sidecar.baseUrl || llm.baseUrl;
  const apiKey = vision.sidecar.apiKey || llm.apiKey;
  const modelName = vision.sidecar.model || llm.model;

  if (!baseUrl || !apiKey || !modelName) {
    throw new Error("Chưa cấu hình API key/Base URL/Model để đọc ảnh.");
  }

  const provider = createOpenAICompatible({
    name: "sheet-music-parser",
    baseURL: baseUrl,
    apiKey: apiKey,
  });

  const model = provider(modelName);

  const prompt = `Bạn là một chuyên gia phân tích bản phổ nhạc (sheet music). Hãy đọc bản phổ trong ảnh và trích xuất các thông tin sau:
1. Tiêu đề bài hát (Title)
2. Tác giả/Nhạc sĩ (Composer)
3. Nhịp điệu (Time Signature, ví dụ: 2/4, 3/4, 4/4...)
4. Tốc độ/Sắc thái (Tempo/Mood, ví dụ: Vừa phải, Hào hứng, Chậm buồn...)
5. Toàn bộ lời bài hát (Lyrics): chép lại chính xác lời ca, phân chia thành các đoạn bằng thẻ [Verse 1], [Chorus], [Verse 2]... nếu nhận diện được cấu trúc.
6. Gợi ý phong cách âm nhạc (Style tags): Dựa trên sắc thái bài hát, gợi ý các từ khóa phong cách bằng tiếng Anh (ví dụ: Vietnamese pop, energetic, piano, acoustic guitar...).

Trả về kết quả dưới định dạng JSON với các trường:
{
  "title": "...",
  "composer": "...",
  "timeSignature": "...",
  "tempoMood": "...",
  "lyrics": "...",
  "styleTags": "..."
}`;

  const result = await chayStream(
    (onError) =>
      streamText({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image", image: `data:${image.mediaType};base64,${image.base64}` },
            ],
          },
        ],
        onError,
      })
  );

  try {
    const text = result.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(text) as SheetMusicInfo;
    return parsed;
  } catch (err) {
    throw new Error("Không thể phân tích kết quả từ model. " + String(err));
  }
}

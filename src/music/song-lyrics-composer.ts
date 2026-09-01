import { resolveLanguageModel } from "../agent/llm-provider.js";
import { streamText } from "ai";
import { chayStream } from "../agent/stream-text-result.js";

export type ComposeLyricsParams = {
  topic: string;
  style?: string;
  mood?: string;
  singerGender?: string;
};

export type ComposedSong = {
  title: string;
  lyrics: string;
  styleTags: string;
};

export async function composeSongLyrics(params: ComposeLyricsParams): Promise<ComposedSong> {
  const model = resolveLanguageModel();

  const prompt = `Bạn là một nhạc sĩ Việt Nam tài ba. Hãy sáng tác lời cho một bài hát mới dựa trên yêu cầu sau:
Chủ đề/Ý tưởng: ${params.topic}
Thể loại âm nhạc (tùy chọn): ${params.style || "Pop"}
Tâm trạng (tùy chọn): ${params.mood || "Tự do"}
Giọng ca mong muốn: ${params.singerGender || "Bất kỳ"}

Hãy viết lời bài hát thật vần điệu, có nhịp điệu rõ ràng, giàu cảm xúc.
QUY TẮC BẮT BUỘC:
- Chỉ viết nội dung lời bài hát; không viết lời giới thiệu, lời dẫn, lời giải thích hay chỉ dẫn sân khấu.
- [Intro] và [Outro] phải để trống hoàn toàn: đây là nhạc dạo/nhạc kết không lời.
- Sau [Intro], vào câu hát đầu tiên tự nhiên; không spoken word, narration, voice-over.
- Chỉ dùng các thẻ [Verse 1], [Chorus], [Verse 2], [Bridge] để phân đoạn; không hát các thẻ.
- Không thêm "yeah", "oh", "ah", "la la", adlibs, vocalise, chant hoặc bất kỳ âm tiết/vocal nào ngoài lời bài hát.
- Lyrics phải là phần duy nhất được hát; không thêm, sửa, lặp hoặc cắt lời.
Cấu trúc lời bài hát PHẢI được đánh dấu rõ ràng bằng các thẻ:
[Intro]
[Verse 1]
[Chorus]
[Verse 2]
[Chorus]
[Bridge]
[Outro]

Sau khi viết lời, hãy gợi ý các từ khóa phong cách âm nhạc bằng tiếng Anh (styleTags) phù hợp với bài hát để đưa vào engine tạo nhạc (ví dụ: Vietnamese pop ballad, emotional, male vocal, acoustic piano...).

Trả về duy nhất định dạng JSON với các trường:
{
  "title": "Tên bài hát",
  "lyrics": "Toàn bộ lời bài hát với các thẻ cấu trúc...",
  "styleTags": "Từ khóa phong cách bằng tiếng Anh..."
}`;

  const result = await chayStream((onError) =>
    streamText({
      model,
      prompt,
      onError,
    })
  );

  try {
    const text = result.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(text) as ComposedSong;
    return parsed;
  } catch (err) {
    throw new Error("Không thể phân tích kết quả sáng tác từ model. " + String(err));
  }
}

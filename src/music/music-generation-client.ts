import { getMusicSettings, isMusicGenConfigured } from "../config/runtime-music-settings.js";
import { getTuning } from "../config/runtime-tuning-settings.js";

export type GenerateMusicParams = {
  prompt: string;
  title?: string;
  lyrics?: string;
  styleTags?: string;
  durationSec?: number;
  instrumental?: boolean;
  vocalType?: "nam" | "nu" | "song_ca" | "top_ca";
};

export type GeneratedMusic = {
  data: Buffer;
  ext: "mp3";
};

export async function generateMusic(
  params: GenerateMusicParams,
  settings = getMusicSettings(),
  fetchImpl = fetch
): Promise<GeneratedMusic> {
  if (!isMusicGenConfigured(settings)) {
    throw new Error("Chưa cấu hình API key cho tính năng tạo nhạc");
  }

  const { apiKey, model } = settings;
  const timeoutMs = getTuning("MUSIC_GEN_TIMEOUT_MS");
  
  let finalPrompt = params.prompt;
  if (params.title) {
    finalPrompt += `\nTitle: ${params.title}`;
  }
  if (params.styleTags) {
    finalPrompt += `\nStyle: ${params.styleTags}`;
  }
  if (params.vocalType) {
    let voice = params.vocalType === "nam" ? "Male vocal" : 
                params.vocalType === "nu" ? "Female vocal" : 
                params.vocalType === "song_ca" ? "Duet vocals" : "Choir vocals";
    finalPrompt += `\nVocals: ${voice}`;
  }
  if (params.instrumental) {
    finalPrompt = `[Instrumental] ${finalPrompt}`;
  } else if (params.lyrics) {
    finalPrompt += `\n\nLyrics:\n${params.lyrics}`;
  }

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: finalPrompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      throw new Error(`Tạo nhạc quá lâu (hơn ${Math.round(timeoutMs / 1000)} giây) nên đã dừng`);
    }
    throw err;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Lỗi gọi API tạo nhạc: ${response.status} ${response.statusText} ${text}`);
  }

  const result = await response.json() as any;
  const parts = result.candidates?.[0]?.content?.parts;
  if (!parts || !Array.isArray(parts)) {
    throw new Error("Phản hồi từ API không chứa nội dung hợp lệ");
  }

  const inlineData = parts.find((p: any) => p.inlineData)?.inlineData;
  if (!inlineData || !inlineData.data) {
    throw new Error("Không tìm thấy dữ liệu âm thanh trong phản hồi");
  }

  return {
    data: Buffer.from(inlineData.data, "base64"),
    ext: "mp3",
  };
}

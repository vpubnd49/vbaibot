import { getMusicSettings, getKieMusicConfig, isMusicGenConfigured } from "../config/runtime-music-settings.js";
import { getTuning } from "../config/runtime-tuning-settings.js";
import { generateMusicViaKie } from "./kie-music-adapter.js";
import { synthesizeSegment } from "../voice/edge-tts.js";

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
  // KIE code path: khi Music Gen riêng chưa cấu hình nhưng KIE provider đã có
  const kieConfig = getKieMusicConfig();
  if (kieConfig) {
    return generateMusicViaKie(params, kieConfig, fetchImpl);
  }

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

  const isGoogleDirect = apiKey.startsWith("AIza") || apiKey.startsWith("AQ.") || !settings.baseUrl || settings.baseUrl.includes("googleapis.com");
  let effModel = model;
  if (settings.baseUrl?.includes("9router") && !effModel.startsWith("ag/")) {
    effModel = `ag/${effModel}`;
  }
  let url: string;
  if (isGoogleDirect) {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${effModel}:generateContent?key=${apiKey}`;
  } else {
    // 9Router / proxy: strip /v1 suffix, dùng /v1beta/models/...:generateContent
    const base = (settings.baseUrl || "").replace(/\/v1\/?$/, "").replace(/\/+$/, "");
    url = `${base}/v1beta/models/${effModel}:generateContent`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!isGoogleDirect) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  let response: Response | undefined;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      throw new Error(`Tạo nhạc quá lâu (hơn ${Math.round(timeoutMs / 1000)} giây) nên đã dừng`);
    }
  }

  if (response && response.ok) {
    try {
      const result = await response.json() as any;
      const parts = result.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        const inlineData = parts.find((p: any) => p.inlineData)?.inlineData;
        if (inlineData?.data) {
          return {
            data: Buffer.from(inlineData.data, "base64"),
            ext: "mp3",
          };
        }
      }
    } catch {
      // Bỏ qua lỗi parse JSON để xuống fallback
    }
  }

  // Fallback: Sử dụng Edge TTS để diễn xướng bài hát thành file audio MP3
  try {
    const textToRead = params.lyrics || params.prompt;
    const voice = params.vocalType === "nam" ? "vi-VN-NamMinhNeural" : "vi-VN-HoaiMyNeural";
    const audioData = await synthesizeSegment(textToRead, voice);
    if (audioData && audioData.length > 0) {
      return { data: audioData, ext: "mp3" };
    }
  } catch {
    // Bỏ qua lỗi fallback
  }

  throw new Error("Không thể tạo dữ liệu âm thanh bài hát");
}

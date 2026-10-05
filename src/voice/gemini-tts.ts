import { createLogger } from '../shared/logger.js';
import { wrapPcmInWav } from './pcm-to-wav.js';

const log = createLogger('gemini-tts');

export type TtsVoice = {
  speakerAlias: string;  // VD: "Anh" hoặc "Chị"
  speakerId: string;     // Tên voice của Gemini VD: "Charon", "Aoede"
};

export type TtsParams = {
  script: string;        // Kịch bản đa người nói với nhãn speaker
  voices: TtsVoice[];    // Ánh xạ giữa alias trong kịch bản và speakerId
  apiKey: string;
  model?: string;        // default: "gemini-2.5-flash-preview-tts"
  baseUrl?: string;      // URL proxy (9Router) — nếu không set thì dùng Google trực tiếp
};

/**
 * Phát hiện key có phải Google trực tiếp không.
 */
function isGoogleDirect(apiKey: string, baseUrl?: string): boolean {
  if (apiKey.startsWith("AIza") || apiKey.startsWith("AQ.")) return true;
  if (!baseUrl) return true;
  if (baseUrl.includes("googleapis.com")) return true;
  return false;
}

/**
 * Gọi REST API của Gemini để sinh giọng đọc đa người nói và trả về WAV Buffer.
 * Hỗ trợ cả Google trực tiếp (key=AIza...) và proxy/9Router (Bearer sk-...).
 */
export async function generateMultiSpeakerAudio(params: TtsParams): Promise<Buffer> {
  const { 
    script, 
    voices, 
    apiKey, 
    model = 'gemini-2.5-flash-preview-tts',
    baseUrl,
  } = params;
  
  const googleDirect = isGoogleDirect(apiKey, baseUrl);

  // Xây URL: Google trực tiếp dùng ?key=, proxy dùng Bearer
  let endpoint: string;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (googleDirect) {
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  } else {
    // 9Router / proxy: strip /v1 suffix, thêm /v1beta/models/...:generateContent
    const base = (baseUrl || "").replace(/\/v1\/?$/, "").replace(/\/$/, "");
    endpoint = `${base}/v1beta/models/${model}:generateContent`;
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: script }]
      }
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: voices
          }
        }
      }
    }
  };

  try {
    log.info({ model, speakers: voices.length, proxy: !googleDirect }, 'Bắt đầu gọi Gemini TTS API cho audio đa người nói');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error({ status: response.status, errorText }, 'Lỗi API từ Gemini TTS');
      throw new Error(`Gemini API lỗi: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as any;
    
    // Trích xuất dữ liệu base64 âm thanh từ kết quả trả về
    const parts = data.candidates?.[0]?.content?.parts || [];
    const inlineData = parts.find((p: any) => p.inlineData)?.inlineData;
    
    if (!inlineData || !inlineData.data) {
      throw new Error('Không tìm thấy dữ liệu âm thanh hợp lệ trong phản hồi của Gemini');
    }
    
    const pcmBuffer = Buffer.from(inlineData.data, 'base64');
    log.info({ size: pcmBuffer.length }, 'Đã nhận dữ liệu PCM âm thanh, tiến hành bọc WAV');
    
    // Sử dụng tiện ích bọc PCM header thành WAV
    return wrapPcmInWav(pcmBuffer);
  } catch (error) {
    log.error({ error }, 'Lỗi hệ thống khi sinh giọng đọc (TTS)');
    throw error;
  }
}


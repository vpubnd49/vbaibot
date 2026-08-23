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
};

/**
 * Gọi REST API của Gemini để sinh giọng đọc đa người nói và trả về WAV Buffer
 */
export async function generateMultiSpeakerAudio(params: TtsParams): Promise<Buffer> {
  const { 
    script, 
    voices, 
    apiKey, 
    model = 'gemini-2.5-flash-preview-tts'
  } = params;
  
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
    log.info({ model, speakers: voices.length }, 'Bắt đầu gọi Gemini TTS API cho audio đa người nói');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

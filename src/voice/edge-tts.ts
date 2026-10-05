import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { createLogger } from "../shared/logger.js";

const log = createLogger("edge-tts");

export type EdgeTtsParams = {
  script: string;
  maleVoice?: string;   // default: "vi-VN-NamMinhNeural"
  femaleVoice?: string; // default: "vi-VN-HoaiMyNeural"
  hostMaleName?: string;   // default: "Anh"
  hostFemaleName?: string; // default: "Chị"
};

/**
 * Sinh giọng đọc cho 1 đoạn text bằng Edge TTS.
 */
async function synthesizeSegment(text: string, voiceName: string): Promise<Buffer> {
  const cleanText = text
    .replace(/\[pause\]/gi, " ... ")
    .replace(/\[emphasis\]/gi, "")
    .replace(/\[whispers?\]/gi, "")
    .trim();

  if (!cleanText) return Buffer.alloc(0);

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(cleanText);
  const chunks: Buffer[] = [];

  audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));

  await new Promise<void>((resolve, reject) => {
    audioStream.on("end", () => resolve());
    audioStream.on("error", reject);
  });

  tts.close();
  return Buffer.concat(chunks);
}

/**
 * Sinh audio podcast đa người nói (Nam Minh & Hoài My - giọng Bắc chuẩn).
 * Tách từng dòng kịch bản "Anh: ..." và "Chị: ..." để tổng hợp thành 1 file MP3 hoàn chỉnh.
 */
export async function generateMultiSpeakerAudioEdge(params: EdgeTtsParams): Promise<Buffer> {
  const {
    script,
    maleVoice = "vi-VN-NamMinhNeural",
    femaleVoice = "vi-VN-HoaiMyNeural",
    hostMaleName = "Anh",
    hostFemaleName = "Chị",
  } = params;

  log.info({ maleVoice, femaleVoice }, "Bắt đầu sinh audio podcast qua Edge TTS Neural");

  const lines = script
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const segmentTasks = lines.map(async (line) => {
    let speaker = hostMaleName;
    let dialogue = line;

    // Nhận diện người nói ở đầu dòng (vd: "Anh: ...", "Chị: ...", "Nam: ...")
    const match = line.match(/^([A-Za-zÀ-ỹ\s]+)[:：]\s*(.*)$/);
    if (match) {
      speaker = match[1]!.trim();
      dialogue = match[2]!.trim();
    }

    if (!dialogue) return Buffer.alloc(0);

    const isFemale =
      speaker.toLowerCase().includes(hostFemaleName.toLowerCase()) ||
      speaker.toLowerCase().includes("chị") ||
      speaker.toLowerCase().includes("nữ") ||
      speaker.toLowerCase().includes("lan") ||
      speaker.toLowerCase().includes("hoa");

    const voice = isFemale ? femaleVoice : maleVoice;

    try {
      return await synthesizeSegment(dialogue, voice);
    } catch (err) {
      log.warn({ err, dialogue: dialogue.slice(0, 40) }, "Lỗi khi sinh audio phân đoạn, bỏ qua");
      return Buffer.alloc(0);
    }
  });

  const audioChunks = (await Promise.all(segmentTasks)).filter((buf) => buf.length > 0);

  if (audioChunks.length === 0) {
    log.info("Không tách được phân đoạn, đọc toàn bộ script bằng giọng chính");
    return await synthesizeSegment(script, maleVoice);
  }

  const combined = Buffer.concat(audioChunks);
  log.info({ totalBytes: combined.length }, "Đã hoàn thành sinh audio podcast Edge TTS");
  return combined;
}

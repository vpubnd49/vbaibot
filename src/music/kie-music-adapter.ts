/**
 * Adapter KIE cho Suno v5.5 — chuyển GenerateMusicParams thành KIE music task.
 */

import type { GenerateMusicParams, GeneratedMusic } from "./music-generation-client.js";
import { createKieMusicTask, pollKieMusicUntilDone, downloadKieMusicResult, type KieMusicSettings } from "../shared/kie-music-client.js";
import { resolveMusicModelId } from "../shared/kie-model-map.js";
import { getTuning } from "../config/runtime-tuning-settings.js";
import { createLogger } from "../shared/logger.js";

const log = createLogger("kie-music-adapter");

export type KieMusicConfig = KieMusicSettings & {
  model: string;
};

export async function generateMusicViaKie(
  params: GenerateMusicParams,
  config: KieMusicConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<GeneratedMusic> {
  const modelId = resolveMusicModelId(config.model);

  // Map vocalType sang style mô tả
  let style = params.styleTags ?? "";
  if (params.vocalType) {
    const voiceMap: Record<string, string> = {
      nam: "Male vocal",
      nu: "Female vocal",
      song_ca: "Duet vocals",
      top_ca: "Choir vocals",
    };
    style = style ? `${style}, ${voiceMap[params.vocalType] ?? ""}` : (voiceMap[params.vocalType] ?? "");
  }

  // Xác định customMode từ có lyrics hay không
  const hasLyrics = Boolean(params.lyrics);
  const isInstrumental = params.instrumental ?? false;

  const timeoutMs = getTuning("MUSIC_GEN_TIMEOUT_MS");

  log.info({ model: modelId, instrumental: isInstrumental, customMode: hasLyrics }, "Bắt đầu tạo nhạc qua KIE");

  const taskId = await createKieMusicTask(
    { baseUrl: config.baseUrl, apiKey: config.apiKey },
    {
       model: modelId,
       prompt: `${params.prompt}\n\nChỉ hát đúng 100% lyrics được cung cấp. Không thêm, sửa, lặp, cắt hoặc đảo lời. Intro chỉ instrumental, không hát/nói; vào câu đầu tự nhiên. Cấm spoken word, narration, voice-over, adlibs, vocalise, chant và mọi vocal ngoài lyrics. Sau câu cuối chỉ nhạc instrumental rồi fade out.`,
       title: params.title,
       style: style || undefined,
       lyrics: params.lyrics,
       customMode: hasLyrics,
      instrumental: isInstrumental,
      // Suno/KIE yêu cầu callbackUrl khi tạo task, dù kết quả vẫn được polling.
      callBackUrl: "https://vbaibot.chauphienbanso.com/api/kie-callback",
    },
    fetchImpl,
  );

  const result = await pollKieMusicUntilDone(
    { baseUrl: config.baseUrl, apiKey: config.apiKey },
    taskId,
    timeoutMs,
    fetchImpl,
  );

  if (result.audioUrls.length === 0) {
    throw new Error(`KIE tạo nhạc thất bại: ${result.failMsg ?? "không có file nhạc kết quả"}`);
  }

  const audioUrl = result.audioUrls[0]!;
  const data = await downloadKieMusicResult(audioUrl, fetchImpl);

  log.info({ taskId, kb: Math.round(data.length / 1024) }, "Đã tải nhạc KIE");

  return { data, ext: "mp3" };
}

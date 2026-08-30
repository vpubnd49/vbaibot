import { createHourlyRateLimit } from "../shared/hourly-rate-limit.js";
import { getTuning } from "../config/runtime-tuning-settings.js";

const limiter = createHourlyRateLimit({
  limit: () => getTuning("MUSIC_GEN_MAX_PER_HOUR") as number,
  buildReason: ({ used, limit, waitMinutes }) =>
    `Đã tạo ${used} bài nhạc trong 1 giờ qua (trần ${limit}). Thử lại sau khoảng ${waitMinutes} phút.`,
});

export const checkMusicRateLimit = limiter.check;
export const resetMusicRateLimit = limiter.reset;

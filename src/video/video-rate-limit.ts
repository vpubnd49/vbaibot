import { createHourlyRateLimit } from "../shared/hourly-rate-limit.js";
import { getTuning } from "../config/runtime-tuning-settings.js";

const limiter = createHourlyRateLimit({
  limit: () => getTuning("VIDEO_GEN_MAX_PER_HOUR"),
  buildReason: ({ used, limit, waitMinutes }) =>
    `Đã tạo ${used} video trong 1 giờ qua (trần ${limit}). Thử lại sau khoảng ${waitMinutes} phút.`,
});

export const checkVideoRateLimit = limiter.check;
export const resetVideoRateLimit = limiter.reset;

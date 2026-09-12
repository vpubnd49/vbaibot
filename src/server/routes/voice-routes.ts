import { Hono } from "hono";
import path from "node:path";
import fs from "node:fs";
import { dataDir } from "../../config/env.js";

/**
 * Route phục vụ file audio cho `api.sendVoice()` của zca-js.
 *
 * `sendVoice` cần URL công khai trỏ đến file .wav/.m4a — route này serve
 * file từ `data/media/voice/` qua HTTP. Bot chạy trên VPS có domain/IP công
 * khai thì Zalo server tự tải file từ đây.
 *
 * Route nằm NGOÀI auth middleware (`/api/*`) — file audio phải public vì Zalo
 * server là bên tải, không có cookie dashboard. An toàn vì filename có random
 * suffix không đoán được, và file tự dọn sau 7 ngày.
 */
export const voiceRoutes = new Hono();

/** accountId đi thẳng vào đường dẫn nên phải chặn cả `..` lẫn ký tự phân cách */
const ACCOUNT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

voiceRoutes.get("/:accountId/:filename", (c) => {
  const { accountId, filename } = c.req.param();

  // Chống path traversal: chỉ cho phép tên file đơn giản
  const safeName = path.basename(filename);
  if (safeName !== filename || !safeName.startsWith("voice_") || !ACCOUNT_ID_PATTERN.test(accountId)) {
    return c.json({ error: "Tên file không hợp lệ" }, 400);
  }

  const filePath = path.join(dataDir, "media", "voice", accountId, safeName);
  if (!fs.existsSync(filePath)) {
    return c.json({ error: "File không tồn tại" }, 404);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(safeName).toLowerCase();
  const contentType =
    ext === ".wav" ? "audio/wav" :
    ext === ".mp3" ? "audio/mpeg" :
    ext === ".m4a" ? "audio/mp4" :
    "application/octet-stream";

  return c.body(fileBuffer, 200, {
    "Content-Type": contentType,
    "Content-Length": String(fileBuffer.length),
    // Audio URL hoạt động như bearer token; không để proxy/cache trung gian giữ
    // lại nội dung hội thoại lâu hơn cần thiết.
    "Cache-Control": "private, no-store",
  });
});

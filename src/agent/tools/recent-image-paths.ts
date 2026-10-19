/** Gom ảnh gần đây trong hội thoại + chạy song song có giới hạn (tách từ read-image-tool.ts). */
import { getRecentMessages } from "../../conversation/history-store.js";
import type { ToolContext } from "./index.js";

/**
 * Trần số ảnh gần đây agent chọn được qua imageIndex. Chính sách tự đặt: đủ
 * rộng cho "ảnh thứ 3 tính từ dưới lên", đủ hẹp để model không phải đếm mò
 * trong danh sách dài. Không đọc file nào cho tới khi model chọn nên trần này
 * không tốn gì.
 */
export const RECENT_IMAGE_LIMIT = 10;

/** Trần song song cho sidecar khi batch mode - cùng giá trị với agent-turn-content */
export const SIDECAR_CONCURRENCY = 3;

const IMAGE_FILE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"]);

function isImageFilePath(path?: string): boolean {
  if (!path) return false;
  const dotIndex = path.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const ext = path.slice(dotIndex).toLowerCase();
  return IMAGE_FILE_EXTENSIONS.has(ext);
}

function isSkippedImageFile(
  file: { fileName?: string; localPath?: string },
  hasDirectImages: boolean,
): boolean {
  const name = (file.fileName ?? "").trim();
  const lp = file.localPath ?? "";
  // Tránh nhân đôi: tin nhắn ảnh đã có trong `images` mà còn sinh thêm `file.jpg` trong `files`
  if (hasDirectImages && (name === "file.jpg" || /-file-\d+-file_jpg\./i.test(lp))) {
    return true;
  }
  // Tránh lấy nhầm ảnh của chính bot khi người dùng quote/reply lại tin nhắn chứa ảnh của bot
  // (Zalo biến caption dài của bot thành fileName của file quote)
  if (/^(dạ|vâng|em\s+đã|đã\s+vẽ|đã\s+tạo|đã\s+sửa|đã\s+ghép|gửi\s+anh|gửi\s+chị|đang\s+vẽ|đang\s+sửa)/i.test(name)) {
    return true;
  }
  if (name.split(/\s+/).length >= 8) {
    return true;
  }
  if (/-file-\d+-(Em____|D__em_|___v__|___t_o_|___ch_nh_s_a)/i.test(lp)) {
    return true;
  }
  return false;
}

/**
 * Gom đường dẫn ảnh MỚI NHẤT TRƯỚC: batch của lượt hiện tại (chưa vào DB)
 * rồi tới history. Hỗ trợ cả ảnh gửi trực tiếp (images) và ảnh gửi dạng file đính kèm/HD (files).
 * Xuất riêng để test không cần dựng tool.
 */
export function collectRecentImagePaths(ctx: ToolContext): string[] {
  const paths: string[] = [];
  const addPath = (p?: string) => {
    if (p && !paths.includes(p)) paths.push(p);
  };

  for (let i = (ctx.batch?.length ?? 0) - 1; i >= 0; i--) {
    const msg = ctx.batch[i]!;
    const hasDirect = (msg.images?.length ?? 0) > 0;
    for (const image of msg.images ?? []) {
      addPath(image.localPath);
    }
    for (const file of msg.files ?? []) {
      if ((isImageFilePath(file.localPath) || isImageFilePath(file.fileName)) && !isSkippedImageFile(file, hasDirect)) {
        addPath(file.localPath);
      }
    }
  }
  if (ctx.message) {
    const hasDirect = (ctx.message.images?.length ?? 0) > 0;
    for (const image of ctx.message.images ?? []) {
      addPath(image.localPath);
    }
    for (const file of ctx.message.files ?? []) {
      if ((isImageFilePath(file.localPath) || isImageFilePath(file.fileName)) && !isSkippedImageFile(file, hasDirect)) {
        addPath(file.localPath);
      }
    }
  }
  const history = getRecentMessages(ctx.account.id, ctx.message.threadId);
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i]!;
    const hasDirect = (msg.images?.length ?? 0) > 0;
    for (const img of msg.images ?? []) {
      addPath(img);
    }
    for (const file of msg.files ?? []) {
      if (file.localPath && isImageFilePath(file.localPath) && !isSkippedImageFile(file, hasDirect)) {
        addPath(file.localPath);
      }
    }
  }
  return paths.slice(0, RECENT_IMAGE_LIMIT);
}

/** Chạy mảng promise với giới hạn concurrency, GIỮ NGUYÊN thứ tự kết quả */
export async function withConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const run = async (): Promise<void> => {
    while (next < tasks.length) {
      const idx = next++;
      results[idx] = await tasks[idx]!();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => run()));
  return results;
}

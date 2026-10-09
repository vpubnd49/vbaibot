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

  for (let i = ctx.batch.length - 1; i >= 0; i--) {
    for (const image of ctx.batch[i]!.images) {
      addPath(image.localPath);
    }
    for (const file of ctx.batch[i]!.files ?? []) {
      if (isImageFilePath(file.localPath) || isImageFilePath(file.fileName)) {
        addPath(file.localPath);
      }
    }
  }
  const history = getRecentMessages(ctx.account.id, ctx.message.threadId);
  for (let i = history.length - 1; i >= 0; i--) {
    for (const img of history[i]!.images ?? []) {
      addPath(img);
    }
    for (const file of history[i]!.files ?? []) {
      if (file.localPath && isImageFilePath(file.localPath)) {
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

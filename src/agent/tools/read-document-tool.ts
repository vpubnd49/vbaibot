import fs from "node:fs";
import path from "node:path";
import { tool } from "ai";
import { createLogger } from "../../shared/logger.js";
import { z } from "zod";
import { dataDir } from "../../config/env.js";
import { getRecentMessages } from "../../conversation/history-store.js";
import type { ToolContext } from "./index.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { wrapUntrustedContent } from "./wrap-untrusted-content.js";
import { readDocument, isSupportedDocument } from "../../documents/document-reader.js";
import { originalNames, labelOf, listChoices, pickIndex } from "./recent-file-picker.js";
import { assertSafePathInside } from "../../shared/path-security-guard.js";
import { getTuning } from "../../config/runtime-tuning-settings.js";

/**
 * Trần số file gần đây agent chọn được qua fileIndex.
 * Để 300 để đủ cho batch OCR toàn bộ ảnh trong hội thoại (vd 57 ảnh điểm thi).
 */
const RECENT_FILE_LIMIT = 300;
const log = createLogger("read-document");

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_") || "x";
}

/**
 * Quét thư mục đĩa đệm data/media/<accountId>/<threadId>/ để lấy mọi file tài liệu
 * phòng trường hợp tin nhắn đã nhận trước khi cập nhật schema SQLite.
 */
function scanDiskMediaFiles(accountId: string, threadId: string): string[] {
  const dirPath = path.join(dataDir, "media", sanitizeSegment(accountId), sanitizeSegment(threadId));
  if (!fs.existsSync(dirPath)) return [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const docFiles: Array<{ relPath: string; mtime: number }> = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(dirPath, entry.name);
      if (isSupportedDocument(entry.name)) {
        const stats = fs.statSync(fullPath);
        const relPath = path.relative(dataDir, fullPath).replace(/\\/g, "/");
        docFiles.push({ relPath, mtime: stats.mtimeMs });
      }
    }

    docFiles.sort((a, b) => b.mtime - a.mtime);
    return docFiles.map((f) => f.relPath);
  } catch (err) {
    log.warn({ accountId, threadId, err }, "Không quét được thư mục file tài liệu gần đây");
    return [];
  }
}

/**
 * Gom đường dẫn file MỚI NHẤT TRƯỚC:
 * 1. Batch của lượt hiện tại
 * 2. Lịch sử SQLite
 * 3. Thư mục đĩa media/
 */
export function collectRecentFilePaths(ctx: ToolContext): string[] {
  const paths: string[] = [];

  // 1. Dùng ctx.batch
  for (let i = ctx.batch.length - 1; i >= 0; i--) {
    const msg = ctx.batch[i] as any;
    if (msg.files) {
      for (const file of msg.files) {
        if (file.localPath && isSupportedDocument(file.localPath) && !paths.includes(file.localPath)) {
          paths.push(file.localPath);
        }
      }
    }
    if (msg.images) {
      for (const img of msg.images) {
        const p = typeof img === "string" ? img : img?.localPath;
        if (p && isSupportedDocument(p) && !paths.includes(p)) {
          paths.push(p);
        }
      }
    }
  }

  // 2. Dùng SQLite History
  const history = getRecentMessages(ctx.account.id, ctx.message.threadId);
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i] as any;
    if (msg.files) {
      for (const file of msg.files) {
        if (file.localPath && isSupportedDocument(file.localPath) && !paths.includes(file.localPath)) {
          paths.push(file.localPath);
        }
      }
    }
    if (msg.images) {
      for (const img of msg.images) {
        const p = typeof img === "string" ? img : img?.localPath;
        if (p && isSupportedDocument(p) && !paths.includes(p)) {
          paths.push(p);
        }
      }
    }
  }

  // 3. Fallback: Quét đĩa media/ cho thread này
  const diskFiles = scanDiskMediaFiles(ctx.account.id, ctx.message.threadId);
  for (const diskFile of diskFiles) {
    if (!paths.includes(diskFile)) {
      paths.push(diskFile);
    }
  }

  return paths.slice(0, RECENT_FILE_LIMIT);
}

export function createReadDocumentTool(ctx: ToolContext) {
  return tool({
    description: "Đọc nội dung text từ file tài liệu (PDF, Word, Excel XLS/XLSX, CSV, TXT, MD, ảnh scan/chụp JPG/PNG, hoặc file nén ZIP/RAR/TAR/GZ chứa tài liệu) đã nhận trong hội thoại. " +
      "ĐẶC BIỆT: Khi người dùng gửi file .ZIP nén thư mục chứa nhiều file (Word, PDF, Excel...), tool sẽ tự động giải nén và đọc toàn bộ nội dung từng file bên trong rồi tổng hợp lại. " +
      "File PDF dạng scan hoặc ảnh chụp tài liệu sẽ được tự động nhận diện chữ (OCR), kể cả bảng biểu nhiều cột. " +
      "Với PDF nhiều trang, có thể đọc theo phạm vi pageStart/pageEnd; nếu người dùng yêu cầu một khoảng dài, phải chia thành các chunk và đọc đủ từng chunk. " +
      "Dòng tô màu nền (vàng, xanh lá) sẽ được ghi chú [TÔ MÀU] trong kết quả.",
    inputSchema: z.object({
      fileIndex: z.coerce
        .number()
        .int()
        .min(0)
        .default(0)
        .describe("Vị trí file tài liệu cần đọc (0 = file mới nhất trong hội thoại, 1 = file kế trước). Ảnh và tài liệu xếp lẫn nhau nên khi biết tên file (đặc biệt file MẪU) hãy dùng fileName"),
      fileName: z.string().optional().describe("Một phần tên file gốc người dùng gửi (không cần dấu), ví dụ \"mẫu\", \"BC tuần 33\". Ưu tiên hơn fileIndex"),
      pageStart: z.coerce.number().int().min(1).optional().describe("Trang bắt đầu, tính từ 1; chỉ dùng cho PDF scan"),
      pageEnd: z.coerce.number().int().min(1).optional().describe("Trang kết thúc, tính từ 1; chỉ dùng cho PDF scan"),
      password: z.string().optional().describe("Mật khẩu nếu file nén (RAR...) có mật khẩu"),
    }),
    execute: async ({ fileIndex, fileName, pageStart, pageEnd, password }) => {
      const paths = collectRecentFilePaths(ctx);
      if (paths.length === 0) {
        return ketQuaLoi("Không có file tài liệu nào trong hội thoại gần đây để đọc.");
      }

      const names = originalNames(ctx);
      const picked = pickIndex(paths, names, fileIndex, fileName);
      if ("error" in picked) return ketQuaLoi(picked.error);

      const relPath = paths[picked.index]!;
      const rawAbsPath = path.isAbsolute(relPath) ? relPath : path.join(dataDir, relPath);

      try {
        const absPath = assertSafePathInside(rawAbsPath, dataDir);
        const doc = await readDocument(absPath, { pageStart, pageEnd, password });
        if (doc.text.startsWith("Lỗi khi đọc nội dung file:")) {
          return ketQuaLoi(doc.text);
        }
        const maxChars = getTuning("DOCUMENT_READ_MAX_CHARS");
        const text = doc.text.length > maxChars
          ? `${doc.text.slice(0, maxChars)}\n[...đã cắt bớt nội dung do vượt giới hạn ${maxChars} ký tự]`
          : doc.text;
        const label = labelOf(relPath, names);
        const others = paths.length > 1 ? `\n[Các file khác đang có trong hội thoại — đọc tiếp bằng fileName/fileIndex nếu cần (ví dụ file mẫu):\n${listChoices(paths, names)}]` : "";
        const header = `[Nội dung file tài liệu: ${label} (${doc.fileType})]\n`;
        const emptyOcrPages = (text.match(/\[OCR không trả về dữ liệu|\[OCR thất bại/g) ?? []).length;
        const pageRangeNote = pageStart || pageEnd ? `\n[Phạm vi yêu cầu: trang ${pageStart ?? 1}-${pageEnd ?? "cuối"}; số trang OCR không có dữ liệu: ${emptyOcrPages}]` : "";
        return wrapUntrustedContent(`${header}${pageRangeNote}\n${text}`, label) + others;
      } catch (err) {
        return ketQuaLoi(`Lỗi khi đọc file tài liệu ${path.basename(relPath)}: ${String(err)}`);
      }
    },
  });
}

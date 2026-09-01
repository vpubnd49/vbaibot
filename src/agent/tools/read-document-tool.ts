import fs from "node:fs";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { dataDir } from "../../config/env.js";
import { getRecentMessages } from "../../conversation/history-store.js";
import type { ToolContext } from "./index.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { wrapUntrustedContent } from "./wrap-untrusted-content.js";
import { readDocument, isSupportedDocument } from "../../documents/document-reader.js";
import { assertSafePathInside } from "../../shared/path-security-guard.js";
import { getTuning } from "../../config/runtime-tuning-settings.js";

/**
 * Trần số file gần đây agent chọn được qua fileIndex.
 */
const RECENT_FILE_LIMIT = 10;

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
  } catch {
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
    description: "Đọc nội dung text từ file tài liệu (PDF, Word, Excel XLS/XLSX, CSV, TXT, MD) đã nhận trong hội thoại",
    inputSchema: z.object({
      fileIndex: z.coerce
        .number()
        .int()
        .min(0)
        .default(0)
        .describe("Vị trí file tài liệu cần đọc (0 = file mới nhất trong hội thoại, 1 = file kế trước)"),
    }),
    execute: async ({ fileIndex }) => {
      const paths = collectRecentFilePaths(ctx);
      if (paths.length === 0) {
        return ketQuaLoi("Không có file tài liệu nào trong hội thoại gần đây để đọc.");
      }

      if (fileIndex >= paths.length) {
        return ketQuaLoi(
          `Vị trí file ${fileIndex} không tồn tại. Hiện chỉ có ${paths.length} file tài liệu (chọn từ 0 đến ${paths.length - 1}).`,
        );
      }

      const relPath = paths[fileIndex]!;
      const rawAbsPath = path.isAbsolute(relPath) ? relPath : path.join(dataDir, relPath);

      try {
        const absPath = assertSafePathInside(rawAbsPath, dataDir);
        const doc = await readDocument(absPath);
        const maxChars = getTuning("DOCUMENT_READ_MAX_CHARS");
        const text = doc.text.length > maxChars
          ? `${doc.text.slice(0, maxChars)}\n[...đã cắt bớt nội dung do vượt giới hạn ${maxChars} ký tự]`
          : doc.text;
        const header = `[Nội dung file tài liệu: ${path.basename(relPath)} (${doc.fileType})]\n`;
        return wrapUntrustedContent(`${header}${text}`, path.basename(relPath));
      } catch (err) {
        return ketQuaLoi(`Lỗi khi đọc file tài liệu ${path.basename(relPath)}: ${String(err)}`);
      }
    },
  });
}

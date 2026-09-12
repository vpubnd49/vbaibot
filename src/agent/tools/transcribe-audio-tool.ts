import fs from "node:fs";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { dataDir } from "../../config/env.js";
import { getRecentMessages } from "../../conversation/history-store.js";
import type { ToolContext } from "./index.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { transcribeAudioFile } from "../../voice/stt-client.js";
import { assertSafePathInside } from "../../shared/path-security-guard.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("transcribe-audio");

const AUDIO_EXTS = new Set([
  ".m4a", ".mp3", ".wav", ".aac", ".ogg", ".opus", ".flac", ".amr", ".webm",
]);

function isAudioFile(name: string): boolean {
  return AUDIO_EXTS.has(path.extname(name).toLowerCase());
}

function sanitizeSegment(val: string): string {
  return val.replace(/[^a-zA-Z0-9_-]/g, "_") || "x";
}

function scanDiskAudio(accountId: string, threadId: string): Array<{ relPath: string; name: string; mtime: number }> {
  const dir = path.join(dataDir, "media", sanitizeSegment(accountId), sanitizeSegment(threadId));
  if (!fs.existsSync(dir)) return [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const audios: Array<{ relPath: string; name: string; mtime: number }> = [];
    for (const e of entries) {
      if (!e.isFile() || !isAudioFile(e.name)) continue;
      const full = path.join(dir, e.name);
      audios.push({
        relPath: path.relative(dataDir, full).replace(/\\/g, "/"),
        name: e.name,
        mtime: fs.statSync(full).mtimeMs,
      });
    }
    return audios.sort((a, b) => b.mtime - a.mtime);
  } catch (err) {
    log.warn({ accountId, threadId, err }, "Không quét được thư mục file audio gần đây");
    return [];
  }
}

export function collectRecentAudioFiles(ctx: ToolContext): Array<{ relPath: string; name: string }> {
  const map = new Map<string, { relPath: string; name: string }>();

  // 1. Current batch
  for (let i = ctx.batch.length - 1; i >= 0; i--) {
    const msg = ctx.batch[i] as any;
    if (msg?.files) {
      for (const f of msg.files) {
        if (f.localPath && isAudioFile(f.localPath || f.fileName || "")) {
          map.set(f.localPath, { relPath: f.localPath, name: f.fileName || path.basename(f.localPath) });
        }
      }
    }
  }

  // 2. Database history
  try {
    const recents = getRecentMessages(ctx.account.id, ctx.message.threadId, 20);
    for (const m of recents) {
      if (m.files) {
        for (const f of m.files) {
          if (f.localPath && isAudioFile(f.localPath) && !map.has(f.localPath)) {
            map.set(f.localPath, { relPath: f.localPath, name: f.fileName || path.basename(f.localPath) });
          }
        }
      }
    }
  } catch {}

  // 3. Disk scan
  for (const item of scanDiskAudio(ctx.account.id, ctx.message.threadId)) {
    if (!map.has(item.relPath)) {
      map.set(item.relPath, item);
    }
  }

  return [...map.values()];
}

export function createTranscribeAudioTool(ctx: ToolContext) {
  return tool({
    description:
      "Lắng nghe và chuyển đổi file âm thanh/ghi âm (.m4a, .mp3, .wav...) thành văn bản (Speech-to-Text). " +
      "Tự động tìm file âm thanh trong cuộc hội thoại hoặc thư mục media của nhóm. " +
      "Dùng khi người dùng yêu cầu 'bóc băng', 'chuyển âm thanh thành chữ', 'nghe file này', hoặc 'xuất text từ file ghi âm'.",
    inputSchema: z.object({
      fileName: z.string().optional().describe("Tên file ghi âm (vd: 'Bản ghi mới 11.m4a'). Nếu bỏ trống sẽ chọn file gần nhất."),
      fileIndex: z.number().int().min(0).optional().default(0).describe("Số thứ tự file (0 là mới nhất, 1 là kế tiếp). Mặc định 0."),
    }),
    execute: async ({ fileName, fileIndex = 0 }) => {
      const audios = collectRecentAudioFiles(ctx);
      if (audios.length === 0) {
        return ketQuaLoi("Không tìm thấy file âm thanh nào trong cuộc trò chuyện này. Vui lòng gửi lại file ghi âm.");
      }

      let selected = audios[fileIndex] || audios[0]!;
      if (fileName) {
        const found = audios.find((a) => a.name.toLowerCase().includes(fileName.toLowerCase()));
        if (found) selected = found;
      }

      const fullPath = path.resolve(dataDir, selected.relPath);
      assertSafePathInside(dataDir, fullPath);

      if (!fs.existsSync(fullPath)) {
        return ketQuaLoi(`Không tìm thấy file âm thanh trên đĩa: ${selected.name}`);
      }

      try {
        const result = await transcribeAudioFile(fullPath, selected.name);
        if (!result || !result.text) {
          return ketQuaLoi("Không thể trích xuất văn bản từ file âm thanh này (file rỗng hoặc không rõ tiếng).");
        }

        return (
          `Đã chuyển đổi thành công file âm thanh "${selected.name}":\n\n` +
          `--- NỘI DUNG VĂN BẢN CHÉP TỪ FILE GHI ÂM ---\n` +
          `${result.text}\n` +
          `--- HẾT NỘI DUNG ---\n\n` +
          `Hãy dùng nội dung trên để trả lời người dùng, biên tập hoặc gọi tool tạo văn bản Word (create_admin_document/create_word_document) nếu được yêu cầu.`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return ketQuaLoi(`Lỗi khi bóc băng âm thanh: ${msg}`);
      }
    },
  });
}

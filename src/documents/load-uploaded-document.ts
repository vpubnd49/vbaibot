import fs from "node:fs";
import path from "node:path";
import { dataDir } from "../config/env.js";
import { createLogger } from "../shared/logger.js";
import { readDocument, isSupportedDocument } from "./document-reader.js";

const log = createLogger("load-uploaded-document");

const mediaDir = path.join(dataDir, "media");

export type LoadedDocument = {
  /** Nội dung text trích xuất - đã cắt nếu vượt maxChars */
  text: string;
  /** Có bị cắt không */
  truncated: boolean;
  /** Số ký tự gốc trước khi cắt */
  originalLength: number;
  /** Đuôi file (.docx, .pdf, ...) */
  fileType: string;
};

/**
 * Đọc nội dung file tài liệu đã lưu trong data/media.
 *
 * @param localPath đường dẫn tương đối với DATA_DIR (vd "media/acc/thread/msg-file-0-bao-gia.docx")
 * @param maxChars  số ký tự tối đa trả về - vượt thì cắt và đánh dấu truncated
 * @returns null nếu file không tồn tại (đã bị dọn), không phải định dạng hỗ trợ, hoặc đọc lỗi
 */
export async function loadUploadedDocument(
  localPath: string,
  maxChars: number,
): Promise<LoadedDocument | null> {
  try {
    const absPath = path.resolve(dataDir, localPath);

    // Chặn path traversal: file phải nằm trong data/media
    if (!absPath.startsWith(mediaDir + path.sep) && !absPath.startsWith(mediaDir + "/")) {
      log.warn({ localPath }, "Đường dẫn file thoát khỏi data/media - bỏ qua");
      return null;
    }

    if (!fs.existsSync(absPath)) {
      log.debug({ localPath }, "File không tồn tại (có thể đã bị dọn)");
      return null;
    }

    if (!isSupportedDocument(absPath)) {
      log.debug({ localPath }, "Định dạng file không được hỗ trợ đọc nội dung");
      return null;
    }

    const result = await readDocument(absPath);

    if (!result.text || result.text.trim().length === 0 || result.text.startsWith("Lỗi")) {
      return null;
    }

    let text = result.text;
    let truncated = false;
    const originalLength = text.length;

    if (text.length > maxChars) {
      text = text.slice(0, maxChars);
      truncated = true;
    }

    return {
      text,
      truncated,
      originalLength,
      fileType: result.fileType,
    };
  } catch (err) {
    log.debug({ localPath, err }, "Không đọc được nội dung file tài liệu");
    return null;
  }
}

import fs from "node:fs";
import path from "node:path";
import { dataDir } from "../config/env.js";
import { readDocument } from "../documents/document-reader.js";
import { assertSafePathInside } from "../shared/path-security-guard.js";
import { CONTAINER_INBOX, nlmAddSource } from "./notebooklm-client.js";

/**
 * Đưa file người dùng gửi trong chat thành nguồn NotebookLM.
 *
 * ƯU TIÊN đọc ra chữ bằng bộ đọc sẵn có của bot (có OCR) rồi nạp dạng văn bản:
 * đường này đi qua API RPC của NotebookLM nên ổn định. Nạp nguyên file phải bấm
 * nút "Add source" trên giao diện web - Google đổi giao diện là hỏng (đã gặp
 * 10/2026). Chỉ khi không đọc được chữ mới thử nạp nguyên file PDF/Word/TXT/MD
 * qua thư mục inbox dùng chung với container (mount chỉ-đọc /inbox).
 */

export const HOST_INBOX_DIR = path.join(dataDir, "notebooklm-inbox");
const NATIVE_EXTS = new Set([".pdf", ".docx", ".txt", ".md"]);
export const MAX_TEXT_CHARS = 400_000;

export type SourceOutcome = { name: string; ok: boolean; error?: string };

export async function addFileSource(notebookUrl: string, relPath: string, displayName: string): Promise<SourceOutcome> {
  const raw = path.isAbsolute(relPath) ? relPath : path.join(dataDir, relPath);
  let abs: string;
  try {
    abs = assertSafePathInside(raw, dataDir);
  } catch {
    return { name: displayName, ok: false, error: "đường dẫn file không hợp lệ" };
  }
  if (!fs.existsSync(abs)) return { name: displayName, ok: false, error: "file đã bị xóa khỏi bộ nhớ" };

  const doc = await readDocument(abs, {}).catch((err: unknown) => ({ text: `Lỗi khi đọc nội dung file: ${String(err)}` }));
  const readable = doc.text.trim() && !doc.text.startsWith("Lỗi khi đọc nội dung file:");
  if (readable) {
    const r = await nlmAddSource(notebookUrl, { type: "text", text: doc.text.slice(0, MAX_TEXT_CHARS), title: displayName });
    if (r.ok) return { name: displayName, ok: true };
    if (!NATIVE_EXTS.has(path.extname(abs).toLowerCase())) return { name: displayName, ok: false, error: r.error };
  }

  const ext = path.extname(abs).toLowerCase();
  if (!NATIVE_EXTS.has(ext)) return { name: displayName, ok: false, error: "không đọc được nội dung file" };
  fs.mkdirSync(HOST_INBOX_DIR, { recursive: true });
  const inboxName = `${Date.now()}-${path.basename(abs).replace(/[^\w.-]+/g, "_")}`;
  const hostCopy = path.join(HOST_INBOX_DIR, inboxName);
  fs.copyFileSync(abs, hostCopy);
  fs.chmodSync(hostCopy, 0o644);
  try {
    const r = await nlmAddSource(notebookUrl, {
      type: "file",
      filePath: `${CONTAINER_INBOX}/${inboxName}`,
      title: displayName,
    });
    return r.ok ? { name: displayName, ok: true } : { name: displayName, ok: false, error: r.error };
  } finally {
    fs.rmSync(hostCopy, { force: true });
  }
}

export async function addUrlSource(notebookUrl: string, url: string): Promise<SourceOutcome> {
  const type = /youtu\.?be/i.test(url) ? "youtube" : "url";
  const r = await nlmAddSource(notebookUrl, { type, url });
  return r.ok ? { name: url, ok: true } : { name: url, ok: false, error: r.error };
}

export async function addTextSource(notebookUrl: string, text: string, title: string): Promise<SourceOutcome> {
  const r = await nlmAddSource(notebookUrl, { type: "text", text: text.slice(0, MAX_TEXT_CHARS), title });
  return r.ok ? { name: title, ok: true } : { name: title, ok: false, error: r.error };
}

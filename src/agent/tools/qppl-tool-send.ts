/**
 * Phần GỬI FILE của qppl_lamdong: gửi từng file của 1 VB, của nhiều VB, hoặc
 * gom thành 1 ZIP kèm MANIFEST.csv. Lỗi từng file được ghi lại để báo đúng,
 * không bao giờ nói "đã gửi đủ" khi thiếu. Tách từ qppl-lamdong-tool.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { downloadAllFilesForDoc, getQpplStorageDir } from "../../qppl/qppl-service.js";
import type { QpplDownloadResult } from "../../qppl/qppl-service.js";
import type { QpplDoc } from "../../qppl/qppl-types.js";
import { createQpplArchive } from "../../qppl/qppl-archive.js";
import { createLogger } from "../../shared/logger.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiFile } from "./sent-by-tool-note.js";
import type { ToolContext } from "./tool-catalog-types.js";
import { parseFileLinks } from "./qppl-tool-format.js";

const log = createLogger("qppl-lamdong-tool");

type GuiCtx = Pick<ToolContext, "api" | "account" | "message" | "ghiNhanDaGui">;
export type KetQuaTai = { doc: QpplDoc; download: QpplDownloadResult };

const gui = (ctx: GuiCtx, filePath: string, caption?: string) =>
  guiFileKemCaption(ctx.api, `${ctx.account.id}:${ctx.message.threadId}`, ctx.message.threadId, ctx.message.threadType, filePath, caption);

/** Gom toàn bộ file thành 1 ZIP + MANIFEST.csv rồi gửi một lần. */
export async function guiZipQppl(ctx: GuiCtx, docs: QpplDoc[], results: KetQuaTai[]): Promise<string> {
  const archiveEntries = results.flatMap(({ doc, download }) =>
    download.downloaded.map((filePath) => ({
      filePath,
      entryName: `${doc.ngayBanHanh?.slice(0, 4) || "unknown"}/${doc.soKyHieu.replace(/[\\/:*?"<>|]/g, "-")}/${path.basename(filePath)}`,
    })),
  );
  const coBan = (doc: QpplDoc) => ({
    documentId: doc.id,
    soKyHieu: doc.soKyHieu,
    loaiVanBan: doc.loaiVanBan,
    ngayBanHanh: doc.ngayBanHanh,
    trichYeu: doc.trichYeu,
  });
  const manifest = results.flatMap(({ doc, download }) => {
    const rows = parseFileLinks(doc.fileUrls).map((link) => {
      const localFile = download.downloaded.find((filePath) => path.basename(filePath).includes(path.basename(link.name)));
      return {
        ...coBan(doc),
        fileName: link.name,
        entryName: localFile ? path.basename(localFile) : "",
        status: localFile ? ("downloaded" as const) : ("failed" as const),
        error: download.failed.find((failed) => failed.name === link.name)?.error,
      };
    });
    return rows.length > 0
      ? rows
      : [{ ...coBan(doc), fileName: "", entryName: "", status: "failed" as const, error: "Không có file tải thành công" }];
  });
  const archivePath = path.join(getQpplStorageDir(), `QPPL_${Date.now()}_${docs.length}VB.zip`);
  try {
    const archive = await createQpplArchive(archivePath, archiveEntries, manifest);
    await gui(ctx, archive.path, `QPPL Lâm Đồng: ${docs.length} văn bản, ${archiveEntries.length} file; kèm MANIFEST.csv`);
    ctx.ghiNhanDaGui?.(ghiChuDaGuiFile(path.basename(archive.path), "ZIP QPPL"));
    const failed = results.reduce((sum, item) => sum + item.download.failed.length, 0);
    return (
      `\n\n✅ ĐÃ GỬI 1 FILE ZIP (${Math.round(archive.bytes / 1024)} KB), gồm ${archiveEntries.length} file từ ${docs.length} văn bản.\n` +
      (failed > 0 ? `⚠️ MANIFEST.csv ghi nhận ${failed} file chưa tải được; không được nói là đã đủ toàn bộ.` : "Đã tải đủ các file đã phát hiện.")
    );
  } catch (err) {
    log.warn({ err }, "Tạo/gửi ZIP QPPL thất bại");
    return "\n\n⚠️ KHÔNG gửi được file ZIP (tạo hoặc gửi thất bại). Model KHÔNG được nói là đã gửi file.";
  } finally {
    try { fs.unlinkSync(archivePath); } catch { /* archive đã được gửi hoặc tạo thất bại */ }
  }
}

/** Gửi mọi file của MỘT VB (nhánh action=get). */
export async function guiFileMotVb(ctx: GuiCtx, doc: QpplDoc, dl: QpplDownloadResult): Promise<string> {
  if (dl.downloaded.length === 0) {
    const fileLinks = parseFileLinks(doc.fileUrls);
    return fileLinks.length > 0
      ? "\n\n⚠️ Không tải được file về máy. Link tải trực tuyến (chỉ file PDF chính thức):\n" +
          fileLinks.map((f) => `- ${f.name}: ${f.url}`).join("\n")
      : "\n\n⚠️ Văn bản này không có file PDF chính thức đính kèm trên cổng tỉnh.";
  }
  const sentNames: string[] = [];
  const failedSends: string[] = [];
  for (const absPath of dl.downloaded) {
    const fileName = path.basename(absPath);
    try {
      await gui(ctx, absPath, `VB ${doc.loaiVanBan}: ${doc.soKyHieu}\n📎 ${fileName}`);
      sentNames.push(fileName);
    } catch (err) {
      failedSends.push(fileName);
      log.warn({ err, docId: doc.id, file: fileName }, "Gửi file VB thất bại");
    }
  }
  if (sentNames.length > 0) ctx.ghiNhanDaGui?.(ghiChuDaGuiFile(sentNames.join(", "), `VB ${doc.soKyHieu}`));
  let note = `\n\n✅ ĐÃ GỬI ${sentNames.length}/${dl.expected} FILE TRỰC TIẾP VÀO CHAT. Model KHÔNG cần gọi thêm send_file.`;
  if (failedSends.length > 0) {
    note += `\n⚠️ ${failedSends.length} file gửi KHÔNG thành công (KHÔNG được nói đã gửi đủ): ${failedSends.join(", ")}`;
  }
  if (dl.failed.length > 0) {
    note += `\n⚠️ ${dl.failed.length} file tải từ cổng tỉnh thất bại: ${dl.failed.map((f) => f.name).join(", ")}`;
  }
  return note;
}

/** Tải + gửi file của NHIỀU VB (nhánh search có sendFileToChat). */
export async function guiFileNhieuVb(ctx: GuiCtx, toSend: QpplDoc[]): Promise<string> {
  const sentFiles: string[] = [];
  const failedFiles: string[] = [];
  let totalFilesSent = 0;
  for (const targetDoc of toSend) {
    const dl = await downloadAllFilesForDoc(targetDoc.id);
    const loiTai = dl.failed.map((f) => `${targetDoc.soKyHieu} — ${f.name} (lỗi tải)`);
    const sentNamesForDoc: string[] = [];
    for (const absPath of dl.downloaded) {
      const fileName = path.basename(absPath);
      try {
        await gui(ctx, absPath, undefined);
        totalFilesSent++;
        sentNamesForDoc.push(fileName);
      } catch (err) {
        failedFiles.push(`${targetDoc.soKyHieu} — ${fileName}`);
        log.warn({ err, docId: targetDoc.id, file: fileName }, "Gửi file VB thất bại");
      }
    }
    if (sentNamesForDoc.length > 0) {
      ctx.ghiNhanDaGui?.(ghiChuDaGuiFile(sentNamesForDoc.join(", "), `VB ${targetDoc.soKyHieu}`));
      sentFiles.push(`#${targetDoc.id}: ${targetDoc.soKyHieu} (${sentNamesForDoc.length}/${dl.expected} file)`);
      failedFiles.push(...loiTai);
    } else if (dl.downloaded.length === 0) {
      failedFiles.push(...loiTai);
      sentFiles.push(`#${targetDoc.id}: ${targetDoc.soKyHieu} (0/${dl.expected} file)`);
    }
  }
  if (totalFilesSent === 0) {
    return (
      "\n\n⚠️ KHÔNG gửi được file nào vào chat (tải/gửi thất bại toàn bộ). " +
      "Model KHÔNG được nói là đã gửi file; phải thông báo lỗi cho người dùng và đề xuất cách khác (VD: gửi link trực tuyến)."
    );
  }
  let note = `\n\n✅ ĐÃ GỬI ${totalFilesSent} FILE TỪ ${sentFiles.length} VĂN BẢN VÀO CHAT:\n` + sentFiles.map((f) => `- ${f}`).join("\n");
  if (failedFiles.length > 0) {
    note +=
      `\n\n⚠️ ${failedFiles.length} file gửi KHÔNG thành công (model KHÔNG được nói là đã gửi đủ):\n` +
      failedFiles.map((f) => `- ${f}`).join("\n");
  }
  return note + "\nModel KHÔNG cần gọi thêm send_file.";
}

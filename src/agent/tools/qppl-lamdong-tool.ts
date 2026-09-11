import fs from "node:fs";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { dataDir } from "../../config/env.js";
import { searchQpplDocs, getQpplDocById, countQpplDocs } from "../../qppl/qppl-store.js";
import { syncQpplDocuments, downloadFileForDoc, liveSearchAndUpsert } from "../../qppl/qppl-service.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiFile } from "./sent-by-tool-note.js";
import type { ToolContext } from "./tool-catalog-types.js";
import type { QpplFileLink, QpplNguon } from "../../qppl/qppl-types.js";

export function createQpplLamdongTool({ api, account, message, ghiNhanDaGui }: ToolContext) {
  return tool({
    description:
      "Tra cứu, tìm kiếm và tải file văn bản pháp luật, văn bản chỉ đạo điều hành của tỉnh Lâm Đồng " +
      "(Công văn, Quyết định, Nghị quyết, Chỉ thị, Báo cáo, Tờ trình...) từ Cổng QPPL tỉnh Lâm Đồng (lamdong.gov.vn). " +
      "Nguồn: UBND tỉnh (63.000+ VB), HĐND tỉnh (1.500+ VB). " +
      "Dùng tool này khi người dùng yêu cầu tra cứu/tìm/tải văn bản chỉ đạo, quyết định UBND, nghị quyết HĐND, " +
      "hoặc hỏi về số hiệu văn bản cụ thể của tỉnh.",
    inputSchema: z.object({
      action: z
        .enum(["search", "get", "sync"])
        .default("search")
        .describe(
          "Hành động: 'search' tìm kiếm, 'get' xem chi tiết/tải file theo ID, 'sync' quét cập nhật mới",
        ),
      keyword: z
        .string()
        .optional()
        .describe(
          "Từ khóa tìm kiếm: số ký hiệu (VD: '4496/QĐ-UBND'), trích yếu, tên cơ quan, lĩnh vực, hoặc 'mới nhất'",
        ),
      loaiVanBan: z
        .string()
        .optional()
        .describe(
          "Lọc theo loại VB: 'Công văn', 'Quyết định', 'Nghị quyết', 'Chỉ thị', 'Báo cáo', 'Tờ trình'",
        ),
      nguon: z
        .enum(["ubnd", "hdnd"])
        .optional()
        .describe("Nguồn: 'ubnd' = UBND tỉnh, 'hdnd' = HĐND tỉnh"),
      docId: z
        .number()
        .optional()
        .describe("ID văn bản (dùng cho action 'get')"),
      sendFileToChat: z
        .boolean()
        .optional()
        .default(false)
        .describe("Nếu true, tải file PDF/DOC và gửi thẳng vào chat cho người dùng"),
    }),
    execute: async ({ action, keyword, loaiVanBan, nguon, docId, sendFileToChat }) => {
      // === SYNC ===
      if (action === "sync") {
        const target = (nguon as QpplNguon) || "ubnd";
        const syncRes = await syncQpplDocuments(target, 200);
        return (
          `Đã đồng bộ VB QPPL tỉnh Lâm Đồng (nguồn: ${target.toUpperCase()}): ` +
          `Quét ${syncRes.totalScanned} mục, cập nhật ${syncRes.updated} mục. ` +
          `Tổng: ${countQpplDocs(target)} văn bản trong kho.`
        );
      }

      // === GET (chi tiết + tải file) ===
      if (action === "get" && docId) {
        const doc = getQpplDocById(docId);
        if (!doc) return `Không tìm thấy văn bản QPPL có ID #${docId}.`;

        let sendNote = "";
        if (sendFileToChat) {
          let absPath: string | null = null;

          // Kiểm tra file đã tải trên đĩa
          if (doc.localPath) {
            const p = path.resolve(dataDir, doc.localPath);
            if (fs.existsSync(p)) absPath = p;
          }

          // Chưa có → tải on-demand
          if (!absPath) {
            absPath = await downloadFileForDoc(docId);
          }

          if (absPath && fs.existsSync(absPath)) {
            const caption = `VB ${doc.loaiVanBan}: ${doc.soKyHieu} - ${doc.trichYeu.slice(0, 80)}`;
            await guiFileKemCaption(
              api,
              `${account.id}:${message.threadId}`,
              message.threadId,
              message.threadType,
              absPath,
              caption,
            );
            ghiNhanDaGui?.(ghiChuDaGuiFile(path.basename(absPath), caption));
            sendNote =
              "\n\n✅ ĐÃ GỬI FILE TRỰC TIẾP VÀO CHAT. Model KHÔNG cần gọi thêm send_file.";
          } else {
            // Không có file → cung cấp link trực tuyến
            let fileLinks: QpplFileLink[] = [];
            try { fileLinks = JSON.parse(doc.fileUrls) as QpplFileLink[]; } catch { /* empty */ }
            if (fileLinks.length > 0) {
              sendNote =
                "\n\n⚠️ Không tải được file về máy. Link tải trực tuyến:\n" +
                fileLinks.map((f) => `- ${f.name}: ${f.url}`).join("\n");
            } else {
              sendNote = "\n\n⚠️ Văn bản này không có file đính kèm trên cổng tỉnh.";
            }
          }
        }

        let fileLinks: QpplFileLink[] = [];
        try { fileLinks = JSON.parse(doc.fileUrls) as QpplFileLink[]; } catch { /* empty */ }

        return (
          `📄 **CHI TIẾT VĂN BẢN (ID #${doc.id})**\n` +
          `- **Số/Ký hiệu**: ${doc.soKyHieu}\n` +
          `- **Loại VB**: ${doc.loaiVanBan || "N/A"}\n` +
          `- **Trích yếu**: ${doc.trichYeu || "N/A"}\n` +
          `- **Cơ quan**: ${doc.coQuanBanHanh || "N/A"}\n` +
          `- **Ngày ban hành**: ${doc.ngayBanHanh ? doc.ngayBanHanh.slice(0, 10) : "N/A"}\n` +
          `- **Hiệu lực**: ${doc.hieuLuc}\n` +
          `- **Nguồn**: ${doc.nguon.toUpperCase()}\n` +
          `- **File đính kèm**: ${fileLinks.length > 0 ? fileLinks.map((f) => f.name).join(", ") : "Không có"}\n` +
          `- **Lưu trữ**: ${doc.localPath ? `Đã tải (${Math.round(doc.fileSize / 1024)} KB)` : "Chưa tải"}` +
          sendNote
        );
      }

      // === SEARCH (mặc định) ===
      let docs = searchQpplDocs({
        keyword,
        loaiVanBan,
        nguon: nguon as QpplNguon | undefined,
        limit: 15,
      });

      // Nếu kho rỗng (lần đầu), auto-sync rồi tìm lại
      if (docs.length === 0 && countQpplDocs() === 0) {
        await syncQpplDocuments("ubnd", 100);
        await syncQpplDocuments("hdnd", 50);
        docs = searchQpplDocs({ keyword, loaiVanBan, nguon: nguon as QpplNguon | undefined, limit: 15 });
      }

      // Fallback: local DB không có → tra cứu trực tiếp trên API cổng tỉnh
      // (VB nằm ngoài batch sync gần nhất, VD: 15187/KH-UBND ban hành 10/09/2026)
      if (docs.length === 0 && keyword) {
        docs = await liveSearchAndUpsert(keyword, 15);
      }

      if (docs.length === 0) {
        return (
          `Không tìm thấy văn bản QPPL nào phù hợp với "${keyword || ""}". ` +
          `Thử từ khóa rộng hơn (VD: số hiệu, tên cơ quan, loại VB, năm ban hành).`
        );
      }

      // Gửi file nếu được yêu cầu
      let sendStatusNote = "";
      if (sendFileToChat && docs.length > 0) {
        const sentFiles: string[] = [];
        // Giới hạn gửi tối đa 5 file cùng lúc
        const toSend = docs.slice(0, 5);
        for (const targetDoc of toSend) {
          let absPath: string | null = null;

          if (targetDoc.localPath) {
            const p = path.resolve(dataDir, targetDoc.localPath);
            if (fs.existsSync(p)) absPath = p;
          }
          if (!absPath) {
            absPath = await downloadFileForDoc(targetDoc.id);
          }

          if (absPath && fs.existsSync(absPath)) {
            const caption = `VB ${targetDoc.loaiVanBan}: ${targetDoc.soKyHieu}`;
            await guiFileKemCaption(
              api,
              `${account.id}:${message.threadId}`,
              message.threadId,
              message.threadType,
              absPath,
              caption,
            );
            ghiNhanDaGui?.(ghiChuDaGuiFile(path.basename(absPath), caption));
            sentFiles.push(`#${targetDoc.id}: ${targetDoc.soKyHieu}`);
          }
        }
        if (sentFiles.length > 0) {
          sendStatusNote =
            `\n\n✅ ĐÃ GỬI ${sentFiles.length} FILE VÀO CHAT:\n` +
            sentFiles.map((f) => `- ${f}`).join("\n") +
            "\nModel KHÔNG cần gọi thêm send_file.";
        }
      }

      const lines = docs.map((d, idx) => {
        const dateStr = d.ngayBanHanh ? d.ngayBanHanh.slice(0, 10) : "";
        let fileLinks: QpplFileLink[] = [];
        try { fileLinks = JSON.parse(d.fileUrls) as QpplFileLink[]; } catch { /* empty */ }
        const fileStatus = d.localPath
          ? `[File sẵn sàng - ${Math.round(d.fileSize / 1024)} KB]`
          : fileLinks.length > 0
            ? `[Có ${fileLinks.length} file trực tuyến]`
            : "[Không có file]";
        return (
          `${idx + 1}. **[ID #${d.id}]** ${d.soKyHieu}\n` +
          `   - ${d.loaiVanBan} | ${dateStr} | ${d.hieuLuc}\n` +
          `   - ${d.trichYeu.slice(0, 120)}${d.trichYeu.length > 120 ? "..." : ""}\n` +
          `   - ${fileStatus}`
        );
      });

      return (
        `🔍 **DANH SÁCH VĂN BẢN QPPL TỈNH LÂM ĐỒNG** (Tìm: "${keyword || "Mới nhất"}"):\n\n` +
        lines.join("\n\n") +
        sendStatusNote +
        `\n\n*(Mẹo: Nhắn "tải file VB số [ký hiệu]" hoặc chỉ ID cụ thể để bot gửi file.)*`
      );
    },
  });
}

import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { searchQpplDocs, getQpplDocById, countQpplDocs } from "../../qppl/qppl-store.js";
import { syncQpplDocuments, downloadAllFilesForDoc, liveSearchAndUpsert } from "../../qppl/qppl-service.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiFile } from "./sent-by-tool-note.js";
import type { ToolContext } from "./tool-catalog-types.js";
import type { QpplFileLink, QpplNguon } from "../../qppl/qppl-types.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("qppl-lamdong-tool");

export function createQpplLamdongTool({ api, account, message, ghiNhanDaGui }: ToolContext) {
  return tool({
    description:
      "BẮT BUỘC GỌI TOOL NÀY khi người dùng yêu cầu tra cứu, tìm kiếm hoặc TẢI FILE văn bản chỉ đạo điều hành của tỉnh Lâm Đồng " +
      "(Quyết định UBND/BĐD, Công văn, Kế hoạch, Nghị quyết HĐND, Chỉ thị, Báo cáo, Tờ trình...). " +
      "KHI NGƯỜI DÙNG YÊU CẦU TẢI FILE (VD: 'tải quyết định 4480', 'tải kế hoạch 15187', 'gửi file quyết định...'): " +
      "BẮT BUỘC đặt sendFileToChat=true và keyword là số hiệu văn bản để tool tải toàn bộ file đính kèm gửi thẳng vào chat.",
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
          // Tải TẤT CẢ file đính kèm
          const dl = await downloadAllFilesForDoc(docId);
          const allPaths = dl.downloaded;

          if (allPaths.length > 0) {
            const sentNames: string[] = [];
            const failedSends: string[] = [];
            for (const absPath of allPaths) {
              const fileName = path.basename(absPath);
              const caption = `VB ${doc.loaiVanBan}: ${doc.soKyHieu}\n📎 ${fileName}`;
              try {
                await guiFileKemCaption(
                  api,
                  `${account.id}:${message.threadId}`,
                  message.threadId,
                  message.threadType,
                  absPath,
                  caption,
                );
                sentNames.push(fileName);
              } catch (err) {
                failedSends.push(fileName);
                log.warn({ err, docId, file: fileName }, "Gửi file VB thất bại");
              }
            }
            if (sentNames.length > 0) {
              ghiNhanDaGui?.(ghiChuDaGuiFile(sentNames.join(", "), `VB ${doc.soKyHieu}`));
            }
            sendNote =
              `\n\n✅ ĐÃ GỬI ${sentNames.length}/${dl.expected} FILE TRỰC TIẾP VÀO CHAT. Model KHÔNG cần gọi thêm send_file.`;
            if (failedSends.length > 0) {
              sendNote +=
                `\n⚠️ ${failedSends.length} file gửi KHÔNG thành công (KHÔNG được nói đã gửi đủ): ${failedSends.join(", ")}`;
            }
            if (dl.failed.length > 0) {
              sendNote +=
                `\n⚠️ ${dl.failed.length} file tải từ cổng tỉnh thất bại: ${dl.failed.map((f) => f.name).join(", ")}`;
            }
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
      // Lấy nhiều kết quả để không bỏ sót văn bản khi người dùng yêu cầu tải hết
      let docs = searchQpplDocs({
        keyword,
        loaiVanBan,
        nguon: nguon as QpplNguon | undefined,
        limit: 50,
      });

      // Nếu kho rỗng (lần đầu), auto-sync rồi tìm lại
      if (docs.length === 0 && countQpplDocs() === 0) {
        await syncQpplDocuments("ubnd", 100);
        await syncQpplDocuments("hdnd", 50);
        docs = searchQpplDocs({ keyword, loaiVanBan, nguon: nguon as QpplNguon | undefined, limit: 50 });
      }

      // Fallback: local DB không có → tra cứu trực tiếp trên API cổng tỉnh
      // (VB nằm ngoài batch sync gần nhất, VD: 15187/KH-UBND ban hành 10/09/2026)
      if (docs.length === 0 && keyword) {
        docs = await liveSearchAndUpsert(keyword, 30);
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
        // Loại trùng soKyHieu (cùng VB có thể xuất hiện nhiều lần từ search)
        const seen = new Set<string>();
        const uniqueDocs = docs.filter((d) => {
          if (seen.has(d.soKyHieu)) return false;
          seen.add(d.soKyHieu);
          return true;
        });
        // Gửi TẤT CẢ văn bản tìm được theo yêu cầu người dùng (tải hết các file).
        // Mỗi file gửi lỗi vẫn tiếp tục gửi các file còn lại để không bỏ sót.
        const toSend = uniqueDocs;
        const sentFiles: string[] = [];
        const failedFiles: string[] = [];
        let totalFilesSent = 0;
        for (const targetDoc of toSend) {
          const dl = await downloadAllFilesForDoc(targetDoc.id);
          const allPaths = dl.downloaded;
          const sentNamesForDoc: string[] = [];
          for (const absPath of allPaths) {
            const fileName = path.basename(absPath);
            const caption = `VB ${targetDoc.loaiVanBan}: ${targetDoc.soKyHieu}\n📎 ${fileName}`;
            try {
              await guiFileKemCaption(
                api,
                `${account.id}:${message.threadId}`,
                message.threadId,
                message.threadType,
                absPath,
                caption,
              );
              totalFilesSent++;
              sentNamesForDoc.push(fileName);
            } catch (err) {
              failedFiles.push(`${targetDoc.soKyHieu} — ${fileName}`);
              log.warn({ err, docId: targetDoc.id, file: fileName }, "Gửi file VB thất bại");
            }
          }
          if (sentNamesForDoc.length > 0) {
            ghiNhanDaGui?.(ghiChuDaGuiFile(
              sentNamesForDoc.join(", "),
              `VB ${targetDoc.soKyHieu}`,
            ));
            sentFiles.push(`#${targetDoc.id}: ${targetDoc.soKyHieu} (${sentNamesForDoc.length}/${dl.expected} file)`);
            if (dl.failed.length > 0) {
              failedFiles.push(...dl.failed.map((f) => `${targetDoc.soKyHieu} — ${f.name} (lỗi tải)`));
            }
          } else if (allPaths.length === 0) {
            if (dl.failed.length > 0) {
              failedFiles.push(...dl.failed.map((f) => `${targetDoc.soKyHieu} — ${f.name} (lỗi tải)`));
            }
            sentFiles.push(`#${targetDoc.id}: ${targetDoc.soKyHieu} (0/${dl.expected} file)`);
          }
        }
        if (totalFilesSent > 0) {
          sendStatusNote =
            `\n\n✅ ĐÃ GỬI ${totalFilesSent} FILE TỪ ${sentFiles.length} VĂN BẢN VÀO CHAT:\n` +
            sentFiles.map((f) => `- ${f}`).join("\n");
          if (failedFiles.length > 0) {
            sendStatusNote +=
              `\n\n⚠️ ${failedFiles.length} file gửi KHÔNG thành công (model KHÔNG được nói là đã gửi đủ):\n` +
              failedFiles.map((f) => `- ${f}`).join("\n");
          }
          sendStatusNote += "\nModel KHÔNG cần gọi thêm send_file.";
        } else {
          sendStatusNote =
            "\n\n⚠️ KHÔNG gửi được file nào vào chat (tải/gửi thất bại toàn bộ). " +
            "Model KHÔNG được nói là đã gửi file; phải thông báo lỗi cho người dùng và đề xuất cách khác (VD: gửi link trực tuyến).";
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

import fs from "node:fs";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { dataDir } from "../../config/env.js";
import { searchThanhtraDocs, getThanhtraDocById, countThanhtraDocs } from "../../thanhtra/thanhtra-store.js";
import { syncThanhtraDocuments } from "../../thanhtra/thanhtra-service.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiFile } from "./sent-by-tool-note.js";
import type { ToolContext } from "./tool-catalog-types.js";

export function createThanhtraLamdongTool({ api, account, message, ghiNhanDaGui }: ToolContext) {
  return tool({
    description:
      "Tra cứu, tìm kiếm danh sách và lấy file PDF Kết luận thanh tra, Thông báo kết luận của Thanh tra tỉnh Lâm Đồng (nguồn chính thức Cổng TTĐT tỉnh Lâm Đồng lamdong.gov.vn). " +
      "Dùng tool này khi người dùng hỏi về kết luận thanh tra tại Lâm Đồng, thanh tra dự án, công ty, doanh nghiệp, trường học, UBND các xã/huyện, hoặc yêu cầu tải/gửi văn bản kết luận thanh tra.",
    inputSchema: z.object({
      action: z
        .enum(["search", "get", "sync"])
        .default("search")
        .describe("Hành động: 'search' để tìm kiếm/lấy danh sách mới nhất, 'get' để xem chi tiết theo ID, 'sync' để quét cập nhật mới từ Cổng tỉnh"),
      keyword: z
        .string()
        .optional()
        .describe("Từ khóa tìm kiếm (tên đơn vị, doanh nghiệp, xã, dự án, số kết luận, hoặc 'mới nhất')"),
      docId: z
        .number()
        .optional()
        .describe("ID của kết luận thanh tra (dùng cho action 'get' hoặc khi muốn gửi đích danh 1 file)"),
      sendFileToChat: z
        .boolean()
        .optional()
        .default(false)
        .describe("Nếu true, tool sẽ gửi thẳng file PDF Kết luận thanh tra vào tin nhắn Zalo cho người dùng"),
    }),
    execute: async ({ action, keyword, docId, sendFileToChat }) => {
      // 1. Nhánh đồng bộ cưỡng bức từ mạng
      if (action === "sync") {
        const syncRes = await syncThanhtraDocuments(20);
        return `Đã đồng bộ xong dữ liệu Thanh tra tỉnh Lâm Đồng: Quét ${syncRes.totalScanned} mục, tải mới ${syncRes.newDownloaded} file PDF. Hiện có tổng cộng ${countThanhtraDocs()} văn bản trong kho dữ liệu.`;
      }

      // 2. Nhánh xem chi tiết hoặc gửi 1 file cụ thể
      if (action === "get" && docId) {
        const doc = getThanhtraDocById(docId);
        if (!doc) {
          return `Không tìm thấy Kết luận thanh tra có ID #${docId}.`;
        }

        let sendNote = "";
        if (sendFileToChat && doc.localPath) {
          const absPath = path.resolve(dataDir, doc.localPath);
          if (fs.existsSync(absPath)) {
            const caption = `Văn bản Kết luận thanh tra: ${doc.title}`;
            await guiFileKemCaption(
              api,
              `${account.id}:${message.threadId}`,
              message.threadId,
              message.threadType,
              absPath,
              caption,
            );
            ghiNhanDaGui?.(ghiChuDaGuiFile(path.basename(absPath), caption));
            sendNote = "\n\n✅ ĐÃ GỬI FILE PDF TRỰC TIẾP VÀO CHAT CHO NGƯỜI DÙNG. Model KHÔNG cần gọi thêm send_file.";
          }
        }

        return (
          `📄 **CHI TIẾT KẾT LUẬN THANH TRA (ID #${doc.id})**\n` +
          `- **Tiêu đề**: ${doc.title}\n` +
          `- **Ngày cập nhật**: ${doc.modifiedAt ? doc.modifiedAt.slice(0, 10) : "Chưa rõ"}\n` +
          `- **Trang công bố**: ${doc.fileRef ? `https://lamdong.gov.vn${doc.fileRef}` : "N/A"}\n` +
          `- **File PDF**: ${doc.pdfUrl || "Chưa có file đính kèm"}\n` +
          `- **Trạng thái lưu trữ**: ${doc.localPath ? `Đã lưu trên máy (${Math.round(doc.fileSize / 1024)} KB)` : "Chưa tải về"}${sendNote}`
        );
      }

      // 3. Nhánh tìm kiếm (mặc định)
      let docs = searchThanhtraDocs(keyword, 6);

      // Nếu kho rỗng (lần đầu chạy chưa kịp sync), tự động sync nhanh 10 mục rồi tìm lại
      if (docs.length === 0 && countThanhtraDocs() === 0) {
        await syncThanhtraDocuments(10);
        docs = searchThanhtraDocs(keyword, 6);
      }

      if (docs.length === 0) {
        return `Không tìm thấy kết luận thanh tra nào phù hợp với từ khóa "${keyword || ""}". Bạn có thể thử tìm từ khóa rộng hơn (ví dụ: tên huyện, xã, năm 2026...).`;
      }

      // Nếu người dùng yêu cầu gửi file → gửi TẤT CẢ file có sẵn, không chỉ file đầu.
      // Model gọi tool ĐÚNG 1 LẦN với sendFileToChat=true → tool tự gửi toàn bộ.
      // Trước đây chỉ gửi docs[0] → model phải gọi riêng lẻ từng ID → tốn step → thiếu file.
      let sendStatusNote = "";
      if (sendFileToChat && docs.length > 0) {
        const sentFiles: string[] = [];
        for (const targetDoc of docs) {
          if (!targetDoc.localPath) continue;
          const absPath = path.resolve(dataDir, targetDoc.localPath);
          if (!fs.existsSync(absPath)) continue;
          const caption = `Văn bản Kết luận thanh tra: ${targetDoc.title}`;
          await guiFileKemCaption(
            api,
            `${account.id}:${message.threadId}`,
            message.threadId,
            message.threadType,
            absPath,
            caption,
          );
          ghiNhanDaGui?.(ghiChuDaGuiFile(path.basename(absPath), caption));
          sentFiles.push(`#${targetDoc.id}: ${path.basename(absPath)}`);
        }
        if (sentFiles.length > 0) {
          sendStatusNote = `\n\n✅ ĐÃ GỬI ${sentFiles.length} FILE PDF VÀO CHAT CHO NGƯỜI DÙNG:\n${sentFiles.map((f) => `- ${f}`).join("\n")}\nModel KHÔNG cần gọi thêm send_file hay gọi tool lần nữa.`;
        }
      }

      const lines = docs.map((d, idx) => {
        const dateStr = d.modifiedAt ? d.modifiedAt.slice(0, 10) : "";
        const fileStatus = d.localPath ? `[PDF sẵn sàng - ${Math.round(d.fileSize / 1024)} KB]` : `[Có link trực tuyến]`;
        return `${idx + 1}. **[ID #${d.id}]** ${d.title}\n   - Ngày ban hành/sửa: ${dateStr}\n   - Trạng thái: ${fileStatus}`;
      });

      return (
        `🔍 **DANH SÁCH KẾT LUẬN THANH TRA TỈNH LÂM ĐỒNG** (Từ khóa: "${keyword || "Mới nhất"}"):\n\n` +
        lines.join("\n\n") +
        sendStatusNote +
        `\n\n*(Mẹo: Bạn có thể yêu cầu bot gửi file PDF cụ thể bằng cách nhắn "Gửi cho tôi file kết luận số [ID]").*`
      );
    },
  });
}

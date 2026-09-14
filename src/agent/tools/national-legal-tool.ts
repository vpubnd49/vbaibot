import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import {
  searchNationalLegal,
  downloadNationalLegal,
  type NationalLegalResult,
} from "../../legal/services/national-legal-service.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiFile } from "./sent-by-tool-note.js";
import type { ToolContext } from "./tool-catalog-types.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("national-legal-tool");

export function createNationalLegalTool({ api, account, message, ghiNhanDaGui }: ToolContext) {
  return tool({
    description:
      "BẮT BUỘC GỌI TOOL NÀY khi người dùng hỏi, tra cứu hoặc yêu cầu TẢI FILE văn bản pháp luật CẤP TRUNG ƯƠNG " +
      "(Luật, Nghị định, Thông tư, Quyết định TTg, Nghị quyết QH/CP, Pháp lệnh...). " +
      "Nguồn: Công báo điện tử CP (congbao.chinhphu.vn) + Thư viện Pháp luật (thuvienphapluat.vn). " +
      "KHÔNG dùng cho VB tỉnh Lâm Đồng (dùng tool qppl_lamdong). " +
      "KHI NGƯỜI DÙNG YÊU CẦU TẢI FILE: đặt sendFileToChat=true.",
    inputSchema: z.object({
      action: z
        .enum(["search", "download"])
        .default("search")
        .describe("Hành động: 'search' tìm kiếm, 'download' tải file VB"),
      keyword: z
        .string()
        .optional()
        .describe(
          "Từ khóa tìm kiếm: số hiệu VB (VD: '347/2026/NĐ-CP'), tên luật, hoặc từ khóa trích yếu. " +
          "Dùng cho action 'search'.",
        ),
      downloadId: z
        .string()
        .optional()
        .describe("ID/URL VB cần tải (lấy từ kết quả search). Dùng cho action 'download'."),
      source: z
        .enum(["congbao", "tvpl"])
        .optional()
        .describe("Nguồn tải: 'congbao' = Công báo CP, 'tvpl' = Thư viện Pháp luật"),
      format: z
        .enum(["pdf", "doc", "docx"])
        .optional()
        .default("pdf")
        .describe("Định dạng file tải về (chỉ TVPL hỗ trợ doc/docx)"),
      sendFileToChat: z
        .boolean()
        .optional()
        .default(false)
        .describe("Nếu true, tải file rồi gửi thẳng vào chat cho người dùng"),
      soHieu: z
        .string()
        .optional()
        .describe("Số hiệu VB (dùng đặt tên file khi tải)"),
    }),
    execute: async ({ action, keyword, downloadId, source, format, sendFileToChat, soHieu }) => {
      // ── SEARCH ──
      if (action === "search") {
        if (!keyword) return "Cần nhập từ khóa để tìm kiếm VB pháp luật cấp TW.";

        try {
          const results = await searchNationalLegal(keyword);

          if (results.length === 0) {
            return (
              `Không tìm thấy văn bản nào khớp từ khóa "${keyword}" trên Công báo CP và TVPL.\n` +
              "Thử lại với số hiệu chính xác (VD: '347/2026') hoặc từ khóa ngắn hơn."
            );
          }

          return formatSearchResults(results, keyword);
        } catch (err) {
          log.error({ err, keyword }, "National legal search error");
          return `Lỗi khi tra cứu VB pháp luật: ${String(err)}`;
        }
      }

      // ── DOWNLOAD ──
      if (action === "download") {
        if (!downloadId) return "Cần downloadId (lấy từ kết quả search) để tải VB.";
        if (!source) return "Cần chỉ định source: 'congbao' hoặc 'tvpl'.";

        try {
          const dl = await downloadNationalLegal(downloadId, source, format || "pdf", soHieu);

          if (!dl.filePath) {
            return `❌ Tải VB thất bại: ${dl.error || "lỗi không xác định"}`;
          }

          // Gửi file vào chat nếu yêu cầu
          if (sendFileToChat) {
            const fileName = path.basename(dl.filePath);
            const caption = `📜 VB Pháp luật: ${soHieu || fileName}\n📎 ${fileName} (${Math.round(dl.fileSize / 1024)} KB)\n🔗 Nguồn: ${source === "congbao" ? "Công báo ĐT Chính phủ" : "Thư viện Pháp luật"}`;

            try {
              await guiFileKemCaption(
                api,
                `${account.id}:${message.threadId}`,
                message.threadId,
                message.threadType,
                dl.filePath,
                caption,
              );
              ghiNhanDaGui?.(ghiChuDaGuiFile(fileName, `VB PL TW (${source})`));

              return (
                `✅ ĐÃ GỬI FILE: ${fileName} (${Math.round(dl.fileSize / 1024)} KB)\n` +
                `Nguồn: ${source === "congbao" ? "Công báo ĐT Chính phủ" : "Thư viện Pháp luật"}\n` +
                `Số hiệu: ${soHieu || "N/A"}`
              );
            } catch (sendErr) {
              log.error({ sendErr, filePath: dl.filePath }, "Failed to send file to chat");
              return `Đã tải file ${fileName} nhưng gửi vào chat thất bại: ${String(sendErr)}`;
            }
          }

          return (
            `✅ Đã tải VB thành công:\n` +
            `- File: ${path.basename(dl.filePath)}\n` +
            `- Kích thước: ${Math.round(dl.fileSize / 1024)} KB\n` +
            `- Nguồn: ${source === "congbao" ? "Công báo ĐT Chính phủ" : "Thư viện Pháp luật"}`
          );
        } catch (err) {
          log.error({ err, downloadId }, "National legal download error");
          return `❌ Lỗi khi tải VB: ${String(err)}`;
        }
      }

      return "Hành động không hợp lệ. Dùng 'search' để tìm hoặc 'download' để tải.";
    },
  });
}

// ─── Format kết quả ────────────────────────────────────────────────

function formatSearchResults(results: NationalLegalResult[], keyword: string): string {
  const maxShow = 10;
  const shown = results.slice(0, maxShow);

  let text = `📋 Tìm thấy ${results.length} VB pháp luật khớp "${keyword}":\n\n`;

  for (let i = 0; i < shown.length; i++) {
    const r = shown[i];
    const srcIcon = r.source === "congbao" ? "🏛️" : "📚";
    text +=
      `${i + 1}. ${srcIcon} **${r.loaiVB}${r.soHieu ? ` ${r.soHieu}` : ""}**\n` +
      `   ${r.trichYeu}\n` +
      `   📅 ${r.ngayBanHanh || "N/A"} | Nguồn: ${r.source === "congbao" ? "Công báo CP" : "TVPL"}\n` +
      `   🔗 ${r.detailUrl}\n` +
      `   → Để tải: dùng action='download', downloadId='${r.downloadId}', source='${r.source}'\n\n`;
  }

  if (results.length > maxShow) {
    text += `... và ${results.length - maxShow} VB khác. Thu hẹp từ khóa để xem thêm.`;
  }

  return text;
}

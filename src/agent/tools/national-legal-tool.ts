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
      "Nguồn: CSDL quốc gia về pháp luật (vbpl.vn) + Công báo ĐT CP (congbao.chinhphu.vn) + Thư viện Pháp luật. " +
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
        .enum(["congbao", "tvpl", "vbpl"])
        .optional()
        .describe("Nguồn tải: 'congbao' = Công báo CP, 'tvpl' = Thư viện PL, 'vbpl' = CSDL quốc gia"),
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
              `Không tìm thấy văn bản nào khớp từ khóa "${keyword}" trên cả Công báo Chính phủ, CSDL quốc gia về pháp luật (vbpl.vn) và Thư viện Pháp luật.\n` +
              `Vui lòng kiểm tra lại số hiệu hoặc cơ quan ban hành.`
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
        let targetDownloadId = downloadId;
        let targetSource = source;
        let targetSoHieu = soHieu;

        // Tự động tìm kiếm trước nếu chưa có downloadId hoặc source
        if (!targetDownloadId || !targetSource) {
          const searchTarget = targetSoHieu || keyword;
          if (!searchTarget) {
            return "Cần cung cấp từ khóa, số hiệu hoặc downloadId để tải văn bản pháp luật.";
          }

          log.info({ searchTarget }, "Auto-searching before download in national-legal-tool");
          try {
            const searchResults = await searchNationalLegal(searchTarget);
            if (searchResults.length === 0) {
              return (
                `Không tìm thấy văn bản nào khớp "${searchTarget}" trên CSDL quốc gia (vbpl.vn), Công báo hay TVPL để tải.\n` +
                `Vui lòng kiểm tra lại số hiệu văn bản.`
              );
            }
            const best = searchResults[0];
            targetDownloadId = best.downloadId;
            targetSource = best.source;
            targetSoHieu = targetSoHieu || best.soHieu;
          } catch (err) {
            log.error({ err, searchTarget }, "Auto-search error before download");
            return `Lỗi khi tra cứu văn bản để tải: ${String(err)}`;
          }
        }

        try {
          const dl = await downloadNationalLegal(targetDownloadId, targetSource, format || "pdf", targetSoHieu);

          if (!dl.filePath) {
            return `❌ Tải VB thất bại: ${dl.error || "lỗi không xác định"}`;
          }

          const sourceLabel =
            targetSource === "congbao"
              ? "Công báo ĐT Chính phủ"
              : targetSource === "vbpl"
                ? "CSDL quốc gia về pháp luật"
                : "Thư viện Pháp luật";

          // Gửi file vào chat nếu yêu cầu
          if (sendFileToChat) {
            const fileName = path.basename(dl.filePath);

            try {
              await guiFileKemCaption(
                api,
                `${account.id}:${message.threadId}`,
                message.threadId,
                message.threadType,
                dl.filePath,
                undefined,
              );
              ghiNhanDaGui?.(ghiChuDaGuiFile(fileName, `VB PL TW (${targetSource})`));

              return (
                `✅ ĐÃ TẢI VÀ GỬI FILE VÀO CHAT: ${fileName} (${Math.round(dl.fileSize / 1024)} KB)\n` +
                `Nguồn: ${sourceLabel}\n` +
                `Số hiệu: ${targetSoHieu || "N/A"}\n` +
                `(File đã được gửi trực tiếp đến người dùng trong chat. Chỉ cần báo ngắn gọn đã gửi file, không gửi link hay caption trùng lặp)`
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
            `- Nguồn: ${sourceLabel}`
          );
        } catch (err) {
          log.error({ err, targetDownloadId }, "National legal download error");
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
    const srcIcon = r.source === "congbao" ? "🏛️" : r.source === "vbpl" ? "⚖️" : "📚";
    const srcName =
      r.source === "congbao"
        ? "Công báo CP"
        : r.source === "vbpl"
          ? "CSDL quốc gia (vbpl.vn)"
          : "Thư viện Pháp luật";
    text +=
      `${i + 1}. ${srcIcon} **${r.loaiVB}${r.soHieu ? ` ${r.soHieu}` : ""}**\n` +
      `   ${r.trichYeu}\n` +
      `   📅 ${r.ngayBanHanh || "N/A"} | Nguồn: ${srcName}\n` +
      `   🔗 ${r.detailUrl}\n` +
      `   → Để tải: dùng action='download', downloadId='${r.downloadId}', source='${r.source}'\n\n`;
  }

  if (results.length > maxShow) {
    text += `... và ${results.length - maxShow} VB khác. Thu hẹp từ khóa để xem thêm.`;
  }

  return text;
}

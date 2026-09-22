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
      "(Luật, Nghị định, Thông tư, Quyết định TTg, Nghị quyết QH/CP, Pháp lệnh, VĂN BẢN HỢP NHẤT (VBHN)...). " +
      "Nguồn: Cổng Pháp luật quốc gia (phapluat.gov.vn) + CSDL quốc gia về pháp luật (vbpl.vn) + Công báo ĐT CP (congbao.chinhphu.vn) + Thư viện Pháp luật + vanban.chinhphu.vn (cho VBHN). " +
      "KHÔNG dùng cho VB tỉnh Lâm Đồng (dùng tool qppl_lamdong). " +
      "KHI NGƯỜI DÙNG NÓI TẢI/DOWNLOAD/GỬI FILE, kể cả 'tải Luật Đất đai mới', phải dùng action='download' và sendFileToChat=true; không chỉ gọi search. " +
      "LUÔN GỌI TOOL NÀY mỗi lần người dùng yêu cầu, KHÔNG BAO GIỜ tự trả lời 'không tìm thấy' mà không gọi tool trước.",
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
        .enum(["congbao", "tvpl", "vbpl", "phapluat"])
        .optional()
        .describe("Nguồn tải: 'phapluat' = Cổng Pháp luật quốc gia, 'congbao' = Công báo CP, 'tvpl' = Thư viện PL, 'vbpl' = CSDL quốc gia"),
      format: z
        .enum(["pdf", "doc", "docx"])
        .optional()
        .default("pdf")
        .describe("Định dạng file tải về (chỉ TVPL hỗ trợ doc/docx)"),
      limit: z
        .number()
        .optional()
        .default(1)
        .describe("Số lượng file muốn tải (nếu tải nhiều văn bản, mặc định 3, tối đa 5)"),
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
    execute: async ({ action, keyword, downloadId, source, format, sendFileToChat, soHieu, limit }) => {
      // ── SEARCH ──
      if (action === "search") {
        if (!keyword) return "Cần nhập từ khóa để tìm kiếm VB pháp luật cấp TW.";

        try {
          const results = await searchNationalLegal(keyword);

          if (results.length === 0) {
            return (
              `Không tìm thấy văn bản nào khớp từ khóa "${keyword}" trên Cổng Pháp luật quốc gia, Công báo Chính phủ, CSDL quốc gia về pháp luật (vbpl.vn) và Thư viện Pháp luật.\n` +
              `Vui lòng kiểm tra lại số hiệu hoặc cơ quan ban hành.`
            );
          }

          // Nếu model vô tình gọi search nhưng lại bật sendFileToChat (muốn tải file)
          if (sendFileToChat && results.length > 0) {
            const isPlural = /\b(các|những|danh sách|toàn bộ|tất cả)\b/i.test(keyword);
            const countToDownload = isPlural ? Math.min(results.length, limit > 1 ? limit : 3) : 1;
            const sentFiles: string[] = [];

            for (let i = 0; i < countToDownload; i++) {
              const item = results[i];
              try {
                const dl = await downloadNationalLegal(item.downloadId, item.source, format || "pdf", item.soHieu);
                if (dl.filePath) {
                  const fileName = path.basename(dl.filePath);
                  await guiFileKemCaption(
                    api,
                    `${account.id}:${message.threadId}`,
                    message.threadId,
                    message.threadType,
                    dl.filePath,
                    undefined,
                  );
                  ghiNhanDaGui?.(ghiChuDaGuiFile(fileName, `VB PL TW (${item.source})`));
                  sentFiles.push(`${item.soHieu || fileName} (${Math.round(dl.fileSize / 1024)} KB)`);
                  await new Promise((r) => setTimeout(r, 600));
                }
              } catch (dlErr) {
                log.error({ dlErr, item }, "Failed downloading search item");
              }
            }

            if (sentFiles.length > 0) {
              let msg = `✅ ĐÃ TẢI VÀ GỬI ${sentFiles.length} VĂN BẢN VÀO CHAT CHO NGƯỜI DÙNG:\n` + sentFiles.map((s) => `- ${s}`).join("\n");
              if (results.length > countToDownload) {
                msg += `\n\n📋 Danh sách các văn bản khác cùng đợt:\n` + results.slice(countToDownload, countToDownload + 7).map((r) => `- ${r.soHieu} (${r.ngayBanHanh}): ${r.trichYeu.slice(0, 70)}`).join("\n");
              }
              msg += `\n(File đã được gửi trực tiếp vào chat. Chỉ cần báo ngắn gọn đã gửi file)`;
              return msg;
            }
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
           if (searchTarget && !targetSoHieu && /luật\s+đất\s+đai/i.test(searchTarget)) {
             targetSoHieu = "31/2024/QH15";
           }
           const resolvedSearchTarget = targetSoHieu || searchTarget;
           if (!resolvedSearchTarget) {
            return "Cần cung cấp từ khóa, số hiệu hoặc downloadId để tải văn bản pháp luật.";
          }

           log.info({ searchTarget: resolvedSearchTarget }, "Auto-searching before download in national-legal-tool");
           try {
             const searchResults = await searchNationalLegal(resolvedSearchTarget);
            if (searchResults.length === 0) {
              return (
                `Không tìm thấy văn bản nào khớp "${searchTarget}" trên Cổng Pháp luật quốc gia, CSDL quốc gia (vbpl.vn), Công báo hay TVPL để tải.\n` +
                `Vui lòng kiểm tra lại số hiệu văn bản.`
              );
            }

            // Kiểm tra xem yêu cầu có phải là tải nhiều văn bản không ("các nghị định", "danh sách", "những")
             const hasExplicitDocumentRequest = /\b(?:qđ|quyết định|nghị định|thông tư|luật)\b/i.test(resolvedSearchTarget) && /\b\d{2,6}\b/.test(resolvedSearchTarget);
             const isPlural = !hasExplicitDocumentRequest && /\b(các|những|danh sách|toàn bộ|tất cả)\b/i.test(resolvedSearchTarget);

            const countToDownload = isPlural ? Math.min(searchResults.length, limit > 1 ? limit : 3) : 1;

            if (countToDownload > 1 && sendFileToChat) {
              const sentFiles: string[] = [];
              const failedFiles: string[] = [];

              for (let i = 0; i < countToDownload; i++) {
                const item = searchResults[i];
                try {
                  const dl = await downloadNationalLegal(item.downloadId, item.source, format || "pdf", item.soHieu);
                  if (dl.filePath) {
                    const fileName = path.basename(dl.filePath);
                    await guiFileKemCaption(
                      api,
                      `${account.id}:${message.threadId}`,
                      message.threadId,
                      message.threadType,
                      dl.filePath,
                      undefined,
                    );
                    ghiNhanDaGui?.(ghiChuDaGuiFile(fileName, `VB PL TW (${item.source})`));
                    sentFiles.push(`${item.soHieu || fileName} (${Math.round(dl.fileSize / 1024)} KB)`);
                    await new Promise((r) => setTimeout(r, 600));
                  } else {
                    failedFiles.push(item.soHieu || item.downloadId);
                  }
                } catch (dlErr) {
                  log.error({ dlErr, item }, "Failed downloading batch item");
                  failedFiles.push(item.soHieu || item.downloadId);
                }
              }

              let msg = `✅ ĐÃ TẢI VÀ GỬI ${sentFiles.length} VĂN BẢN VÀO CHAT CHO NGƯỜI DÙNG:\n` + sentFiles.map((s) => `- ${s}`).join("\n");
              if (searchResults.length > countToDownload) {
                msg += `\n\n📋 Danh sách các văn bản khác cùng đợt:\n` + searchResults.slice(countToDownload, countToDownload + 7).map((r) => `- ${r.soHieu} (${r.ngayBanHanh}): ${r.trichYeu.slice(0, 70)}`).join("\n");
              }
              msg += `\n(File đã được gửi trực tiếp vào chat. Chỉ cần báo ngắn gọn đã gửi file, không gửi link hay caption trùng lặp)`;
              return msg;
            }

              const best = searchResults[0];
              if (!best) return `Không xác định được văn bản chính xác từ yêu cầu "${resolvedSearchTarget}".`;
              targetDownloadId = best.downloadId;

             targetSource = best.source;
             targetSoHieu = targetSoHieu || best.soHieu;
             log.info({ selected: best.soHieu, source: best.source, downloadId: best.downloadId }, "Selected best national legal result");
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
                : targetSource === "phapluat"
                  ? "Cổng Pháp luật quốc gia"
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
    const srcIcon = r.source === "congbao" ? "🏛️" : r.source === "vbpl" ? "⚖️" : r.source === "phapluat" ? "🇻🇳" : "📚";
    const srcName =
      r.source === "congbao"
        ? "Công báo CP"
        : r.source === "vbpl"
          ? "CSDL quốc gia (vbpl.vn)"
          : r.source === "phapluat"
            ? "Cổng Pháp luật quốc gia"
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

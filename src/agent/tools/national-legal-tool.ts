import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { searchNationalLegal, downloadNationalLegal } from "../../legal/services/national-legal-service.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiFile } from "./sent-by-tool-note.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import type { ToolContext } from "./tool-catalog-types.js";
import { createLogger } from "../../shared/logger.js";
import { baoDaGuiNhieu, formatSearchResults, soLuongCanTai, taiVaGuiNhieu, tenNguon } from "./national-legal-helpers.js";

const log = createLogger("national-legal-tool");

/** "các/những/danh sách..." → người dùng muốn nhiều VB */
const LA_SO_NHIEU = /\b(các|những|danh sách|toàn bộ|tất cả)\b/i;

export function createNationalLegalTool(ctx: ToolContext) {
  const { api, account, message, ghiNhanDaGui } = ctx;
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
      const dinhDang = format || "pdf";

      // ── SEARCH ──
      if (action === "search") {
        if (!keyword) return ketQuaLoi("Cần nhập từ khóa để tìm kiếm VB pháp luật cấp TW.");
        try {
          const results = await searchNationalLegal(keyword);
          if (results.length === 0) {
            return ketQuaLoi(
              `Không tìm thấy văn bản nào khớp từ khóa "${keyword}" trên Cổng Pháp luật quốc gia, Công báo Chính phủ, CSDL quốc gia về pháp luật (vbpl.vn) và Thư viện Pháp luật.\n` +
                `Vui lòng kiểm tra lại số hiệu hoặc cơ quan ban hành.`,
            );
          }
          // Model gọi search nhưng bật sendFileToChat (thực ra muốn tải file)
          if (sendFileToChat) {
            const n = soLuongCanTai(LA_SO_NHIEU.test(keyword), results.length, limit);
            const { sent, failed } = await taiVaGuiNhieu(ctx, results.slice(0, n), dinhDang);
            if (sent.length > 0) return baoDaGuiNhieu(sent, failed, results, n);
          }
          return formatSearchResults(results, keyword);
        } catch (err) {
          log.error({ err, keyword }, "National legal search error");
          return ketQuaLoi("Lỗi khi tra cứu VB pháp luật (nguồn đang lỗi hoặc quá tải). Thử lại sau hoặc dùng legal_search/web_search.");
        }
      }

      if (action !== "download") {
        return ketQuaLoi("Hành động không hợp lệ. Dùng 'search' để tìm hoặc 'download' để tải.");
      }

      // ── DOWNLOAD ──
      let targetDownloadId = downloadId;
      let targetSource = source;
      let targetSoHieu = soHieu;

      // Tự động tìm kiếm trước nếu chưa có downloadId hoặc source
      if (!targetDownloadId || !targetSource) {
        const searchTarget = targetSoHieu || keyword;
        if (searchTarget && !targetSoHieu && /luật\s+đất\s+đai/i.test(searchTarget)) {
          targetSoHieu = "31/2024/QH15";
        }
        const resolved = targetSoHieu || searchTarget;
        if (!resolved) {
          return ketQuaLoi("Cần cung cấp từ khóa, số hiệu hoặc downloadId để tải văn bản pháp luật.");
        }
        log.info({ searchTarget: resolved }, "Auto-searching before download in national-legal-tool");
        try {
          const results = await searchNationalLegal(resolved);
          if (results.length === 0) {
            return ketQuaLoi(
              `Không tìm thấy văn bản nào khớp "${searchTarget}" trên Cổng Pháp luật quốc gia, CSDL quốc gia (vbpl.vn), Công báo hay TVPL để tải.\n` +
                `Vui lòng kiểm tra lại số hiệu văn bản.`,
            );
          }
          // Có số hiệu cụ thể ("NĐ 349") thì luôn chỉ tải 1 VB, kể cả câu có chữ "các"
          const coSoHieuCuThe = /\b(?:qđ|quyết định|nghị định|thông tư|luật)\b/i.test(resolved) && /\b\d{2,6}\b/.test(resolved);
          const n = soLuongCanTai(!coSoHieuCuThe && LA_SO_NHIEU.test(resolved), results.length, limit);
          if (n > 1 && sendFileToChat) {
            const { sent, failed } = await taiVaGuiNhieu(ctx, results.slice(0, n), dinhDang);
            if (sent.length === 0) {
              return ketQuaLoi(`Tìm thấy văn bản nhưng tải/gửi thất bại tất cả (${failed.join(", ")}). Không được báo là đã gửi.`);
            }
            return baoDaGuiNhieu(sent, failed, results, n);
          }
          const best = results[0]!;
          targetDownloadId = best.downloadId;
          targetSource = best.source;
          targetSoHieu = targetSoHieu || best.soHieu;
          log.info({ selected: best.soHieu, source: best.source, downloadId: best.downloadId }, "Selected best national legal result");
        } catch (err) {
          log.error({ err, searchTarget }, "Auto-search error before download");
          return ketQuaLoi("Lỗi khi tra cứu văn bản để tải (nguồn đang lỗi hoặc quá tải). Thử lại sau.");
        }
      }

      try {
        const dl = await downloadNationalLegal(targetDownloadId, targetSource, dinhDang, targetSoHieu);
        if (!dl.filePath) {
          return ketQuaLoi(`Tải VB thất bại: ${dl.error || "lỗi không xác định"}. Không được báo là đã tải.`);
        }
        const fileName = path.basename(dl.filePath);
        const sourceLabel = tenNguon(targetSource);
        if (!sendFileToChat) {
          return `✅ Đã tải VB thành công:\n- File: ${fileName}\n- Kích thước: ${Math.round(dl.fileSize / 1024)} KB\n- Nguồn: ${sourceLabel}`;
        }
        try {
          await guiFileKemCaption(api, `${account.id}:${message.threadId}`, message.threadId, message.threadType, dl.filePath, undefined);
        } catch (sendErr) {
          log.error({ sendErr, filePath: dl.filePath }, "Failed to send file to chat");
          return ketQuaLoi(`Đã tải file ${fileName} nhưng gửi vào chat thất bại. Không được báo là đã gửi.`);
        }
        ghiNhanDaGui?.(ghiChuDaGuiFile(fileName, `VB PL TW (${targetSource})`));
        return (
          `✅ ĐÃ TẢI VÀ GỬI FILE VÀO CHAT: ${fileName} (${Math.round(dl.fileSize / 1024)} KB)\n` +
          `Nguồn: ${sourceLabel}\n` +
          `Số hiệu: ${targetSoHieu || "N/A"}\n` +
          `(File đã được gửi trực tiếp đến người dùng trong chat. Chỉ cần báo ngắn gọn đã gửi file, không gửi link hay caption trùng lặp)`
        );
      } catch (err) {
        log.error({ err, targetDownloadId }, "National legal download error");
        return ketQuaLoi("Lỗi khi tải VB (nguồn đang lỗi hoặc quá tải). Thử lại sau. Không được báo là đã tải.");
      }
    },
  });
}

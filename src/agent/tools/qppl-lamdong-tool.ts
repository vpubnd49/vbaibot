import { tool } from "ai";
import { z } from "zod";
import { getQpplDocById, countQpplDocs } from "../../qppl/qppl-store.js";
import { syncQpplDocuments, downloadAllFilesForDoc } from "../../qppl/qppl-service.js";
import type { QpplNguon } from "../../qppl/qppl-types.js";
import { resolveAgency, getAgencyConfig } from "../../qppl/qppl-registry.js";
import type { ToolContext } from "./tool-catalog-types.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { formatQpplDetail, formatQpplList, locTheoThang, loaiTrungSoKyHieu } from "./qppl-tool-format.js";
import { guiFileMotVb, guiFileNhieuVb, guiZipQppl, type KetQuaTai } from "./qppl-tool-send.js";
import { timVanBanQppl } from "./qppl-tool-search.js";

/** Phân giải mã nguồn từ coQuan → nguon → keyword (keyword chỉ nhận khi không phải UBND chung). */
function phanGiaiNguon(coQuan?: string, nguon?: string, keyword?: string): QpplNguon | undefined {
  if (coQuan) {
    const ag = resolveAgency(coQuan);
    if (ag) return ag.code;
  }
  if (nguon) {
    const ag = resolveAgency(nguon);
    return ag ? ag.code : (nguon as QpplNguon);
  }
  if (keyword) {
    const ag = resolveAgency(keyword);
    if (ag && ag.code !== "ubnd") return ag.code;
  }
  return undefined;
}

export function createQpplLamdongTool(ctx: ToolContext) {
  return tool({
    description:
      "BẮT BUỘC GỌI TOOL NÀY khi người dùng yêu cầu tra cứu, tìm kiếm hoặc TẢI FILE văn bản chỉ đạo điều hành, " +
      "báo cáo, quyết định, công văn, kế hoạch của UBND Tỉnh, HĐND Tỉnh hoặc BẤT KỲ SỞ BAN NGÀNH, ĐỊA PHƯƠNG CỦA LÂM ĐỒNG " +
      "(Sở Tư pháp, Sở Tài chính, Sở Giáo dục & Đào tạo, Sở Nội vụ, Thanh tra tỉnh, UBND huyện Đức Trọng, Di Linh, Đạ Tẻh, TP. Đà Lạt...). " +
      "Khi người dùng hỏi báo cáo/văn bản của ngành hoặc huyện nào, LUÔN truyền 'coQuan' tương ứng để tìm chính xác tại nguồn đó. " +
      "KHI NGƯỜI DÙNG YÊU CẦU TẢI FILE (VD: 'tải quyết định 4480', 'tải kế hoạch 15187', 'gửi file...'): " +
      "BẮT BUỘC đặt sendFileToChat=true và keyword là số hiệu văn bản để tool tải toàn bộ file đính kèm gửi thẳng vào chat. " +
      "Tool CHỈ tải các file PDF chính thức của đúng nội dung tải, TUYỆT ĐỐI KHÔNG tải hay gửi file Word dự thảo.",
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
          "Từ khóa tìm kiếm: số ký hiệu (VD: '4496/QĐ-UBND'), trích yếu, tên văn bản, lĩnh vực, hoặc 'mới nhất'",
        ),
      coQuan: z
        .string()
        .optional()
        .describe(
          "Tên cơ quan, Sở ban ngành hoặc huyện/thành phố để tra cứu đích danh (VD: 'Sở Tư pháp', 'Sở Tài chính', 'Sở Giáo dục', 'Đức Trọng', 'UBND tỉnh'...). Hệ thống sẽ tự động đối chiếu và quét đúng cơ quan tương ứng.",
        ),
      loaiVanBan: z
        .string()
        .optional()
        .describe(
          "Lọc theo loại VB: 'Công văn', 'Quyết định', 'Nghị quyết', 'Chỉ thị', 'Báo cáo', 'Tờ trình'",
        ),
      nguon: z
        .string()
        .optional()
        .describe("Mã nguồn cơ quan nếu biết (VD: 'ubnd', 'hdnd', 'stp', 'stc', 'snv', 'ductrong', 'sgd_edu'...)"),
      docId: z
        .number()
        .optional()
        .describe("ID văn bản (dùng cho action 'get')"),
      dateFrom: z
        .string()
        .optional()
        .describe(
          "Ngày bắt đầu ISO (VD: '2026-01-01'). Dùng để lọc VB theo khoảng thời gian. " +
          "Ví dụ: tháng 1/2026 → dateFrom='2026-01-01', dateTo='2026-02-01'",
        ),
      dateTo: z
        .string()
        .optional()
        .describe(
          "Ngày kết thúc ISO (VD: '2026-02-01'). Kết hợp dateFrom. " +
          "Ví dụ: 6 tháng đầu 2026 → dateFrom='2026-01-01', dateTo='2026-07-01'",
        ),
      sendFileToChat: z
        .boolean()
        .optional()
        .default(false)
        .describe("Nếu true, tải file PDF/DOC và gửi thẳng vào chat cho người dùng"),
      archiveFiles: z
        .boolean()
        .optional()
        .default(false)
        .describe("Nếu true cùng sendFileToChat, gom toàn bộ file thành một ZIP kèm MANIFEST.csv rồi gửi một lần"),
      maxSendDocs: z
        .number()
        .optional()
        .default(1)
        .describe(
          "Số VB tối đa gửi file vào chat (mặc định 1 = chỉ VB đầu tiên/mới nhất). " +
          "Đặt >1 khi user yêu cầu 'tất cả', 'mấy cái', 'các VB' — VD: 'gửi tất cả báo cáo CCHC' → maxSendDocs=10.",
        ),
    }),
    execute: async ({ action, keyword, coQuan, loaiVanBan, nguon, docId, dateFrom, dateTo, sendFileToChat, archiveFiles, maxSendDocs }) => {
      const targetNguon = phanGiaiNguon(coQuan, nguon, keyword);

      // === SYNC ===
      if (action === "sync") {
        const target = targetNguon || "ubnd";
        const syncRes = await syncQpplDocuments(target, 200);
        const agConfig = getAgencyConfig(target);
        return (
          `Đã đồng bộ văn bản (nguồn: ${agConfig?.name || target.toUpperCase()}): ` +
          `Quét ${syncRes.totalScanned} mục, cập nhật ${syncRes.updated} mục. ` +
          `Tổng: ${countQpplDocs(target)} văn bản trong kho.`
        );
      }

      // === GET (chi tiết + tải file) ===
      if (action === "get" && docId) {
        const doc = getQpplDocById(docId);
        if (!doc) return ketQuaLoi(`Không tìm thấy văn bản QPPL có ID #${docId}. Dùng action=search để lấy ID đúng.`);
        let sendNote = "";
        if (sendFileToChat) {
          // Tải TẤT CẢ file đính kèm
          const dl = await downloadAllFilesForDoc(docId);
          sendNote = archiveFiles ? await guiZipQppl(ctx, [doc], [{ doc, download: dl }]) : await guiFileMotVb(ctx, doc, dl);
        }
        return formatQpplDetail(doc, sendNote);
      }

      // === SEARCH (mặc định) ===
      const docs = await timVanBanQppl({ keyword, loaiVanBan, targetNguon, dateFrom, dateTo });
      if (docs.length === 0) {
        const agencyName = targetNguon ? (getAgencyConfig(targetNguon)?.name || targetNguon) : "Lâm Đồng";
        return (
          `Không tìm thấy văn bản nào của ${agencyName} phù hợp với "${keyword || ""}". ` +
          `Thử từ khóa rộng hơn (VD: số hiệu, loại VB, năm ban hành).`
        );
      }

      let sendStatusNote = "";
      if (sendFileToChat) {
        // Giới hạn số VB gửi file: mặc định 1 (chỉ VB mới nhất). User nói "tất cả" → model đặt maxSendDocs > 1.
        const toSend = locTheoThang(loaiTrungSoKyHieu(docs), dateFrom, dateTo).slice(0, maxSendDocs);
        if (archiveFiles) {
          const results: KetQuaTai[] = [];
          for (const d of toSend) results.push({ doc: d, download: await downloadAllFilesForDoc(d.id) });
          sendStatusNote = await guiZipQppl(ctx, toSend, results);
        } else {
          sendStatusNote = await guiFileNhieuVb(ctx, toSend);
        }
      }

      return formatQpplList(docs, targetNguon, keyword, sendStatusNote);
    },
  });
}

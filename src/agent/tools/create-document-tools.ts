import { unescapeNewlinesDeep, explodeBlockLines, coBangGia, THONG_BAO_BANG_GIA } from "../../documents/normalize-newlines.js";
import { tool } from "ai";
import { z } from "zod";
import {
  documentBlockSchema,
  sheetSchema,
  type DocumentBlock,
  type Sheet,
} from "../../documents/document-content-schema.js";
import { pptxSlideSchema, pptxThemeSchema, type PptxSlide } from "../../documents/pptx-content-schema.js";
import { checkDocumentRateLimit } from "../../documents/document-rate-limit.js";
import {
  checkDocumentLimits,
  checkSpreadsheetLimits,
  checkPresentationLimits,
  safeFileName,
} from "../../documents/document-limits.js";
import { renderDocx } from "../../documents/render-docx.js";
import { renderXlsx } from "../../documents/render-xlsx.js";
import { renderPptx } from "../../documents/render-pptx.js";
import { getTuning } from "../../config/runtime-tuning-settings.js";
import { deliverFile, guard, type Ctx } from "./document-delivery.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { createLogger } from "../../shared/logger.js";
import { replaceOutdatedOrgNames, replaceOutdatedOrgNamesInText } from "../outdated-content-guard.js";

/**
 * Tool tạo file .docx/.xlsx rồi GỬI LUÔN cho cuộc trò chuyện.
 *
 * Tự gửi thay vì để model gọi tiếp send_file, vì 2 lý do: file nằm ở thư mục tạm
 * (send_file chỉ nhận shared-files hoặc URL), và tách 2 bước tốn thêm một lượt
 * gửi lại toàn bộ hội thoại. Học pattern `deliver` của GoClaw - kể cả câu trả về
 * cũng phải dặn model đừng gửi lại, nếu không nó rất dễ gọi send_file lần nữa và
 * người dùng nhận file 2 lần.
 *
 * An toàn: tool chỉ nhận DỮ LIỆU (tiêu đề, đoạn văn, bảng), không nhận code và
 * không đọc file nào từ đĩa theo yêu cầu của model.
 */

const log = createLogger("create-document");

export function createWordDocumentTool(ctx: Ctx) {
  return tool({
    description:
      "Tạo file Word (.docx) chuẩn văn bản Việt Nam (Times New Roman 13pt) rồi gửi luôn cho người dùng. " +
      "Dùng khi người dùng yêu cầu file, hoặc khi nội dung dài/có bảng mà đọc trong chat sẽ rối.\n" +
      "QUY TẮC BÔI ĐỎ TỪ ĐÃ SỬA: Khi người dùng nhờ rà soát, sửa lỗi chính tả, biên tập lại tài liệu -> " +
      "BẮT BUỘC dùng `<red>từ đã sửa</red>` (hoặc `~~từ cũ~~ <red>từ mới</red>`) trong các đoạn văn paragraph/items để bôi đỏ nổi bật các từ đã sửa trong file Word cho người dùng dễ nhìn thấy.\n" +
      "Văn bản hành chính: mở đầu bằng two_columns (cơ quan bên trái, quốc hiệu **CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM** bên phải), " +
      "dòng địa danh - ngày tháng dùng paragraph align right, kết bằng two_columns (nơi nhận | chức vụ + tên người ký). " +
      "Nội dung ngắn thì trả lời thẳng, đừng tạo file.",
    inputSchema: z.object({
      fileName: z.string().min(1).describe('Tên file, vd "bao-gia-thang-7.docx"'),
      title: z.string().optional().describe("Tiêu đề canh giữa, đậm, ở đầu trang"),
      blocks: z
        .array(documentBlockSchema)
        .min(1)
        .describe("Nội dung theo thứ tự: heading, paragraph, bullets, table, two_columns"),
      caption: z.string().optional().describe("Lời nhắn gửi kèm file"),
    }),
    execute: ({ fileName, title, blocks, caption }) =>
      guard(async () => {
        const limit = checkDocumentLimits(blocks as DocumentBlock[]);
        if (!limit.ok) return ketQuaLoi(limit.reason);

        const rate = checkDocumentRateLimit(`${ctx.account.id}:${ctx.message.threadId}`);
        if (!rate.ok) return ketQuaLoi(rate.reason);

        const sanitizedBlocks = explodeBlockLines(unescapeNewlinesDeep(replaceOutdatedOrgNames(blocks))) as DocumentBlock[];
        if (sanitizedBlocks.some((b) => b.type === "bullets" && coBangGia(b.items))) {
          return ketQuaLoi(THONG_BAO_BANG_GIA);
        }
        const sanitizedTitle = title ? unescapeNewlinesDeep(replaceOutdatedOrgNamesInText(title)) : undefined;

        const data = await renderDocx(sanitizedBlocks, { title: sanitizedTitle });
        return deliverFile(ctx, safeFileName(fileName, "docx"), data, caption);
      }),
  });
}

export function createExcelFileTool(ctx: Ctx) {
  return tool({
    description:
      "Tạo file Excel (.xlsx) trình bày sẵn đẹp (banner, header nổi, sọc xen kẽ, số liệu tô màu) rồi gửi luôn cho người dùng. " +
      "Hợp với báo giá, danh sách, bảng số liệu, báo cáo tổng hợp.\n" +
      'Ô trong rows: chuỗi, số (BẮT BUỘC dùng số thực/nguyên cho các cột số lượng, kinh phí, tiến độ để Excel tính toán được), hoặc công thức dạng chuỗi "=B2*C2" (nhân 2 ô cùng dòng) / "=SUM(D2:D9)" (cộng 1 cột, đánh số coi header là dòng 1). ' +
      "HÀNG TỔNG CỘNG: Cột số lượng/tổng BẮT BUỘC dùng công thức SUM (ví dụ: '=SUM(C2:C7)') thay vì ghi số chết hoặc ghi text thô, để người dùng sửa số là bảng tự động cập nhật lại.\n" +
      "BẮT BUỘC gọi tool khi người dùng yêu cầu xuất Excel; không chỉ mô tả hoặc hứa hẹn. " +
      "Cho phép rows rỗng khi người dùng yêu cầu file mẫu chỉ gồm tiêu đề và cột; nếu là báo cáo có số liệu thì điền đầy đủ các dòng. " +
      "VIẾT ĐẦY ĐỦ như một báo cáo thật, đừng tóm tắt cụt lủn: báo cáo tổng hợp nên tách nhiều sheet " +
      "(tổng quan, chi tiết từng mục, số liệu, rủi ro/kết luận, nguồn tham khảo), mỗi sheet có title + subtitle + note, " +
      "mỗi ô mô tả trọn ý chứ không phải vài chữ. Đã bỏ công tạo file thì nội dung phải đáng để mở ra đọc.\n" +
      'MỌI chữ (tên sheet, tên file, header, nội dung) GIỮ NGUYÊN dấu tiếng Việt - viết "Tổng quan" chứ không "Tong quan".',
    inputSchema: z.object({
      fileName: z.string().min(1).describe('Tên file, vd "bao-gia.xlsx"'),
      sheets: z.array(sheetSchema).min(1).describe("Danh sách sheet, mỗi sheet có tên + cột + dòng"),
      caption: z.string().optional().describe("Lời nhắn gửi kèm file"),
    }),
    execute: ({ fileName, sheets, caption }) =>
      guard(async () => {
        const limit = checkSpreadsheetLimits(sheets as Sheet[]);
        if (!limit.ok) return ketQuaLoi(limit.reason);

        const rate = checkDocumentRateLimit(`${ctx.account.id}:${ctx.message.threadId}`);
        if (!rate.ok) return ketQuaLoi(rate.reason);

        const sanitizedSheets = replaceOutdatedOrgNames(sheets) as Sheet[];

        let data: Buffer;
        try {
          data = await renderXlsx(sanitizedSheets);
        } catch (err) {
          log.error({ accountId: ctx.account.id, threadId: ctx.message.threadId, fileName, stage: "render", err }, "Dựng file Excel thất bại");
          throw err;
        }
        return deliverFile(ctx, safeFileName(fileName, "xlsx"), data, caption);
      }),
  });
}

export function createPowerpointTool(ctx: Ctx) {
  return tool({
    description:
      "Tạo file PowerPoint (.pptx) trình chiếu chuyên nghiệp 16:9 rồi gửi luôn cho người dùng. " +
      "Dùng khi người dùng cần slide thuyết trình, báo cáo hội nghị, trình chiếu dự án, giới thiệu sản phẩm. " +
      "Hỗ trợ 7 loại slide: title_slide (trang bìa, có badge), section_slide (ngăn phần), " +
      "content_slide (bullet points, có thể kèm icon emoji), two_columns_slide (so sánh 2 cột), " +
      "feature_cards_slide (2-4 card tính năng cạnh nhau — phù hợp giới thiệu sản phẩm), " +
      "table_slide (bảng số liệu), quote_slide (trích dẫn nhấn mạnh). " +
      "Bullet items hỗ trợ icon emoji: dùng {icon: '📊', text: 'Nội dung'} hoặc string thuần. " +
      "Bôi đậm bằng **chữ đậm** trong text bullet. Mỗi slide content tối đa 6-8 bullets ngắn gọn. " +
      "Theme 'zaloagent': nền trắng, card bo tròn, accent cam/xanh lá — lý tưởng cho pitch deck, giới thiệu sản phẩm. " +
      "MỌI chữ GIỮ NGUYÊN dấu tiếng Việt.",
    inputSchema: z.object({
      fileName: z.string().min(1).describe('Tên file, vd "bao-cao-quy-3.pptx"'),
      title: z.string().optional().describe("Metadata tiêu đề bài trình chiếu"),
      theme: pptxThemeSchema,
      slides: z
        .array(pptxSlideSchema)
        .min(1)
        .describe("Danh sách slide theo thứ tự trình bày"),
      caption: z.string().optional().describe("Lời nhắn gửi kèm file"),
    }),
    execute: ({ fileName, title, theme, slides, caption }) =>
      guard(async () => {
        const limit = checkPresentationLimits(slides as PptxSlide[]);
        if (!limit.ok) return ketQuaLoi(limit.reason);

        const rate = checkDocumentRateLimit(`${ctx.account.id}:${ctx.message.threadId}`);
        if (!rate.ok) return ketQuaLoi(rate.reason);

        const defaultTheme = getTuning("DOCUMENT_DEFAULT_PPTX_THEME");
        const data = await renderPptx(slides as PptxSlide[], theme ?? defaultTheme, { title });
        return deliverFile(ctx, safeFileName(fileName, "pptx"), data, caption);
      }),
  });
}

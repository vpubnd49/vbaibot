import { tool } from "ai";
import { z } from "zod";
import { adminDocumentSchema, type AdminDocument } from "../../documents/admin-document-schema.js";
import { checkDocumentRateLimit } from "../../documents/document-rate-limit.js";
import { safeFileName } from "../../documents/document-limits.js";
import { renderAdminDocx } from "../../documents/render-admin-docx.js";
import { renderPartyDocx } from "../../documents/render-party-docx.js";
import { createLogger } from "../../shared/logger.js";
import { withNamedTempFile } from "../../shared/temp-file-store.js";
import type { ToolContext } from "./index.js";
import { ketQuaLoi, type KetQuaLoiTool } from "./tool-failure-result.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiFile } from "./sent-by-tool-note.js";

const log = createLogger("create-admin-document");

const DELIVERED_NOTE =
  "Đã tạo và GỬI văn bản hành chính (.docx) chuẩn Nghị định 30/2020/NĐ-CP (hoặc HD05) cho người dùng rồi. KHÔNG gọi send_file để gửi lại file này.";

type Ctx = Pick<ToolContext, "api" | "account" | "message" | "ghiNhanDaGui">;

async function deliverAdminFile(
  ctx: Ctx,
  fileName: string,
  data: Buffer,
  caption: string | undefined,
): Promise<string> {
  const threadKey = `${ctx.account.id}:${ctx.message.threadId}`;
  await withNamedTempFile(fileName, data, (filePath) =>
    guiFileKemCaption(
      ctx.api,
      threadKey,
      ctx.message.threadId,
      ctx.message.threadType,
      filePath,
      caption,
    ),
  );
  ctx.ghiNhanDaGui?.(ghiChuDaGuiFile(fileName, caption));
  log.info(
    { accountId: ctx.account.id, threadId: ctx.message.threadId, fileName, bytes: data.length },
    "Đã gửi văn bản hành chính chuẩn NĐ 30 tự tạo",
  );
  return `${DELIVERED_NOTE} (tên file: ${fileName}, ${Math.round(data.length / 1024)} KB)`;
}

async function guard(
  work: () => Promise<string | KetQuaLoiTool>,
): Promise<string | KetQuaLoiTool> {
  try {
    return await work();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log.warn({ err }, "Tạo/gửi văn bản hành chính thất bại");
    return ketQuaLoi(
      `Không tạo được văn bản hành chính (${reason}). Nói thật với người dùng và tóm tắt nội dung trực tiếp trong chat.`,
    );
  }
}

export function createAdminDocumentTool(ctx: Ctx) {
  return tool({
    description:
      "Tạo và xuất file Word (.docx) chuẩn thể thức và kỹ thuật trình bày theo Nghị định 30/2020/NĐ-CP của Chính phủ " +
      "(hoặc Hướng dẫn 05-HD/VPTW của Ban Chấp hành Trung ương Đảng) rồi gửi luôn cho người dùng.\n" +
      "Hỗ trợ 24 loại văn bản: Tờ trình (to_trinh), Quyết định (quyet_dinh), Công văn (cong_van), Giấy mời (giay_moi), " +
      "Kế hoạch (ke_hoach), Báo cáo (bao_cao), Thông báo (thong_bao), Biên bản (bien_ban), Quy chế (quy_che), Quy định (quy_dinh), v.v.\n" +
      "QUY TẮC BÔI ĐỎ TỪ ĐÃ SỬA KHI RÀ SOÁT / SỬA LỖI: Khi người dùng nhờ rà soát, sửa lỗi chính tả, biên tập lại văn bản, " +
      "BẮT BUỘC trong các đoạn văn của 'document.sections' phải dùng thẻ `<red>từ đã sửa</red>` (hoặc `~~từ sai~~ <red>từ đúng</red>`) " +
      "để bôi đỏ nổi bật tất cả các từ đã sửa trong file Word (.docx) xuất ra cho người dùng dễ nhìn thấy.\n" +
      "Tự động định dạng Quốc hiệu, Tiêu ngữ, Căn cứ pháp lý in nghiêng, thụt đầu dòng 1cm, số trang đỉnh trang, khối ký và nơi nhận chuẩn 100%.",
    inputSchema: z.object({
      fileName: z.string().min(1).describe('Tên file .docx, ví dụ: "to-trinh-phe-duyet-du-toan.docx"'),
      document: adminDocumentSchema.describe("Cấu trúc văn bản hành chính hoàn chỉnh"),
      caption: z.string().optional().describe("Lời nhắn kèm theo khi gửi file"),
    }),
    execute: ({ fileName, document: docData, caption }) =>
      guard(async () => {
        const rate = checkDocumentRateLimit(`${ctx.account.id}:${ctx.message.threadId}`);
        if (!rate.ok) return ketQuaLoi(rate.reason);

        const data =
          docData.heThong === "dang_hd05"
            ? await renderPartyDocx(docData as AdminDocument)
            : await renderAdminDocx(docData as AdminDocument);

        return deliverAdminFile(ctx, safeFileName(fileName, "docx"), data, caption);
      }),
  });
}

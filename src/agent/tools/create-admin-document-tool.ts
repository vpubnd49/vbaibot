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
import { replaceOutdatedOrgNames } from "../outdated-content-guard.js";

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

/** Tự động làm sạch các placeholder phổ biến trong căn cứ pháp lý và nội dung */
function cleanDocumentPlaceholders(doc: AdminDocument): AdminDocument {
  if (doc.canCuPhapLy) {
    doc.canCuPhapLy = doc.canCuPhapLy.map((cc) => {
      let s = cc;
      // Thông tư 01/2025/TT-BYT
      if (/01\/2025\/TT-BYT/i.test(s)) {
        if (/quy định về\s*\[/i.test(s) || /\[(?:tên đầy đủ|tên thông tư|điền)[^\]]*\]/i.test(s)) {
          s = s.replace(
            /(?:của Bộ Y tế\s+)?(?:quy định về\s+)?\[(?:tên đầy đủ của thông tư|tên thông tư|điền tên|tên đầy đủ)[^\]]*\]/gi,
            "ngày 01/01/2025 của Bộ trưởng Bộ Y tế quy định chi tiết và hướng dẫn thi hành một số điều của Luật Bảo hiểm y tế",
          );
        }
      }
      // Placeholder generic [tên đầy đủ...] hoặc [...]
      s = s.replace(/\s*\[(?:tên đầy đủ|điền tên|chèn tên|tên chính thức)[^\]]*\]/gi, "");
      return s;
    });
  }

  if (doc.sections) {
    for (const sec of doc.sections) {
      if (sec.paragraphs) {
        sec.paragraphs = sec.paragraphs.map((p) =>
          p.replace(/\s*\[(?:tên đầy đủ|điền tên|chèn tên|ghi rõ)[^\]]*\]/gi, ""),
        );
      }
    }
  }

  return doc;
}

export function createAdminDocumentTool(ctx: Ctx) {
  return tool({
    description:
      "Tạo và xuất file Word (.docx) chuẩn thể thức và kỹ thuật trình bày theo Nghị định 30/2020/NĐ-CP của Chính phủ " +
      "(hoặc Hướng dẫn 05-HD/VPTW của Ban Chấp hành Trung ương Đảng) rồi gửi luôn cho người dùng.\n" +
      "Hỗ trợ 24 loại văn bản: Tờ trình (to_trinh), Quyết định (quyet_dinh), Công văn (cong_van), Giấy mời (giay_moi), " +
      "Kế hoạch (ke_hoach), Báo cáo (bao_cao), Thông báo (thong_bao), Biên bản (bien_ban), Quy chế (quy_che), Quy định (quy_dinh), v.v.\n" +
      "⚠️ QUY TẮC CĂN CỨ PHÁP LÝ & PLACEHOLDER: Tuyệt đối KHÔNG để lại placeholder chưa điền như '[tên đầy đủ của thông tư]', '[căn cứ...]', '[điền...]', '[...]'. Mọi căn cứ pháp lý phải ghi rõ ràng, chính xác tên đầy đủ của văn bản.\n" +
      "⚠️ QUY TẮC NỘI DUNG BẮT BUỘC: Mỗi section trong 'document.sections' PHẢI chứa NỘI DUNG THỰC CHẤT đầy đủ. " +
      "CẤM chỉ viết câu dẫn mở đầu (ví dụ 'có ý kiến chỉ đạo như sau:') rồi bỏ trống. " +
      "Nếu là công văn giao việc: PHẢI ghi rõ đơn vị chủ trì, đơn vị phối hợp, nội dung công việc cụ thể, thời hạn, cơ quan nhận báo cáo trong paragraphs. " +
      "Nếu là tờ trình: PHẢI ghi rõ sự cần thiết, cơ sở pháp lý, nội dung đề xuất. " +
      "File xuất ra PHẢI đọc được hoàn chỉnh không thiếu nội dung.\n" +
      "QUY TẮC BÔI ĐỎ TỪ ĐÃ SỬA KHI RÀ SOÁT / SỬA LỖI: Khi người dùng nhờ rà soát, sửa lỗi chính tả, biên tập lại văn bản, " +
      "BẮT BUỘC trong các đoạn văn của 'document.sections' phải dùng thẻ `<red>từ đã sửa</red>` (hoặc `~~từ sai~~ <red>từ đúng</red>`) " +
      "để bôi đỏ nổi bật tất cả các từ đã sửa trong file Word (.docx) xuất ra cho người dùng dễ nhìn thấy.\n" +
      "Hỗ trợ các thẻ định dạng inline: `<b>đậm</b>` (hoặc `**đậm**`), `<i>nghiêng</i>` (hoặc `*nghiêng*`), `<u>gạch chân</u>`, `~~gạch bỏ~~`, `<red>bôi đỏ</red>` (hoặc `<green>`, `<blue>`). Tuyệt đối không gõ sai cú pháp thẻ như `<b1.`.\n" +
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

        const sanitizedDoc = cleanDocumentPlaceholders(
          replaceOutdatedOrgNames(docData) as AdminDocument,
        );

        // ── Validation: phát hiện công văn giao/chuyển bỏ trống nội dung ──
        // Bot hay viết phần dẫn "có ý kiến chỉ đạo như sau:" rồi TRỐNG nội
        // dung giao. Bắt bằng cách đo tổng ký tự thực sự trong sections.
        if (sanitizedDoc.loaiVanBan === "cong_van") {
          const allText = sanitizedDoc.sections
            .flatMap((s) => [...(s.paragraphs ?? []), ...(s.items ?? []), s.heading ?? ""])
            .join(" ");
          // Đếm ký tự chữ (loại bỏ khoảng trắng, dấu câu, thẻ html)
          const cleanText = allText.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
          const MIN_CONTENT_CHARS = 80; // Một đoạn giao ngắn nhất cũng ~80 ký tự
          if (cleanText.length < MIN_CONTENT_CHARS) {
            log.warn(
              { chars: cleanText.length, preview: cleanText.substring(0, 200) },
              "Công văn sections quá ngắn — thiếu nội dung giao/chuyển",
            );
            return ketQuaLoi(
              `Nội dung sections quá ngắn (${cleanText.length} ký tự < ${MIN_CONTENT_CHARS}). ` +
              "Công văn giao việc PHẢI có đoạn nêu rõ: (1) Giao đơn vị nào chủ trì, (2) Phối hợp ai, " +
              "(3) Nội dung công việc cụ thể, (4) Thời hạn hoàn thành. " +
              "Hãy gọi lại tool với paragraphs ĐẦY ĐỦ nội dung giao việc, " +
              "tham khảo mẫu: 'Giao Sở Tư pháp chủ trì, phối hợp với các sở, ban, ngành " +
              "nghiên cứu, triển khai theo yêu cầu tại Quyết định nêu trên; " +
              "gửi báo cáo cho UBND tỉnh trước ngày .../.../.../.'",
            );
          }
        }

        const data =
          sanitizedDoc.heThong === "dang_hd05"
            ? await renderPartyDocx(sanitizedDoc)
            : await renderAdminDocx(sanitizedDoc);

        return deliverAdminFile(ctx, safeFileName(fileName, "docx"), data, caption);
      }),
  });
}

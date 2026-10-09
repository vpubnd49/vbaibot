/**
 * Gửi file tự tạo (docx/xlsx/pptx) vào cuộc trò chuyện + bọc lỗi thành ketQuaLoi.
 * Tách từ create-document-tools.ts để file đó dưới 200 dòng.
 */
import { createLogger } from "../../shared/logger.js";
import { withNamedTempFile } from "../../shared/temp-file-store.js";
import type { ToolContext } from "./index.js";
import { ketQuaLoi, type KetQuaLoiTool } from "./tool-failure-result.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiFile } from "./sent-by-tool-note.js";

const log = createLogger("create-document");

const DELIVERED_NOTE =
  "Đã tạo và GỬI file cho người dùng rồi. KHÔNG gọi send_file để gửi lại file này.";

export type Ctx = Pick<ToolContext, "api" | "account" | "message" | "ghiNhanDaGui" | "fileDaGuiTrongLuot">;

/** Dựng buffer -> gửi kèm caption -> xóa file tạm. Trả câu cho model đọc. */
export async function deliverFile(
  ctx: Ctx,
  fileName: string,
  data: Buffer,
  caption: string | undefined,
): Promise<string> {
  const threadKey = `${ctx.account.id}:${ctx.message.threadId}`;
  log.info(
    { accountId: ctx.account.id, threadId: ctx.message.threadId, fileName, bytes: data.length, stage: "rendered" },
    "Đã dựng file tự tạo, bắt đầu gửi attachment",
  );
  try {
    await withNamedTempFile(fileName, data, (filePath) =>
      guiFileKemCaption(
        ctx.api,
        threadKey,
        ctx.message.threadId,
        ctx.message.threadType,
        filePath,
        caption,
        ctx.fileDaGuiTrongLuot,
      ),
    );
  } catch (err) {
    log.error(
      { accountId: ctx.account.id, threadId: ctx.message.threadId, fileName, bytes: data.length, stage: "delivery", err },
      "Gửi attachment file tự tạo thất bại",
    );
    throw err;
  }
  // Vào history: tin này KHÔNG đi qua `deliverChatReply` nên không ai ghi hộ.
  // Thiếu nó thì dashboard không thấy, và lượt sau bot không nhớ đã gửi file.
  ctx.ghiNhanDaGui?.(ghiChuDaGuiFile(fileName, caption));
  log.info(
    { accountId: ctx.account.id, threadId: ctx.message.threadId, fileName, bytes: data.length },
    "Đã gửi file tự tạo",
  );
  return `${DELIVERED_NOTE} (tên file: ${fileName}, ${Math.round(data.length / 1024)} KB)`;
}

/** Gói mọi nhánh lỗi thành câu cho model đọc - không throw ra agent loop */
export async function guard(
  work: () => Promise<string | KetQuaLoiTool>,
): Promise<string | KetQuaLoiTool> {
  try {
    return await work();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log.warn({ err }, "Tạo/gửi file thất bại");
    return ketQuaLoi(
      `Không tạo được file (${reason}). Nói thật với người dùng và trả lời nội dung trực tiếp trong chat.`,
    );
  }
}

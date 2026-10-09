import type { Tool } from "ai";
import { createLogger } from "../../shared/logger.js";
import { ketQuaLoi } from "./tool-failure-result.js";

const log = createLogger("safe-tool-wrapper");

/**
 * Lưới an toàn cuối cùng cho luật "tool không bao giờ ném lỗi ra agent loop".
 *
 * Mỗi tool vẫn phải tự bắt lỗi và trả `ketQuaLoi(...)` với câu tiếng Việt rõ
 * nghĩa. Lớp bọc này chỉ đỡ những exception lọt lưới (service DB/mạng ném bất
 * ngờ, tool mới quên try/catch) để cả lượt không chết, và để guard đếm được
 * đây là lượt hỏng (hình dạng `{ok:false, loi}`).
 *
 * Không nuốt lỗi khi lượt đã bị hủy (abortSignal) - lúc đó agent loop cần thấy
 * exception để dừng đúng cách.
 *
 * Không đưa `String(err)` thô cho model: chi tiết nội bộ (đường dẫn, stack, SQL)
 * chỉ ghi log, model nhận câu chung.
 */
export function bocToolAnToan(key: string, t: Tool): Tool {
  const goc = t.execute;
  if (typeof goc !== "function") return t;
  const execute = (async (input: unknown, options: { abortSignal?: AbortSignal }) => {
    try {
      return await (goc as (i: unknown, o: unknown) => unknown)(input, options);
    } catch (err) {
      if (options?.abortSignal?.aborted) throw err;
      log.error({ err, tool: key }, "Tool ném lỗi lọt lưới - đã chuyển thành ketQuaLoi");
      return ketQuaLoi(
        `Công cụ ${key} gặp lỗi nội bộ, chưa thực hiện được. ` +
          "Báo người dùng thử lại sau hoặc dùng cách khác; không được nói là đã làm xong.",
      );
    }
  }) as Tool["execute"];
  return { ...t, execute } as Tool;
}

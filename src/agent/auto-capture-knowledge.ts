import type { StepResult } from "ai";
import { proposeKnowledge } from "../conversation/shared-knowledge-store.js";
import { createLogger } from "../shared/logger.js";

const log = createLogger("auto-capture-knowledge");

/**
 * Tool tra cứu có giá trị lâu dài — kết quả LUÔN được auto-capture.
 * Không capture tool tạm thời (weather, finance_rates, news).
 */
const TOOL_CAPTURE_MAP: Record<string, string> = {
  legal_search: "legal",
  admin_division_lookup: "correction",
  tax_accounting_lookup: "legal",
};

/**
 * web_search chỉ capture khi query chứa từ khóa gợi ý thông tin lâu dài.
 * Loại bỏ: thời tiết, giá cả, tin tức thời sự, giải trí.
 */
const WEB_SEARCH_KEYWORDS = [
  "luật", "nghị định", "thông tư", "quy định", "quy trình",
  "diện tích", "dân số", "hành chính", "sáp nhập",
  "hiệu lực", "thay thế", "bãi bỏ", "ban hành",
  "tiêu chuẩn", "quy chuẩn", "hướng dẫn",
  "tỉnh", "thành phố", "đơn vị", "phường", "xã",
  "điều lệ", "nội quy", "chính sách",
];

const webSearchIsValuable = (query: string): boolean => {
  const lower = query.toLowerCase();
  return WEB_SEARCH_KEYWORDS.some((kw) => lower.includes(kw));
};

/**
 * Rút trích nội dung ngắn gọn từ kết quả tool (tối đa 500 ký tự).
 */
function condenseResult(raw: unknown): string {
  const str = typeof raw === "string" ? raw : JSON.stringify(raw);
  if (str.length <= 500) return str;
  return str.slice(0, 497) + "...";
}

/**
 * Sau mỗi lượt agent hoàn tất, quét tất cả tool calls đã chạy.
 * Nếu có tool tra cứu trả về kết quả — tự động lưu vào shared_knowledge
 * với status='pending' để admin duyệt trên Dashboard.
 *
 * Chạy FIRE-AND-FORGET: không block câu trả lời gửi cho người dùng.
 */
export function autoCaptureKnowledge(
  accountId: string,
  threadId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  steps: StepResult<any>[],
): void {
  try {
    let captured = 0;

    for (const step of steps) {
      for (const call of step.toolCalls) {
        const toolName = String("toolName" in call ? call.toolName : "");
        const args = ("args" in call ? call.args : {}) as Record<string, unknown>;

        // Xác định có phải tool cần capture không
        let category: string | undefined;

        if (toolName in TOOL_CAPTURE_MAP) {
          category = TOOL_CAPTURE_MAP[toolName];
        } else if (toolName === "web_search") {
          const query = (args.query ?? args.q ?? "") as string;
          if (webSearchIsValuable(query)) {
            category = "general";
          }
        }

        if (!category) continue;

        // Tìm kết quả tương ứng trong toolResults
        const result = step.toolResults.find(
          (r: { toolCallId: string }) => r.toolCallId === call.toolCallId,
        );
        if (!result) continue;

        const query =
          (args.query ?? args.q ?? args.keyword ?? args.ten ?? "") as string;
        const resultText = condenseResult("result" in result ? result.result : result);

        // Bỏ qua kết quả quá ngắn (lỗi, không tìm thấy)
        if (resultText.length < 30) continue;

        const content = `[Tra cứu: ${query}] ${resultText}`;
        const source = `tool:${toolName}`;

        const ketQua = proposeKnowledge({
          accountId,
          category,
          content: content.slice(0, 1000), // Giới hạn 1000 ký tự
          source,
          learnedInThreadId: threadId,
        });

        if (ketQua.ghi) captured++;
      }
    }

    if (captured > 0) {
      log.info({ captured, accountId, threadId }, "Auto-capture: lưu tri thức từ kết quả tra cứu");
    }
  } catch (err) {
    // Fire-and-forget: lỗi ở đây KHÔNG được ảnh hưởng câu trả lời
    log.warn({ err }, "Auto-capture knowledge lỗi (không ảnh hưởng trả lời)");
  }
}

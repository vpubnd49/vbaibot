import type { Tool } from "ai";
import type { AccountConfig } from "../../config/account-store.js";
import type { AgentProfile } from "../../config/agent-store.js";
import { TOOL_DEFINITIONS, type ToolContext, type ToolDefinition } from "./tool-catalog.js";
import { bocToolAnToan } from "./safe-tool-wrapper.js";

/**
 * Logic lọc + dựng tool cho 1 lượt agent. Hình dạng dữ liệu (type + catalog
 * `TOOL_DEFINITIONS`) nằm ở `tool-catalog.ts` - tách ra để file này không vượt
 * ngưỡng 200 dòng. Re-export lại để mọi nơi import từ "tool-registry.js" (hoặc
 * gián tiếp qua "index.js") như cũ, không phải sửa call site nào khác.
 */
export {
  TOOL_DEFINITIONS,
  TOOL_KEYS,
  DEFAULT_DISABLED_TOOL_KEYS,
  type ToolContext,
  type ToolDefinition,
  type ToolGroup,
} from "./tool-catalog.js";

/**
 * Hai lớp cùng quyết định một tool có được cấp hay không.
 *
 * - `agent` khai NĂNG LỰC: agent này biết làm những việc gì.
 * - `account` áp CHÍNH SÁCH: nick Zalo này được phép làm gì.
 *
 * Cả hai đều lưu danh sách TẮT, và kết quả là phần KHÔNG bên nào tắt. Không bên
 * nào bật ngược lại được bên kia - nhờ vậy thêm một agent mới không bao giờ nới
 * rộng được quyền của một nick, kể cả khi agent đó được tạo cẩu thả.
 */
export type ToolScope = {
  agent: Pick<AgentProfile, "disabledTools">;
  account: Pick<AccountConfig, "disabledTools">;
  thread?: { disabledTools?: string[] };
};

/**
 * Bộ tool đưa vào lượt agent, đã bỏ tool agent tắt, tool account tắt trên
 * dashboard, tool thread tắt riêng, và (với lượt theo lịch) tool có `runsInScheduledTurn: false`.
 * Tool bị tắt không xuất hiện trong schema -> model không biết nó tồn tại,
 * không tốn token mô tả, không thể bị prompt injection dụ gọi.
 */
export function buildAgentTools(ctx: ToolContext): Record<string, Tool> {
  const tools: Record<string, Tool> = {};
  for (const def of listAvailableTools(
    { agent: ctx.agent, account: ctx.account, thread: ctx.thread },
    { isolated: ctx.isolated },
  )) {
    tools[def.key] = bocToolAnToan(def.key, def.build(ctx));
  }
  return tools;
}

/**
 * Tool agent THỰC SỰ nhận được trong lượt này. Dùng chung bộ lọc với
 * `buildAgentTools` (chính nó gọi hàm này) vì system prompt cũng cần danh sách
 * để trả lời câu "bạn làm được gì" - hai nơi tự lọc riêng là sớm muộn cũng
 * lệch, và lệch nghĩa là bot hứa một tool mà model không hề nhận được.
 */
export function listAvailableTools(
  scope: ToolScope,
  context: { isolated?: boolean } = {},
): ToolDefinition[] {
  // Gộp ba danh sách TẮT thành một tập: tool nằm trong tập là bị loại, bất kể
  // bên nào tắt nó (agent, account, thread).
  const disabled = new Set([
    ...scope.agent.disabledTools,
    ...scope.account.disabledTools,
    ...(scope.thread?.disabledTools ?? []),
  ]);
  return TOOL_DEFINITIONS.filter((def) => {
    if (disabled.has(def.key)) return false;
    if (context.isolated && def.runsInScheduledTurn === false) return false;
    // Kiểm mỗi lượt: cấu hình từ dashboard ăn ngay không cần restart
    return !def.available || def.available();
  });
}


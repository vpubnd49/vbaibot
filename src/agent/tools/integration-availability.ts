import { db } from "../../conversation/database.js";

/**
 * Điều kiện "available" cho các tool tích hợp bên ngoài (Notion, MCP).
 * Chưa có cấu hình nào thì ẩn tool khỏi schema - model khỏi gọi vô ích rồi
 * nhận lỗi "chưa cấu hình". Kiểm mỗi lượt nên thêm cấu hình là dùng được ngay.
 * `available()` không có ctx nên chỉ xét "có ÍT NHẤT một account đã cấu hình";
 * tool vẫn tự kiểm cấu hình theo account khi chạy.
 * Bảng được tạo trong module tool tương ứng; lỗi truy vấn (bảng chưa có) => false.
 */
function coDong(sql: string): boolean {
  try {
    return db.prepare(sql).get() !== undefined;
  } catch {
    return false;
  }
}

export function hasAnyNotionConfig(): boolean {
  return coDong("SELECT 1 FROM notion_config WHERE enabled = 1 AND api_key <> '' LIMIT 1");
}

export function hasAnyMcpServer(): boolean {
  return coDong("SELECT 1 FROM mcp_servers WHERE enabled = 1 LIMIT 1");
}

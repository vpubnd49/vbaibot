/**
 * recent-file-picker.ts
 * Chọn file nguồn trong hội thoại theo TÊN (không chỉ theo số thứ tự).
 *
 * Lỗi thực tế: người dùng gửi file mẫu rồi gửi thêm vài ảnh; danh sách file xếp lẫn ảnh và
 * tài liệu, model gọi fileIndex=0 và đọc nhầm ảnh thay vì file mẫu. Tên file trên đĩa lại bị
 * làm sạch ("Q__th_nh_l_p...") nên không thể đoán từ đường dẫn → tra ngược tên gốc từ tin nhắn.
 */
import path from "node:path";
import { getRecentMessages } from "../../conversation/history-store.js";
import type { ToolContext } from "./index.js";

const fold = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();

/** Bản đồ localPath → tên file gốc người dùng gửi. */
export function originalNames(ctx: ToolContext): Map<string, string> {
  const map = new Map<string, string>();
  const scan = (msgs: any[]) => {
    for (const m of msgs) for (const f of m?.files ?? []) if (f.localPath && f.fileName) map.set(f.localPath, f.fileName);
  };
  scan(ctx.batch as any[]);
  scan(getRecentMessages(ctx.account.id, ctx.message.threadId) as any[]);
  return map;
}

export const labelOf = (p: string, names: Map<string, string>) => names.get(p) ?? path.basename(p);

/** Danh sách "0: tên" gọn để model biết đang có file nào. */
export function listChoices(paths: string[], names: Map<string, string>, max = 10): string {
  const rows = paths.slice(0, max).map((p, i) => `${i}: ${labelOf(p, names)}`);
  return rows.join("\n") + (paths.length > max ? `\n… và ${paths.length - max} file cũ hơn` : "");
}

/** Trả về vị trí file: ưu tiên khớp tên (không dấu, không phân biệt hoa thường), không có thì dùng fileIndex. */
export function pickIndex(
  paths: string[],
  names: Map<string, string>,
  fileIndex: number,
  fileName?: string,
): { index: number } | { error: string } {
  if (fileName?.trim()) {
    const q = fold(fileName.trim());
    const hit = paths.findIndex((p) => fold(labelOf(p, names)).includes(q));
    if (hit >= 0) return { index: hit };
    // File tới GIỮA lượt (chưa vào batch lẫn history) không có tên gốc, chỉ còn tên trên
    // đĩa đã bị media-store làm sạch: mọi ký tự ngoài [a-zA-Z0-9_-] thành "_"
    // ("Kiểm tra" → "Ki_m_tra"). Làm sạch từ khóa theo đúng luật đó rồi so lại.
    const s = fileName.trim().replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    if ((s.match(/[a-z0-9]/g) ?? []).length >= 4) {
      const hit2 = paths.findIndex((p) => path.basename(p).toLowerCase().includes(s));
      if (hit2 >= 0) return { index: hit2 };
    }
    return { error: `Không có file nào tên chứa "${fileName}". Các file hiện có:\n${listChoices(paths, names)}` };
  }
  if (fileIndex >= paths.length) {
    return { error: `Vị trí file ${fileIndex} không tồn tại. Các file hiện có:\n${listChoices(paths, names)}` };
  }
  return { index: fileIndex };
}

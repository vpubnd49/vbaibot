/**
 * normalize-newlines.ts
 * Chữa hai lỗi model hay gây khi dựng file Word theo mẫu (thấy trong ảnh chụp thật):
 *  1. Gõ chữ "\n" (gạch chéo + n) thay vì xuống dòng → file hiện nguyên "\n" giữa câu.
 *  2. Dựng BẢNG bằng gạch đầu dòng dạng "1 | | | | Nội dung" thay vì khối bảng thật.
 */

/** Đổi chuỗi "\n" (2 ký tự) thành xuống dòng thật, đệ quy qua object/mảng. */
export function unescapeNewlinesDeep<T>(value: T): T {
  if (typeof value === "string") return value.replace(/\\r\\n|\\n/g, "\n") as unknown as T;
  if (Array.isArray(value)) return value.map((v) => unescapeNewlinesDeep(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = unescapeNewlinesDeep(v);
    return out as T;
  }
  return value;
}

const splitLines = (items: string[]) =>
  items.flatMap((s) => s.split("\n").map((l) => l.trim()).filter(Boolean));

/** Với khối bullets/two_columns: mỗi dòng xuống dòng thành một mục riêng (docx bỏ qua "\n" trong một run). */
export function explodeBlockLines<B extends { type: string }>(blocks: B[]): B[] {
  return blocks.map((b: any) => {
    if (b.type === "bullets" && Array.isArray(b.items)) return { ...b, items: splitLines(b.items) };
    if (b.type === "two_columns") {
      return { ...b, left: splitLines(b.left ?? []), right: splitLines(b.right ?? []) };
    }
    return b;
  });
}

/** Mục kiểu "1 | | | | nội dung": ≥3 dấu gạch đứng. */
export const laDongBangGia = (s: string) => (s.match(/\|/g) ?? []).length >= 3;

/** Có ít nhất 2 mục là dòng bảng giả → model đang dựng bảng bằng gạch đầu dòng. */
export function coBangGia(items: string[] | undefined): boolean {
  return (items ?? []).filter(laDongBangGia).length >= 2;
}

export const THONG_BAO_BANG_GIA =
  "Phát hiện bảng bị dựng bằng gạch đầu dòng dạng \"1 | | | |\". Bảng PHẢI dùng khối bảng thật (table: headers + rows, ô trống để \"\"), " +
  "giữ đúng số cột và tên cột của mẫu. Nếu mẫu có bố cục riêng (tiêu đề hai cột, bảng nhiều cột, khối ký) hãy dùng create_word_document với " +
  "blocks two_columns / heading / table thay vì create_admin_document. Gọi lại tool, KHÔNG báo đã làm xong.";

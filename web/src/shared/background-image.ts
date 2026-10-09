import type { Theme } from "./use-theme";

/**
 * Ảnh nền theo chế độ sáng/tối. Hai file riêng chứ không phải một ảnh rồi lọc
 * màu bằng CSS: bản tối có hành tinh và chấm sáng vẽ khác hẳn, `filter:
 * invert()` chỉ cho ra một tấm xám bẩn.
 *
 * Cả hai đều là WebP ~7-13 KB (gốc PNG hơn 1 MB) - xem `web/public/`.
 *
 * Từ giao diện "nền kem" (09/10/2026), chế độ sáng KHÔNG dùng ảnh nền (ảnh cũ
 * tông xanh lệch màu với nền kem) - trả `null` để caller bỏ backgroundImage.
 */
export function anhNen(theme: Theme): string | null {
  return theme === "dark" ? "/dashboard-background-dark.webp" : null;
}

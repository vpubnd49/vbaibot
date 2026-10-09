/**
 * Định dạng tiếng Việt cho Trang chủ / Báo cáo / Nhật ký.
 * Hàm THUẦN (nhận `now` qua tham số) để test được, không phụ thuộc giờ máy.
 */

const THU = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export function loiChao(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 11) return "Chào buổi sáng!";
  if (h < 14) return "Chào buổi trưa!";
  if (h < 18) return "Chào buổi chiều!";
  return "Chào buổi tối!";
}

/** "Thứ Năm, ngày 8 tháng 10, 2026" */
export function ngayDayDu(d: Date): string {
  return `${THU[d.getDay()]}, ngày ${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
}

/** "40k", "872.6M", "1.2B" - gọn cho ô số nhỏ trên điện thoại */
export function soGon(n: number): string {
  const abs = Math.abs(n);
  const fmt = (v: number, s: string) => `${Number(v.toFixed(v < 10 ? 1 : v < 100 ? 1 : 0))}${s}`;
  if (abs >= 1e9) return fmt(n / 1e9, "B");
  if (abs >= 1e6) return fmt(n / 1e6, "M");
  if (abs >= 1e4) return fmt(n / 1e3, "k");
  return n.toLocaleString("vi-VN");
}

/** "13 giây trước", "5 phút trước" */
export function truocDay(ms: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s} giây trước`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} giờ trước` : `${Math.round(h / 24)} ngày trước`;
}

/** Khoảng tới một mốc tương lai: "32 phút", "2 giờ", "3 ngày" */
export function khoangToi(iso: string, now: number = Date.now()): string {
  const m = Math.max(0, Math.round((Date.parse(iso) - now) / 60_000));
  if (m < 60) return `${m} phút`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} giờ` : `${Math.round(h / 24)} ngày`;
}

/** "08:00" theo giờ trình duyệt (dashboard và bot cùng múi giờ VN trong thực tế) */
export function gioPhut(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** "08:00" nếu là hôm nay, "14/10 08:00" nếu ngày khác */
export function gioNgan(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (khoaNgay(d) === khoaNgay(now)) return gioPhut(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${gioPhut(iso)}`;
}

/** YYYY-MM-DD theo giờ địa phương của trình duyệt */
export function khoaNgay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function tuKhoaNgay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function congNgay(key: string, n: number): string {
  const d = tuKhoaNgay(key);
  d.setDate(d.getDate() + n);
  return khoaNgay(d);
}

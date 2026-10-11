/**
 * pass-status-rules.ts
 * Tính TRẠNG THÁI ĐÈO bằng code từ danh sách tin (mới nhất trước) - không để
 * model tự suy. Module thuần (không db/mạng) để test được.
 *
 * Nguyên tắc:
 *  - Tin mới nhất quyết định mô tả hiện tại.
 *  - Tin CẤM XE/CHIA CẮT chỉ được coi là hết hiệu lực khi có tin SAU nó nói rõ
 *    dỡ lệnh cấm / hoàn thành sửa chữa. Tin "thông tuyến" chung chung (có thể ở
 *    điểm sạt khác trên cùng đèo) KHÔNG xoá cảnh báo cấm xe.
 *  - Có sự cố/thi công trong khung tin → không bao giờ 🟢.
 */

export type PassEvidence = {
  title: string;
  source: string;
  publishedAt: Date;
  link: string;
  snippet: string;
};

export type PassStatus = { icon: string; lines: string[] };

const RE_RESTRICT =
  /cấm (xe|các phương tiện|phương tiện|lưu thông|ô tô)|chia cắt|tê liệt|phong tỏa|phong toả|đóng (đèo|đường|tuyến)|tạm dừng lưu thông|dừng lưu thông|không thể lưu thông|ách tắc|ùn tắc kéo dài/;
const RE_LIFT =
  /dỡ bỏ lệnh cấm|bỏ lệnh cấm|hết cấm|gỡ lệnh cấm|hoàn thành (sửa chữa|thi công|khắc phục)|hoàn tất (sửa chữa|thi công|khắc phục)|cho phép (các )?phương tiện lưu thông/;
const RE_INCIDENT = /sạt lở|sạt trượt|sụt lún|sụt lở|nứt|sự cố|tai nạn|lật|đá lăn|đá rơi|cây (rừng )?(ngã|đổ)|ngã đổ|hư hỏng|ngập/;
const RE_WORKS = /thi công|khắc phục|sửa chữa|gia cố|mở rộng|khẩn cấp|công trình|rào chắn|một chiều|phân luồng|hạn chế|xử lý/;
const RE_REOPEN = /thông xe|thông tuyến|khôi phục giao thông|lưu thông trở lại|thông đường/;

const lc = (s: string) => s.normalize("NFC").toLowerCase();

export function isRestrictText(text: string): boolean {
  return RE_RESTRICT.test(lc(text));
}

export function cleanTitle(t: string): string {
  return t
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/#\S+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
}

const dayMonth = (d: Date) =>
  d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" });

/** `evidence` phải sắp mới nhất trước. */
export function computePassStatus(evidence: PassEvidence[], windowDays: number): PassStatus {
  if (evidence.length === 0) {
    return { icon: "⚪", lines: [`Chưa có thông tin cập nhật trong ${windowDays} ngày.`] };
  }
  const items = evidence.map((e) => {
    const t = lc(`${e.title} ${e.snippet}`);
    return {
      e,
      restrict: RE_RESTRICT.test(t),
      lift: RE_LIFT.test(t),
      incident: RE_INCIDENT.test(t),
      works: RE_WORKS.test(t),
      reopen: RE_REOPEN.test(t),
    };
  });
  const latest = items[0]!;
  const d = (x: PassEvidence) => dayMonth(x.publishedAt);
  const lines = [`Tin mới nhất (${d(latest.e)}): ${cleanTitle(latest.e.title)}.`];

  // Lệnh cấm chưa có tin dỡ bỏ ở phía MỚI HƠN nó
  const unlifted = items.filter((it, idx) => it.restrict && !it.lift && !items.slice(0, idx).some((n) => n.lift));
  const banCurrent = latest.restrict && !latest.lift && !latest.reopen;
  for (const it of unlifted) {
    if (it === latest) continue;
    lines.push(`Lưu ý: tin ngày ${d(it.e)} báo "${cleanTitle(it.e.title)}" — CHƯA thấy tin dỡ bỏ, cần kiểm tra trước khi đi.`);
  }

  // Tin mới nhất là "thông xe" → nhắc việc thi công/khắc phục gần nhất để không bị che mất
  if (latest.reopen) {
    const works = items.find((it) => it !== latest && !it.reopen && !unlifted.includes(it) && (it.works || it.incident));
    if (works) lines.push(`Trước đó (${d(works.e)}): ${cleanTitle(works.e.title)}.`);
  }

  const anyIssue = items.some((it) => it.restrict || it.incident || it.works);
  const icon = banCurrent || (unlifted.length > 0 && !latest.reopen) ? "🔴" : anyIssue ? "🟡" : "⚪";
  if (latest.reopen && anyIssue) lines.push("Đã thông xe nhưng vừa có sự cố/đang khắc phục — cần thận trọng.");
  return { icon, lines };
}

/**
 * Phân loại lỗi vẽ ảnh: lần hỏng này CÓ ĐÁNG THỬ LẠI không.
 *
 * HAI LỚP lỗi đáng thử lại:
 *
 * 1. **Provider chạy xong mà không đẻ ra ảnh nào** (`LoiVeHutAnh`).
 *    Router gửi `tool_choice: "auto"` nên model upstream tự quyết có gọi tool
 *    vẽ hay không. Nó chọn trả lời bằng chữ là stream kết thúc sạch sẽ mà
 *    chẳng có ảnh. Đo thật 2026-08-05: lượt hỏng chạy 129,9 giây rồi mới báo
 *    lỗi, còn gọi lại ngay sau đó thì 9/9 lần ra ảnh.
 *
 * 2. **Lỗi kết nối tạm thời** (`LoiKetNoiTamThoi`): ECONNRESET, ECONNREFUSED,
 *    socket hang up, HTTP 502/503/504, fetch timeout. Đây là sự cố hạ tầng
 *    THOÁNG QUA — router/proxy tạm quá tải, Cloudflare trả 502, hoặc container
 *    đang restart. Thử lại sau vài giây thường thành công. Khác hẳn timeout
 *    vẽ ảnh (provider treo cả phút) — ở đây kết nối KHÔNG THÀNH LẬP ĐƯỢC hoặc
 *    bị cắt ngay, nên retry NHANH và không tốn thêm 2 phút chờ.
 *
 * VÌ SAO KHÔNG THỬ LẠI CÁC LỖI KHÁC:
 *   - HTTP 4xx: sai key, hết quota, sai tham số - lần sau y hệt lần trước.
 *   - chưa cấu hình đủ: thử lại vô nghĩa.
 *   - quá hạn vẽ ảnh (IMAGE_GEN_TIMEOUT_MS / stall): provider treo thật, retry
 *     là tốn thêm trọn một trần thời gian nữa mà nguyên nhân thường chưa hết.
 *     KHÁC với lỗi kết nối (fetch bị refuse/reset ngay lập tức, retry tức thì).
 *
 * HAI ĐƯỜNG NHẬN DIỆN cho mỗi lớp, cố ý xếp theo độ tin cậy giảm dần:
 *   1. Lớp Error riêng (`LoiVeHutAnh`, `LoiKetNoiTamThoi`) - do chính mình ném.
 *   2. Regex khớp câu lỗi - fallback cho lỗi do provider/runtime ném trực tiếp.
 */

/** Provider kết thúc mà không đưa ra ảnh nào */
export class LoiVeHutAnh extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoiVeHutAnh";
  }
}

/**
 * Lỗi kết nối tạm thời: provider không phản hồi được nhưng có thể sẵn sàng
 * ngay sau đó. Khác hẳn timeout vẽ ảnh: ở đây kết nối CHƯA BAO GIỜ thành lập
 * hoặc bị cắt trước khi provider bắt đầu vẽ.
 */
export class LoiKetNoiTamThoi extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoiKetNoiTamThoi";
  }
}

/**
 * Câu router dùng khi stream Codex chạy hết mà không thấy `image_generation_call`
 * nào có `result` (`codex.js:124` và `codex.js:194`). Nó ĐOÁN là tài khoản
 * thiếu quyền Plus/Pro, nhưng đó chỉ là nhánh bắt tất - nên chỉ khớp phần mô tả
 * sự việc ("không trả về ảnh"), bỏ qua phần suy đoán về tài khoản.
 */
const CHU_CUA_PROVIDER = /did not return an image/i;

/**
 * Regex nhận diện lỗi kết nối tạm thời từ câu lỗi của Node.js / proxy / CDN.
 *
 * ECONNRESET / ECONNREFUSED: server từ chối hoặc cắt kết nối TCP.
 * socket hang up: HTTP response chưa xong mà kết nối mất.
 * HTTP 502/503/504: proxy/CDN trả gateway error (Cloudflare, Nginx).
 * ETIMEDOUT / EHOSTUNREACH: DNS hoặc mạng chưa thông tạm thời.
 * fetch failed: undici / Node.js 18+ fetch bọc lỗi mạng bên trong.
 *
 * KHÔNG khớp: "Vẽ ảnh quá lâu" (stall/timeout vẽ) — đó là lỗi khác.
 */
const MAU_LOI_KET_NOI = /ECONNRESET|ECONNREFUSED|socket hang up|ETIMEDOUT|EHOSTUNREACH|fetch failed|HTTP 50[234]/i;

/** Câu lỗi này của provider có thuộc lớp "chạy xong mà không ra ảnh" không */
export function laChuVeHutAnh(message: string): boolean {
  return CHU_CUA_PROVIDER.test(message);
}

/** Câu lỗi này có thuộc lớp "kết nối tạm thời" không */
export function laChuKetNoiTamThoi(message: string): boolean {
  return MAU_LOI_KET_NOI.test(message);
}

/** Lỗi này có đáng gọi lại provider thêm một lần không (cả hai lớp) */
export function laLoiDangThuLai(err: unknown): boolean {
  if (err instanceof LoiVeHutAnh) return true;
  if (err instanceof LoiKetNoiTamThoi) return true;
  if (!(err instanceof Error)) return false;
  return laChuVeHutAnh(err.message) || laChuKetNoiTamThoi(err.message);
}

// --- Backward compatibility ---

/** @deprecated Dùng `laLoiDangThuLai` thay thế - giữ lại cho test cũ */
export function laLoiVeHutAnh(err: unknown): boolean {
  if (err instanceof LoiVeHutAnh) return true;
  return err instanceof Error && laChuVeHutAnh(err.message);
}

/** Lỗi thuộc lớp kết nối tạm thời? */
export function laLoiKetNoi(err: unknown): boolean {
  if (err instanceof LoiKetNoiTamThoi) return true;
  return err instanceof Error && laChuKetNoiTamThoi(err.message);
}

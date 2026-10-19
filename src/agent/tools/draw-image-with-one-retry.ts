import { laLoiDangThuLai, laLoiKetNoi } from "../../images/image-retry-policy.js";
import type { GeneratedImage, GenerateImageParams } from "../../images/image-generation-client.js";

/**
 * Gọi provider vẽ ảnh, hụt thì BÁO CHO NGƯỜI DÙNG rồi thử lại đúng MỘT lần.
 *
 * Xử lý HAI lớp lỗi retryable:
 *
 * 1. **Vẽ hụt ảnh** (LoiVeHutAnh): provider chạy xong mà không ra ảnh — retry
 *    ngay lập tức vì gọi lại gần như chắc được (9/9 lần đo thật).
 *
 * 2. **Kết nối tạm thời** (LoiKetNoiTamThoi, ECONNRESET, HTTP 502/503/504):
 *    chờ 5 giây rồi retry. Provider chưa kịp nhận request nên không tốn tiền,
 *    và lỗi hạ tầng thoáng qua (proxy restart, Cloudflare blip) thường hết
 *    trong vài giây.
 *
 * Vì sao đúng một lần: mỗi lần vẽ tốn 1-3 phút, ba lần là người ta bỏ đi rồi
 * mới có ảnh.
 *
 * Vì sao PHẢI báo trước khi thử lại: người dùng đã nghe hứa "đợi 1-3 phút" ở
 * đầu lượt, mà lần hỏng đo được đã ngốn 129,9 giây. Thử lại âm thầm là để họ
 * ngồi im gần 4 phút sau một lời hứa 3 phút.
 *
 * `baoThuLai` hỏng KHÔNG được làm chết lượt vẽ: gửi được ảnh vẫn quý hơn gửi
 * được lời nhắn. Cùng cách xử lý với câu báo trước ở tool.
 *
 * Tách khỏi `create-image-tool.ts` để test được nhánh thử lại mà không phải
 * dựng cả ToolContext, và để tool khỏi vượt trần 200 dòng.
 */

/** Độ trễ trước khi retry lỗi kết nối — đủ để proxy/CDN phục hồi */
const RETRY_DELAY_KET_NOI_MS = 5_000;

export async function veVoiMotLanThuLai(
  generate: (params: GenerateImageParams) => Promise<GeneratedImage>,
  params: GenerateImageParams,
  baoThuLai: () => Promise<void> | void,
): Promise<GeneratedImage> {
  try {
    return await generate(params);
  } catch (err) {
    // Mọi lỗi khác đi thẳng ra ngoài: sai key, hết quota, lỗi cấu hình thì
    // gọi lại chỉ tốn thêm thời gian chứ không đổi kết cục.
    if (!laLoiDangThuLai(err)) throw err;

    // Lỗi kết nối tạm thời: chờ vài giây cho hạ tầng phục hồi trước khi retry.
    // Khác với vẽ hụt ảnh (retry ngay lập tức vì provider vẫn sống): ở đây
    // provider/proxy chưa sẵn sàng, retry ngay là va vào cùng một bức tường.
    if (laLoiKetNoi(err)) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_KET_NOI_MS));
    }

    try {
      await baoThuLai();
    } catch {
      // Nhắn hụt thì thôi, vẫn vẽ tiếp
    }

    // Lần hai hỏng thì để lỗi bay ra - tool bên ngoài lo phần nói thật
    return await generate(params);
  }
}

import { tool } from "ai";
import { z } from "zod";
import { loadStoredImage } from "../../conversation/media-store.js";
import { askAboutImage } from "../vision-sidecar.js";
import type { ToolContext } from "./index.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import type { KetQuaLoiTool } from "./tool-failure-result.js";
import { RECENT_IMAGE_LIMIT, SIDECAR_CONCURRENCY, collectRecentImagePaths, withConcurrency } from "./recent-image-paths.js";

export { collectRecentImagePaths } from "./recent-image-paths.js";

/**
 * Tool "nhìn kỹ lại" ảnh - mảnh cuối của hệ vision (pattern read_image của
 * GoClaw / vision_analyze của Hermes): mô tả cache sinh TRƯỚC khi biết câu
 * hỏi nên lossy - "đếm số cá màu vàng" cần hỏi lại con mắt với prompt đúng
 * câu hỏi. Agent tự quyết khi nào mô tả sẵn có không đủ.
 *
 * Chỉ vào schema khi sidecar đã cấu hình (tool-registry `available`).
 *
 * BATCH MODE (imageIndexes): đọc NHIỀU ảnh trong 1 lần gọi, song song. Giảm
 * từ N step xuống 1 step - đặc biệt quan trọng cho trích xuất bảng biểu từ
 * nhiều ảnh chụp/scan: 7 ảnh × 1 step/ảnh = 7 step đã chạm trần LLM_MAX_STEPS,
 * còn batch mode chỉ tốn 1 step.
 */


/** Đọc 1 ảnh, trả text hoặc thông báo lỗi */
async function readSingleImage(
  relPath: string,
  question: string,
  ask: typeof askAboutImage,
): Promise<{ ok: true; text: string } | KetQuaLoiTool> {
  const image = loadStoredImage(relPath);
  if (!image) {
    return ketQuaLoi("Ảnh này đã bị dọn khỏi bộ nhớ (quá hạn lưu trữ), không xem lại được nữa.");
  }
  try {
    const answer = await ask(image, question);
    // Trả `ketQuaLoi` chứ không phải `{ok:false, reason}`: `laKetQuaLoi` chỉ nhận
    // hình dạng có trường `loi`, nên object `reason` sẽ lọt qua guard như một
    // kết quả THÀNH CÔNG - guard đếm sai mà không test nào đỏ.
    return answer ? { ok: true, text: answer } : ketQuaLoi("Model đọc ảnh không trả lời được câu hỏi này.");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return ketQuaLoi(`Hệ thống đọc ảnh đang lỗi (${reason}).`);
  }
}

/** `ask` tiêm được để test không chạm mạng thật */
export function createReadImageTool(ctx: ToolContext, ask = askAboutImage) {
  return tool({
    description:
      "Nhìn kỹ lại ảnh đã nhận trong hội thoại bằng model đọc ảnh, với một câu hỏi cụ thể " +
      "(đếm số lượng, đọc chữ nhỏ, xác định chi tiết, so sánh màu sắc, trích xuất bảng biểu). Nếu ảnh có một danh sách đầy đủ, phải đọc toàn bộ từ đầu đến cuối để chuyển sang Excel khi người dùng cần. " +
      "Dùng khi mô tả ảnh sẵn có trong hội thoại không đủ chi tiết để trả lời người dùng.\n" +
      "BATCH MODE: Khi cần đọc NHIỀU ẢNH CÙNG LÚC (trích xuất bảng biểu từ nhiều trang, " +
      "so sánh nhiều ảnh), dùng imageIndexes=[1,2,3,...] thay vì gọi tool nhiều lần — " +
      "chỉ tốn 1 bước thay vì N bước, nhanh hơn và tiết kiệm lượt gọi tool.",
    inputSchema: z.object({
      question: z
        .string()
        .min(1)
        .describe('Câu hỏi cụ thể về ảnh, vd "Đếm chính xác số cá màu vàng trong ảnh"'),
      imageIndex: z.coerce
        .number()
        .int()
        .min(1)
        .max(RECENT_IMAGE_LIMIT)
        .default(1)
        .describe("Ảnh thứ mấy tính từ MỚI NHẤT (1 = ảnh mới nhất). Dùng khi chỉ cần đọc 1 ảnh."),
      imageIndexes: z
        .array(z.coerce.number().int().min(1).max(RECENT_IMAGE_LIMIT))
        .optional()
        .describe(
          "Danh sách index ảnh cần đọc CÙNG LÚC, vd [1,2,3,4,5]. " +
        "Khi có tham số này thì imageIndex bị bỏ qua. " +
        "Dùng cho trích xuất bảng biểu từ nhiều trang ảnh; với một ảnh đầy đủ danh sách cũng phải dùng imageIndexes=[1] để đọc từ đầu đến cuối.",
        ),
    }),
    execute: async ({ question, imageIndex, imageIndexes }) => {
      const paths = collectRecentImagePaths(ctx);
      if (paths.length === 0) {
        return ketQuaLoi("Không có ảnh nào trong hội thoại gần đây để xem.");
      }

      // ── BATCH MODE ──────────────────────────────────────────────────
      if (imageIndexes && imageIndexes.length > 0) {
        // Kiểm tra index hợp lệ
        const invalid = imageIndexes.filter((idx) => idx > paths.length);
        if (invalid.length === imageIndexes.length) {
          return ketQuaLoi(
            `Hội thoại chỉ còn ${paths.length} ảnh gần đây - tất cả index [${invalid.join(",")}] đều vượt quá.`,
          );
        }

        const tasks = imageIndexes.map((idx) => {
          const relPath = paths[idx - 1];
          if (!relPath) {
            return async () => ketQuaLoi(`Index ${idx} vượt quá ${paths.length} ảnh gần đây.`);
          }
          return () => readSingleImage(relPath, question, ask);
        });

        const results = await withConcurrency(tasks, SIDECAR_CONCURRENCY);
        const total = imageIndexes.length;
        const lines = results.map((r, i) => {
          const label = `[Ảnh ${i + 1}/${total} (index ${imageIndexes[i]})]`;
          return r.ok ? `${label}\n${r.text}` : `${label}\n[Lỗi: ${r.loi}]`;
        });

        const successCount = results.filter((r) => r.ok).length;
        const summary = successCount === total
          ? `Đã đọc thành công ${total}/${total} ảnh.`
          : `Đọc được ${successCount}/${total} ảnh, ${total - successCount} ảnh bị lỗi (xem chi tiết bên dưới).`;

        return `${summary}\n\n${lines.join("\n\n")}`;
      }

      // ── SINGLE MODE (giữ nguyên hành vi cũ) ────────────────────────
      const relPath = paths[imageIndex - 1];
      if (!relPath) {
        return ketQuaLoi(
          `Hội thoại chỉ còn ${paths.length} ảnh gần đây - imageIndex ${imageIndex} vượt quá.`,
        );
      }
      const result = await readSingleImage(relPath, question, ask);
      if (!result.ok) {
        return ketQuaLoi(
          result.loi.includes("đã bị dọn") ? result.loi :
          `Hệ thống đọc ảnh đang lỗi (${result.loi}). Nói thật với người dùng là chưa xem kỹ được ảnh, đừng đoán nội dung.`,
        );
      }
      return result.text;
    },
  });
}

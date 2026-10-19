import { tool } from "ai";
import { z } from "zod";
import { isImageGenConfigured } from "../../config/runtime-image-settings.js";
import { getImageDescription } from "../../conversation/image-description-store.js";
import { loadStoredImage } from "../../conversation/media-store.js";
import { generateImage } from "../../images/image-generation-client.js";
import { checkImageRateLimit } from "../../images/image-rate-limit.js";
import { enqueueSend } from "../../middleware/rate-limiter.js";
import { createLogger } from "../../shared/logger.js";
import { withNamedTempFile } from "../../shared/temp-file-store.js";
import { CREATE_IMAGE_DESCRIPTION } from "./create-image-tool-description.js";
import { veVoiMotLanThuLai } from "./draw-image-with-one-retry.js";
import { collectRecentImagePaths } from "./read-image-tool.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiAnh, ghiChuDaGuiChu } from "./sent-by-tool-note.js";
import type { ToolContext } from "./index.js";

/**
 * Tool vẽ ảnh mới hoặc SỬA ảnh người dùng vừa gửi, rồi gửi luôn vào hội thoại.
 *
 * Nhắn báo trước khi vẽ: đo thật là ~70 giây mỗi ảnh. Im lặng ngần ấy thời gian
 * thì người nhắn tưởng bot lơ và nhắn lại - vừa khó chịu vừa đẻ thêm một lượt.
 * Câu báo chỉ gửi SAU khi đã qua cửa kiểm trần và cấu hình, để không hứa lèo.
 *
 * Gửi ảnh với ĐÚNG đuôi file provider trả về: zca-js định tuyến theo đuôi, chỉ
 * jpg/jpeg/png/webp mới đi đường photo_original và hiện thành ẢNH trong chat -
 * sai đuôi thì nó thành file đính kèm phải bấm tải mới xem được.
 *
 * `generate` tiêm được để test không chạm mạng và không tốn tiền.
 */

const log = createLogger("create-image");

const DELIVERED_NOTE =
  "Đã vẽ và GỬI ảnh cho người dùng rồi. KHÔNG gọi send_file để gửi lại ảnh này.";

/**
 * Câu báo khi lần vẽ đầu hụt và đang gọi lại provider.
 *
 * Nói THẲNG là lần đầu chưa ra chứ không ậm ừ "vẫn đang xử lý": người dùng đã
 * đợi hơn hai phút, giấu đi thì lần chờ thứ hai không có lý do nào giải thích.
 * Nhắc lại mốc thời gian vì lời hứa "1-3 phút" ở đầu lượt đã hết hạn.
 */
const TIN_THU_LAI = "Lần vẽ đầu chưa ra ảnh, mình vẽ lại lần nữa, đợi thêm 1-3 phút nhé...";

/**
 * Trần ký tự prompt. Đây là CHÍNH SÁCH tự đặt, KHÔNG phải giới hạn của provider
 * (chưa đo được giới hạn thật). Mốc tham chiếu: prompt 700 ký tự chép nguyên
 * văn một bài viết cho ra e-magazine đúng ý, nên 4000 là rộng gấp mấy lần nhu
 * cầu thường gặp mà vẫn chặn được model đổ nguyên một tài liệu dài vào.
 * Vượt trần thì schema báo lỗi cho model tự rút gọn, không cắt ngầm.
 */
const MAX_PROMPT_CHARS = 4000;

/**
 * Nhận diện yêu cầu rõ ràng từ tin nhắn người dùng đòi lấy ảnh mẫu / ghép ảnh / giữ nguyên người thật.
 * Dùng để tự động bật chế độ tham chiếu ảnh gốc kể cả khi LLM chọn nhầm mode="ve_moi".
 */
const YEU_CAU_DUNG_ANH_DA_GUI_RE =
  /(?:lấy\s*(?:hình|ảnh|tấm)\s*\d*\s*làm\s*mẫu|theo\s*(?:hình|ảnh)\s*mẫu|(?:mẫu|hình|ảnh)\s*(?:lúc\s*nãy|vừa\s*gửi|ở\s*trên|trước\s*đó)|ghép\s*(?:đúng\s*)?(?:ảnh|hình|người|mặt|chân\s*dung|vào)|giữ\s*nguyên\s*(?:hình|ảnh|người|mặt|khuôn\s*mặt|chân\s*dung)|thay\s*(?:ảnh|hình)\s*(?:người|nhân\s*vật|chân\s*dung|thật)|đổi\s*nền|thay\s*background|xóa\s*vật\s*thể)/i;

/**
 * Nhận diện yêu cầu ghép người thật vào mẫu hoặc kết hợp nhiều ảnh (ảnh mẫu + ảnh chân dung thật).
 */
const YEU_CAU_GHEP_HOAC_MAU_RE =
  /(?:ghép|lấy\s*(?:hình|ảnh|tấm)\s*\d*\s*làm\s*mẫu|theo\s*(?:hình|ảnh)?\s*mẫu|nội\s*dung\s*mẫu|mẫu\s*lúc\s*nãy|giữ\s*nguyên\s*(?:hình|ảnh|người|mặt|khuôn\s*mặt|chân\s*dung)|ảnh\s*thật|người\s*thật|hình\s*thật|thay\s*(?:ảnh|hình))/i;

/**
 * Nhận diện ảnh chụp màn hình giao dịch ngân hàng / biên lai thuần chữ để không lấn chỗ của ảnh mẫu và ảnh chân dung khi gom tự động.
 */
const ANH_BIEN_LAI_GIAO_DICH_RE =
  /(?:đặt\s*mua\s*cctg\s*thành\s*công|giao\s*dịch\s*thành\s*công|chuyển\s*khoản\s*thành\s*công|về\s*trang\s*tiền\s*gửi)/i;

const CHI_THI_GHEP_NGUOI_THAT =
  "\n\n[CRITICAL INSTRUCTION — REAL PHOTO & TEMPLATE COMPOSITING]:\n" +
  "- Reference image(s) are attached directly to this request (including the template poster/banner and the real person's portrait photo).\n" +
  "- STRICT IDENTITY & PHOTO PRESERVATION: You MUST preserve 100% of the EXACT real person from the provided portrait photo (their exact face, facial features, glasses, hair, skin tone, expression, suit/outfit, and arms-crossed/standing pose). DO NOT redraw, re-imagine, beautify, or replace them with a synthetic AI-generated person!\n" +
  "- Cut out the exact real person from their portrait photo and composite them seamlessly into the character position of the template design, replacing the old person in the template.\n" +
  "- Preserve the template's graphic layout, background, colors, logos, mascot, and decorative elements, while updating the text and numbers strictly as requested.";

export function createImageTool(ctx: ToolContext, generate = generateImage) {
  return tool({
    description: CREATE_IMAGE_DESCRIPTION,
    inputSchema: z.object({
      mode: z
        .enum(["ve_moi", "sua_anh_da_gui"])
        .describe(
          'BẮT BUỘC chọn. "ve_moi" = vẽ ảnh hoàn toàn mới từ mô tả (khi người dùng KHÔNG gửi ảnh hoặc không yêu cầu ' +
            'dựa vào ảnh đã gửi). "sua_anh_da_gui" = BẮT BUỘC khi người dùng đã gửi ảnh trong hội thoại và yêu cầu ' +
            'sửa / biến đổi / ghép ảnh người thật vào ảnh mẫu / lấy hình làm mẫu / đổi nền studio / phối cảnh thêm rèm, nội thất / làm sáng ảnh / xóa chi tiết thừa / thêm chữ vào ảnh đã gửi.',
        ),
      prompt: z
        .string()
        .min(1)
        .max(MAX_PROMPT_CHARS)
        .describe(
          "Mô tả chi tiết ảnh cần vẽ. Nếu mode='sua_anh_da_gui', BẮT BUỘC cấu trúc thành 2 phần rõ rệt: " +
            "[BẢO TOÀN: đối tượng/người thật/bố cục mẫu gốc cần giữ nguyên 100%] + [BIẾN ĐỔI: vị trí ghép ảnh người thật vào mẫu, nội dung chữ/số liệu cần thay đổi, chi tiết nền mới/phông studio, vật thể thêm vào hoặc chi tiết cần xóa]",
        ),
      imageIndex: z.coerce
        .number()
        .int()
        .min(1)
        .optional()
        .describe(
          'Chỉ có tác dụng khi mode = "sua_anh_da_gui": sửa ảnh thứ mấy tính từ mới nhất (1 = mới nhất). Bỏ trống = ảnh mới nhất',
        ),
      imageIndices: z
        .array(z.coerce.number().int().min(1))
        .optional()
        .describe(
          'Dùng khi mode = "sua_anh_da_gui" và cần GHÉP / KẾT HỢP nhiều ảnh đã gửi (ví dụ: ghép ảnh người thật ở hình 2 vào poster mẫu ở hình 1, truyền [1, 2] hoặc [2, 3]). Khi truyền mảng này, hệ thống sẽ gửi đồng thời tất cả các ảnh tham chiếu cho AI.',
        ),
      transparentBackground: z
        .boolean()
        .optional()
        .describe("Cần nền trong suốt (logo, sticker, icon để ghép lên nền khác)"),
      caption: z
        .string()
        .optional()
        .describe(
          "Lời nhắn gửi kèm ảnh giải thích chuyên nghiệp các điểm đã xử lý (phông nền, ánh sáng, tiếp đất/bóng đổ, chi tiết bổ sung)",
        ),
    }),
    execute: async ({ mode, prompt, imageIndex, imageIndices, transparentBackground, caption }) => {
      const threadKey = `${ctx.account.id}:${ctx.message.threadId}`;

      const userTextOnly = [ctx.message.text, ...(ctx.batch?.map((m) => m.text) ?? [])].join(" ");
      const allUserText = `${userTextOnly} ${prompt}`;
      if (/\binfographic\b|đồ họa thông tin|tóm tắt.*(?:quyết định|nghị định|văn bản|luật|thông tư|kế hoạch|đề án|tài liệu|chính sách)/i.test(allUserText)) {
        log.warn({ prompt, userText: ctx.message.text }, "Từ chối create_image vì yêu cầu infographic/tóm tắt văn bản tài liệu");
        return ketQuaLoi(
          "Yêu cầu tạo Infographic tóm tắt tài liệu văn bản BẮT BUỘC phải dùng công cụ `notebooklm` (action: 'tao', loai: 'infographic')! TUYỆT ĐỐI KHÔNG dùng tool create_image cho việc này. Hãy gọi tool notebooklm ngay bây giờ.",
        );
      }

      if (!isImageGenConfigured()) {
        return ketQuaLoi(
          "Tool vẽ ảnh chưa cấu hình (thiếu base URL, model hoặc API key). Nói thật với người dùng là chưa vẽ được.",
        );
      }

      // Nạp ảnh gốc TRƯỚC khi tính vào trần: xin sửa ảnh không tồn tại thì
      // không có gì được vẽ, không có lý do gì trừ suất của người dùng
      let refImage: { base64: string; mediaType: string } | undefined;
      let refImages: Array<{ base64: string; mediaType: string }> | undefined;

      // Nếu người dùng nói rõ trong tin nhắn là "lấy hình làm mẫu", "ghép ảnh", "giữ nguyên hình ảnh thật"
      // mà model lỡ chọn mode="ve_moi" thì tự động chuyển sang "sua_anh_da_gui" để không vẽ bịa người khác.
      const effectiveMode =
        mode === "ve_moi" && YEU_CAU_DUNG_ANH_DA_GUI_RE.test(userTextOnly)
          ? "sua_anh_da_gui"
          : mode;

      if (effectiveMode === "sua_anh_da_gui") {
        const paths = collectRecentImagePaths(ctx);

        if (paths.length > 0) {
          const requestedIndices =
            imageIndices && imageIndices.length > 0
              ? [...new Set(imageIndices)]
              : [imageIndex ?? 1];

          for (const idx of requestedIndices) {
            if (!paths[idx - 1]) {
              return ketQuaLoi(
                `Hội thoại chỉ còn ${paths.length} ảnh gần đây - imageIndex ${idx} vượt quá. Dùng imageIndex từ 1 đến ${paths.length}, hoặc đổi mode sang "ve_moi".`,
              );
            }
          }

          const selectedPaths = requestedIndices.map((idx) => paths[idx - 1]!);

          // Nếu người dùng yêu cầu ghép ảnh / lấy mẫu + giữ nguyên người thật mà model chỉ truyền 1 ảnh
          // trong khi hội thoại có >= 2 ảnh người dùng gửi, tự động gom thêm ảnh mẫu và ảnh chân dung
          // để AI nhìn thấy đồng thời CẢ ảnh mẫu LẪN ảnh người thật.
          if (selectedPaths.length === 1 && paths.length >= 2 && YEU_CAU_GHEP_HOAC_MAU_RE.test(allUserText)) {
            for (const candidatePath of paths) {
              if (selectedPaths.length >= 3) break;
              if (selectedPaths.includes(candidatePath)) continue;
              const desc = getImageDescription(candidatePath) ?? "";
              if (ANH_BIEN_LAI_GIAO_DICH_RE.test(desc)) continue;
              selectedPaths.push(candidatePath);
            }
          }

          const loadedList: Array<{ base64: string; mediaType: string }> = [];
          for (const relPath of selectedPaths) {
            const loaded = loadStoredImage(relPath);
            if (!loaded) {
              if (loadedList.length === 0) {
                return ketQuaLoi(
                  "Ảnh này đã bị dọn khỏi bộ nhớ (quá hạn lưu trữ) nên không đọc được để sửa. Nhờ người dùng gửi lại ảnh.",
                );
              }
              continue;
            }
            loadedList.push(loaded);
          }

          if (loadedList.length > 0) {
            refImage = loadedList[0];
            if (loadedList.length > 1) {
              refImages = loadedList;
            }
          }
        }
      }

      if (/infographic|tóm tắt.*(?:văn bản|nghị định|quyết định|tài liệu|chính sách)/i.test(prompt)) {
        log.warn({ prompt }, "Từ chối create_image vì người dùng yêu cầu infographic từ tài liệu văn bản");
        return ketQuaLoi(
          "Yêu cầu tạo Infographic tóm tắt tài liệu văn bản BẮT BUỘC phải gọi công cụ `notebooklm` (action: 'tao', loai: 'infographic')! TUYỆT ĐỐI KHÔNG dùng tool create_image cho việc này. Hãy gọi tool notebooklm ngay bây giờ.",
        );
      }

      const rate = checkImageRateLimit(threadKey);
      if (!rate.ok) return ketQuaLoi(rate.reason);

      const finalPrompt =
        refImage && YEU_CAU_GHEP_HOAC_MAU_RE.test(allUserText) && !prompt.includes("STRICT IDENTITY")
          ? `${prompt}${CHI_THI_GHEP_NGUOI_THAT}`
          : prompt;

      // Chỉ báo sau khi chắc chắn sẽ vẽ thật
      await enqueueSend(threadKey, () =>
        ctx.api.sendMessage(
          {
            // "1-3 phút" chứ không phải "1 phút": đo thật 60 giây cho ảnh
            // thường, 135 giây cho trang nhiều chữ. Hứa 1 phút là hứa hụt.
            msg: refImage
              ? "Đang sửa ảnh, đợi 1-3 phút nhé..."
              : "Đang vẽ ảnh, đợi 1-3 phút nhé...",
          },
          ctx.message.threadId,
          ctx.message.threadType,
        ),
      )
        .then(() => {
          // Câu báo trước cũng là tin THẬT người ta đọc được - vào history như
          // mọi tin khác, không thì dashboard hiện ảnh mà thiếu câu dẫn.
          ctx.ghiNhanDaGui?.(ghiChuDaGuiChu(refImage ? "Đang sửa ảnh, đợi 1-3 phút nhé..." : "Đang vẽ ảnh, đợi 1-3 phút nhé..."));
        })
        .catch(() => {
          // Báo trước hỏng không được làm chết cả lượt vẽ
        });

      try {
        const image = await veVoiMotLanThuLai(
          (p) => generate(p),
          { prompt: finalPrompt, refImage, ...(refImages ? { refImages } : {}), transparentBackground },
          async () => {
            // KHÔNG trừ thêm suất: `checkImageRateLimit` đã chạy ở trên và lần
            // hụt vừa rồi đã tiêu mất một suất rồi. Bắt trả giá hai suất cho
            // một tấm ảnh là phạt người dùng vì lỗi của provider.
            await enqueueSend(threadKey, () =>
              ctx.api.sendMessage({ msg: TIN_THU_LAI }, ctx.message.threadId, ctx.message.threadType),
            );
            ctx.ghiNhanDaGui?.(ghiChuDaGuiChu(TIN_THU_LAI));
          },
        );
        const fileName = `anh-${Date.now()}.${image.ext}`;
        await withNamedTempFile(fileName, image.data, (filePath) =>
          guiFileKemCaption(
            ctx.api,
            threadKey,
            ctx.message.threadId,
            ctx.message.threadType,
            filePath,
            caption,
          ),
        );
        ctx.ghiNhanDaGui?.(ghiChuDaGuiAnh(1, caption));
        log.info(
          { accountId: ctx.account.id, threadId: ctx.message.threadId, kb: Math.round(image.data.length / 1024), sua: Boolean(refImage) },
          "Đã gửi ảnh tự vẽ",
        );
        return `${DELIVERED_NOTE} (${Math.round(image.data.length / 1024)} KB)`;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        log.warn({ err }, "Vẽ ảnh thất bại");
        return ketQuaLoi(`Vẽ ảnh thất bại: ${reason}`);
      }
    },
  });
}

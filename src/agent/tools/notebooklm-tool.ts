import { tool } from "ai";
import { z } from "zod";
import { getNotebooklmSettings, isNotebooklmConfigured } from "../../config/runtime-notebooklm-settings.js";
import { getAdminUserIds } from "../../zalo/owner-notifier.js";
import { nlmAsk, nlmCreateNotebook, nlmListContent } from "../../notebooklm/notebooklm-client.js";
import { KIND_LABEL, startGenerationJob, startResendJob, type GenerateKind, type JobTarget } from "../../notebooklm/notebooklm-jobs.js";
import { addFileSource, addTextSource, addUrlSource, type SourceOutcome } from "../../notebooklm/notebooklm-sources.js";
import {
  addSourceCount,
  getThreadNotebook,
  reserveGeneration,
  saveThreadNotebook,
} from "../../notebooklm/notebooklm-store.js";
import { collectRecentFilePaths } from "./read-document-tool.js";
import { labelOf, originalNames, pickIndex } from "./recent-file-picker.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { wrapUntrustedContent } from "./wrap-untrusted-content.js";
import type { ToolContext } from "./index.js";

/**
 * Tool NotebookLM: mỗi cuộc chat có một notebook riêng. Nạp file/link làm
 * nguồn, hỏi đáp có trích dẫn, tạo podcast/video/infographic/báo cáo/slides/bảng.
 * Mọi chốt chặn (quyền, trần lượt, có notebook chưa) nằm ở MÃ, không nhờ AI.
 */

const MAX_FILES = 5;
const LOAI: Record<string, GenerateKind> = {
  podcast: "audio_overview",
  video: "video",
  infographic: "infographic",
  bao_cao: "report",
  slides: "presentation",
  bang_du_lieu: "data_table",
};

/** Chuẩn hóa URL sổ tay sang tên miền mới Gemini Notebook (notebook.google.com) */
export function normalizeNotebookUrl(url: string): string {
  return url.replace(/^https?:\/\/notebooklm\.google\.com\b/i, "https://notebook.google.com");
}

export function createNotebooklmTool(ctx: ToolContext) {
  const threadKey = `${ctx.account.id}:${ctx.message.threadId}`;
  const target: JobTarget = {
    api: ctx.api,
    accountId: ctx.account.id,
    threadId: ctx.message.threadId,
    threadType: ctx.message.threadType,
    threadKey,
  };

  return tool({
    description:
      "Google Gemini Notebook (tên cũ: NotebookLM) cho cuộc chat này (mỗi cuộc chat một sổ tay riêng trên notebook.google.com). " +
      "Hỗ trợ quy trình 1 chạm: 'tao_so_tay' (tạo sổ tay mới toanh), 'them_nguon' (nạp file/link/đoạn văn), " +
      "'tao' (tạo bản trình chiếu Slides, infographic, podcast, video, báo cáo - tự động tạo sổ tay và nạp nguồn nếu cần, chạy nền 1-3 phút rồi gửi file về Zalo), " +
      "'hoi' (hỏi đáp có trích dẫn), 'lay' (gửi lại file đã tạo), 'danh_sach' (xem danh sách). " +
      "Khi người dùng yêu cầu 'tạo sổ tay mới trên Gemini Notebook / NotebookLM...', 'tạo slide từ Gemini Notebook / NotebookLM...', hoặc làm slide trình chiếu: BẮT BUỘC gọi tool này ngay!",
    inputSchema: z.object({
      action: z
        .enum(["tao_so_tay", "them_nguon", "hoi", "tao", "lay", "danh_sach"])
        .describe(
          "tao_so_tay = tạo sổ tay mới riêng biệt (nạp luôn tài liệu và tạo slide nếu có yêu cầu); " +
            "them_nguon = nạp file vừa gửi / link / đoạn văn làm nguồn; " +
            "tao = tạo bản trình chiếu Slides, infographic, podcast, video, báo cáo từ tài liệu (tự động nạp file và chạy nền); " +
            "hoi = hỏi đáp dựa trên tài liệu; lay = gửi lại bản đã tạo; danh_sach = xem danh sách nguồn và nội dung.",
        ),
      soTayMoi: z
        .boolean()
        .optional()
        .describe("ĐẶT TRUE khi người dùng yêu cầu 'hãy tạo sổ tay mới...', 'tạo notebook mới...' để không bị lẫn tài liệu cũ."),
      tenSoTay: z
        .string()
        .max(200)
        .optional()
        .describe("Tên đặt cho sổ tay mới (ví dụ: 'Báo cáo Chuyển đổi số 2026', 'Tóm tắt Quyết định 1842')"),
      tenFile: z
        .array(z.string())
        .max(MAX_FILES)
        .optional()
        .describe("them_nguon / tao: một phần tên các file cần nạp; bỏ trống = file mới nhất"),
      soFile: z.coerce
        .number()
        .int()
        .min(1)
        .max(MAX_FILES)
        .optional()
        .describe("nạp N file mới nhất trong hội thoại"),
      url: z.string().url().optional().describe("link website hoặc YouTube làm nguồn"),
      vanBan: z.string().max(400_000).optional().describe("đoạn văn bản dán trực tiếp"),
      cauHoi: z.string().max(2000).optional().describe("hoi: câu hỏi cần giải đáp từ tài liệu"),
      loai: z
        .enum(["slides", "infographic", "podcast", "video", "bao_cao", "bang_du_lieu"])
        .optional()
        .describe("tao/lay: loại nội dung. 'slides' = bản trình chiếu PowerPoint/Google Slides đẹp và nhanh"),
      yeuCau: z
        .string()
        .max(1000)
        .optional()
        .describe("tao: yêu cầu thêm (trọng tâm, phong cách thiết kế, đối tượng người xem...)"),
    }),
    execute: async (input) => {
      const settings = getNotebooklmSettings();
      if (!isNotebooklmConfigured(settings)) return ketQuaLoi("Gemini Notebook (NotebookLM) đang tắt. Nói thật với người dùng.");
      if (!settings.publicAccess && !getAdminUserIds(ctx.account.id).includes(ctx.message.senderId)) {
        return ketQuaLoi("Gemini Notebook (NotebookLM) hiện chỉ dành cho Admin. Nói lịch sự với người dùng là chưa mở cho mọi người.");
      }

      let nb = getThreadNotebook(threadKey);
      if (nb) {
        nb = { ...nb, notebookUrl: normalizeNotebookUrl(nb.notebookUrl) };
      }
      const yeuCauSoTayMoi = input.action === "tao_so_tay" || input.soTayMoi === true;

      // Helper nạp nguồn từ ngữ cảnh (file/link/văn bản)
      const napNguon = async (targetUrl: string) => {
        const results: SourceOutcome[] = [];
        if (input.url) results.push(await addUrlSource(targetUrl, input.url));
        if (input.vanBan) results.push(await addTextSource(targetUrl, input.vanBan, "Văn bản dán từ Zalo"));
        if (!input.url && !input.vanBan) {
          const paths = collectRecentFilePaths(ctx);
          if (paths.length > 0) {
            const names = originalNames(ctx);
            const picks: number[] = [];
            if (input.tenFile?.length) {
              for (const n of input.tenFile) {
                const p = pickIndex(paths, names, 0, n);
                if (!("error" in p) && !picks.includes(p.index)) picks.push(p.index);
              }
            } else {
              for (let i = 0; i < Math.min(input.soFile ?? 1, paths.length); i++) picks.push(i);
            }
            for (const i of picks) results.push(await addFileSource(targetUrl, paths[i]!, labelOf(paths[i]!, names)));
          }
        }
        const ok = results.filter((r) => r.ok);
        if (ok.length > 0) addSourceCount(threadKey, ok.length);
        const lines = results.map((r) => (r.ok ? `✓ ${r.name}` : `✗ ${r.name}: ${r.error}`));
        return { okCount: ok.length, totalCount: results.length, lines };
      };

      // Xử lý tạo sổ tay mới nếu được yêu cầu hoặc chưa có sổ tay
      if (yeuCauSoTayMoi || (!nb && (input.action === "them_nguon" || input.action === "tao"))) {
        const paths = collectRecentFilePaths(ctx);
        const names = originalNames(ctx);
        const fileLabel = paths.length > 0 ? labelOf(paths[0]!, names) : undefined;
        const tenSoTay =
          input.tenSoTay ||
          (fileLabel ? `Sổ tay ${fileLabel}` : `Zalo ${ctx.message.isGroup ? "nhóm" : "chat"} ${ctx.message.threadId}`);

        const created = await nlmCreateNotebook(tenSoTay);
        if (!created.ok) return ketQuaLoi(`Không tạo được sổ tay Gemini Notebook mới (${created.error}).`);
        const normalizedUrl = normalizeNotebookUrl(created.data.notebook_url);
        saveThreadNotebook(threadKey, normalizedUrl, created.data.notebook_id);
        nb = { notebookUrl: normalizedUrl, notebookId: created.data.notebook_id, sourceCount: 0 };

        // Tự động nạp nguồn vào sổ tay mới
        const { okCount, totalCount, lines } = await napNguon(nb.notebookUrl);

        // Nếu chỉ đơn thuần là tạo sổ tay mới (không kèm lệnh tạo Studio)
        if (input.action === "tao_so_tay" && !input.loai) {
          const detail = totalCount > 0 ? `\nĐã nạp ${okCount}/${totalCount} nguồn:\n${lines.join("\n")}` : "\n(Chưa có tài liệu nguồn)";
          return `✓ Đã tạo thành công sổ tay mới trên Gemini Notebook (NotebookLM): "${tenSoTay}".${detail}\nBạn có thể yêu cầu tạo slide trình chiếu (slides), infographic, podcast hoặc hỏi đáp ngay!`;
        }
      }

      if (input.action === "them_nguon") {
        if (!nb) return ketQuaLoi("Chưa khởi tạo được sổ tay Gemini Notebook (NotebookLM).");
        const { okCount, totalCount, lines } = await napNguon(nb.notebookUrl);
        if (totalCount === 0) return ketQuaLoi("Chưa có file hoặc link nào trong hội thoại để nạp. Nhờ người dùng gửi file hoặc link trước.");
        return `Kết quả nạp nguồn Gemini Notebook (${okCount}/${totalCount} thành công):\n${lines.join("\n")}`;
      }

      if (!nb) return ketQuaLoi("Cuộc chat này chưa có nguồn Gemini Notebook (NotebookLM). Nhờ người dùng gửi file rồi nạp nguồn trước (them_nguon).");

      if (input.action === "hoi") {
        if (!input.cauHoi) return ketQuaLoi("Thiếu câu hỏi.");
        const r = await nlmAsk(nb.notebookUrl, input.cauHoi);
        if (!r.ok) return ketQuaLoi(`Gemini Notebook chưa trả lời được (${r.error}).`);
        return wrapUntrustedContent(r.data.answer, "NotebookLM");
      }

      if (input.action === "danh_sach") {
        const r = await nlmListContent(nb.notebookUrl);
        if (!r.ok) return ketQuaLoi(`Không xem được danh sách (${r.error}).`);
        const src = r.data.sources.map((s) => `- ${s.name}`).join("\n") || "(chưa có)";
        const gen = r.data.generatedContent.map((g) => `- ${g.type}: ${g.name}`).join("\n") || "(chưa có)";
        return wrapUntrustedContent(`Nguồn:\n${src}\n\nĐã tạo:\n${gen}`, "NotebookLM");
      }

      const kind = input.loai ? LOAI[input.loai] : undefined;
      if (!kind) return ketQuaLoi("Thiếu loại nội dung cần tạo (slides, infographic, podcast, video, bao_cao, bang_du_lieu).");

      if (input.action === "lay") {
        if (kind === "report" || kind === "data_table") return ketQuaLoi("Loại này không gửi lại được - tạo lại bằng action tao nếu cần.");
        startResendJob(target, nb.notebookUrl, kind as Exclude<GenerateKind, "report" | "data_table">);
        return `Đang tải lại ${KIND_LABEL[kind]}, gửi trong 1-2 phút. Báo người dùng chờ, KHÔNG gửi file khác.`;
      }

      // Action "tao": Đảm bảo có nguồn trong sổ tay trước khi generate
      if (nb.sourceCount === 0) {
        const { okCount } = await napNguon(nb.notebookUrl);
        if (okCount === 0) {
          return ketQuaLoi("Sổ tay NotebookLM chưa có tài liệu nào để làm việc. Hãy gửi file hoặc link vào chat rồi yêu cầu lại.");
        }
      }

      const quota = reserveGeneration(threadKey, settings.maxPerDay, settings.maxPerDayGlobal);
      if (!quota.ok) return ketQuaLoi(quota.reason);

      let yeuCau = input.yeuCau;
      const paths = collectRecentFilePaths(ctx);
      const names = originalNames(ctx);
      const latestName = paths.length > 0 ? labelOf(paths[0]!, names) : undefined;

      if (kind === "presentation") {
        // Tối ưu hóa chỉ dẫn thiết kế bản trình chiếu (Slides) chuyên nghiệp, đẹp và súc tích (Chương 8)
        const slideDirectives = [
          latestName ? `Tập trung nội dung cốt lõi của tài liệu ${latestName}` : "Tập trung các luận điểm và số liệu quan trọng nhất",
          "Thiết kế bản trình chiếu (Slides) chuyên nghiệp, hiện đại, bố cục rõ ràng: Trang bìa nổi bật tiêu đề; mỗi slide 1 thông điệp với gạch đầu dòng súc tích, làm nổi bật số liệu; tiếng Việt chuẩn mực, mạch lạc, dễ thuyết trình",
          input.yeuCau,
        ]
          .filter(Boolean)
          .join(". ");
        yeuCau = slideDirectives;
      } else if (kind === "infographic") {
        // Chuẩn Chương 8.2 (Infographic tiếng Việt dễ đọc, ngắn gọn Concise để tránh lỗi dấu tiếng Việt)
        const infoDirectives = [
          latestName ? `Tập trung nội dung cốt lõi của tài liệu ${latestName}` : "Tóm tắt trực quan các nội dung quan trọng nhất",
          "Trình bày bằng tiếng Việt chuẩn chính tả, câu chữ ngắn gọn súc tích (mỗi khối tối đa 2 câu ngắn, dưới 10 từ mỗi dòng), làm nổi bật các con số và mốc quan trọng bằng chữ to rõ ràng",
          input.yeuCau,
        ]
          .filter(Boolean)
          .join(". ");
        yeuCau = infoDirectives;
      } else if (!yeuCau && latestName) {
        yeuCau = `Tập trung tóm tắt nội dung tài liệu ${latestName} bằng tiếng Việt rõ ràng, mạch lạc`;
      }

      startGenerationJob(target, nb.notebookUrl, kind, yeuCau);
      const eta =
        kind === "report" || kind === "infographic" || kind === "data_table" || kind === "presentation"
          ? "1-3 phút"
          : kind === "video"
            ? "10-30 phút"
            : "5-10 phút";
      return `🚀 Đã bắt đầu tạo ${KIND_LABEL[kind]} từ Gemini Notebook / NotebookLM (khoảng ${eta}). Hệ thống đang tự động xử lý chạy nền, xong sẽ tự động gửi file về đây. Báo người dùng chỉ cần ngồi đợi nhận kết quả; KHÔNG gọi lại tool này.`;
    },
  });
}

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
      "Google NotebookLM cho cuộc chat này (mỗi cuộc chat một notebook riêng). " +
      "them_nguon: nạp file vừa gửi / link / đoạn văn làm nguồn. hoi: hỏi đáp dựa trên nguồn, có trích dẫn. " +
      "tao: tạo podcast âm thanh, video tóm tắt, infographic, báo cáo, bản trình chiếu Slides (slides), hoặc bảng dữ liệu Excel (bang_du_lieu) từ nguồn (chạy nền 1-15 phút, xong tự gửi). " +
      "lay: gửi lại podcast/video/infographic/slides đã tạo. danh_sach: xem nguồn và nội dung đã tạo. " +
      "Chỉ dùng khi người dùng nhắc NotebookLM, podcast từ tài liệu, hoặc muốn hỏi đáp/tóm tắt nhiều tài liệu đã nạp.",
    inputSchema: z.object({
      action: z.enum(["them_nguon", "hoi", "tao", "lay", "danh_sach"]),
      tenFile: z.array(z.string()).max(MAX_FILES).optional().describe("them_nguon: một phần tên các file cần nạp; bỏ trống = file mới nhất"),
      soFile: z.coerce.number().int().min(1).max(MAX_FILES).optional().describe("them_nguon: nạp N file mới nhất (khi không nêu tên)"),
      url: z.string().url().optional().describe("them_nguon: link web hoặc YouTube"),
      vanBan: z.string().max(400_000).optional().describe("them_nguon: đoạn văn bản dán trực tiếp"),
      cauHoi: z.string().max(2000).optional().describe("hoi: câu hỏi"),
      loai: z.enum(["podcast", "video", "infographic", "bao_cao", "slides", "bang_du_lieu"]).optional().describe("tao/lay: loại nội dung"),
      yeuCau: z.string().max(1000).optional().describe("tao: yêu cầu thêm (trọng tâm, giọng điệu...)"),
    }),
    execute: async (input) => {
      const settings = getNotebooklmSettings();
      if (!isNotebooklmConfigured(settings)) return ketQuaLoi("NotebookLM đang tắt. Nói thật với người dùng.");
      if (!settings.publicAccess && !getAdminUserIds(ctx.account.id).includes(ctx.message.senderId)) {
        return ketQuaLoi("NotebookLM hiện chỉ dành cho Admin. Nói lịch sự với người dùng là chưa mở cho mọi người.");
      }

      const nb = getThreadNotebook(threadKey);

      if (input.action === "them_nguon") {
        let notebookUrl = nb?.notebookUrl;
        if (!notebookUrl) {
          const created = await nlmCreateNotebook(`Zalo ${ctx.message.isGroup ? "nhóm" : "chat"} ${ctx.message.threadId}`);
          if (!created.ok) return ketQuaLoi(`Không tạo được notebook (${created.error}).`);
          notebookUrl = created.data.notebook_url;
          saveThreadNotebook(threadKey, notebookUrl, created.data.notebook_id);
        }
        const results: SourceOutcome[] = [];
        if (input.url) results.push(await addUrlSource(notebookUrl, input.url));
        if (input.vanBan) results.push(await addTextSource(notebookUrl, input.vanBan, "Văn bản dán từ Zalo"));
        if (!input.url && !input.vanBan) {
          const paths = collectRecentFilePaths(ctx);
          if (paths.length === 0) return ketQuaLoi("Chưa có file nào trong hội thoại. Nhờ người dùng gửi file trước.");
          const names = originalNames(ctx);
          const picks: number[] = [];
          if (input.tenFile?.length) {
            for (const n of input.tenFile) {
              const p = pickIndex(paths, names, 0, n);
              if ("error" in p) return ketQuaLoi(p.error);
              if (!picks.includes(p.index)) picks.push(p.index);
            }
          } else {
            for (let i = 0; i < Math.min(input.soFile ?? 1, paths.length); i++) picks.push(i);
          }
          for (const i of picks) results.push(await addFileSource(notebookUrl, paths[i]!, labelOf(paths[i]!, names)));
        }
        const ok = results.filter((r) => r.ok);
        addSourceCount(threadKey, ok.length);
        const lines = results.map((r) => (r.ok ? `✓ ${r.name}` : `✗ ${r.name}: ${r.error}`));
        return `Kết quả nạp nguồn NotebookLM (${ok.length}/${results.length} thành công):\n${lines.join("\n")}`;
      }

      if (!nb) return ketQuaLoi("Cuộc chat này chưa có nguồn NotebookLM. Nhờ người dùng gửi file rồi nạp nguồn trước (them_nguon).");

      if (input.action === "hoi") {
        if (!input.cauHoi) return ketQuaLoi("Thiếu câu hỏi.");
        const r = await nlmAsk(nb.notebookUrl, input.cauHoi);
        if (!r.ok) return ketQuaLoi(`NotebookLM chưa trả lời được (${r.error}).`);
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
      if (!kind) return ketQuaLoi("Thiếu loại nội dung (podcast, video, infographic, bao_cao, slides, bang_du_lieu).");

      if (input.action === "lay") {
        if (kind === "report" || kind === "data_table") return ketQuaLoi("Loại này không gửi lại được - tạo lại bằng action tao nếu cần.");
        startResendJob(target, nb.notebookUrl, kind as Exclude<GenerateKind, "report" | "data_table">);
        return `Đang tải lại ${KIND_LABEL[kind]}, gửi trong 1-2 phút. Báo người dùng chờ, KHÔNG gửi file khác.`;
      }

      const quota = reserveGeneration(threadKey, settings.maxPerDay, settings.maxPerDayGlobal);
      if (!quota.ok) return ketQuaLoi(quota.reason);
      startGenerationJob(target, nb.notebookUrl, kind, input.yeuCau);
      const eta = kind === "report" || kind === "infographic" || kind === "data_table" || kind === "presentation" ? "1-3 phút" : "5-15 phút";
      return `Đã bắt đầu tạo ${KIND_LABEL[kind]} (khoảng ${eta}). Xong bot tự gửi vào đây. Báo người dùng chờ; KHÔNG gọi lại tool này.`;
    },
  });
}

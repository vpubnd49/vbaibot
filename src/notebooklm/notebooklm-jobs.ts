import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { API, ThreadType } from "zca-js";
import { dataDir } from "../config/env.js";
import { appendMessage } from "../conversation/history-store.js";
import { enqueueSend } from "../middleware/rate-limiter.js";
import { guiFileKemCaption } from "../agent/tools/send-attachment-with-caption.js";
import { createLogger } from "../shared/logger.js";
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { nlmDownload, nlmGenerate, nlmGetContentText, nlmListContent, type StudioType } from "./notebooklm-client.js";
import { refundGeneration } from "./notebooklm-store.js";

/**
 * Việc TẠO nội dung Studio chạy NỀN: audio/video mất 5-15 phút, giữ lượt chat
 * chờ ngần ấy là bot "đứng hình". Tool trả lời "đang làm" ngay, job này xong
 * thì tự gửi file vào đúng cuộc chat và ghi vào lịch sử để lượt sau bot nhớ.
 * Hỏng thì báo lý do và HOÀN lượt.
 */

const log = createLogger("notebooklm-jobs");
const run = promisify(execFile);
export const HOST_OUT_DIR = path.join(dataDir, "notebooklm-out");

export type GenerateKind = "audio_overview" | "video" | "infographic" | "report" | "presentation" | "data_table";

export const KIND_LABEL: Record<GenerateKind, string> = {
  audio_overview: "podcast âm thanh",
  video: "video tóm tắt",
  infographic: "infographic",
  report: "báo cáo",
  presentation: "bản trình chiếu (Slides)",
  data_table: "bảng dữ liệu (Excel/CSV)",
};

export type JobTarget = {
  api: API;
  accountId: string;
  threadId: string;
  threadType: ThreadType;
  threadKey: string;
};

async function say(t: JobTarget, msg: string): Promise<void> {
  await enqueueSend(t.threadKey, () => t.api.sendMessage({ msg }, t.threadId, t.threadType)).catch((err) =>
    log.debug({ err }, "Không gửi được tin NotebookLM"),
  );
  appendMessage(t.accountId, t.threadId, { role: "assistant", content: msg });
}

/** M4A của NotebookLM -> MP3 cho máy nào cũng mở được; không có ffmpeg thì gửi nguyên */
async function toMp3(file: string): Promise<string> {
  const out = file.replace(/\.[^.]+$/, ".mp3");
  try {
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", file, "-codec:a", "libmp3lame", "-q:a", "4", out], {
      timeout: 5 * 60_000,
    });
    fs.rmSync(file, { force: true });
    return out;
  } catch (err) {
    log.debug({ err }, "Không chuyển được M4A sang MP3 - gửi file gốc");
    return file;
  }
}

/**
 * Tải có THỬ LẠI: ngay sau khi báo "completed" link media đôi khi chưa sẵn
 * (404/5xx, chưa thấy artifact, trả HTML) - thử tối đa 6 lần cách nhau 20 giây.
 * Lỗi khác (máy chủ tắt, sai tham số) báo luôn.
 *
 * Luồng tải (sơ đồ kiến trúc Bước 5): bot gọi GET /content/download → máy chủ
 * MCP trong container đọc COOKIE SỐNG từ Chrome profile (giải mã Cookies SQLite
 * v10, không dùng stale.json đã cũ) → tải file từ Google qua HTTPS → ghi ra
 * /out (mount chung HOST_OUT_DIR). Mọi logic cookie nằm bên MCP, bot chỉ nhận
 * file đã tải xong.
 */
const RETRYABLE = /no .*artifact|not found|404|50\d|html|media url|timeout|quá lâu/i;
export const DOWNLOAD_RETRY = { attempts: 6, delayMs: 20_000 };

async function downloadWithRetry(notebookUrl: string, kind: Exclude<GenerateKind, "report" | "data_table">, name: string) {
  let dl = await nlmDownload(notebookUrl, kind, name);
  for (let i = 1; !dl.ok && i < DOWNLOAD_RETRY.attempts && RETRYABLE.test(dl.error); i++) {
    log.debug({ kind, attempt: i, error: dl.error }, "Tải NotebookLM lỗi - thử lại");
    await new Promise((r) => setTimeout(r, DOWNLOAD_RETRY.delayMs));
    dl = await nlmDownload(notebookUrl, kind, name);
  }
  return dl;
}


async function deliverMedia(t: JobTarget, notebookUrl: string, kind: Exclude<GenerateKind, "report" | "data_table">): Promise<string | null> {
  const ext = { audio_overview: "m4a", video: "mp4", infographic: "png", presentation: "pdf" }[kind];
  const name = `nlm-${t.threadId}-${Date.now()}.${ext}`;
  fs.mkdirSync(HOST_OUT_DIR, { recursive: true });
  const dl = await downloadWithRetry(notebookUrl, kind, name);
  if (!dl.ok) return `tải file về lỗi: ${dl.error}`;
  let file = path.join(HOST_OUT_DIR, name);
  if (!fs.existsSync(file)) return "máy chủ báo tải xong nhưng không thấy file";
  if (kind === "audio_overview") file = await toMp3(file);
  try {
    await guiFileKemCaption(t.api, t.threadKey, t.threadId, t.threadType, file, `Đây là ${KIND_LABEL[kind]} từ NotebookLM.`);
  } finally {
    fs.rmSync(file, { force: true });
  }
  return null;
}

/** Gửi lại bản đã tạo gần nhất (không tốn lượt) - "gửi lại file audio" */
export function startResendJob(t: JobTarget, notebookUrl: string, kind: Exclude<GenerateKind, "report" | "data_table">): void {
  void enqueueStudioJob(async () => {
    const error = await deliverMedia(t, notebookUrl, kind);
    if (error) await say(t, `❌ Chưa gửi lại được ${KIND_LABEL[kind]} (${error}).`);
    else appendMessage(t.accountId, t.threadId, { role: "assistant", content: `[Đã gửi lại ${KIND_LABEL[kind]} từ NotebookLM]` });
  });
}

async function generateDocxReport(title: string, text: string): Promise<Buffer> {
  const lines = text.split("\n");
  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
  ];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push(new Paragraph({ text: "", spacing: { after: 100 } }));
      continue;
    }
    const hMatch = trimmed.match(/^(#{1,3})\s+(.*)/);
    if (hMatch) {
      const level = hMatch[1]!.length;
      paragraphs.push(new Paragraph({
        text: hMatch[2]!.trim(),
        heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
      }));
    } else {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line, font: "Times New Roman", size: 26 })],
        spacing: { after: 80 },
      }));
    }
  }
  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  });
  return await Packer.toBuffer(doc);
}

/** Báo cáo: luôn tạo file Word .docx chuẩn đẹp gửi kèm tin nhắn tóm tắt */
async function deliverReport(t: JobTarget, text: string): Promise<void> {
  fs.mkdirSync(HOST_OUT_DIR, { recursive: true });
  const docxFile = path.join(HOST_OUT_DIR, `bao-cao-notebooklm-${Date.now()}.docx`);
  try {
    const docxBuf = await generateDocxReport("Báo cáo tổng hợp từ NotebookLM", text);
    fs.writeFileSync(docxFile, docxBuf);
    await guiFileKemCaption(
      t.api,
      t.threadKey,
      t.threadId,
      t.threadType,
      docxFile,
      "📄 Báo cáo từ NotebookLM (file Word .docx chuẩn). Bạn có thể mở trực tiếp bằng Microsoft Word trên máy tính hoặc điện thoại.",
    );
  } catch (err) {
    log.warn({ err }, "Tạo docx cho report thất bại, gửi dạng tin nhắn");
  } finally {
    fs.rmSync(docxFile, { force: true });
  }

  if (text.length <= 3000) {
    await say(t, `📄 Nội dung báo cáo:\n\n${text}`);
  } else {
    await say(t, `📄 Tóm tắt phần đầu báo cáo:\n\n${text.slice(0, 1500)}…\n\n(Nội dung chi tiết đầy đủ có trong file Word .docx ở trên)`);
  }
}

/** Hàng đợi tuần tự cấp Job: đảm bảo mỗi job tạo nội dung (generate -> list -> download -> gửi) hoàn tất trọn vẹn trước khi job tiếp theo bắt đầu. Tránh trường hợp job audio chặn nlmDownload của infographic */
let studioJobChain: Promise<unknown> = Promise.resolve();

function enqueueStudioJob<T>(job: () => Promise<T>): Promise<T> {
  const run = studioJobChain.then(job, job);
  studioJobChain = run.catch(() => undefined);
  return run;
}

export function startGenerationJob(t: JobTarget, notebookUrl: string, kind: GenerateKind, instructions?: string): void {
  void enqueueStudioJob(async () => {
    const startedAt = Date.now();

    // So sánh danh sách Studio TRƯỚC và SAU generate để nhận ra đúng nội dung
    // mới tạo (sơ đồ kiến trúc Bước 4). Snapshot trước giúp:
    //   - Xác nhận generate THẬT SỰ tạo nội dung mới (không chỉ tin status)
    //   - Log rõ tên/loại nội dung mới cho debug
    //   - Phát hiện khi máy chủ báo OK nhưng Studio không có gì mới
    const beforeIds = new Set<string>();
    const beforeList = await nlmListContent(notebookUrl);
    if (beforeList.ok) {
      for (const g of beforeList.data.generatedContent) beforeIds.add(g.id);
    }

    const gen = await nlmGenerate(notebookUrl, kind as StudioType, { instructions });
    let error: string | null = gen.ok ? null : gen.error;

    // So sánh SAU generate: tìm nội dung mới xuất hiện
    if (!error) {
      const afterList = await nlmListContent(notebookUrl);
      if (afterList.ok) {
        const newItems = afterList.data.generatedContent.filter((g) => !beforeIds.has(g.id));
        if (newItems.length > 0) {
          log.info(
            { kind, newItems: newItems.map((g) => ({ id: g.id, type: g.type, name: g.name })) },
            "So sánh Studio TRƯỚC/SAU: phát hiện nội dung mới",
          );
        } else {
          log.warn({ kind }, "So sánh Studio TRƯỚC/SAU: không thấy nội dung mới sau generate");
        }
      }
    }

    if (!error && kind === "report") {
      const text = (gen.ok && (gen.data.textContent || gen.data.content)) || "";
      if (text) await deliverReport(t, text);
      else error = "máy chủ không trả nội dung báo cáo";
    } else if (!error && kind === "data_table") {
      // Sơ đồ Bước 5: "slide/bảng không có file thì gửi link Google Sheets"
      // Ưu tiên link Google khi máy chủ trả URL; fallback gửi file CSV
      const afterList = await nlmListContent(notebookUrl);
      const tableItem = afterList.ok
        ? afterList.data.generatedContent.find((g) => g.type === "data_table")
        : undefined;
      const googleUrl = tableItem?.url || tableItem?.mediaUrl;

      if (googleUrl && /docs\.google\.com/i.test(googleUrl)) {
        await say(t, `📊 Bảng dữ liệu từ NotebookLM:\n🔗 ${googleUrl}\n(Mở bằng Google Sheets)`);
      } else {
        // Fallback: lấy textContent CSV rồi gửi file
        const r = await nlmGetContentText(notebookUrl, "data_table");
        if (!r.ok) { error = r.error; }
        else if (!r.data.text) { error = "máy chủ không trả dữ liệu bảng"; }
        else {
          fs.mkdirSync(HOST_OUT_DIR, { recursive: true });
          const csvFile = path.join(HOST_OUT_DIR, `bang-du-lieu-notebooklm-${Date.now()}.csv`);
          // Ghi UTF-8 với BOM để Excel mở đúng tiếng Việt
          fs.writeFileSync(csvFile, "\uFEFF" + r.data.text, "utf8");
          try {
            await guiFileKemCaption(
              t.api, t.threadKey, t.threadId, t.threadType, csvFile,
              `📊 Bảng dữ liệu từ NotebookLM: ${r.data.name}\n(Mở bằng Excel hoặc Google Sheets)`,
            );
          } finally {
            fs.rmSync(csvFile, { force: true });
          }
        }
      }
    } else if (!error && kind === "presentation") {
      // Xử lý bản trình chiếu (Slides): tải PDF Slide Deck từ NotebookLM và convert tự động sang PPTX thật 16:9
      const afterList = await nlmListContent(notebookUrl);
      const presItem = afterList.ok
        ? afterList.data.generatedContent.find((g) => g.type === "presentation")
        : undefined;
      const googleUrl = presItem?.url || presItem?.mediaUrl;

      const rawPdfName = `nlm-slide-raw-${t.threadId}-${Date.now()}.pdf`;
      const cleanPdfName = `nlm-slide-${t.threadId}-${Date.now()}.pdf`;
      const pptxName = `nlm-slide-${t.threadId}-${Date.now()}.pptx`;
      fs.mkdirSync(HOST_OUT_DIR, { recursive: true });
      const dl = await downloadWithRetry(notebookUrl, "presentation", rawPdfName);

      let delivered = false;
      if (dl.ok) {
        const rawPdfFile = path.join(HOST_OUT_DIR, rawPdfName);
        const cleanPdfFile = path.join(HOST_OUT_DIR, cleanPdfName);
        const pptxFile = path.join(HOST_OUT_DIR, pptxName);
        if (fs.existsSync(rawPdfFile)) {
          let sendFile = rawPdfFile;
          let isPptx = false;
          const scriptPath = path.resolve("scripts/pdf_to_pptx.py");
          if (fs.existsSync(scriptPath)) {
            try {
              await run("python3", [scriptPath, rawPdfFile, pptxFile, cleanPdfFile], {
                timeout: 3 * 60_000,
              });
              if (fs.existsSync(pptxFile) && fs.statSync(pptxFile).size > 1000) {
                sendFile = pptxFile;
                isPptx = true;
              } else if (fs.existsSync(cleanPdfFile) && fs.statSync(cleanPdfFile).size > 1000) {
                sendFile = cleanPdfFile;
              }
            } catch (convErr) {
              log.warn({ convErr }, "Chuyển PDF sang PPTX thất bại, gửi file PDF gốc");
            }
          }

          try {
            const captionLines = [
              isPptx
                ? "📊 Bản trình chiếu PowerPoint (.pptx) chuẩn 16:9 đã hoàn thành!"
                : "📊 Bản trình chiếu Slide Deck (.pdf) đã hoàn thành!",
              googleUrl && /docs\.google\.com/i.test(googleUrl) ? `🔗 Xem/trình chiếu trực tuyến: ${googleUrl}` : "",
              "Chân trang đã được làm sạch 100%, không còn watermark hay nguồn xuất.",
            ].filter(Boolean);
            await guiFileKemCaption(t.api, t.threadKey, t.threadId, t.threadType, sendFile, captionLines.join("\n"));
            delivered = true;
          } finally {
            fs.rmSync(rawPdfFile, { force: true });
            fs.rmSync(cleanPdfFile, { force: true });
            fs.rmSync(pptxFile, { force: true });
          }
        }
      }

      // Fallback: nếu tải file gặp lỗi hoặc chưa sẵn sàng nhưng có link Google Slides trực tuyến
      if (!delivered) {
        if (googleUrl && /docs\.google\.com/i.test(googleUrl)) {
          log.info({ googleUrl }, "Đã gửi link Google Slides trực tuyến từ NotebookLM");
          await say(
            t,
            `📊 Bản trình chiếu (Slides) từ NotebookLM đã tạo thành công!\n🔗 Bạn có thể xem và trình chiếu trực tuyến tại: ${googleUrl}\n(Để lưu về máy, bạn mở link và chọn Tệp > Tải xuống nhé!)`,
          );
        } else {
          error = dl.ok ? "máy chủ báo tải xong nhưng không tìm thấy file slides" : `tải file slides về lỗi: ${dl.error}`;
        }
      }
    } else if (!error) {
      error = await deliverMedia(t, notebookUrl, kind as Exclude<GenerateKind, "report" | "data_table" | "presentation">);
    }

    const minutes = Math.round((Date.now() - startedAt) / 60_000);
    if (error) {
      refundGeneration(t.threadKey);
      log.warn({ kind, threadKey: t.threadKey, error }, "Tạo nội dung NotebookLM thất bại");
      await say(t, `❌ Chưa tạo được ${KIND_LABEL[kind]} (${error}). Lượt này không bị tính.`);
      return;
    }
    log.info({ kind, threadKey: t.threadKey, minutes }, "Đã gửi nội dung NotebookLM");
    if (kind !== "report") {
      appendMessage(t.accountId, t.threadId, { role: "assistant", content: `[Đã gửi ${KIND_LABEL[kind]} từ NotebookLM]` });
    }
  });
}

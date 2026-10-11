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
import { nlmDownload, nlmGenerate, type StudioType } from "./notebooklm-client.js";
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

export type GenerateKind = "audio_overview" | "video" | "infographic" | "report";

export const KIND_LABEL: Record<GenerateKind, string> = {
  audio_overview: "podcast âm thanh",
  video: "video tóm tắt",
  infographic: "infographic",
  report: "báo cáo",
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
 */
const RETRYABLE = /no .*artifact|not found|404|50\d|html|media url|timeout|quá lâu/i;
export const DOWNLOAD_RETRY = { attempts: 6, delayMs: 20_000 };

async function downloadWithRetry(notebookUrl: string, kind: Exclude<GenerateKind, "report">, name: string) {
  let dl = await nlmDownload(notebookUrl, kind, name);
  for (let i = 1; !dl.ok && i < DOWNLOAD_RETRY.attempts && RETRYABLE.test(dl.error); i++) {
    log.debug({ kind, attempt: i, error: dl.error }, "Tải NotebookLM lỗi - thử lại");
    await new Promise((r) => setTimeout(r, DOWNLOAD_RETRY.delayMs));
    dl = await nlmDownload(notebookUrl, kind, name);
  }
  return dl;
}

async function deliverMedia(t: JobTarget, notebookUrl: string, kind: Exclude<GenerateKind, "report">): Promise<string | null> {
  const ext = { audio_overview: "m4a", video: "mp4", infographic: "png" }[kind];
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
export function startResendJob(t: JobTarget, notebookUrl: string, kind: Exclude<GenerateKind, "report">): void {
  void deliverMedia(t, notebookUrl, kind).then(async (error) => {
    if (error) await say(t, `❌ Chưa gửi lại được ${KIND_LABEL[kind]} (${error}).`);
    else appendMessage(t.accountId, t.threadId, { role: "assistant", content: `[Đã gửi lại ${KIND_LABEL[kind]} từ NotebookLM]` });
  });
}

/** Báo cáo ngắn gửi thẳng tin nhắn; dài thì gửi file .md kèm đoạn đầu - không cắt mất nội dung */
async function deliverReport(t: JobTarget, text: string): Promise<void> {
  if (text.length <= 3800) {
    await say(t, `📄 Báo cáo từ NotebookLM:\n\n${text}`);
    return;
  }
  fs.mkdirSync(HOST_OUT_DIR, { recursive: true });
  const file = path.join(HOST_OUT_DIR, `bao-cao-notebooklm-${Date.now()}.md`);
  fs.writeFileSync(file, text, "utf8");
  try {
    await guiFileKemCaption(t.api, t.threadKey, t.threadId, t.threadType, file, "📄 Báo cáo đầy đủ từ NotebookLM (file .md).");
  } finally {
    fs.rmSync(file, { force: true });
  }
  await say(t, `📄 Tóm tắt đầu báo cáo:\n\n${text.slice(0, 1500)}…`);
}

export function startGenerationJob(t: JobTarget, notebookUrl: string, kind: GenerateKind, instructions?: string): void {
  void (async () => {
    const startedAt = Date.now();
    const gen = await nlmGenerate(notebookUrl, kind as StudioType, { instructions });
    let error: string | null = gen.ok ? null : gen.error;

    if (!error && kind === "report") {
      const text = (gen.ok && (gen.data.textContent || gen.data.content)) || "";
      if (text) await deliverReport(t, text);
      else error = "máy chủ không trả nội dung báo cáo";
    } else if (!error) {
      error = await deliverMedia(t, notebookUrl, kind as Exclude<GenerateKind, "report">);
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
  })();
}

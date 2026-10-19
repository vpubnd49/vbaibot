/**
 * legal-docs-crawler.ts
 * Cào định kỳ văn bản pháp luật MỚI từ nguồn chính thống miễn phí và tải sẵn PDF:
 *
 * 1. vanban.chinhphu.vn — danh sách "Tất cả văn bản" (50 VB mới nhất / trang),
 *    mỗi dòng có sẵn link file trên datafiles.chinhphu.vn (bản ký số .signed.pdf).
 * 2. congbao.chinhphu.vn — RSS "Các văn bản mới ban hành" (50 mục), PDF trên congbaocdn.
 *
 * Luồng mỗi lượt (mặc định 30 phút):
 *   cào danh sách -> thêm VB chưa thấy vào hàng đợi (legal_docs, status=pending)
 *   -> tải tối đa N file/lượt (nghỉ giữa các file) -> đánh dấu downloaded/failed.
 * VB trùng số hiệu giữa 2 nguồn chỉ tải 1 lần (bản sau ghi status=duplicate).
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { dataDir } from "../../config/env.js";
import { createLogger } from "../../shared/logger.js";
import { fetchCongbaoDetail, fetchCongbaoRss } from "./congbao-crawler.js";
import {
  crawlerFilesTotalBytes,
  findCachedLegalFile,
  listCrawlerFilesOldestFirst,
  listPendingLegalDocs,
  markLegalDocDownloaded,
  markLegalDocFailed,
  markLegalFilePurged,
  upsertLegalDoc,
  type LegalDocRow,
} from "./legal-docs-store.js";

const log = createLogger("legal-docs-crawler");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const CHINHPHU_LIST_URL = "https://vanban.chinhphu.vn/?pageid=41852&mode=0";
const INTERVAL_MS = 30 * 60 * 1000;
const DOWNLOADS_PER_ROUND = 15;
const STORAGE_ROOT = path.join(dataDir, "legal-auto");

/**
 * Chính sách lưu trữ (chỉnh qua .env, không cần build lại):
 * - LEGAL_AUTO_MAX_MB: tổng dung lượng tối đa kho tự tải (mặc định 2048 MB)
 * - LEGAL_AUTO_RETENTION_DAYS: xoá file cũ hơn N ngày (mặc định 180, 0 = không xoá theo ngày)
 * - LEGAL_AUTO_MIN_FREE_MB: đĩa trống dưới mức này thì tạm dừng tải (mặc định 3072 MB)
 * Chỉ xoá FILE do bộ cào tải; văn bản vẫn nằm trong danh mục (status=purged),
 * người dùng hỏi lại thì bot tải trực tiếp từ nguồn như bình thường.
 */
function numEnv(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : def;
}
const MB = 1024 * 1024;
function storagePolicy() {
  return {
    maxBytes: numEnv("LEGAL_AUTO_MAX_MB", 2048) * MB,
    retentionDays: numEnv("LEGAL_AUTO_RETENTION_DAYS", 180),
    minFreeBytes: numEnv("LEGAL_AUTO_MIN_FREE_MB", 3072) * MB,
  };
}

function diskFreeBytes(): number | null {
  try {
    const s = fs.statfsSync(dataDir);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return null;
  }
}

export type PurgeResult = { files: number; bytes: number; reason: string[] };

/** Xoá file quá hạn + xoá file cũ nhất tới khi dưới giới hạn dung lượng */
export function enforceLegalStoragePolicy(): PurgeResult {
  const policy = storagePolicy();
  const out: PurgeResult = { files: 0, bytes: 0, reason: [] };
  const root = path.resolve(STORAGE_ROOT) + path.sep;
  const files = listCrawlerFilesOldestFirst();
  let total = crawlerFilesTotalBytes();
  const cutoff = policy.retentionDays > 0 ? Date.now() - policy.retentionDays * 86_400_000 : 0;

  for (const f of files) {
    const tooOld = cutoff > 0 && Date.parse(f.downloadedAt) < cutoff;
    const overCap = total > policy.maxBytes;
    if (!tooOld && !overCap) break; // danh sách đã sắp cũ -> mới
    if (!path.resolve(f.filePath).startsWith(root)) continue; // an toàn: chỉ xoá trong legal-auto
    try {
      fs.rmSync(f.filePath, { force: true });
    } catch (err) {
      log.warn({ err, file: f.filePath }, "Không xoá được file văn bản cũ");
      continue;
    }
    markLegalFilePurged(f.filePath);
    total -= f.fileSize;
    out.files++;
    out.bytes += f.fileSize;
    const why = tooOld ? `quá ${policy.retentionDays} ngày` : `vượt ${Math.round(policy.maxBytes / MB)} MB`;
    if (!out.reason.includes(why)) out.reason.push(why);
  }
  if (out.files > 0) log.info(out, "Đã dọn file văn bản pháp luật cũ");
  return out;
}

export type CrawlRoundResult = {
  startedAt: string;
  finishedAt: string;
  discovered: { chinhphu: number; congbao: number };
  newDocs: number;
  downloaded: number;
  failed: number;
  purged: PurgeResult | null;
  skippedLowDisk: boolean;
  errors: string[];
};

const state: {
  running: boolean;
  lastRound: CrawlRoundResult | null;
  nextRunAt: string | null;
} = { running: false, lastRound: null, nextRunAt: null };

let timer: ReturnType<typeof setInterval> | null = null;

export function getLegalCrawlerState() {
  const policy = storagePolicy();
  return {
    ...state,
    intervalMinutes: INTERVAL_MS / 60_000,
    downloadsPerRound: DOWNLOADS_PER_ROUND,
    storageDir: STORAGE_ROOT,
    storage: {
      usedBytes: crawlerFilesTotalBytes(),
      maxBytes: policy.maxBytes,
      retentionDays: policy.retentionDays,
      minFreeBytes: policy.minFreeBytes,
      diskFreeBytes: diskFreeBytes(),
    },
  };
}

// ───────────────────────── Nguồn 1: vanban.chinhphu.vn ─────────────────────────

type ChinhphuItem = { docid: string; soHieu: string; ngayBanHanh: string; trichYeu: string; fileUrls: string[] };

export function parseChinhphuListing(html: string): ChinhphuItem[] {
  const out: ChinhphuItem[] = [];
  const seen = new Set<string>();
  const rows = html.split(/<tr[\s>]/i).slice(1);
  for (const row of rows) {
    const id = row.match(/pageid=27160&(?:amp;)?docid=(\d+)/i)?.[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const soHieu = decode(row.match(/<span\s+class="code">\s*([^<]+?)\s*<\/span>/i)?.[1] ?? "");
    const rawDate = row.match(/<span\s+class="(?:issued-date|issue-v2)[^"]*">\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? "";
    const trichYeu = decode(row.match(/<span\s+class="substract">\s*([\s\S]*?)\s*<\/span>/i)?.[1]?.replace(/<[^>]+>/g, "") ?? "");
    const fileUrls = [...row.matchAll(/href="(https:\/\/datafiles\.chinhphu\.vn\/[^"]+\.(?:pdf|docx?))"/gi)].map((m) => m[1]!);
    out.push({
      docid: id,
      soHieu,
      ngayBanHanh: rawDate ? rawDate.split("/").reverse().join("-") : "",
      trichYeu,
      fileUrls,
    });
  }
  return out;
}

async function crawlChinhphu(): Promise<{ found: number; added: number }> {
  const res = await fetch(CHINHPHU_LIST_URL, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`vanban.chinhphu.vn HTTP ${res.status}`);
  const items = parseChinhphuListing(await res.text());
  let added = 0;
  for (const it of items) {
    const pdf = it.fileUrls.find((u) => /\.pdf$/i.test(u)) ?? it.fileUrls[0] ?? "";
    if (
      upsertLegalDoc({
        id: `chinhphu:${it.docid}`,
        source: "chinhphu",
        soHieu: it.soHieu,
        trichYeu: it.trichYeu,
        loaiVb: guessLoaiVb(it.soHieu),
        ngayBanHanh: it.ngayBanHanh,
        detailUrl: `https://vanban.chinhphu.vn/?pageid=27160&docid=${it.docid}`,
        fileUrl: pdf,
      })
    ) added++;
  }
  return { found: items.length, added };
}

// ───────────────────────── Nguồn 2: Công báo ─────────────────────────

async function crawlCongbao(): Promise<{ found: number; added: number }> {
  const items = await fetchCongbaoRss();
  let added = 0;
  for (const it of items) {
    const key = it.detailUrl.match(/-(\d+)\.htm/)?.[1] ?? it.detailUrl;
    if (
      upsertLegalDoc({
        id: `congbao:${key}`,
        source: "congbao",
        soHieu: it.soHieu,
        trichYeu: it.title,
        loaiVb: it.loaiVB,
        ngayBanHanh: it.pubDate.slice(0, 10),
        detailUrl: it.detailUrl,
      })
    ) added++;
  }
  return { found: items.length, added };
}

// ───────────────────────── Tải file ─────────────────────────

async function resolveFileUrl(doc: LegalDocRow): Promise<string | null> {
  if (doc.fileUrl) return doc.fileUrl;
  if (doc.source === "congbao") {
    return (await fetchCongbaoDetail(doc.detailUrl))?.pdfUrl ?? null;
  }
  if (doc.source === "chinhphu") {
    const res = await fetch(doc.detailUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const html = (await res.text()).replace(/\\\//g, "/");
    const links = [...html.matchAll(/https:\/\/datafiles\.chinhphu\.vn\/[^"'\s<>]+\.(?:pdf|docx?)/gi)].map((m) => m[0]);
    return links.find((u) => /\.pdf$/i.test(u)) ?? links[0] ?? null;
  }
  return null;
}

function isValidDoc(buf: Buffer): "pdf" | "docx" | "doc" | null {
  if (buf.length < 1000) return null;
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  if (buf[0] === 0x50 && buf[1] === 0x4b) return "docx";
  if (buf[0] === 0xd0 && buf[1] === 0xcf) return "doc";
  return null;
}

async function downloadOne(doc: LegalDocRow): Promise<boolean> {
  // Đã có file cùng số hiệu (nguồn khác / người dùng đã tải) -> không tải lại
  const cached = doc.soHieu ? findCachedLegalFile(doc.soHieu) : null;
  if (cached?.filePath && cached.id !== doc.id) {
    markLegalDocDownloaded(doc.id, cached.filePath, cached.fileSize, "", "duplicate");
    return true;
  }

  const url = await resolveFileUrl(doc);
  if (!url) {
    markLegalDocFailed(doc.id, "Nguồn chưa đăng file đính kèm", doc.attempts >= 2 ? "no_file" : "failed");
    return false;
  }

  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(90_000) });
  if (!res.ok) {
    markLegalDocFailed(doc.id, `HTTP ${res.status} khi tải ${url}`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const kind = isValidDoc(buf);
  if (!kind) {
    markLegalDocFailed(doc.id, "File tải về không phải PDF/DOC hợp lệ");
    return false;
  }

  const month = (doc.ngayBanHanh || doc.discoveredAt).slice(0, 7) || "khac";
  const dir = path.join(STORAGE_ROOT, doc.source, month);
  fs.mkdirSync(dir, { recursive: true });
  const safe = (doc.soHieu || doc.id).replace(/[\\/:*?"<>|\s]+/g, "-").slice(0, 120);
  const filePath = path.join(dir, `${safe}.${kind}`);
  fs.writeFileSync(filePath, buf);
  markLegalDocDownloaded(doc.id, filePath, buf.length, url);
  return true;
}

// ───────────────────────── Vòng chạy ─────────────────────────

export async function runLegalCrawlRound(): Promise<CrawlRoundResult | null> {
  if (state.running) return null;
  state.running = true;
  const result: CrawlRoundResult = {
    startedAt: new Date().toISOString(),
    finishedAt: "",
    discovered: { chinhphu: 0, congbao: 0 },
    newDocs: 0,
    downloaded: 0,
    failed: 0,
    purged: null,
    skippedLowDisk: false,
    errors: [],
  };
  try {
    const [cp, cb] = await Promise.allSettled([crawlChinhphu(), crawlCongbao()]);
    if (cp.status === "fulfilled") {
      result.discovered.chinhphu = cp.value.found;
      result.newDocs += cp.value.added;
    } else result.errors.push(`vanban.chinhphu.vn: ${String(cp.reason)}`);
    if (cb.status === "fulfilled") {
      result.discovered.congbao = cb.value.found;
      result.newDocs += cb.value.added;
    } else result.errors.push(`Công báo: ${String(cb.reason)}`);

    // Dọn trước để có chỗ cho file mới
    result.purged = enforceLegalStoragePolicy();

    const free = diskFreeBytes();
    if (free !== null && free < storagePolicy().minFreeBytes) {
      result.skippedLowDisk = true;
      result.errors.push(`Đĩa VPS còn ${(free / 1024 ** 3).toFixed(1)} GB - tạm dừng tải file (vẫn cập nhật danh mục)`);
    }

    for (const doc of result.skippedLowDisk ? [] : listPendingLegalDocs(DOWNLOADS_PER_ROUND)) {
      try {
        if (await downloadOne(doc)) result.downloaded++;
        else result.failed++;
      } catch (err) {
        result.failed++;
        markLegalDocFailed(doc.id, err instanceof Error ? err.message : String(err));
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Tải xong có thể vượt trần -> dọn lại
    if (result.downloaded > 0) {
      const after = enforceLegalStoragePolicy();
      if (after.files > 0 && result.purged) {
        result.purged.files += after.files;
        result.purged.bytes += after.bytes;
        for (const r of after.reason) if (!result.purged.reason.includes(r)) result.purged.reason.push(r);
      }
    }

    if (result.downloaded > 0 || result.newDocs > 0) {
      triggerVbaiLegalSync();
    }
  } finally {
    result.finishedAt = new Date().toISOString();
    state.lastRound = result;
    state.running = false;
    state.nextRunAt = timer ? new Date(Date.now() + INTERVAL_MS).toISOString() : null;
  }
  log.info(result, "Hoàn tất lượt cào văn bản pháp luật");
  return result;
}

function triggerVbaiLegalSync(): void {
  const syncScript = "/var/www/vbai/proxy/scripts/sync-vbaibot-legal.cjs";
  if (fs.existsSync(syncScript)) {
    execFile("node", [syncScript], (err) => {
      if (err) log.warn({ err: err.message }, "Không thể kích hoạt đồng bộ kho sang VBAI");
      else log.info("Đã đồng bộ kho văn bản pháp luật sang VBAI (MongoDB known_documents)");
    });
  }
}

export function startLegalDocsCrawler(): void {
  if (timer) return;
  const kick = () => runLegalCrawlRound().catch((err) => log.error({ err }, "Lỗi lượt cào văn bản pháp luật"));
  setTimeout(kick, 90_000).unref();
  timer = setInterval(kick, INTERVAL_MS);
  timer.unref();
  state.nextRunAt = new Date(Date.now() + 90_000).toISOString();
  log.info({ intervalMinutes: INTERVAL_MS / 60_000 }, "Khởi động bộ cào văn bản pháp luật (vanban.chinhphu.vn + Công báo)");
}

export function stopLegalDocsCrawler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

// ───────────────────────── Helpers ─────────────────────────

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function guessLoaiVb(soHieu: string): string {
  const s = soHieu.toUpperCase();
  if (/VBHN/.test(s)) return "Văn bản hợp nhất";
  if (/\/(NĐ|ND)-/.test(s)) return "Nghị định";
  if (/\/TT(LT)?-/.test(s)) return "Thông tư";
  if (/\/(QĐ|QD)-/.test(s)) return "Quyết định";
  if (/\/NQ-/.test(s)) return "Nghị quyết";
  if (/\/CT-/.test(s)) return "Chỉ thị";
  if (/\/(CĐ|CD)-/.test(s)) return "Công điện";
  if (/\/TB-/.test(s)) return "Thông báo";
  if (/\/QH\d*/.test(s)) return "Luật";
  if (/^\d+\/[A-ZĐ]+-/.test(s)) return "Công văn";
  return "Văn bản";
}

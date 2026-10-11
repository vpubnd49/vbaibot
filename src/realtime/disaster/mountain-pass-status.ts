/**
 * mountain-pass-status.ts
 * Tình trạng 10 đèo huyết mạch dựa trên BẰNG CHỨNG CÓ NGÀY.
 *
 * Vì sao có module này: trước đây model tự "điền" 🟢 Thông suốt cho đèo không có
 * dữ liệu → sai nghiêm trọng (đèo Gia Bắc, Prenn, Mimosa đang có sự cố vẫn báo
 * thông suốt). Giờ mỗi đèo được tra riêng:
 *  - Google News RSS (when:7d) → có ngày đăng + tên báo, bao phủ Báo Lâm Đồng,
 *    Lao Động, Tuổi Trẻ, Thanh Niên, VnExpress...
 *  - Bài fanpage Facebook đã cào (7 ngày)
 *  - Bảng disaster_alerts (7 ngày)
 * Đèo không có bằng chứng → "chưa có thông tin", KHÔNG được khẳng định thông suốt.
 */
import { crawlRssFeed } from "../crawler/rss-crawler.js";
import { searchFacebookPosts } from "../facebook/facebook-page-store.js";
import { db } from "../../conversation/database.js";
import { createLogger } from "../../shared/logger.js";
import { cleanTitle, computePassStatus, isRestrictText, type PassEvidence } from "./pass-status-rules.js";

export type { PassEvidence } from "./pass-status-rules.js";

const log = createLogger("mountain-pass-status");

const WINDOW_DAYS = 14;
const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_ITEMS_PER_PASS = 5;

type PassDef = {
  name: string;
  route: string;
  /** Cụm dùng để tìm kiếm (có chữ "đèo") */
  queries: string[];
  /** Cụm bắt buộc xuất hiện trong tiêu đề/mô tả để coi là đúng đèo */
  match: string[];
};

export const MOUNTAIN_PASSES: PassDef[] = [
  { name: "Đèo D'ran", route: "QL27", queries: ["đèo D'ran", "đèo Dran"], match: ["đèo d'ran", "đèo dran", "đèo d’ran", "deo dran"] },
  { name: "Đèo Đại Ninh", route: "QL28B", queries: ["đèo Đại Ninh"], match: ["đèo đại ninh"] },
  { name: "Đèo Gia Bắc", route: "QL28", queries: ["đèo Gia Bắc"], match: ["gia bắc"] },
  { name: "Đèo Sông Pha (Ngoạn Mục)", route: "QL27", queries: ["đèo Sông Pha", "đèo Ngoạn Mục"], match: ["sông pha", "ngoạn mục"] },
  { name: "Đèo Khánh Lê", route: "QL27C", queries: ["đèo Khánh Lê"], match: ["khánh lê"] },
  { name: "Đèo Prenn", route: "QL20", queries: ["đèo Prenn"], match: ["prenn"] },
  { name: "Đèo Mimosa", route: "QL20", queries: ["đèo Mimosa"], match: ["đèo mimosa", "đèo mimisa"] },
  { name: "Đèo Tuyền Lâm", route: "ĐT/nội bộ Tuyền Lâm", queries: ["đèo Tuyền Lâm"], match: ["đèo tuyền lâm"] },
  { name: "Đèo Tà Đùng", route: "QL28", queries: ["đèo Tà Đùng"], match: ["tà đùng"] },
  { name: "Đèo Bảo Lộc", route: "QL20", queries: ["đèo Bảo Lộc"], match: ["đèo bảo lộc"] },
];


export type PassReport = { pass: PassDef; evidence: PassEvidence[] };

let cache: { at: number; reports: PassReport[] } | null = null;
let inflight: Promise<PassReport[]> | null = null;

function lc(s: string): string {
  return s.normalize("NFC").toLowerCase();
}

function matchesPass(pass: PassDef, text: string): boolean {
  const t = lc(text);
  return pass.match.some((m) => t.includes(m));
}

function withinWindow(d: Date): boolean {
  const t = d.getTime();
  return Number.isFinite(t) && Date.now() - t <= WINDOW_DAYS * 86_400_000 && t <= Date.now() + 3_600_000;
}

function googleNewsUrl(q: string): string {
  const query = `"${q}" when:${WINDOW_DAYS}d`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=vi&gl=VN&ceid=VN:vi`;
}

/** "Tiêu đề - Tên báo" → tách tên báo của Google News */
function splitPublisher(title: string): { title: string; source: string } {
  const idx = title.lastIndexOf(" - ");
  if (idx > 10) return { title: title.slice(0, idx).trim(), source: title.slice(idx + 3).trim() };
  return { title, source: "Báo điện tử" };
}

async function newsEvidence(pass: PassDef): Promise<PassEvidence[]> {
  const out: PassEvidence[] = [];
  const results = await Promise.allSettled(
    pass.queries.map((q) => crawlRssFeed(googleNewsUrl(q), "Google News", 12)),
  );
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const item of r.value) {
      const publishedAt = new Date(item.pubDate);
      if (!withinWindow(publishedAt)) continue;
      if (!matchesPass(pass, `${item.title} ${item.description}`)) continue;
      const { title, source } = splitPublisher(item.title);
      out.push({ title, source, publishedAt, link: item.link, snippet: "" });
    }
  }
  return out;
}

function facebookEvidence(pass: PassDef): PassEvidence[] {
  const out: PassEvidence[] = [];
  for (const m of pass.match) {
    try {
      const { items } = searchFacebookPosts({ q: m, limit: 10 });
      for (const p of items) {
        const publishedAt = new Date(p.createdAt);
        if (!withinWindow(publishedAt) || !matchesPass(pass, p.message)) continue;
        const text = p.message.replace(/\s+/g, " ").trim();
        out.push({
          title: text.slice(0, 160),
          source: `FB: ${p.pageName}`,
          publishedAt,
          link: p.permalink,
          snippet: text.slice(160, 400),
        });
      }
    } catch (err) {
      log.debug({ err }, "Không đọc được bài Facebook cho đèo");
    }
  }
  return out;
}

function alertEvidence(pass: PassDef): PassEvidence[] {
  const out: PassEvidence[] = [];
  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    const rows = db
      .prepare(
        "SELECT title, summary, source_name, source_url, published_at FROM disaster_alerts WHERE published_at >= ? ORDER BY published_at DESC LIMIT 200",
      )
      .all(since) as Array<{ title: string; summary: string; source_name: string; source_url: string; published_at: string }>;
    for (const r of rows) {
      if (!matchesPass(pass, `${r.title} ${r.summary}`)) continue;
      const publishedAt = new Date(r.published_at);
      if (!withinWindow(publishedAt)) continue;
      out.push({ title: r.title, source: r.source_name || "Cảnh báo thiên tai", publishedAt, link: r.source_url, snippet: r.summary.slice(0, 240) });
    }
  } catch (err) {
    log.debug({ err }, "Không đọc được disaster_alerts cho đèo");
  }
  return out;
}

function dedupe(items: PassEvidence[]): PassEvidence[] {
  const seen = new Set<string>();
  const uniq = items
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .filter((e) => {
      const key = lc(e.title).replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 60);
      if (seen.has(key) || seen.has(e.link)) return false;
      seen.add(key);
      seen.add(e.link);
      return true;
    });
  const top = uniq.slice(0, MAX_ITEMS_PER_PASS);
  // Giữ thêm tin cấm xe/chia cắt cũ hơn: không được để tin "thông xe" mới đẩy mất lệnh cấm còn hiệu lực
  const extraBans = uniq
    .slice(MAX_ITEMS_PER_PASS)
    .filter((e) => isRestrictText(`${e.title} ${e.snippet}`))
    .slice(0, 2);
  return [...top, ...extraBans];
}

async function buildReports(): Promise<PassReport[]> {
  const reports: PassReport[] = [];
  // 3 đèo/lượt để không dồn request vào Google News
  for (let i = 0; i < MOUNTAIN_PASSES.length; i += 3) {
    const batch = MOUNTAIN_PASSES.slice(i, i + 3);
    const done = await Promise.all(
      batch.map(async (pass) => {
        const news = await newsEvidence(pass).catch(() => []);
        return { pass, evidence: dedupe([...news, ...facebookEvidence(pass), ...alertEvidence(pass)]) };
      }),
    );
    reports.push(...done);
  }
  return reports;
}

export async function getMountainPassReports(): Promise<PassReport[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.reports;
  if (!inflight) {
    inflight = buildReports()
      .then((reports) => {
        cache = { at: Date.now(), reports };
        return reports;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

function fmtVn(d: Date): string {
  return d.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

/** Lọc theo tên đèo nếu người dùng chỉ hỏi 1 đèo (vd "đèo Prenn") */
export function filterPassReports(reports: PassReport[], area?: string): PassReport[] {
  if (!area) return reports;
  const hit = reports.filter((r) => matchesPass(r.pass, area) || lc(area).includes(lc(r.pass.name)));
  return hit.length > 0 ? hit : reports;
}

// Trạng thái từng đèo tính bằng code trong pass-status-rules.ts

export function formatPassReports(reports: PassReport[]): string {
  const out: string[] = [];
  out.push(`🚧 BẢNG TÌNH TRẠNG ĐÈO (hệ thống tính sẵn từ tin ${WINDOW_DAYS} ngày gần nhất):`);
  out.push(
    "QUY TẮC (bắt buộc): CHÉP NGUYÊN VĂN biểu tượng và các câu của từng đèo dưới đây; chỉ được rút gọn câu chữ, " +
      "KHÔNG đổi biểu tượng, KHÔNG thêm nhận định không có trong bảng (CẤM các cụm: \"lưu thông bình thường\", \"thông suốt\", " +
      "\"êm thuận\", \"ổn định\", \"không có chướng ngại vật\", \"an toàn\"). Dòng \"Lưu ý ... CHƯA thấy tin dỡ bỏ\" BẮT BUỘC giữ lại.",
  );
  for (const { pass, evidence } of reports) {
    const st = computePassStatus(evidence, WINDOW_DAYS);
    out.push(`${st.icon} ${pass.name} (${pass.route}): ${st.lines.join(" ")}`);
  }
  out.push("");
  out.push("— Tin gốc tham khảo (không dùng để tự đổi trạng thái ở bảng trên) —");
  for (const { pass, evidence } of reports) {
    if (evidence.length === 0) continue;
    out.push(`■ ${pass.name}`);
    for (const e of evidence) {
      out.push(`  - [${fmtVn(e.publishedAt)}] ${cleanTitle(e.title)} — ${e.source}`);
      if (e.link && !e.link.includes("news.google.com")) out.push(`    ${e.link}`);
    }
  }
  return out.join("\n");
}

import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../shared/logger.js";
import { dataDir } from "../../config/env.js";

const log = createLogger("congbao-crawler");

const RSS_URL = "https://congbao.chinhphu.vn/cac-van-ban-moi-ban-hanh.rss";

// ─── Types ─────────────────────────────────────────────────────────

export type CongbaoItem = {
  /** Trích yếu / tiêu đề */
  title: string;
  /** URL trang chi tiết trên Công báo */
  detailUrl: string;
  /** Ngày đăng Công báo (ISO) */
  pubDate: string;
  /** Số hiệu VB trích từ URL (VD: "341/2026/NĐ-CP") */
  soHieu: string;
  /** Loại VB trích từ URL (nghi-dinh, thong-tu, quyet-dinh, nghi-quyet, ...) */
  loaiVB: string;
};

export type CongbaoDetail = CongbaoItem & {
  /** Link PDF trực tiếp trên CDN (congbaocdn.chinhphu.vn) */
  pdfUrl: string | null;
  /** Số Công báo */
  soCongBao: string | null;
};

// ─── RSS Parser ────────────────────────────────────────────────────

/**
 * Parse RSS Công báo bằng regex (không cần xml parser).
 * RSS format rất ổn định: <item><description>...<pubDate>...<link>...<guid>...</item>
 */
export async function fetchCongbaoRss(): Promise<CongbaoItem[]> {
  const res = await fetch(RSS_URL, {
    headers: { "User-Agent": "VBAI-Bot/1.0 (congbao-rss-reader)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();

  const items: CongbaoItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    const desc = extractTag(block, "description");
    const link = extractTag(block, "link");
    const pub = extractTag(block, "pubDate");

    if (!link) continue;

    const { soHieu, loaiVB } = parseCongbaoUrl(link);
    items.push({
      title: cleanCdata(desc || ""),
      detailUrl: link.trim(),
      pubDate: pub ? new Date(pub).toISOString() : new Date().toISOString(),
      soHieu,
      loaiVB,
    });
  }

  log.info({ count: items.length }, "Fetched congbao RSS items");
  return items;
}

// ─── Detail Page Parser ────────────────────────────────────────────

/**
 * Fetch trang chi tiết VB trên Công báo, tìm link PDF trên CDN.
 *
 * Pattern HTML cần tìm:
 * ```html
 * <a ... data-href="https://congbaocdn.chinhphu.vn/xxx_signed.pdf" ...>506</a>
 * ```
 */
export async function fetchCongbaoDetail(detailUrl: string): Promise<CongbaoDetail | null> {
  try {
    const res = await fetch(detailUrl, {
      headers: { "User-Agent": "VBAI-Bot/1.0 (congbao-detail)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      log.warn({ url: detailUrl, status: res.status }, "Detail fetch failed");
      return null;
    }

    const html = await res.text();

    // Tìm data-href trỏ đến PDF trên CDN
    const pdfMatch = html.match(/data-href="(https?:\/\/congbaocdn\.chinhphu\.vn\/[^"]+\.pdf)"/i);
    const pdfUrl = pdfMatch ? pdfMatch[1] : null;

    // Tìm số Công báo từ title attribute
    const cbMatch = html.match(/title="Công báo số (\d+)/);
    const soCongBao = cbMatch ? cbMatch[1] : null;

    // Trích tiêu đề từ <title>
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    const { soHieu, loaiVB } = parseCongbaoUrl(detailUrl);

    return {
      title,
      detailUrl,
      pubDate: new Date().toISOString(),
      soHieu,
      loaiVB,
      pdfUrl,
      soCongBao,
    };
  } catch (err) {
    log.error({ err, url: detailUrl }, "Error fetching congbao detail");
    return null;
  }
}

// ─── PDF Download ──────────────────────────────────────────────────

/**
 * Tải file PDF từ CDN Công báo về thư mục local.
 * @returns Đường dẫn tuyệt đối file đã tải, hoặc null nếu thất bại.
 */
export async function downloadCongbaoPdf(
  pdfUrl: string,
  soHieu: string,
): Promise<string | null> {
  const dir = getCongbaoStorageDir();
  // Tên file an toàn từ số hiệu
  const safeName = soHieu.replace(/[\\/:*?"<>|]/g, "-") || "congbao";
  const fileName = `${safeName}_congbao.pdf`;
  const filePath = path.join(dir, fileName);

  // Kiểm tra đã tải chưa
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
    log.debug({ filePath }, "PDF đã tồn tại, bỏ qua tải");
    return filePath;
  }

  try {
    const res = await fetch(pdfUrl, {
      headers: { "User-Agent": "VBAI-Bot/1.0 (congbao-pdf)" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      log.warn({ url: pdfUrl, status: res.status }, "PDF download failed");
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    log.info({ filePath, size: buffer.length }, "Downloaded congbao PDF");
    return filePath;
  } catch (err) {
    log.error({ err, url: pdfUrl }, "Error downloading congbao PDF");
    return null;
  }
}

// ─── Tìm kiếm VB trên Công báo ────────────────────────────────────

/**
 * Tìm VB trên Công báo theo số hiệu hoặc từ khóa.
 * Fetch RSS → lọc theo keyword → trả items khớp.
 */
export async function searchCongbao(keyword: string): Promise<CongbaoItem[]> {
  const items = await fetchCongbaoRss();
  const kw = keyword.toLowerCase().trim();
  return items.filter(
    (item) =>
      item.soHieu.toLowerCase().includes(kw) ||
      item.title.toLowerCase().includes(kw),
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function cleanCdata(s: string): string {
  return s.replace(/<!\[CDATA\[\s*/g, "").replace(/\s*\]\]>/g, "").trim();
}

/**
 * Parse URL Công báo để trích số hiệu và loại VB.
 * VD: `congbao.chinhphu.vn/van-ban/nghi-dinh-so-341-2026-nd-cp-470382.htm`
 *  → soHieu: "341/2026/NĐ-CP", loaiVB: "Nghị định"
 */
function parseCongbaoUrl(url: string): { soHieu: string; loaiVB: string } {
  const slug = url.split("/").pop()?.replace(".htm", "") || "";

  // Pattern: {loai-vb}-so-{so}-{nam}-{loai}-{coquan}-{id}
  // VD: nghi-dinh-so-341-2026-nd-cp-470382
  const match = slug.match(
    /^([\w-]+?)-so-([\d]+)-([\d]{4})-([a-z]+)-([a-z]+)-(\d+)$/i,
  );

  if (match) {
    const [, rawLoai, so, nam, loai, coQuan] = match;
    const soHieu = `${so}/${nam}/${loai.toUpperCase()}-${coQuan.toUpperCase()}`;
    const loaiVB = formatLoaiVB(rawLoai);
    return { soHieu, loaiVB };
  }

  // Fallback: VB hợp nhất, QĐ TTg...
  const vbhnMatch = slug.match(/^van-ban-hop-nhat-so-([\d]+)-([\d]{4})/i);
  if (vbhnMatch) {
    return { soHieu: `${vbhnMatch[1]}/${vbhnMatch[2]}/VBHN`, loaiVB: "VB hợp nhất" };
  }

  const qdMatch = slug.match(/^quyet-dinh-so-([\d]+)-qd-ttg/i);
  if (qdMatch) {
    return { soHieu: `${qdMatch[1]}/QĐ-TTg`, loaiVB: "Quyết định TTg" };
  }

  const nqMatch = slug.match(/^nghi-quyet-so-([\d]+)-nq-cp/i);
  if (nqMatch) {
    return { soHieu: `${nqMatch[1]}/NQ-CP`, loaiVB: "Nghị quyết CP" };
  }

  return { soHieu: slug, loaiVB: "Không xác định" };
}

function formatLoaiVB(raw: string): string {
  const map: Record<string, string> = {
    "nghi-dinh": "Nghị định",
    "thong-tu": "Thông tư",
    "quyet-dinh": "Quyết định",
    "nghi-quyet": "Nghị quyết",
    "chi-thi": "Chỉ thị",
    "lenh": "Lệnh",
    "phap-lenh": "Pháp lệnh",
    "luat": "Luật",
    "thong-tu-lien-tich": "Thông tư liên tịch",
  };
  return map[raw] || raw.replace(/-/g, " ");
}

export function getCongbaoStorageDir(): string {
  const dir = path.join(dataDir, "congbao");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

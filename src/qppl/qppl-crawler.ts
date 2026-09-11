import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../shared/logger.js";
import type { QpplFileLink, QpplNguon, QpplRawItem } from "./qppl-types.js";

const log = createLogger("qppl-crawler");

const API_PROXY_URL = "https://api.lamdong.gov.vn/RestApi/Readjson";

/**
 * Endpoint SharePoint REST API cho từng nguồn.
 *
 * Tên cột $select khớp chính xác với Unicode-encoded field names mà SharePoint
 * trả về — đã xác nhận bằng probe thật (09/2026). Thay đổi tên cột sẽ khiến
 * response trả `undefined` mà không báo lỗi.
 */
const NGUON_CONFIG: Record<QpplNguon, { baseUrl: string; listTitle: string }> = {
  ubnd: {
    baseUrl: "https://w3.lamdong.gov.vn/sites/vpubnd/_api/web/lists/getByTitle",
    listTitle: "Quản lý văn bản chỉ đạo",
  },
  hdnd: {
    baseUrl: "https://w3.lamdong.gov.vn/sites/dbnd/_api/web/lists/getByTitle",
    listTitle: "Quản lý văn bản",
  },
};

const SP_SELECT_FIELDS = [
  "ID",
  "Title",
  "S_x1ed1__x002f_K_x00fd__x0020_hi",
  "Ng_x00e0_y",
  "Lo_x1ea1_i_x0020_v_x0103_n_x0020",
  "C_x01a1__x0020_quan_x0020_ban_x0",
  "Tr_x00ed_ch_x0020_y_x1ebf_u",
  "L_x0129_nh_x0020_V_x1ef1_c",
  "Hi_x1ec7_u_x0020_l_x1ef1_c",
  "Urls",
  "Modified",
].join(",");

/**
 * Parse trường `Urls` HTML để lấy link file đính kèm.
 *
 * Trường Urls chứa HTML dạng:
 * ```html
 * <a href="https&#58;//media.lamdong.gov.vn/media/xxx">TenFile.pdf</a><br>
 * <a href="https&#58;//media.lamdong.gov.vn/media/yyy">TenFile.doc</a>
 * ```
 *
 * Hỗ trợ:
 * - HTML entity thập phân, thập lục phân (`&#x3A;`) và named (`&quot;`, `&apos;`).
 * - Encode nhiều lớp (`&amp;#58;` → `&#58;` → `:`).
 * - Anchor có phần tử lồng nhau (`<a ...><span>file.pdf</span></a>`).
 * - Anchor không có text: lấy tên từ `title`/`aria-label`/`download` hoặc đường dẫn URL.
 * - `href` không nằm trong dấu quote.
 * - URL protocol-relative (`//host/path`) và tương đối (resolve từ base lamdong.gov.vn).
 * - Loại trùng theo URL sau chuẩn hóa (bỏ fragment, lowercase host).
 */

const ENTITY_DECODER_RE = /&(?:#[xX]([0-9a-fA-F]+)|#(\d+)|(quot|apos|amp|lt|gt|nbsp));/g;

function decodeHtmlEntities(input: string, maxPasses = 3): string {
  let current = input;
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    current = current.replace(ENTITY_DECODER_RE, (whole, hex: string | undefined, dec: string | undefined, named: string | undefined) => {
      changed = true;
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      if (dec) return String.fromCodePoint(parseInt(dec, 10));
      switch (named) {
        case "quot": return '"';
        case "apos": return "'";
        case "amp": return "&";
        case "lt": return "<";
        case "gt": return ">";
        case "nbsp": return " ";
        default: return whole;
      }
    });
    if (!changed) break;
  }
  return current;
}

const ANCHOR_RE = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const HREF_RE = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
const TITLE_RE = /\b(?:title|aria-label)\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const DOWNLOAD_RE = /\bdownload\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

function attrValue(re: RegExp, attrs: string): string | undefined {
  const m = re.exec(attrs);
  if (!m) return undefined;
  return (m[1] ?? m[2] ?? m[3] ?? "").trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Resolve URL tương đối/protocol-relative về tuyệt đối; trả null nếu không parse được */
function resolveUrl(raw: string, base: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, "");
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = ""; // fragment không phân biệt file
    return u.toString();
  } catch {
    return null;
  }
}

/** Tên file dự phòng từ đường dẫn URL (decode percent-encoding) */
function nameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const decoded = decodeURIComponent(seg).trim();
    return decoded || u.hostname;
  } catch {
    return "file";
  }
}

export function extractFileUrls(rawUrls: unknown): QpplFileLink[] {
  if (rawUrls === undefined || rawUrls === null) return [];

  // SharePoint/proxy có thể trả Urls là HTML string, JSON string, array hoặc object.
  // Thu thập mọi string ở các tầng rồi parse HTML/plain URL thống nhất.
  const rawStrings: string[] = [];
  const collectStrings = (value: unknown, depth = 0): void => {
    if (depth > 4 || value === null || value === undefined) return;
    if (typeof value === "string") {
      const text = value.trim();
      if (!text) return;
      rawStrings.push(text);
      const decoded = decodeHtmlEntities(text);
      if (decoded !== text) rawStrings.push(decoded);
      try {
        const parsed: unknown = JSON.parse(decoded);
        if (parsed !== value) collectStrings(parsed, depth + 1);
      } catch {
        // Đây là HTML hoặc URL thuần, xử lý ở bước bên dưới.
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) collectStrings(item, depth + 1);
      return;
    }
    if (typeof value === "object") {
      for (const item of Object.values(value as Record<string, unknown>)) {
        collectStrings(item, depth + 1);
      }
    }
  };
  collectStrings(rawUrls);

  const seen = new Set<string>();
  const links: QpplFileLink[] = [];
  const addLink = (href: string, candidateName?: string): void => {
    const url = resolveUrl(href, "https://lamdong.gov.vn/");
    if (!url || seen.has(url)) return;
    const name = candidateName?.trim() || nameFromUrl(url);
    if (!name) return;
    seen.add(url);
    links.push({ name, url });
  };

  for (const raw of rawStrings) {
    const unescaped = decodeHtmlEntities(raw);
    let anchor: RegExpExecArray | null;
    ANCHOR_RE.lastIndex = 0;
    while ((anchor = ANCHOR_RE.exec(unescaped)) !== null) {
      const attrs = anchor[1] ?? "";
      const href = attrValue(HREF_RE, attrs);
      if (!href) continue;
      const text = stripTags(anchor[2] ?? "");
      const title = attrValue(TITLE_RE, attrs) ?? "";
      const download = attrValue(DOWNLOAD_RE, attrs) ?? "";
      addLink(href, text || title || download);
    }

    // Một số response trả plain URL hoặc JSON object có trường url/href mà không có anchor.
    if (!/<a\b/i.test(unescaped)) {
      const plainUrlRe = /(?:https?:\/\/|\/\/|\/)[^\s"'<>]+/gi;
      let match: RegExpExecArray | null;
      while ((match = plainUrlRe.exec(unescaped)) !== null) addLink(match[0]);
    }
  }

  return links;
}

/**
 * Tải danh sách văn bản QPPL từ SharePoint REST API.
 *
 * Phân trang tự động: SharePoint giới hạn `$top` tối đa 100 items/request.
 * Khi có nhiều hơn, response chứa `d.__next` với URL trang kế.
 */
export async function fetchQpplItems(
  nguon: QpplNguon,
  limit = 200,
): Promise<QpplRawItem[]> {
  const cfg = NGUON_CONFIG[nguon];
  const pageSize = Math.min(limit, 100);
  let nextUrl: string | null =
    `${cfg.baseUrl}('${encodeURIComponent(cfg.listTitle)}')/items` +
    `?$orderby=Modified desc` +
    `&$select=${SP_SELECT_FIELDS}` +
    `&$top=${pageSize}`;

  const allItems: QpplRawItem[] = [];
  let page = 0;
  const MAX_PAGES = 10;

  while (nextUrl && allItems.length < limit && page < MAX_PAGES) {
    page++;
    try {
      const res = await fetch(API_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json;odata=verbose",
          "User-Agent": "Mozilla/5.0 (compatible; VBAIBot/1.0)",
        },
        body: JSON.stringify({ SourceUrl: nextUrl }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        log.warn({ status: res.status, page, nguon }, "API QPPL trả mã lỗi");
        break;
      }

      const data = (await res.json()) as {
        d?: { results?: QpplRawItem[]; __next?: string };
      };
      const items = data?.d?.results || [];
      allItems.push(...items);

      // SharePoint trả __next URL với domain lamdong.gov.vn nhưng API thật ở w3
      const rawNext = data?.d?.__next;
      nextUrl =
        rawNext && items.length > 0
          ? rawNext.replace("https://lamdong.gov.vn/", "https://w3.lamdong.gov.vn/")
          : null;

      log.debug(
        { page, fetched: items.length, total: allItems.length, nguon },
        "Đã lấy trang VB QPPL",
      );
    } catch (err) {
      log.error({ err, page, nguon }, "Lỗi khi gọi API danh sách VB QPPL");
      break;
    }
  }

  return allItems.slice(0, limit);
}

/**
 * Tra cứu trực tiếp trên API SharePoint theo số hiệu hoặc từ khóa.
 *
 * Dùng làm fallback khi kho local chưa sync đến VB cần tìm (63.000+ VB mà
 * mỗi lần sync chỉ lấy 200 mới nhất). SharePoint `substringof` filter tìm
 * chuỗi con trên trường Số/Ký hiệu hoặc Trích yếu.
 *
 * Thử cả UBND lẫn HĐND rồi gộp kết quả.
 */
export async function searchQpplItemsLive(
  keyword: string,
  limit = 10,
): Promise<{ nguon: QpplNguon; item: QpplRawItem }[]> {
  const kw = keyword.trim();
  if (!kw) return [];

  const results: { nguon: QpplNguon; item: QpplRawItem }[] = [];
  const nguons: QpplNguon[] = ["ubnd", "hdnd"];

  // SharePoint OData `substringof` phá vỡ khi chuỗi chứa `/` hoặc `'`.
  // "15187/KH-UBND" → dùng "15187" (phần số) để tìm trên Số/Ký hiệu,
  // và dùng nguyên chuỗi gốc để tìm trên Title (Title chứa đầy đủ).
  const safeKw = kw.includes("/")
    ? kw.split("/").sort((a, b) => a.length - b.length).pop() || kw.split("/")[0] || kw
    : kw;
  // Thoát dấu nháy đơn cho OData
  const escapedKw = safeKw.replace(/'/g, "''");

  for (const nguon of nguons) {
    const cfg = NGUON_CONFIG[nguon];
    // SharePoint OData chỉ hỗ trợ substringof trên Title (Single line of text).
    // Các trường Unicode-encoded khác (Trích yếu, Số/Ký hiệu) là Note/Calculated
    // nên sẽ bị SharePoint trả lỗi HTTP 400 Bad Request nếu dùng substringof.
    // Title của văn bản trên SharePoint luôn có dạng: "Trục liên thông: 4480/QĐ-BDD".
    const filter = `substringof('${escapedKw}',Title)`;
    const url =
      `${cfg.baseUrl}('${encodeURIComponent(cfg.listTitle)}')/items` +
      `?$filter=${encodeURIComponent(filter)}` +
      `&$orderby=Modified desc` +
      `&$select=${SP_SELECT_FIELDS}` +
      `&$top=${Math.min(limit, 20)}`;

    try {
      const res = await fetch(API_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json;odata=verbose",
          "User-Agent": "Mozilla/5.0 (compatible; VBAIBot/1.0)",
        },
        body: JSON.stringify({ SourceUrl: url }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        log.warn({ status: res.status, nguon, kw }, "Live search API lỗi");
        continue;
      }

      const data = (await res.json()) as { d?: { results?: QpplRawItem[] } };
      const items = data?.d?.results || [];
      for (const item of items) {
        results.push({ nguon, item });
      }
      log.debug({ nguon, kw, found: items.length }, "Live search QPPL");
    } catch (err) {
      log.warn({ err, nguon, kw }, "Lỗi live search QPPL");
    }

    if (results.length >= limit) break;
  }

  return results.slice(0, limit);
}

/**
 * Tải file từ `media.lamdong.gov.vn` về đĩa.
 * Trả về kích thước file (bytes). Hỗ trợ PDF, DOC, DOCX.
 */
function looksLikeHtml(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 512).toString("utf8").trimStart().toLowerCase();
  return sample.startsWith("<!doctype html") || sample.startsWith("<html") || sample.includes("đăng nhập") || sample.includes("sign in");
}

function looksLikeKnownFile(buffer: Buffer, contentType: string): boolean {
  if (buffer.length === 0) return false;
  if (looksLikeHtml(buffer)) return false;
  const type = contentType.toLowerCase();
  const isPdf = buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isOle = buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (isPdf || isZip || isOle) return true;
  return !type.includes("text/html") && !type.includes("application/xhtml");
}

/** Tải file vào file tạm, xác minh response rồi đổi tên nguyên tử. */
export async function downloadQpplFile(
  fileUrl: string,
  destPath: string,
): Promise<number> {
  const res = await fetch(fileUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  const contentType = res.headers.get("content-type") || "";
  if (!looksLikeKnownFile(buffer, contentType)) {
    throw new Error(`Response không phải file hợp lệ (content-type: ${contentType || "unknown"})`);
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const tempPath = `${destPath}.part`;
  fs.writeFileSync(tempPath, buffer);
  fs.renameSync(tempPath, destPath);

  log.debug(
    { url: fileUrl, finalUrl: res.url, contentType, bytes: buffer.length, dest: path.basename(destPath) },
    "Đã tải file VB QPPL",
  );

  return buffer.length;
}

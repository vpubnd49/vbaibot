import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../shared/logger.js";
import type { QpplFileLink, QpplNguon, QpplRawItem } from "./qppl-types.js";
import { AGENCY_REGISTRY, getTier1Agencies } from "./qppl-registry.js";
import { fetchEduDocuments } from "./qppl-edu-crawler.js";

const log = createLogger("qppl-crawler");

const API_PROXY_URL = "https://api.lamdong.gov.vn/RestApi/Readjson";

/**
 * Lấy cấu hình endpoint SharePoint REST API cho từng nguồn hoặc Sở ban ngành / địa phương.
 */
function getAgencyConfig(nguon: QpplNguon): { baseUrl: string; listTitle: string } {
  const reg = AGENCY_REGISTRY[nguon];
  if (reg) {
    return {
      baseUrl: `${reg.baseUrl}/_api/web/lists/getByTitle`,
      listTitle: reg.listTitle,
    };
  }
  // Mặc định về UBND tỉnh
  return {
    baseUrl: "https://w3.lamdong.gov.vn/sites/vpubnd/_api/web/lists/getByTitle",
    listTitle: "Quản lý văn bản chỉ đạo",
  };
}


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
    const decoded = decodeMaybeNonUtf8(seg).trim();
    return decoded || u.hostname;
  } catch {
    return "file";
  }
}

/**
 * Giải mã tên file từ URL SharePoint.
 *
 * SharePoint Lâm Đồng encode tên file tiếng Việt dạng percent-encoded
 * Latin-1/Windows-1252 thay vì UTF-8 chuẩn. Ví dụ:
 * - `B%E1o%20c%E1o` (Latin-1) thay vì `B%C3%A1o%20c%C3%A1o` (UTF-8)
 * - `%D0_%20%E1n` (Latin-1 cho "Đề án") thay vì `%C4%90%E1%BB%81%20%C3%A1n`
 *
 * Chiến lược: thử UTF-8 trước, nếu ra ký tự thay thế (�) → decode lại
 * từng byte thành Latin-1 (code page 1252).
 */
function decodeMaybeNonUtf8(encoded: string): string {
  // Bước 1: thử decode chuẩn UTF-8
  try {
    const utf8 = decodeURIComponent(encoded);
    if (!utf8.includes("\uFFFD")) return utf8;
  } catch { /* fallthrough to Latin-1 */ }

  // Bước 2: decode từng byte thành Latin-1
  // Chuyển percent-encoded thành mảng byte, rồi map byte → char Latin-1
  try {
    const bytes: number[] = [];
    for (let i = 0; i < encoded.length; i++) {
      if (encoded[i] === "%" && i + 2 < encoded.length) {
        bytes.push(parseInt(encoded.substring(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(encoded.charCodeAt(i));
      }
    }
    // Latin-1: mỗi byte là một code point (ISO 8859-1 superset)
    return String.fromCharCode(...bytes);
  } catch {
    // Fallback cuối: trả nguyên encoded
    return encoded;
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
  if (nguon === "sgd_edu") {
    return fetchEduDocuments("", limit);
  }

  const cfg = getAgencyConfig(nguon);
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
 * Dùng làm fallback khi kho local chưa sync đến VB cần tìm (hàng chục nghìn VB
 * trên mỗi site).
 * Hỗ trợ chỉ định cơ quan (targetNguon) hoặc tự động quét toàn bộ Tier 1.
 */
function normalizeQpplNumber(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/[\s/-]/g, "")
    .toUpperCase();
}

function extractQpplNumber(value: string): string | null {
  const match = value.match(/\b\d+\s*\/\s*[A-ZĐÀ-Ỹ0-9][A-ZĐÀ-Ỹ0-9-]*\b/i);
  return match?.[0] ? normalizeQpplNumber(match[0]) : null;
}

export async function searchQpplItemsLive(
  keyword: string,
  limit = 10,
  targetNguon?: QpplNguon,
): Promise<{ nguon: QpplNguon; item: QpplRawItem }[]> {
  const kw = keyword.trim();
  // Nếu không có keyword VÀ không chỉ định nguồn → không biết tìm gì
  if (!kw && !targetNguon) return [];

  const results: { nguon: QpplNguon; item: QpplRawItem }[] = [];
  const nguons: QpplNguon[] = targetNguon
    ? [targetNguon]
    : getTier1Agencies().map((a) => a.code);

  // SharePoint OData `substringof` phá vỡ khi chuỗi chứa `/` hoặc `'`.
  // "15187/KH-UBND" → dùng "15187" (phần số) để tìm trên Số/Ký hiệu,
  // và dùng nguyên chuỗi gốc để tìm trên Title (Title chứa đầy đủ).
  const requestedNumber = extractQpplNumber(kw);
  const safeKw = requestedNumber ? kw.split("/")[0]!.trim() : kw;
  // Thoát dấu nháy đơn cho OData
  const escapedKw = safeKw.replace(/'/g, "''");

  for (const nguon of nguons) {
    if (nguon === "sgd_edu") {
      try {
        const eduItems = await fetchEduDocuments(kw, limit);
        for (const item of eduItems) {
          results.push({ nguon, item });
        }
      } catch (err) {
        log.warn({ err }, "Lỗi live search Sở GD&ĐT");
      }
      continue;
    }

    const cfg = getAgencyConfig(nguon);
    // Khi có keyword → filter theo substringof; khi keyword rỗng → lấy mới nhất (không filter)
    const filter = kw
      ? `substringof('${escapedKw}',Title)`
      : "";
    const filterParam = filter
      ? `?$filter=${encodeURIComponent(filter)}&`
      : "?";
    const url =
      `${cfg.baseUrl}('${encodeURIComponent(cfg.listTitle)}')/items` +
      `${filterParam}$orderby=Modified desc` +
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
         if (requestedNumber) {
           const itemNumber = extractQpplNumber(String(item.S_x1ed1__x002f_K_x00fd__x0020_hi || item.Title || ""));
           if (itemNumber !== requestedNumber) continue;
         }
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
async function pdfMatchesDocumentNumber(buffer: Buffer, expectedSoKyHieu?: string): Promise<boolean> {
  if (!expectedSoKyHieu) return true;
  try {
    const pdfModule: any = await import("pdf-parse");
    const parse = typeof pdfModule === "function" ? pdfModule : pdfModule.default;
    if (!parse) return false;
    const parsed = await parse(buffer, { max: 5 });
    const text = String(parsed.text || "");
    if (!text.trim()) return true; // PDF scan: magic bytes vẫn được kiểm tra; không OCR trong đường tải nhanh.
    return normalizeQpplNumber(text).includes(normalizeQpplNumber(expectedSoKyHieu));
  } catch {
    return true; // Không chặn file scan hợp lệ chỉ vì parser không đọc được text.
  }
}

export async function downloadQpplFile(
  fileUrl: string,
  destPath: string,
  expectedSoKyHieu?: string,
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
  if (contentType.toLowerCase().includes("pdf") && !(await pdfMatchesDocumentNumber(buffer, expectedSoKyHieu))) {
    throw new Error(`Nội dung PDF không khớp số/ký hiệu ${expectedSoKyHieu}`);
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

/**
 * Tra cứu VB QPPL trong khoảng ngày, phân trang tự động.
 *
 * SharePoint `$filter` trên trường `Ng_x00e0_y` (Date) hoạt động qua proxy,
 * nhưng `substringof` trên Title chỉ chứa số hiệu ("Trục liên thông: 1077/UBND-NNMT")
 * — KHÔNG chứa trích yếu hay loại VB. Vì vậy:
 * - Lọc NGÀY: qua API (`$filter`)
 * - Lọc KEYWORD + LOẠI VB: post-filter client-side trên trích yếu + số ký hiệu.
 *
 * Thử cả UBND lẫn HĐND rồi gộp kết quả.
 */
export async function searchQpplByDateRange(opts: {
  dateFrom: string; // ISO date "2026-01-01"
  dateTo: string;   // ISO date "2026-02-01"
  keyword?: string;
  loaiVanBan?: string;
  limit?: number;
  targetNguon?: QpplNguon;
}): Promise<{ nguon: QpplNguon; item: QpplRawItem }[]> {
  const { dateFrom, dateTo, keyword, loaiVanBan, limit = 50, targetNguon } = opts;
  if (!dateFrom || !dateTo) return [];

  const results: { nguon: QpplNguon; item: QpplRawItem }[] = [];
  const nguons: QpplNguon[] = targetNguon
    ? [targetNguon]
    : getTier1Agencies().map((a) => a.code);

  const kwLower = keyword?.trim().toLowerCase() ?? "";
  const loaiLower = loaiVanBan?.trim().toLowerCase() ?? "";

  for (const nguon of nguons) {
    if (nguon === "sgd_edu") {
      try {
        const eduItems = await fetchEduDocuments(kwLower, limit);
        for (const item of eduItems) {
          results.push({ nguon, item });
        }
      } catch (err) {
        log.warn({ err }, "Lỗi live search date range Sở GD&ĐT");
      }
      continue;
    }

    const cfg = getAgencyConfig(nguon);
    const dateFilter =
      `Ng_x00e0_y ge datetime'${dateFrom}T00:00:00' and Ng_x00e0_y lt datetime'${dateTo}T00:00:00'`;

    const pageSize = 100; // SharePoint max per page
    let nextUrl: string | null =
      `${cfg.baseUrl}('${encodeURIComponent(cfg.listTitle)}')/items` +
      `?$filter=${encodeURIComponent(dateFilter)}` +
      `&$orderby=Ng_x00e0_y desc` +
      `&$select=${SP_SELECT_FIELDS}` +
      `&$top=${pageSize}`;

    let page = 0;
    const MAX_PAGES = 20; // max 2000 items per nguon per date range
    let nguonItems: QpplRawItem[] = [];

    while (nextUrl && page < MAX_PAGES) {
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
          log.warn({ status: res.status, page, nguon, dateFrom, dateTo }, "API date-range QPPL trả mã lỗi");
          break;
        }

        const data = (await res.json()) as {
          d?: { results?: QpplRawItem[]; __next?: string };
        };
        const items = data?.d?.results || [];
        nguonItems.push(...items);

        const rawNext = data?.d?.__next;
        nextUrl =
          rawNext && items.length > 0
            ? rawNext.replace("https://lamdong.gov.vn/", "https://w3.lamdong.gov.vn/")
            : null;

        log.debug(
          { page, fetched: items.length, total: nguonItems.length, nguon, dateFrom, dateTo },
          "Đã lấy trang VB QPPL theo ngày",
        );
      } catch (err) {
        log.error({ err, page, nguon, dateFrom, dateTo }, "Lỗi khi gọi API date-range QPPL");
        break;
      }
    }

    // Post-filter: keyword trên trích yếu + số ký hiệu, loại VB trên loai
    for (const item of nguonItems) {
      if (kwLower) {
        const searchable = [
          item.Tr_x00ed_ch_x0020_y_x1ebf_u ?? "",
          item.S_x1ed1__x002f_K_x00fd__x0020_hi ?? "",
          item.Title ?? "",
        ].join(" ").toLowerCase();
        if (!searchable.includes(kwLower)) continue;
      }
      if (loaiLower) {
        const itemLoai = (item.Lo_x1ea1_i_x0020_v_x0103_n_x0020 ?? "").toLowerCase();
        if (!itemLoai.includes(loaiLower)) continue;
      }
      results.push({ nguon, item });
    }

    log.debug(
      { nguon, dateFrom, dateTo, rawCount: nguonItems.length, filtered: results.length },
      "Date-range search QPPL",
    );

    if (results.length >= limit) break;
  }

  return results.slice(0, limit);
}


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
 * HTML entities (`&#58;` = `:`, `&amp;` = `&`) được unescape trước khi parse.
 */
export function extractFileUrls(urlsHtml: string | undefined): QpplFileLink[] {
  if (!urlsHtml?.trim()) return [];

  const unescaped = urlsHtml
    .replace(/&#123;/g, "{")
    .replace(/&#125;/g, "}")
    .replace(/&quot;/g, '"')
    .replace(/&#58;/g, ":")
    .replace(/&amp;/g, "&");

  const links: QpplFileLink[] = [];
  const linkRegex = /href=["']([^"']+)["'][^>]*>([^<]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(unescaped)) !== null) {
    const url = match[1]?.trim();
    const name = match[2]?.trim();
    if (url && name && url.startsWith("http")) {
      links.push({ name, url });
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
    // Tìm trên Số/Ký hiệu, Title, và Trích yếu
    const filter =
      `substringof('${escapedKw}',S_x1ed1__x002f_K_x00fd__x0020_hi)` +
      ` or substringof('${escapedKw}',Title)` +
      ` or substringof('${escapedKw}',Tr_x00ed_ch_x0020_y_x1ebf_u)`;
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
export async function downloadQpplFile(
  fileUrl: string,
  destPath: string,
): Promise<number> {
  const res = await fetch(fileUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buffer);

  log.debug(
    { url: fileUrl, bytes: buffer.length, dest: path.basename(destPath) },
    "Đã tải file VB QPPL",
  );

  return buffer.length;
}

import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../shared/logger.js";
import type { ThanhtraRawItem } from "./thanhtra-types.js";

const log = createLogger("thanhtra-crawler");

const API_PROXY_URL = "https://api.lamdong.gov.vn/RestApi/Readjson";
const SP_ENDPOINT_BASE = "https://w3.lamdong.gov.vn/sites/thanhtra/thanh-tra/ketluan/_api/web/lists/getByTitle('Site Pages')/items";
const LAMDONG_PORTAL_HOST = "https://lamdong.gov.vn";

/**
 * Bóc tách link file PDF từ chuỗi CanvasContent1 của trang SPFx SharePoint.
 * Chuỗi có thể chứa mã HTML entities như &#123; &quot; &#58;
 */
export function extractPdfUrl(canvasContent: string | undefined): string | null {
  if (!canvasContent || !canvasContent.trim()) return null;

  const unescaped = canvasContent
    .replace(/&#123;/g, "{")
    .replace(/&#125;/g, "}")
    .replace(/&quot;/g, '"')
    .replace(/&#58;/g, ":")
    .replace(/&amp;/g, "&");

  const pdfRegex = /href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi;
  const match = pdfRegex.exec(unescaped);
  if (!match || !match[1]) return null;

  let rawUrl = match[1].trim();
  if (rawUrl.startsWith("/")) {
    rawUrl = `${LAMDONG_PORTAL_HOST}${rawUrl}`;
  }
  return rawUrl;
}

/**
 * Tải danh sách bài viết Kết luận thanh tra từ API SharePoint của Cổng tỉnh Lâm Đồng.
 *
 * SharePoint REST API giới hạn `$top` tối đa 100 items/request. Khi có nhiều hơn,
 * response trả kèm `d.__next` chứa URL trang kế (dùng `$skiptoken`). Hàm này tự
 * phân trang cho đến khi đủ `limit` hoặc hết dữ liệu.
 *
 * Tổng số kết luận trên cổng ≈ 128 (tính đến 09/2026), nên `limit=200` đủ lấy toàn bộ.
 */
export async function fetchThanhtraItems(limit = 200): Promise<ThanhtraRawItem[]> {
  const pageSize = Math.min(limit, 100);
  let nextUrl: string | null =
    `${SP_ENDPOINT_BASE}?$filter=Title ne 'Home'&$orderby=Modified desc` +
    `&$select=ID,Title,Description,CanvasContent1,FileRef,Modified,Created&$top=${pageSize}`;
  const allItems: ThanhtraRawItem[] = [];
  let page = 0;
  const MAX_PAGES = 10; // An toàn: tối đa 1000 items

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
        log.warn({ status: res.status, page }, "Cổng API Thanh tra Lâm Đồng trả mã lỗi");
        break;
      }

      const data = (await res.json()) as { d?: { results?: ThanhtraRawItem[]; __next?: string } };
      const items = data?.d?.results || [];
      allItems.push(...items);

      // SharePoint trả __next URL có domain lamdong.gov.vn nhưng API thật ở w3.lamdong.gov.vn
      const rawNext = data?.d?.__next;
      nextUrl =
        rawNext && items.length > 0
          ? rawNext.replace("https://lamdong.gov.vn/", "https://w3.lamdong.gov.vn/")
          : null;

      log.debug({ page, fetched: items.length, total: allItems.length }, "Đã lấy trang kết luận thanh tra");
    } catch (err) {
      log.error({ err, page }, "Lỗi khi gọi API danh sách kết luận thanh tra");
      break;
    }
  }

  return allItems.slice(0, limit);
}

/**
 * Tải file PDF từ URL về đường dẫn đích trên đĩa.
 * Trả về kích thước file (bytes).
 */
export async function downloadPdfFile(pdfUrl: string, destPath: string): Promise<number> {
  try {
    const res = await fetch(pdfUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    // Kiểm tra header PDF
    if (buffer.length < 4 || buffer.subarray(0, 4).toString() !== "%PDF") {
      log.warn({ pdfUrl }, "Nội dung tải về không phải định dạng PDF hợp lệ");
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, buffer);
    return buffer.length;
  } catch (err) {
    log.warn({ pdfUrl, destPath, err }, "Không tải được file PDF kết luận thanh tra");
    throw err;
  }
}

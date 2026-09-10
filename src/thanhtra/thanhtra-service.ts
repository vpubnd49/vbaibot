import fs from "node:fs";
import path from "node:path";
import { dataDir } from "../config/env.js";
import { createLogger } from "../shared/logger.js";
import { downloadPdfFile, extractPdfUrl, fetchThanhtraItems } from "./thanhtra-crawler.js";
import { countThanhtraDocs, upsertThanhtraDoc } from "./thanhtra-store.js";
import type { ThanhtraSyncResult } from "./thanhtra-types.js";

const log = createLogger("thanhtra-service");

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // Đồng bộ mỗi 6 giờ

export function getThanhtraStorageDir(): string {
  const dir = path.join(dataDir, "thanhtra");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Tên file an toàn không chứa ký tự đặc biệt của hệ điều hành */
function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[\\/:*?"<>|]/g, "_").trim() || "document.pdf";
}

/**
 * Quét danh sách Kết luận thanh tra trực tuyến, tải file PDF về đĩa và cập nhật SQLite DB
 */
export async function syncThanhtraDocuments(limit = 30): Promise<ThanhtraSyncResult> {
  const storageDir = getThanhtraStorageDir();
  const rawItems = await fetchThanhtraItems(limit);

  const result: ThanhtraSyncResult = {
    totalScanned: rawItems.length,
    newDownloaded: 0,
    updated: 0,
    errors: 0,
    items: [],
  };

  if (rawItems.length === 0) {
    log.debug("Không lấy được bản ghi nào từ cổng Thanh tra Lâm Đồng");
    return result;
  }

  for (const item of rawItems) {
    const title = item.Title?.trim() || "Kết luận thanh tra";
    const fileRef = item.FileRef?.trim() || (item.ID ? `/sites/thanhtra/thanh-tra/ketluan/SitePages/item-${item.ID}.aspx` : "");
    if (!fileRef || fileRef.endsWith("/Home.aspx") || title.toLowerCase() === "home") continue;

    const pdfUrl = extractPdfUrl(item.CanvasContent1);
    let localPath: string | null = null;
    let fileSize = 0;
    let downloaded = false;

    if (pdfUrl) {
      try {
        const decodedUrl = decodeURIComponent(pdfUrl);
        const baseName = sanitizeFileName(path.basename(decodedUrl.split("?")[0]!));
        const absPath = path.join(storageDir, baseName);
        const relPath = path.join("thanhtra", baseName).replace(/\\/g, "/");

        if (fs.existsSync(absPath)) {
          const stats = fs.statSync(absPath);
          fileSize = stats.size;
          localPath = relPath;
          log.debug({ title, file: baseName, kb: Math.round(fileSize / 1024) }, "File PDF đã có trên đĩa - bỏ qua tải lại");
        } else {
          // Tải file PDF về đĩa
          fileSize = await downloadPdfFile(pdfUrl, absPath);
          localPath = relPath;
          downloaded = true;
          result.newDownloaded++;
          log.info({ title, file: baseName, bytes: fileSize }, "Đã tải file PDF kết luận thanh tra");
        }
      } catch (err) {
        result.errors++;
        log.warn({ title, pdfUrl, err }, "Lỗi khi tải file PDF kết luận thanh tra");
      }
    }

    upsertThanhtraDoc({
      title,
      description: item.Description ?? "",
      fileRef,
      pdfUrl,
      localPath,
      fileSize,
      modifiedAt: item.Modified,
    });

    result.updated++;
    result.items.push({
      title,
      pdfUrl,
      localPath,
      downloaded,
    });
  }

  log.info(
    {
      scanned: result.totalScanned,
      newDownloaded: result.newDownloaded,
      totalInDb: countThanhtraDocs(),
    },
    "Hoàn thành đồng bộ Kết luận Thanh tra Lâm Đồng",
  );

  return result;
}

/**
 * Khởi động tiến trình đồng bộ định kỳ Kết luận Thanh tra Lâm Đồng
 */
export function startThanhtraSyncTask(): void {
  const run = (): void => {
    void syncThanhtraDocuments(200).catch((err) => {
      log.error({ err }, "Đồng bộ Kết luận Thanh tra định kỳ thất bại");
    });
  };

  // Chạy ngay lần đầu khi khởi động bot (trì hoãn 10 giây để bot login xong)
  setTimeout(run, 10_000).unref();

  // Lặp lại mỗi 6 giờ
  setInterval(run, SYNC_INTERVAL_MS).unref();
}

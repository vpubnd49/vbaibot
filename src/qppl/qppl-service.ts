import fs from "node:fs";
import path from "node:path";
import { dataDir } from "../config/env.js";
import { createLogger } from "../shared/logger.js";
import { extractFileUrls, fetchQpplItems, downloadQpplFile, searchQpplItemsLive } from "./qppl-crawler.js";
import { countQpplDocs, getQpplDocById, updateQpplLocalPath, upsertQpplDoc } from "./qppl-store.js";
import type { QpplDoc, QpplFileLink, QpplNguon, QpplSyncResult } from "./qppl-types.js";

const log = createLogger("qppl-service");

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 giờ

export function getQpplStorageDir(): string {
  const dir = path.join(dataDir, "qppl");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "document";
}

/**
 * Quét danh sách VB QPPL từ cổng tỉnh, lưu metadata vào DB.
 *
 * KHÔNG tải file ngay — chỉ lưu link. File được tải on-demand khi người dùng
 * yêu cầu qua `downloadFileForDoc`.
 */
export async function syncQpplDocuments(
  nguon: QpplNguon,
  limit = 200,
): Promise<QpplSyncResult> {
  const rawItems = await fetchQpplItems(nguon, limit);
  const result: QpplSyncResult = {
    totalScanned: rawItems.length,
    newInserted: 0,
    updated: 0,
    errors: 0,
  };

  if (rawItems.length === 0) {
    log.debug({ nguon }, "Không lấy được bản ghi QPPL nào");
    return result;
  }

  for (const item of rawItems) {
    const soKyHieu =
      item.S_x1ed1__x002f_K_x00fd__x0020_hi?.trim() ||
      item.Title?.replace(/^Trục liên thông:\s*/i, "").trim() ||
      "";
    if (!soKyHieu || soKyHieu.toLowerCase() === "home") continue;

    const fileLinks = extractFileUrls(item.Urls);

    try {
      upsertQpplDoc({
        soKyHieu,
        trichYeu: item.Tr_x00ed_ch_x0020_y_x1ebf_u ?? "",
        loaiVanBan: item.Lo_x1ea1_i_x0020_v_x0103_n_x0020 ?? "",
        coQuanBanHanh: item.C_x01a1__x0020_quan_x0020_ban_x0 ?? "",
        linhVuc: item.L_x0129_nh_x0020_V_x1ef1_c ?? "",
        hieuLuc: item.Hi_x1ec7_u_x0020_l_x1ef1_c ?? "Còn",
        ngayBanHanh: item.Ng_x00e0_y ?? undefined,
        nguon,
        fileUrls: JSON.stringify(fileLinks),
        spId: item.ID ?? null,
        modifiedAt: item.Modified,
      });
      result.updated++;
    } catch (err) {
      result.errors++;
      log.warn({ soKyHieu, err }, "Lỗi khi upsert VB QPPL");
    }
  }

  log.info(
    { nguon, scanned: result.totalScanned, updated: result.updated, total: countQpplDocs(nguon) },
    "Hoàn thành đồng bộ VB QPPL",
  );
  return result;
}

/**
 * Tra cứu trực tiếp trên API cổng tỉnh rồi upsert kết quả vào DB local.
 *
 * Dùng khi searchQpplDocs (local) trả rỗng — có nghĩa VB nằm ngoài batch sync
 * gần nhất. Hàm này gọi API SharePoint, lưu metadata vào SQLite, rồi trả về
 * `QpplDoc[]` y hệt search local — caller không cần phân biệt.
 *
 * Ví dụ: người dùng hỏi "tải 15187/KH-UBND" nhưng VB đó chưa sync → gọi hàm
 * này → tìm được trên API → upsert → trả về doc có id, có fileUrls → tool tải
 * on-demand bình thường.
 */
export async function liveSearchAndUpsert(
  keyword: string,
  limit = 10,
): Promise<QpplDoc[]> {
  const liveResults = await searchQpplItemsLive(keyword, limit);
  if (liveResults.length === 0) return [];

  const docs: QpplDoc[] = [];
  for (const { nguon, item } of liveResults) {
    const soKyHieu =
      item.S_x1ed1__x002f_K_x00fd__x0020_hi?.trim() ||
      item.Title?.replace(/^Trục liên thông:\s*/i, "").trim() ||
      "";
    if (!soKyHieu) continue;

    const fileLinks = extractFileUrls(item.Urls);

    try {
      const doc = upsertQpplDoc({
        soKyHieu,
        trichYeu: item.Tr_x00ed_ch_x0020_y_x1ebf_u ?? "",
        loaiVanBan: item.Lo_x1ea1_i_x0020_v_x0103_n_x0020 ?? "",
        coQuanBanHanh: item.C_x01a1__x0020_quan_x0020_ban_x0 ?? "",
        linhVuc: item.L_x0129_nh_x0020_V_x1ef1_c ?? "",
        hieuLuc: item.Hi_x1ec7_u_x0020_l_x1ef1_c ?? "Còn",
        ngayBanHanh: item.Ng_x00e0_y ?? undefined,
        nguon,
        fileUrls: JSON.stringify(fileLinks),
        spId: item.ID ?? null,
        modifiedAt: item.Modified,
      });
      docs.push(doc);
    } catch (err) {
      log.warn({ soKyHieu, err }, "Lỗi upsert VB từ live search");
    }
  }

  log.info({ keyword, found: docs.length }, "Live search QPPL → upsert xong");
  return docs;
}

/**
 * Tải file PDF (ưu tiên) hoặc DOC cho một văn bản.
 *
 * @deprecated Dùng {@link downloadAllFilesForDoc} thay thế để tải TẤT CẢ file đính kèm.
 * Hàm này chỉ giữ lại cho tương thích ngược.
 */
export async function downloadFileForDoc(docId: number): Promise<string | null> {
  const results = await downloadAllFilesForDoc(docId);
  return results.downloaded.length > 0 ? results.downloaded[0]! : null;
}

function rankFile(name: string): number {
  const lower = name.toLowerCase();
  const isSigned = lower.includes("signed");
  const isPhuLuc =
    lower.includes("phu luc") ||
    lower.includes("phụ lục") ||
    lower.includes("danh muc") ||
    lower.includes("danh mục") ||
    lower.includes("to trinh") ||
    lower.includes("tờ trình") ||
    lower.includes("phieu trinh") ||
    lower.includes("phiếu trình") ||
    lower.includes("dm ");
  const isMainDoc =
    lower.includes("quyet dinh") ||
    lower.includes("quyết định") ||
    lower.includes("ke hoach") ||
    lower.includes("kế hoạch") ||
    lower.includes("thong bao") ||
    lower.includes("thông báo") ||
    lower.includes("cong van") ||
    lower.includes("công văn") ||
    lower.includes("bao cao") ||
    lower.includes("báo cáo");

  if (isSigned && !isPhuLuc) return 100;
  if (isMainDoc && !isPhuLuc) return 90;
  if (isSigned && isPhuLuc) return 80;
  if (!isPhuLuc && lower.endsWith(".pdf")) return 70;
  if (!isPhuLuc) return 60;
  if (lower.endsWith(".pdf")) return 50;
  return 40;
}

/**
 * Tải TẤT CẢ file đính kèm cho một văn bản.
 *
 * Gọi khi người dùng yêu cầu tải file cụ thể. Tải toàn bộ file đính kèm
 * (PDF, DOC, DOCX, XLSX...) theo thứ tự ưu tiên:
 * Văn bản chính (đã ký số) → Dự thảo/Word → Phụ lục/Danh mục.
 *
 * File đã tải trước đó trên đĩa sẽ không tải lại.
 * Trả về số file kỳ vọng, các đường dẫn đã tải và từng file thất bại.
 */
export type QpplDownloadFailure = {
  name: string;
  url: string;
  error: string;
};

export type QpplDownloadResult = {
  expected: number;
  downloaded: string[];
  failed: QpplDownloadFailure[];
};

export async function downloadAllFilesForDoc(docId: number): Promise<QpplDownloadResult> {
  const doc = getQpplDocById(docId);
  if (!doc) return { expected: 0, downloaded: [], failed: [] };

  // Parse file links
  let links: QpplFileLink[];
  try {
    links = JSON.parse(doc.fileUrls) as QpplFileLink[];
  } catch {
    return { expected: 0, downloaded: [], failed: [] };
  }
  if (links.length === 0) return { expected: 0, downloaded: [], failed: [] };

  // Sắp xếp ưu tiên: văn bản chính (signed/quyết định) lên trước, phụ lục/danh mục ra sau
  const sortedLinks = [...links].sort((a, b) => rankFile(b.name) - rankFile(a.name));

  const storageDir = getQpplStorageDir();
  const downloadedPaths: string[] = [];
  const failed: QpplDownloadFailure[] = [];
  let totalBytes = 0;
  const safeSoKyHieu = doc.soKyHieu.replace(/[\/\\:*?"<>|]/g, "-").trim();

  for (let i = 0; i < sortedLinks.length; i++) {
    const link = sortedLinks[i]!;
    // Giữ tên gốc của file từ cổng tỉnh để người dùng dễ nhận biết (QD chính vs Phụ lục)
    const cleanOriginalName = sanitizeFileName(link.name);
    // Giữ tên dễ nhận biết nhưng thêm chỉ số khi nhiều URL có cùng tên file.
    const baseName = sanitizeFileName(
      `[${safeSoKyHieu}] ${String(i + 1).padStart(2, "0")} ${cleanOriginalName}`,
    );
    const absPath = path.join(storageDir, baseName);

    // Chỉ bỏ qua file đã có nội dung; file rỗng/hỏng phải được tải lại.
    if (fs.existsSync(absPath) && fs.statSync(absPath).size > 0) {
      downloadedPaths.push(absPath);
      totalBytes += fs.statSync(absPath).size;
      continue;
    }

    try {
      const fileSize = await downloadQpplFile(link.url, absPath);
      totalBytes += fileSize;
      downloadedPaths.push(absPath);
      log.debug({ docId, file: baseName, bytes: fileSize, idx: i + 1 }, "Đã tải file VB");
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      failed.push({ name: link.name, url: link.url, error });
      log.warn({ docId, url: link.url, name: link.name, err }, "Không tải được file đính kèm");
      // Tiếp tục tải các file còn lại
    }
  }

  // Cập nhật localPath (lưu file đầu tiên - file chính - làm đại diện) và tổng fileSize
  if (downloadedPaths.length > 0) {
    const relPath = path.join("qppl", path.basename(downloadedPaths[0]!)).replace(/\\/g, "/");
    updateQpplLocalPath(docId, relPath, totalBytes);
    log.info(
      { docId, total: downloadedPaths.length, ofTotal: links.length, bytes: totalBytes },
      "Hoàn thành tải file VB QPPL",
    );
  }

  return { expected: sortedLinks.length, downloaded: downloadedPaths, failed };
}

/**
 * Khởi động tiến trình đồng bộ định kỳ VB QPPL tỉnh Lâm Đồng.
 */
export function startQpplSyncTask(): void {
  const run = (): void => {
    void (async () => {
      try {
        await syncQpplDocuments("ubnd", 200);
        await syncQpplDocuments("hdnd", 100);
      } catch (err) {
        log.error({ err }, "Đồng bộ VB QPPL định kỳ thất bại");
      }
    })();
  };

  // Chạy lần đầu sau 15 giây (chờ bot login + thanhtra sync xong trước)
  setTimeout(run, 15_000).unref();

  // Lặp mỗi 6 giờ
  setInterval(run, SYNC_INTERVAL_MS).unref();
}

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
 * Gọi khi người dùng yêu cầu tải file cụ thể. Kiểm tra localPath trước,
 * nếu đã tải rồi thì bỏ qua. Nếu chưa, tải file đầu tiên (ưu tiên PDF).
 *
 * Trả về đường dẫn tuyệt đối trên đĩa, hoặc null nếu không có link.
 */
export async function downloadFileForDoc(docId: number): Promise<string | null> {
  const doc = getQpplDocById(docId);
  if (!doc) return null;

  // Đã tải rồi → trả về ngay
  if (doc.localPath) {
    const absPath = path.resolve(dataDir, doc.localPath);
    if (fs.existsSync(absPath)) return absPath;
  }

  // Parse file links
  let links: QpplFileLink[];
  try {
    links = JSON.parse(doc.fileUrls) as QpplFileLink[];
  } catch {
    return null;
  }
  if (links.length === 0) return null;

  // Ưu tiên PDF, rồi DOC/DOCX
  const pdfLink = links.find((l) => /\.pdf$/i.test(l.name));
  const chosen = pdfLink || links[0]!;

  const storageDir = getQpplStorageDir();
  const ext = path.extname(chosen.name) || ".pdf";
  const baseName = sanitizeFileName(
    `${doc.soKyHieu.replace(/\//g, "-")}_${doc.nguon}${ext}`,
  );
  const absPath = path.join(storageDir, baseName);
  const relPath = path.join("qppl", baseName).replace(/\\/g, "/");

  try {
    const fileSize = await downloadQpplFile(chosen.url, absPath);
    updateQpplLocalPath(docId, relPath, fileSize);
    log.info({ docId, file: baseName, bytes: fileSize }, "Đã tải on-demand file VB QPPL");
    return absPath;
  } catch (err) {
    log.warn({ docId, url: chosen.url, err }, "Không tải được file VB QPPL on-demand");
    return null;
  }
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

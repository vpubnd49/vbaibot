import { createLogger } from "../shared/logger.js";
import type { QpplFileLink, QpplRawItem } from "./qppl-types.js";

const log = createLogger("qppl-edu-crawler");

const EDU_API_URL = "https://lamdong.edu.vn/Modules/Sidebar/GetDocumentDi";
const EDU_DETAIL_URL = "https://lamdong.edu.vn/Modules/Sidebar/GetDetailDocument2";

interface EduRawItem {
  ID: string;
  SO_HIEU: string;
  TRICH_YEU: string;
  NGAY_BAN_HANH: string;
  TOTALPAGE?: string;
  [key: string]: unknown;
}

interface EduDetailItem {
  TEN_LOAI?: string;
  TRICH_YEU?: string;
  BUT_PHE?: string;
  SO_HIEU?: string;
  NGAY_BAN_HANH?: string;
  CO_QUAN_BAN_HANH?: string;
  ATTACHMENTS?: Array<{
    Name?: string;
    Path?: string;
  }>;
}

/**
 * Tra cứu danh sách văn bản từ Cổng Sở Giáo dục & Đào tạo tỉnh Lâm Đồng.
 */
export async function fetchEduDocuments(
  keyword = "",
  limit = 20,
  pageNum = 1,
): Promise<QpplRawItem[]> {
  try {
    const params = new URLSearchParams();
    params.append("pageNum", String(pageNum));
    params.append("pageSize", String(Math.min(limit, 50)));
    params.append("TimKiem", keyword);
    params.append("XuatXu", "");
    params.append("Code", "sgd_document");

    const res = await fetch(EDU_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0 (compatible; VBAIBot/1.0)",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      log.warn({ status: res.status }, "Lỗi khi gọi API Sở GD&ĐT");
      return [];
    }

    const rawList = (await res.json()) as EduRawItem[];
    if (!Array.isArray(rawList)) return [];

    const items: QpplRawItem[] = [];

    for (const it of rawList.slice(0, limit)) {
      if (!it.SO_HIEU && !it.TRICH_YEU) continue;

      // Chuẩn hóa ngày ban hành
      let ngayIso: string | undefined;
      if (it.NGAY_BAN_HANH) {
        const parts = it.NGAY_BAN_HANH.split("/");
        if (parts.length === 3) {
          ngayIso = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}T00:00:00Z`;
        }
      }

      items.push({
        ID: Math.abs(hashCode(it.ID)),
        Title: it.SO_HIEU || it.TRICH_YEU,
        S_x1ed1__x002f_K_x00fd__x0020_hi: it.SO_HIEU,
        Tr_x00ed_ch_x0020_y_x1ebf_u: it.TRICH_YEU,
        C_x01a1__x0020_quan_x0020_ban_x0: "Sở Giáo dục và Đào tạo",
        Ng_x00e0_y: ngayIso,
        Modified: ngayIso,
        // Lưu ID gốc của EDU vào Urls tạm để có thể fetch attachments on demand
        Urls: JSON.stringify({ eduId: it.ID }),
      });
    }

    return items;
  } catch (err) {
    log.error({ err, keyword }, "Lỗi fetch danh sách VB Sở GD&ĐT");
    return [];
  }
}

/**
 * Lấy chi tiết văn bản và link file đính kèm từ Sở GD&ĐT.
 */
export async function fetchEduDocumentAttachments(eduId: string): Promise<QpplFileLink[]> {
  try {
    const params = new URLSearchParams();
    params.append("maCongVan", "0");
    params.append("sodi", "");
    params.append("code", "sgd_document");
    params.append("alias", "");
    params.append("id", eduId);

    const res = await fetch(EDU_DETAIL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0 (compatible; VBAIBot/1.0)",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const rawText = await res.text();
    const parsed = typeof rawText === "string" ? JSON.parse(rawText) : rawText;
    const detailList: EduDetailItem[] = typeof parsed === "string" ? JSON.parse(parsed) : parsed;

    if (!Array.isArray(detailList) || detailList.length === 0) return [];
    const detail = detailList[0];

    const links: QpplFileLink[] = [];
    if (detail.ATTACHMENTS && Array.isArray(detail.ATTACHMENTS)) {
      for (const att of detail.ATTACHMENTS) {
        if (att.Path) {
          links.push({
            name: att.Name || "file.pdf",
            url: att.Path.startsWith("http") ? att.Path : `https://lamdong.edu.vn${att.Path}`,
          });
        }
      }
    }

    return links;
  } catch (err) {
    log.warn({ err, eduId }, "Không lấy được file đính kèm Sở GD&ĐT");
    return [];
  }
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return hash;
}

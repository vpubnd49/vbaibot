/**
 * dossier-engine.ts
 * TẦNG XỬ LÝ & BỒI ĐẮP HỒ SƠ (Dossier Engine)
 *
 * Nhận bài viết đầu vào (từ RSS, Facebook, disaster_alerts) và:
 *  1. Nhận diện thực thể (đèo nào? hồ đập nào?)
 *  2. Phân loại hành động: incident / restrict / construction / partial_reopen / lift_ban / full_reopen
 *  3. Nạp event vào timeline của dossier tương ứng
 *  4. Tính lại trạng thái dossier
 *
 * Module thuần logic (không fetch mạng), nhận đầu vào đã cào sẵn.
 */
import { createLogger } from "../../shared/logger.js";
import {
  matchAllPassDossiers,
  addEvent,
  recomputeDossierStatus,
  getDossier,
  type EventAction,
} from "./incident-dossier-store.js";

const log = createLogger("dossier-engine");

// ──── Action Detection Regexes ─────────────────────────────────────────────

const RE_RESTRICT =
  /cấm (xe|các phương tiện|phương tiện|lưu thông|ô tô)|chia cắt|tê liệt|phong tỏa|phong toả|đóng (đèo|đường|tuyến)|tạm dừng lưu thông|dừng lưu thông|không thể lưu thông|ách tắc|ùn tắc kéo dài|hạn chế (lưu thông|phương tiện)/;

const RE_LIFT_BAN =
  /dỡ bỏ lệnh cấm|bỏ lệnh cấm|hết cấm|gỡ lệnh cấm|cho phép (các )?phương tiện lưu thông trở lại|cho phép lưu thông (bình thường|trở lại)/;

const RE_FULL_REOPEN =
  /hoàn thành (sửa chữa|thi công|khắc phục|nâng cấp)|hoàn tất (sửa chữa|thi công|khắc phục)|nghiệm thu|khánh thành|hoàn công|thông xe toàn tuyến|mở cửa trở lại hoàn toàn/;

const RE_PARTIAL_REOPEN =
  /thông xe|thông tuyến|khôi phục giao thông|lưu thông trở lại|thông đường|đã dọn dẹp|đã khơi thông/;

const RE_CONSTRUCTION =
  /thi công|khắc phục|sửa chữa|gia cố|mở rộng|rào chắn|phân luồng|một chiều|bơm (bê ?tông|xi ?măng)|lu lèn|đổ (bê ?tông|đá)|đào đắp|nền đường/;

const RE_INCIDENT =
  /sạt lở|sạt trượt|sụt lún|sụt lở|nứt (đường|mặt đường|nền|taluy)|đá lăn|đá rơi|cây (rừng )?(ngã|đổ)|ngã đổ|ngập (nước|đường|lũ|sâu)|lũ quét|tai nạn (nghiêm trọng|liên hoàn|chết|giao thông)/;

const RE_LOCATION_KM = /[Kk]m\s*(\d+(?:[+–-]\d+)?(?:\s*[–-]\s*[Kk]?m?\s*\d+)?)/;

// ──── Classify article action ──────────────────────────────────────────────

function classifyAction(text: string): EventAction {
  const t = text.normalize("NFC").toLowerCase();

  // Thứ tự ưu tiên: lift > full_reopen > restrict > construction > partial_reopen > incident > info
  if (RE_LIFT_BAN.test(t)) return "lift_ban";
  if (RE_FULL_REOPEN.test(t)) return "full_reopen";
  if (RE_RESTRICT.test(t)) return "restrict";
  if (RE_CONSTRUCTION.test(t)) return "construction";
  if (RE_PARTIAL_REOPEN.test(t)) return "partial_reopen";
  if (RE_INCIDENT.test(t)) return "incident";
  return "info";
}

function extractLocationKm(text: string): string {
  const m = RE_LOCATION_KM.exec(text);
  return m ? `Km${m[1]}` : "";
}

// ──── Public API ───────────────────────────────────────────────────────────

export type ArticleInput = {
  title: string;
  body: string;         // summary / description / message
  sourceUrl: string;
  sourceName: string;
  publishedAt: string;  // ISO datetime
};

/**
 * Xử lý 1 bài viết: nhận diện đèo → phân loại hành động → nạp event → tính lại status.
 * Trả về danh sách dossierId đã được cập nhật.
 */
export function ingestArticle(article: ArticleInput): string[] {
  const combined = `${article.title} ${article.body}`;
  const dossierIds = matchAllPassDossiers(combined);

  if (dossierIds.length === 0) return [];

  const action = classifyAction(combined);
  const locationKm = extractLocationKm(combined);
  const headline = article.title.slice(0, 200);
  const detail = article.body.slice(0, 500);

  const updated: string[] = [];

  for (const dossierId of dossierIds) {
    const eventId = addEvent({
      dossierId,
      action,
      headline,
      detail,
      sourceUrl: article.sourceUrl,
      sourceName: article.sourceName,
      publishedAt: article.publishedAt,
      locationKm,
    });

    if (eventId === -1) {
      // Trùng sourceUrl → đã nạp rồi, skip
      continue;
    }

    // Tính lại trạng thái dossier
    recomputeDossierStatus(dossierId);
    updated.push(dossierId);

    const dossier = getDossier(dossierId);
    log.info(
      {
        dossierId,
        action,
        status: dossier?.status,
        headline: headline.slice(0, 80),
        restrictions: dossier?.activeRestrictions.length,
      },
      "Nạp event vào dossier",
    );
  }

  return updated;
}

/**
 * Xử lý batch nhiều bài viết (từ crawler). Trả về tổng dossier đã cập nhật.
 */
export function ingestArticles(articles: ArticleInput[]): number {
  let totalUpdated = 0;
  for (const article of articles) {
    const updated = ingestArticle(article);
    totalUpdated += updated.length;
  }
  return totalUpdated;
}

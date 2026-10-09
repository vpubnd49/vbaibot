/**
 * Phần phụ của national_legal: định dạng kết quả và vòng "tải rồi gửi nhiều VB".
 * Tách khỏi national-legal-tool.ts (trước 300+ dòng, cùng một vòng tải-gửi lặp 2 lần).
 */
import path from "node:path";
import {
  downloadNationalLegal,
  type NationalLegalResult,
} from "../../legal/services/national-legal-service.js";
import { createLogger } from "../../shared/logger.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiFile } from "./sent-by-tool-note.js";
import type { ToolContext } from "./tool-catalog-types.js";

const log = createLogger("national-legal-tool");

export type NguonVb = NationalLegalResult["source"];

export function tenNguon(source: string | undefined): string {
  if (source === "congbao") return "Công báo ĐT Chính phủ";
  if (source === "vbpl") return "CSDL quốc gia về pháp luật";
  if (source === "phapluat") return "Cổng Pháp luật quốc gia";
  return "Thư viện Pháp luật";
}

/** Số VB cần tải khi người dùng nói "các/những/danh sách..." (mặc định 3). */
export function soLuongCanTai(laSoNhieu: boolean, coKetQua: number, limit: number): number {
  return laSoNhieu ? Math.min(coKetQua, limit > 1 ? limit : 3) : 1;
}

/** Tải lần lượt rồi gửi từng file vào chat; lỗi từng file không làm hỏng cả lượt. */
export async function taiVaGuiNhieu(
  ctx: Pick<ToolContext, "api" | "account" | "message" | "ghiNhanDaGui">,
  items: NationalLegalResult[],
  format: "pdf" | "doc" | "docx",
): Promise<{ sent: string[]; failed: string[] }> {
  const sent: string[] = [];
  const failed: string[] = [];
  for (const item of items) {
    try {
      const dl = await downloadNationalLegal(item.downloadId, item.source, format, item.soHieu);
      if (!dl.filePath) {
        failed.push(item.soHieu || item.downloadId);
        continue;
      }
      const fileName = path.basename(dl.filePath);
      await guiFileKemCaption(
        ctx.api,
        `${ctx.account.id}:${ctx.message.threadId}`,
        ctx.message.threadId,
        ctx.message.threadType,
        dl.filePath,
        undefined,
      );
      ctx.ghiNhanDaGui?.(ghiChuDaGuiFile(fileName, `VB PL TW (${item.source})`));
      sent.push(`${item.soHieu || fileName} (${Math.round(dl.fileSize / 1024)} KB)`);
      await new Promise((r) => setTimeout(r, 600));
    } catch (err) {
      log.error({ err, item }, "Failed downloading/sending national legal item");
      failed.push(item.soHieu || item.downloadId);
    }
  }
  return { sent, failed };
}

/** Câu báo kết quả gửi nhiều VB + danh sách VB khác cùng đợt. */
export function baoDaGuiNhieu(
  sent: string[],
  failed: string[],
  results: NationalLegalResult[],
  daTai: number,
): string {
  let msg = `✅ ĐÃ TẢI VÀ GỬI ${sent.length} VĂN BẢN VÀO CHAT CHO NGƯỜI DÙNG:\n` + sent.map((s) => `- ${s}`).join("\n");
  if (failed.length > 0) msg += `\n⚠️ Không tải được: ${failed.join(", ")}`;
  if (results.length > daTai) {
    msg +=
      `\n\n📋 Danh sách các văn bản khác cùng đợt:\n` +
      results
        .slice(daTai, daTai + 7)
        .map((r) => `- ${r.soHieu} (${r.ngayBanHanh}): ${r.trichYeu.slice(0, 70)}`)
        .join("\n");
  }
  msg += `\n(File đã được gửi trực tiếp vào chat. Chỉ cần báo ngắn gọn đã gửi file, không gửi link hay caption trùng lặp)`;
  return msg;
}

export function formatSearchResults(results: NationalLegalResult[], keyword: string): string {
  const maxShow = 10;
  const shown = results.slice(0, maxShow);

  let text = `📋 Tìm thấy ${results.length} VB pháp luật khớp "${keyword}":\n\n`;

  for (let i = 0; i < shown.length; i++) {
    const r = shown[i]!;
    const srcIcon = r.source === "congbao" ? "🏛️" : r.source === "vbpl" ? "⚖️" : r.source === "phapluat" ? "🇻🇳" : "📚";
    const srcName = r.source === "vbpl" ? "CSDL quốc gia (vbpl.vn)" : r.source === "congbao" ? "Công báo CP" : tenNguon(r.source);
    text +=
      `${i + 1}. ${srcIcon} **${r.loaiVB}${r.soHieu ? ` ${r.soHieu}` : ""}**\n` +
      `   ${r.trichYeu}\n` +
      `   📅 ${r.ngayBanHanh || "N/A"} | Nguồn: ${srcName}\n` +
      `   🔗 ${r.detailUrl}\n` +
      `   → Để tải: dùng action='download', downloadId='${r.downloadId}', source='${r.source}'\n\n`;
  }

  if (results.length > maxShow) {
    text += `... và ${results.length - maxShow} VB khác. Thu hẹp từ khóa để xem thêm.`;
  }

  return text;
}

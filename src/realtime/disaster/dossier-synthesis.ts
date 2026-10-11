/**
 * dossier-synthesis.ts
 * TẦNG PHỤC VỤ TRUY VẤN — Xuất báo cáo cấu trúc 3 tầng từ Incident Dossier
 *
 * Khi người dùng hỏi về đèo/thiên tai, module này:
 *  1. Đọc dossier + timeline events
 *  2. Format thành báo cáo 3 phần bắt buộc:
 *     [HIỆN TẠI - MỚI NHẤT] + [BỐI CẢNH & LỆNH CẤM GỐC] + [KHUYẾN CÁO]
 *  3. Trả text chuẩn hóa cho bot — bot PHẢI chép nguyên văn, KHÔNG tự thêm.
 *
 * Kết hợp với mountain-pass-status.ts (evidence từ RSS/FB realtime) để có
 * dữ liệu mới nhất + bối cảnh lệnh cấm cũ.
 */
import {
  getDossier,
  listEvents,
  listDossiersByCategory,
  type IncidentDossier,
  type IncidentEvent,
} from "./incident-dossier-store.js";


// ──── Status Icons ─────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, string> = {
  blocked: "🔴",
  restricted: "🟡",
  under_repair: "🟠",
  open: "🟢",
  unknown: "⚪",
};

const STATUS_LABEL: Record<string, string> = {
  blocked: "CẤM LƯU THÔNG",
  restricted: "HẠN CHẾ (cấm xe tải/xe khách)",
  under_repair: "ĐANG THI CÔNG / KHẮC PHỤC",
  open: "Thông xe",
  unknown: "Chưa có thông tin cập nhật",
};

// ──── Date formatting ──────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return "Không rõ";
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}


// ──── Synthesis: 1 dossier → báo cáo 3 phần ───────────────────────────────

export type DossierReport = {
  dossierId: string;
  name: string;
  route: string;
  icon: string;
  statusLabel: string;
  currentSection: string;     // [HIỆN TẠI - MỚI NHẤT]
  contextSection: string;     // [BỐI CẢNH & LỆNH CẤM CŨ]
  advisorySection: string;    // [KHUYẾN CÁO]
  fullText: string;           // 3 phần ghép lại
  isActive: boolean;          // có sự cố chưa giải quyết
};

function buildCurrentSection(dossier: IncidentDossier, recentEvents: IncidentEvent[]): string {
  if (recentEvents.length === 0 && !dossier.latestHeadline) {
    return "Chưa có thông tin cập nhật gần đây.";
  }

  const lines: string[] = [];
  const latest = recentEvents[0];
  if (latest) {
    lines.push(`(${fmtDate(latest.publishedAt)}): ${latest.headline}`);
    if (latest.detail && latest.detail !== latest.headline) {
      const short = latest.detail.length > 200 ? latest.detail.slice(0, 197) + "..." : latest.detail;
      lines.push(short);
    }
    if (latest.locationKm) lines.push(`Vị trí: ${latest.locationKm}.`);
    if (latest.sourceName) lines.push(`Nguồn: ${latest.sourceName}.`);
  } else if (dossier.latestHeadline) {
    lines.push(`(${fmtDate(dossier.latestUpdateDate)}): ${dossier.latestHeadline}`);
  }

  // Thêm 1-2 event gần nhất nếu khác loại với event mới nhất
  for (const ev of recentEvents.slice(1, 3)) {
    if (latest && ev.action === latest.action) continue;
    lines.push(`Trước đó (${fmtDate(ev.publishedAt)}): ${ev.headline}`);
  }

  return lines.join("\n");
}

function buildContextSection(dossier: IncidentDossier, allEvents: IncidentEvent[]): string {
  if (dossier.activeRestrictions.length === 0 && !dossier.originIncident) {
    return "";
  }

  const lines: string[] = [];

  // Lệnh cấm đang duy trì
  if (dossier.activeRestrictions.length > 0) {
    for (const r of dossier.activeRestrictions) {
      lines.push(`⚠️ Lệnh cấm/hạn chế (từ ${fmtDate(r.since)}): ${r.description}`);
      if (r.vehicleTypes && r.vehicleTypes.length > 0) {
        lines.push(`  Áp dụng cho: ${r.vehicleTypes.join(", ")}.`);
      }
      lines.push("  → CHƯA có thông báo dỡ bỏ.");
    }
  }

  // Bối cảnh sự cố gốc
  if (dossier.originIncident && dossier.originDate) {
    lines.push(
      `Sự cố gốc (${fmtDate(dossier.originDate)}): ${dossier.originIncident}`,
    );
  }

  // Timeline thi công/khắc phục
  const constructionEvents = allEvents.filter(
    (e) => e.action === "construction" || e.action === "incident" || e.action === "new_incident",
  ).slice(0, 3);
  if (constructionEvents.length > 0 && dossier.status !== "open") {
    lines.push("Tiến trình:");
    for (const ev of constructionEvents) {
      lines.push(`  - ${fmtDate(ev.publishedAt)}: ${ev.headline}`);
    }
  }

  return lines.join("\n");
}

function buildAdvisorySection(dossier: IncidentDossier): string {
  const lines: string[] = [];

  switch (dossier.status) {
    case "blocked":
      lines.push("🚫 KHÔNG lưu thông qua tuyến này. Sử dụng tuyến đường thay thế.");
      break;
    case "restricted":
      lines.push("🚗 Xe con, xe máy có thể lưu thông nhưng cần thận trọng.");
      lines.push("🚛 Xe tải, xe khách: cần kiểm tra trước khi đi hoặc chọn tuyến khác.");
      lines.push("Giảm tốc độ qua các đoạn rào chắn thi công.");
      break;
    case "under_repair":
      lines.push("⚠️ Đang thi công — giảm tốc độ, chú ý biển cảnh báo và rào chắn.");
      lines.push("Tránh di chuyển ban đêm khi tầm nhìn hạn chế.");
      break;
    case "open":
      lines.push("Lưu thông bình thường. Chú ý thời tiết nếu có mưa lớn.");
      break;
    case "unknown":
      lines.push("Chưa có đủ thông tin. Liên hệ Sở GTVT hoặc theo dõi báo địa phương trước khi đi.");
      break;
  }

  return lines.join("\n");
}

export function synthesizeDossierReport(dossierId: string): DossierReport | null {
  const dossier = getDossier(dossierId);
  if (!dossier) return null;

  const allEvents = listEvents(dossierId, 50);
  // "Gần đây" = 14 ngày gần nhất
  const sinceDate = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const recentEvents = allEvents.filter((e) => e.publishedAt >= sinceDate);

  const icon = STATUS_ICON[dossier.status] ?? "⚪";
  const statusLabel = STATUS_LABEL[dossier.status] ?? dossier.status;

  const currentSection = buildCurrentSection(dossier, recentEvents);
  const contextSection = buildContextSection(dossier, allEvents);
  const advisorySection = buildAdvisorySection(dossier);

  // Ghép thành fullText
  const parts: string[] = [];
  parts.push(`${icon} **${dossier.name}** (${dossier.route}): ${statusLabel}`);
  parts.push("");

  if (currentSection) {
    parts.push(`📰 Diễn biến mới nhất:`);
    parts.push(currentSection);
    parts.push("");
  }

  if (contextSection) {
    parts.push(`📋 Bối cảnh & Lệnh cấm đang duy trì:`);
    parts.push(contextSection);
    parts.push("");
  }

  if (advisorySection) {
    parts.push(`🚗 Khuyến cáo:`);
    parts.push(advisorySection);
  }

  return {
    dossierId,
    name: dossier.name,
    route: dossier.route,
    icon,
    statusLabel,
    currentSection,
    contextSection,
    advisorySection,
    fullText: parts.join("\n"),
    isActive: !dossier.isResolved && dossier.status !== "open" && dossier.status !== "unknown",
  };
}

// ──── Tổng hợp tất cả đèo ─────────────────────────────────────────────────

/**
 * Format báo cáo 10 đèo cho disaster_alert_lookup tool.
 * Chỉ hiển thị chi tiết cho đèo đang có sự cố; đèo bình thường chỉ hiện 1 dòng.
 */
export function formatAllPassDossiers(filterArea?: string): string {
  const dossiers = listDossiersByCategory("mountain_pass");
  const out: string[] = [];

  out.push("🚧 BẢNG TÌNH TRẠNG ĐÈO — HỒ SƠ SỰ CỐ TÍCH LŨY");
  out.push(
    "QUY TẮC (bắt buộc): Phải trích dẫn nguyên văn phần Bối cảnh & Lệnh cấm. " +
    "KHÔNG được tự thêm \"lưu thông bình thường\", \"thông suốt\", \"an toàn\" " +
    "nếu đèo có trạng thái 🟡/🟠/🔴. Dòng \"CHƯA có thông báo dỡ bỏ\" BẮT BUỘC giữ lại.",
  );
  out.push("");

  let hasActive = false;

  for (const dossier of dossiers) {
    // Nếu có filterArea, chỉ hiển thị đèo match
    if (filterArea) {
      const area = filterArea.normalize("NFC").toLowerCase();
      const name = dossier.name.normalize("NFC").toLowerCase();
      if (!name.includes(area) && !area.includes(name.replace("đèo ", ""))) {
        continue;
      }
    }

    const report = synthesizeDossierReport(dossier.id);
    if (!report) continue;

    if (report.isActive) {
      hasActive = true;
      out.push(report.fullText);
      out.push("---");
    } else {
      const icon = STATUS_ICON[dossier.status] ?? "⚪";
      const label = STATUS_LABEL[dossier.status] ?? "Chưa có thông tin";
      out.push(`${icon} ${dossier.name} (${dossier.route}): ${label}`);
      if (dossier.latestHeadline && dossier.latestUpdateDate) {
        out.push(`  Tin gần nhất (${fmtDate(dossier.latestUpdateDate)}): ${dossier.latestHeadline}`);
      }
    }
  }

  if (!hasActive && !filterArea) {
    out.push("");
    out.push("✅ Hiện tại không có đèo nào đang bị cấm hoặc thi công khẩn cấp.");
  }

  return out.join("\n");
}

/**
 * Lấy báo cáo chi tiết 1 đèo (khi người dùng hỏi cụ thể).
 */
export function getPassDossierReport(passName: string): string | null {
  const dossiers = listDossiersByCategory("mountain_pass");
  const area = passName.normalize("NFC").toLowerCase();

  for (const d of dossiers) {
    const name = d.name.normalize("NFC").toLowerCase();
    if (name.includes(area) || area.includes(name.replace("đèo ", ""))) {
      const report = synthesizeDossierReport(d.id);
      return report?.fullText ?? null;
    }
  }

  return null;
}

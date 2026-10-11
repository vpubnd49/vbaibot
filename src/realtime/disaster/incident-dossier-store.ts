/**
 * incident-dossier-store.ts
 * HỒ SƠ VÒNG ĐỜI SỰ CỐ (Incident Dossier System)
 *
 * Khác disaster_alerts (hết hạn 24h), dossiers KHÔNG BAO GIỜ tự xóa khi sự cố
 * chưa giải quyết. Mỗi thực thể (đèo, hồ đập, quốc lộ) có 1 hồ sơ duy nhất
 * chứa timeline mọi sự kiện: khởi phát → cấm xe → thi công → dỡ bỏ.
 *
 * Quy tắc bất biến:
 *   Lệnh cấm CŨ chỉ được coi là dỡ bỏ khi có EVENT mới loại 'lift_ban'
 *   hoặc 'full_reopen'. Tin "thông xe" chung chung (partial_reopen) KHÔNG
 *   xoá lệnh cấm gốc.
 */
import { db } from "../../conversation/database.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("incident-dossier");

// ──── Types ────────────────────────────────────────────────────────────────

export type DossierCategory = "mountain_pass" | "reservoir" | "highway" | "weather";

export type DossierStatus =
  | "blocked"       // cấm tuyệt đối
  | "restricted"    // cấm một phần (xe tải, xe khách)
  | "under_repair"  // đang thi công / gia cố
  | "open"          // thông xe hoàn toàn
  | "unknown";      // chưa có thông tin

export type EventAction =
  | "incident"        // sự cố ban đầu (sạt lở, sụt lún, ngập)
  | "restrict"        // cấm xe / đóng đường
  | "construction"    // đang thi công / khắc phục
  | "partial_reopen"  // thông xe một phần / thông xe chung chung
  | "lift_ban"        // dỡ bỏ lệnh cấm chính thức
  | "full_reopen"     // thông xe hoàn toàn (nghiệm thu, khánh thành)
  | "new_incident"    // sự cố mới trên cùng thực thể
  | "info";           // thông tin bổ sung (không đổi trạng thái)

export type ActiveRestriction = {
  description: string;
  since: string;        // ISO date
  sourceUrl?: string;
  vehicleTypes?: string[]; // ["xe tải", "xe khách"]
};

export type IncidentDossier = {
  id: string;
  category: DossierCategory;
  name: string;
  route: string;
  status: DossierStatus;
  originDate: string;
  originIncident: string;
  activeRestrictions: ActiveRestriction[];
  latestUpdateDate: string;
  latestHeadline: string;
  isResolved: boolean;
  resolvedReason: string;
  createdAt: string;
  updatedAt: string;
};

export type IncidentEvent = {
  id: number;
  dossierId: string;
  action: EventAction;
  headline: string;
  detail: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt: string;
  locationKm: string;
  createdAt: string;
};

// ──── Schema ───────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS incident_dossiers (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL DEFAULT 'mountain_pass',
    name TEXT NOT NULL,
    route TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'unknown',
    origin_date TEXT,
    origin_incident TEXT NOT NULL DEFAULT '',
    active_restrictions TEXT NOT NULL DEFAULT '[]',
    latest_update_date TEXT,
    latest_headline TEXT NOT NULL DEFAULT '',
    is_resolved INTEGER NOT NULL DEFAULT 0,
    resolved_reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_dossiers_category ON incident_dossiers (category, is_resolved);
  CREATE INDEX IF NOT EXISTS idx_dossiers_status ON incident_dossiers (status);

  CREATE TABLE IF NOT EXISTS incident_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dossier_id TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'info',
    headline TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    source_name TEXT NOT NULL DEFAULT '',
    published_at TEXT NOT NULL,
    location_km TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (dossier_id) REFERENCES incident_dossiers (id)
  );
  CREATE INDEX IF NOT EXISTS idx_events_dossier ON incident_events (dossier_id, published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_events_published ON incident_events (published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_events_source ON incident_events (source_url);
`);

// ──── Prepared Statements ──────────────────────────────────────────────────

const upsertDossierStmt = db.prepare(`
  INSERT INTO incident_dossiers (id, category, name, route, status, origin_date, origin_incident, active_restrictions, latest_update_date, latest_headline)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    status = excluded.status,
    active_restrictions = excluded.active_restrictions,
    latest_update_date = excluded.latest_update_date,
    latest_headline = excluded.latest_headline,
    is_resolved = 0,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
`);

const updateStatusStmt = db.prepare(`
  UPDATE incident_dossiers
  SET status = ?,
      active_restrictions = ?,
      latest_update_date = ?,
      latest_headline = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`);

const resolveStmt = db.prepare(`
  UPDATE incident_dossiers
  SET status = 'open',
      is_resolved = 1,
      resolved_reason = ?,
      active_restrictions = '[]',
      latest_update_date = ?,
      latest_headline = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`);

const getDossierStmt = db.prepare(`SELECT * FROM incident_dossiers WHERE id = ?`);

const listActiveDossiersStmt = db.prepare(`
  SELECT * FROM incident_dossiers
  WHERE is_resolved = 0
  ORDER BY
    CASE status
      WHEN 'blocked' THEN 0
      WHEN 'restricted' THEN 1
      WHEN 'under_repair' THEN 2
      WHEN 'unknown' THEN 3
      ELSE 4
    END,
    latest_update_date DESC
`);

const listDossiersByCategoryStmt = db.prepare(`
  SELECT * FROM incident_dossiers WHERE category = ? ORDER BY name
`);

const insertEventStmt = db.prepare(`
  INSERT INTO incident_events (dossier_id, action, headline, detail, source_url, source_name, published_at, location_km)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const eventExistsBySourceStmt = db.prepare(`
  SELECT 1 FROM incident_events WHERE source_url = ? AND dossier_id = ? LIMIT 1
`);

const listEventsStmt = db.prepare(`
  SELECT * FROM incident_events WHERE dossier_id = ? ORDER BY published_at DESC LIMIT ?
`);

const listRecentEventsStmt = db.prepare(`
  SELECT * FROM incident_events WHERE dossier_id = ? AND published_at >= ? ORDER BY published_at DESC
`);

// ──── Raw row types ────────────────────────────────────────────────────────

type DossierRow = {
  id: string;
  category: string;
  name: string;
  route: string;
  status: string;
  origin_date: string | null;
  origin_incident: string;
  active_restrictions: string;
  latest_update_date: string | null;
  latest_headline: string;
  is_resolved: number;
  resolved_reason: string;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: number;
  dossier_id: string;
  action: string;
  headline: string;
  detail: string;
  source_url: string;
  source_name: string;
  published_at: string;
  location_km: string;
  created_at: string;
};

function toDossier(row: DossierRow): IncidentDossier {
  let restrictions: ActiveRestriction[] = [];
  try { restrictions = JSON.parse(row.active_restrictions); } catch { /* empty */ }
  return {
    id: row.id,
    category: row.category as DossierCategory,
    name: row.name,
    route: row.route,
    status: row.status as DossierStatus,
    originDate: row.origin_date ?? "",
    originIncident: row.origin_incident,
    activeRestrictions: restrictions,
    latestUpdateDate: row.latest_update_date ?? "",
    latestHeadline: row.latest_headline,
    isResolved: row.is_resolved === 1,
    resolvedReason: row.resolved_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEvent(row: EventRow): IncidentEvent {
  return {
    id: row.id,
    dossierId: row.dossier_id,
    action: row.action as EventAction,
    headline: row.headline,
    detail: row.detail,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    publishedAt: row.published_at,
    locationKm: row.location_km,
    createdAt: row.created_at,
  };
}

// ──── CRUD: Dossiers ───────────────────────────────────────────────────────

export function upsertDossier(d: {
  id: string;
  category: DossierCategory;
  name: string;
  route: string;
  status: DossierStatus;
  originDate: string;
  originIncident: string;
  activeRestrictions: ActiveRestriction[];
  latestUpdateDate: string;
  latestHeadline: string;
}): void {
  upsertDossierStmt.run(
    d.id, d.category, d.name, d.route, d.status,
    d.originDate, d.originIncident,
    JSON.stringify(d.activeRestrictions),
    d.latestUpdateDate, d.latestHeadline,
  );
}

export function getDossier(id: string): IncidentDossier | null {
  const row = getDossierStmt.get(id) as DossierRow | undefined;
  return row ? toDossier(row) : null;
}

export function listActiveDossiers(): IncidentDossier[] {
  return (listActiveDossiersStmt.all() as DossierRow[]).map(toDossier);
}

export function listDossiersByCategory(category: DossierCategory): IncidentDossier[] {
  return (listDossiersByCategoryStmt.all(category) as DossierRow[]).map(toDossier);
}

export function updateDossierStatus(
  id: string,
  status: DossierStatus,
  restrictions: ActiveRestriction[],
  latestDate: string,
  latestHeadline: string,
): void {
  updateStatusStmt.run(status, JSON.stringify(restrictions), latestDate, latestHeadline, id);
}

export function resolveDossier(id: string, reason: string, date: string, headline: string): void {
  resolveStmt.run(reason, date, headline, id);
  log.info({ id, reason }, "Đóng hồ sơ sự cố — đã giải quyết");
}

// ──── CRUD: Events ─────────────────────────────────────────────────────────

export function addEvent(e: {
  dossierId: string;
  action: EventAction;
  headline: string;
  detail: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt: string;
  locationKm?: string;
}): number {
  // Dedup: không thêm event trùng sourceUrl cho cùng dossier
  if (e.sourceUrl && eventExistsBySourceStmt.get(e.sourceUrl, e.dossierId)) {
    return -1;
  }
  const result = insertEventStmt.run(
    e.dossierId, e.action, e.headline, e.detail,
    e.sourceUrl, e.sourceName, e.publishedAt, e.locationKm ?? "",
  );
  return Number(result.lastInsertRowid);
}

export function eventExistsBySource(sourceUrl: string, dossierId: string): boolean {
  return eventExistsBySourceStmt.get(sourceUrl, dossierId) !== undefined;
}

export function listEvents(dossierId: string, limit = 20): IncidentEvent[] {
  return (listEventsStmt.all(dossierId, limit) as EventRow[]).map(toEvent);
}

export function listRecentEvents(dossierId: string, sinceDate: string): IncidentEvent[] {
  return (listRecentEventsStmt.all(dossierId, sinceDate) as EventRow[]).map(toEvent);
}

// ──── Status Computation from Events ───────────────────────────────────────

/**
 * Tính lại trạng thái dossier từ toàn bộ timeline events.
 * Quy tắc bất biến: lệnh cấm cũ CHỈ bị dỡ khi có event 'lift_ban' hoặc
 * 'full_reopen' SAU nó. 'partial_reopen' KHÔNG dỡ lệnh cấm.
 */
export function recomputeDossierStatus(dossierId: string): void {
  const dossier = getDossier(dossierId);
  if (!dossier) return;

  const events = listEvents(dossierId, 100);
  if (events.length === 0) {
    updateDossierStatus(dossierId, "unknown", [], "", "Chưa có sự kiện nào.");
    return;
  }

  // events đã sắp DESC (mới nhất trước)
  const latest = events[0]!;
  const restrictions: ActiveRestriction[] = [];
  let hasUnliftedBan = false;
  let hasConstruction = false;
  let hasFullReopen = false;

  // Duyệt từ CŨ NHẤT đến MỚI NHẤT để dựng trạng thái tích lũy
  const chronological = [...events].reverse();
  const liftedBanIndices = new Set<number>();

  // Tìm các event lift_ban/full_reopen → đánh dấu các ban trước đó
  for (let i = 0; i < chronological.length; i++) {
    const ev = chronological[i]!;
    if (ev.action === "full_reopen") {
      hasFullReopen = true;
      // Full reopen dỡ MỌI ban trước nó
      for (let j = 0; j < i; j++) {
        if (chronological[j]!.action === "restrict") liftedBanIndices.add(j);
      }
    } else if (ev.action === "lift_ban") {
      // Lift_ban dỡ ban gần nhất trước nó chưa được dỡ
      for (let j = i - 1; j >= 0; j--) {
        if (chronological[j]!.action === "restrict" && !liftedBanIndices.has(j)) {
          liftedBanIndices.add(j);
          break;
        }
      }
    }
  }

  // Thu thập lệnh cấm chưa dỡ
  for (let i = 0; i < chronological.length; i++) {
    const ev = chronological[i]!;
    if (ev.action === "restrict" && !liftedBanIndices.has(i)) {
      hasUnliftedBan = true;
      restrictions.push({
        description: ev.headline,
        since: ev.publishedAt,
        sourceUrl: ev.sourceUrl || undefined,
      });
    }
    if (ev.action === "construction") {
      hasConstruction = true;
    }
  }

  // Kiểm tra nếu full_reopen xảy ra SAU mọi sự cố
  let lastFullReopen: typeof chronological[0] | undefined;
  let lastIncident: typeof chronological[0] | undefined;
  for (let i = chronological.length - 1; i >= 0; i--) {
    if (!lastFullReopen && chronological[i]!.action === "full_reopen") lastFullReopen = chronological[i];
    if (!lastIncident && (chronological[i]!.action === "incident" || chronological[i]!.action === "new_incident" || chronological[i]!.action === "restrict")) lastIncident = chronological[i];
    if (lastFullReopen && lastIncident) break;
  }
  if (lastFullReopen && lastIncident) {
    const reopenTime = new Date(lastFullReopen.publishedAt).getTime();
    const incidentTime = new Date(lastIncident.publishedAt).getTime();
    if (reopenTime > incidentTime) {
      hasUnliftedBan = false;
      hasConstruction = false;
    }
  }

  // Quyết định status
  let newStatus: DossierStatus;
  if (hasUnliftedBan && restrictions.length > 0) {
    // Cấm hoàn toàn hay cấm một phần?
    const anyFullBlock = restrictions.some((r) => {
      const d = r.description.toLowerCase();
      return /cấm (mọi|các|tất cả) (phương tiện|loại xe)/.test(d) ||
        /đóng (đèo|đường|tuyến)/.test(d) ||
        /chia cắt|tê liệt|phong tỏa|phong toả/.test(d);
    });
    newStatus = anyFullBlock ? "blocked" : "restricted";
  } else if (hasConstruction) {
    newStatus = "under_repair";
  } else if (hasFullReopen) {
    newStatus = "open";
  } else {
    // Có events nhưng chưa rõ → dựa vào event mới nhất
    if (latest.action === "partial_reopen") {
      newStatus = hasConstruction ? "under_repair" : "unknown";
    } else if (latest.action === "incident" || latest.action === "new_incident") {
      newStatus = "under_repair";
    } else {
      newStatus = "unknown";
    }
  }

  updateDossierStatus(dossierId, newStatus, restrictions, latest.publishedAt, latest.headline);

  // Nếu full_reopen và không còn ban nào → resolve
  if (newStatus === "open" && hasFullReopen && restrictions.length === 0) {
    resolveDossier(dossierId, `Thông xe hoàn toàn: ${latest.headline}`, latest.publishedAt, latest.headline);
  }

  log.debug({ dossierId, newStatus, restrictions: restrictions.length }, "Tính lại trạng thái dossier");
}

// ──── Seed Data: 10 đèo huyết mạch ────────────────────────────────────────

const PASS_SEED: Array<{ id: string; name: string; route: string }> = [
  { id: "pass_dran", name: "Đèo D'ran", route: "QL27" },
  { id: "pass_dai_ninh", name: "Đèo Đại Ninh", route: "QL28B" },
  { id: "pass_gia_bac", name: "Đèo Gia Bắc", route: "QL28" },
  { id: "pass_song_pha", name: "Đèo Sông Pha (Ngoạn Mục)", route: "QL27" },
  { id: "pass_khanh_le", name: "Đèo Khánh Lê", route: "QL27C" },
  { id: "pass_prenn", name: "Đèo Prenn", route: "QL20" },
  { id: "pass_mimosa", name: "Đèo Mimosa", route: "QL20" },
  { id: "pass_tuyen_lam", name: "Đèo Tuyền Lâm", route: "ĐT/nội bộ Tuyền Lâm" },
  { id: "pass_ta_dung", name: "Đèo Tà Đùng", route: "QL28" },
  { id: "pass_bao_loc", name: "Đèo Bảo Lộc", route: "QL20" },
];

export function seedDossiers(): void {
  const existing = db.prepare(`SELECT COUNT(*) as cnt FROM incident_dossiers WHERE category = 'mountain_pass'`).get() as { cnt: number };
  if (existing.cnt >= PASS_SEED.length) return;

  log.info("Khởi tạo hồ sơ sự cố cho 10 đèo huyết mạch");
  for (const p of PASS_SEED) {
    const row = getDossierStmt.get(p.id) as DossierRow | undefined;
    if (!row) {
      upsertDossier({
        id: p.id,
        category: "mountain_pass",
        name: p.name,
        route: p.route,
        status: "unknown",
        originDate: "",
        originIncident: "",
        activeRestrictions: [],
        latestUpdateDate: "",
        latestHeadline: "Chưa có thông tin.",
      });
    }
  }
}

// ──── Mapping: Tên đèo → dossier ID ───────────────────────────────────────

const PASS_MATCH_MAP: Array<{ dossierId: string; patterns: string[] }> = [
  { dossierId: "pass_dran", patterns: ["đèo d'ran", "đèo dran", "deo dran"] },
  { dossierId: "pass_dai_ninh", patterns: ["đèo đại ninh", "đại ninh"] },
  { dossierId: "pass_gia_bac", patterns: ["gia bắc", "đèo gia bắc"] },
  { dossierId: "pass_song_pha", patterns: ["sông pha", "ngoạn mục", "đèo sông pha", "đèo ngoạn mục"] },
  { dossierId: "pass_khanh_le", patterns: ["khánh lê", "đèo khánh lê"] },
  { dossierId: "pass_prenn", patterns: ["prenn", "đèo prenn"] },
  { dossierId: "pass_mimosa", patterns: ["mimosa", "đèo mimosa"] },
  { dossierId: "pass_tuyen_lam", patterns: ["tuyền lâm", "đèo tuyền lâm"] },
  { dossierId: "pass_ta_dung", patterns: ["tà đùng", "đèo tà đùng"] },
  { dossierId: "pass_bao_loc", patterns: ["bảo lộc", "đèo bảo lộc"] },
];

/**
 * Nhận diện tuyến đèo từ nội dung bài viết → trả về dossierId.
 * Trả null nếu không match đèo nào.
 */
export function matchPassDossier(text: string): string | null {
  const t = text.normalize("NFC").toLowerCase();
  for (const { dossierId, patterns } of PASS_MATCH_MAP) {
    if (patterns.some((p) => t.includes(p))) return dossierId;
  }
  return null;
}

/**
 * Tìm TẤT CẢ dossier matching text (có thể bài viết đề cập nhiều đèo).
 */
export function matchAllPassDossiers(text: string): string[] {
  const t = text.normalize("NFC").toLowerCase();
  const ids: string[] = [];
  for (const { dossierId, patterns } of PASS_MATCH_MAP) {
    if (patterns.some((p) => t.includes(p))) ids.push(dossierId);
  }
  return ids;
}

// Auto-seed khi module được import
seedDossiers();

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeDocumentNumber } from "../domain/document-number.js";
import { normalizeVietnamese } from "../domain/normalize-vietnamese.js";
import type { LegalDocument } from "../domain/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");

type BosungEntry = {
  id?: string;
  so_hieu?: string;
  loai_van_ban?: string;
  co_quan_ban_hanh?: string;
  ngay_ban_hanh?: string;
  ngay_hieu_luc?: string;
  tinh_trang_hieu_luc?: string;
  trich_yeu?: string;
  thay_the_cho?: string[] | string;
  sua_doi_cho?: string[];
  bi_thay_the_boi?: string[];
  tom_tat_chinh_sach?: string | string[];
  tom_tat_chuong_dieu?: string;
  official_source_urls?: string[];
  verified?: boolean;
  summary_verified?: boolean;
  verified_at?: string;
};

type KnownDocEntry = {
  id: string;
  document_number: string;
  document_type?: string;
  title?: string;
  topic_aliases?: string[];
  query_patterns?: string[];
  issuer?: string;
  issue_date?: string | null;
  effective_date?: string | null;
  effective_status?: string;
  replaces?: string[];
  amends?: string[];
  superseded_by?: string[];
  official_source_urls?: string[];
  verification_status?: string;
  verified_at?: string | null;
};

let cachedDocuments: Map<string, LegalDocument> | null = null;
let cachedKnownDocs: KnownDocEntry[] | null = null;

function mapBosungToLegalDocument(entry: BosungEntry, docNum: string): LegalDocument {
  const norm = normalizeDocumentNumber(docNum);
  const safeId = entry.id || `bosung_${norm.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

  const replacesArr = Array.isArray(entry.thay_the_cho)
    ? entry.thay_the_cho
    : entry.thay_the_cho
      ? [entry.thay_the_cho]
      : [];

  const summaryStr = Array.isArray(entry.tom_tat_chinh_sach)
    ? entry.tom_tat_chinh_sach.join(" ")
    : typeof entry.tom_tat_chinh_sach === "string"
      ? entry.tom_tat_chinh_sach
      : "";

  return {
    id: safeId,
    documentNumber: docNum,
    documentType: entry.loai_van_ban || "luat",
    title: entry.trich_yeu || "",
    issuer: entry.co_quan_ban_hanh || "",
    issueDate: entry.ngay_ban_hanh || null,
    effectiveDate: entry.ngay_hieu_luc || null,
    effectiveStatus: entry.tinh_trang_hieu_luc || "co_hieu_luc",
    replacements: replacesArr,
    amends: Array.isArray(entry.sua_doi_cho) ? entry.sua_doi_cho : [],
    supersededBy: Array.isArray(entry.bi_thay_the_boi) ? entry.bi_thay_the_boi : [],
    summary: summaryStr,
    chapterArticleSummary: entry.tom_tat_chuong_dieu || "",
    officialSourceUrls: Array.isArray(entry.official_source_urls) ? entry.official_source_urls : [],
    verified: entry.verified === true,
    source: "bosung_metadata",
  };
}

export function loadLegalDatabase(forceReload = false): Map<string, LegalDocument> {
  if (cachedDocuments && !forceReload) {
    return cachedDocuments;
  }

  const map = new Map<string, LegalDocument>();

  // 1. Load known-documents.json
  try {
    const knownPath = path.join(DATA_DIR, "known-documents.json");
    if (fs.existsSync(knownPath)) {
      const raw = fs.readFileSync(knownPath, "utf-8");
      cachedKnownDocs = JSON.parse(raw) as KnownDocEntry[];
      for (const kd of cachedKnownDocs) {
        if (kd.document_number) {
          const norm = normalizeDocumentNumber(kd.document_number);
          map.set(norm, {
            id: kd.id,
            documentNumber: kd.document_number,
            documentType: kd.document_type || "luat",
            title: kd.title || "",
            issuer: kd.issuer || "",
            issueDate: kd.issue_date || null,
            effectiveDate: kd.effective_date || null,
            effectiveStatus: kd.effective_status || "in_force",
            replacements: kd.replaces || [],
            amends: kd.amends || [],
            supersededBy: kd.superseded_by || [],
            summary: "",
            chapterArticleSummary: "",
            officialSourceUrls: kd.official_source_urls || [],
            verified: kd.verification_status === "verified",
            source: "known_documents",
          });
        }
      }
    }
  } catch (err) {
    console.warn("[legal-repository] Failed to load known-documents.json:", err);
  }

  // 2. Load bosung_metadata.json (overrides & enriches with full policy summary)
  try {
    const bosungPath = path.join(DATA_DIR, "bosung_metadata.json");
    if (fs.existsSync(bosungPath)) {
      const raw = fs.readFileSync(bosungPath, "utf-8");
      const bosungData = JSON.parse(raw) as Record<string, BosungEntry>;
      for (const entry of Object.values(bosungData)) {
        if (entry && entry.so_hieu) {
          const norm = normalizeDocumentNumber(entry.so_hieu);
          map.set(norm, mapBosungToLegalDocument(entry, entry.so_hieu));
        }
      }
    }
  } catch (err) {
    console.warn("[legal-repository] Failed to load bosung_metadata.json:", err);
  }

  cachedDocuments = map;
  return cachedDocuments;
}

export function findLegalDocumentByNumber(docNumber = ""): LegalDocument | null {
  if (!docNumber) return null;
  const target = normalizeDocumentNumber(docNumber);
  const db = loadLegalDatabase();
  return db.get(target) || null;
}

export function findLegalDocumentByAlias(query = ""): LegalDocument | null {
  if (!query) return null;
  const qNorm = normalizeVietnamese(query);
  if (!cachedKnownDocs) loadLegalDatabase();

  if (cachedKnownDocs) {
    for (const doc of cachedKnownDocs) {
      if (doc.topic_aliases && Array.isArray(doc.topic_aliases)) {
        for (const alias of doc.topic_aliases) {
          if (qNorm.includes(normalizeVietnamese(alias))) {
            return findLegalDocumentByNumber(doc.document_number);
          }
        }
      }
      if (doc.query_patterns && Array.isArray(doc.query_patterns)) {
        for (const pat of doc.query_patterns) {
          if (qNorm.includes(normalizeVietnamese(pat))) {
            return findLegalDocumentByNumber(doc.document_number);
          }
        }
      }
    }
  }
  return null;
}

export function findLegalDocumentsByPartialNumber(
  number = "",
  docType: string | null = null,
  yearFilter: number | null = null,
): LegalDocument[] {
  if (!number) return [];
  const numStr = String(number).trim();
  const db = loadLegalDatabase();
  const results: LegalDocument[] = [];

  for (const doc of db.values()) {
    const dn = doc.documentNumber;
    if (dn.startsWith(numStr + "/") || dn === numStr) {
      if (docType && doc.documentType !== docType) continue;
      if (yearFilter && !dn.includes("/" + yearFilter + "/")) continue;
      results.push(doc);
    }
  }

  return results;
}

export function findLegalDocumentsByTopic(topic = ""): LegalDocument[] {
  if (!topic) return [];
  const topicNorm = normalizeVietnamese(topic);
  if (!topicNorm) return [];

  const db = loadLegalDatabase();
  const results: LegalDocument[] = [];

  for (const doc of db.values()) {
    const titleNorm = normalizeVietnamese(doc.title);
    const summaryNorm = normalizeVietnamese(doc.summary);
    if (titleNorm.includes(topicNorm) || summaryNorm.includes(topicNorm)) {
      results.push(doc);
    }
  }

  return results;
}

/**
 * Types and interfaces for the Legal Research Domain (VBAI Legal Core).
 */

export type DocumentType =
  | "luat"
  | "nghi_dinh"
  | "thong_tu"
  | "quyet_dinh"
  | "nghi_quyet"
  | "hien_phap"
  | "phap_lenh"
  | "van_ban";

export type EffectiveStatus =
  | "co_hieu_luc"
  | "in_force"
  | "het_hieu_luc"
  | "expired"
  | "bi_thay_the"
  | "superseded"
  | "chua_co_hieu_luc"
  | "not_yet_in_force"
  | "unknown";

export type ArticleCoordinate = {
  article: string | null;
  clause: string | null;
  point: string | null;
  raw: string;
};

export type ArticleReference = {
  type: "article" | "clause" | "point" | "raw";
  value: string;
  raw: string;
};

export type LegalDocument = {
  id: string;
  documentNumber: string;
  documentType: string;
  title: string;
  issuer: string;
  issueDate: string | null;
  effectiveDate: string | null;
  effectiveStatus: string;
  replacements: string[];
  amends: string[];
  supersededBy: string[];
  summary: string;
  chapterArticleSummary: string;
  officialSourceUrls: string[];
  verified: boolean;
  source: string;
};

export type ExtractedLegalEntities = {
  hasDocumentRef: boolean;
  documentNumbers: Array<{ raw: string; normalized: string }>;
  hasBareNumberRef: boolean;
  bareNumberCandidates: Array<{ number: string; docType: string | null }>;
  hasPartialRef: boolean;
  partialDocumentNumbers: Array<{ number: string; year: string }>;
  years: number[];
  documentType: { type: string; raw: string } | null;
  topics: string[];
  hasArticleRef: boolean;
  articleReferences: ArticleReference[];
};

export type LegalQueryResult = {
  success: boolean;
  query: string;
  document: LegalDocument | null;
  documents: LegalDocument[];
  citations: Array<{
    id: string;
    documentNumber: string;
    label: string;
    documentTitle: string;
  }>;
  articles: ArticleReference[];
  warnings: string[];
  effectiveDocNumber: string | null;
  resolutionMethod: string | null;
  candidateDocuments: Array<{
    documentNumber: string;
    title: string;
    documentType: string;
    issuer: string;
    effectiveStatus: string;
  }>;
  retrievalContext: string;
  error?: string;
};

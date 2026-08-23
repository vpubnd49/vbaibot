import { extractLegalEntities } from "../domain/legal-entity-extractor.js";
import { parseArticleCoordinate } from "../domain/article-coordinate.js";
import {
  findLegalDocumentByNumber,
  findLegalDocumentByAlias,
  findLegalDocumentsByPartialNumber,
  findLegalDocumentsByTopic,
} from "../repositories/legal-repository.js";
import { resolveDocumentCrossReferences } from "./cross-reference-service.js";
import type { LegalDocument, LegalQueryResult } from "../domain/types.js";

export function processLegalQuery(query: string): LegalQueryResult {
  if (!query || typeof query !== "string" || !query.trim()) {
    return {
      success: false,
      query: "",
      document: null,
      documents: [],
      citations: [],
      articles: [],
      warnings: ["Vui lòng nhập từ khóa hoặc số hiệu văn bản cần tra cứu."],
      effectiveDocNumber: null,
      resolutionMethod: null,
      candidateDocuments: [],
      retrievalContext: "",
      error: "Query is required",
    };
  }

  const trimmedQuery = query.trim();
  const entities = extractLegalEntities(trimmedQuery);
  const articleCoord = parseArticleCoordinate(trimmedQuery);

  let effectiveDocNumber: string | null = null;
  let documentMetadata: LegalDocument | null = null;
  let resolutionMethod: string | null = null;
  let candidateDocuments: LegalDocument[] = [];

  // Strategy 1: Full document number (e.g. 72/2025/QH15)
  if (entities.hasDocumentRef) {
    const candidateNum = entities.documentNumbers[0].normalized;
    documentMetadata = findLegalDocumentByNumber(candidateNum);
    if (documentMetadata) {
      effectiveDocNumber = candidateNum;
      resolutionMethod = "full_number";
    }
  }

  // Strategy 2: Bare number + document type (e.g. "Luật số 72", "Nghị định 15")
  if (!documentMetadata && entities.hasBareNumberRef) {
    for (const candidate of entities.bareNumberCandidates) {
      const yearFilter = entities.years.length > 0 ? entities.years[0] : null;
      const matches = findLegalDocumentsByPartialNumber(
        candidate.number,
        candidate.docType,
        yearFilter,
      );

      if (matches.length === 1) {
        effectiveDocNumber = matches[0].documentNumber;
        documentMetadata = matches[0];
        resolutionMethod = "bare_number_exact";
        break;
      } else if (matches.length > 1) {
        candidateDocuments = matches;
        effectiveDocNumber = matches[0].documentNumber;
        documentMetadata = matches[0];
        resolutionMethod = "bare_number_multiple";
        break;
      }
    }
  }

  // Strategy 3: Partial number (e.g. "72/2025")
  if (!documentMetadata && entities.hasPartialRef) {
    for (const partial of entities.partialDocumentNumbers) {
      const docType = entities.documentType?.type || null;
      const matches = findLegalDocumentsByPartialNumber(
        partial.number,
        docType,
        parseInt(partial.year, 10),
      );
      if (matches.length === 1) {
        effectiveDocNumber = matches[0].documentNumber;
        documentMetadata = matches[0];
        resolutionMethod = "partial_number_exact";
        break;
      } else if (matches.length > 1) {
        candidateDocuments = matches;
        effectiveDocNumber = matches[0].documentNumber;
        documentMetadata = matches[0];
        resolutionMethod = "partial_number_multiple";
        break;
      }
    }
  }

  // Strategy 4: Alias search (e.g. "Luật tổ chức chính quyền địa phương")
  if (!documentMetadata) {
    const knownDoc = findLegalDocumentByAlias(trimmedQuery);
    if (knownDoc) {
      effectiveDocNumber = knownDoc.documentNumber;
      documentMetadata = knownDoc;
      resolutionMethod = "alias";
    }
  }

  // Strategy 5: Topic search (e.g. "việc làm", "bảo hiểm thất nghiệp")
  if (!documentMetadata && entities.topics.length > 0) {
    for (const topic of entities.topics) {
      const topicMatches = findLegalDocumentsByTopic(topic);
      if (topicMatches.length > 0) {
        if (topicMatches.length === 1) {
          effectiveDocNumber = topicMatches[0].documentNumber;
          documentMetadata = topicMatches[0];
          resolutionMethod = "topic_exact";
        } else {
          candidateDocuments = topicMatches;
          effectiveDocNumber = topicMatches[0].documentNumber;
          documentMetadata = topicMatches[0];
          resolutionMethod = "topic_multiple";
        }
        break;
      }
    }
  }

  const documents: LegalDocument[] = documentMetadata ? [documentMetadata] : candidateDocuments;
  const warnings: string[] = [];

  if (entities.hasDocumentRef && !documentMetadata) {
    warnings.push(
      `Văn bản số ${entities.documentNumbers[0].normalized} chưa có dữ liệu đầy đủ trong CSDL cục bộ.`,
    );
  }

  const citations: Array<{
    id: string;
    documentNumber: string;
    label: string;
    documentTitle: string;
  }> = [];

  if (documentMetadata) {
    if (articleCoord.article) {
      const label = [
        articleCoord.point ? `Điểm ${articleCoord.point}` : null,
        articleCoord.clause ? `Khoản ${articleCoord.clause}` : null,
        `Điều ${articleCoord.article}`,
      ]
        .filter(Boolean)
        .join(" ");

      citations.push({
        id: "CIT-1",
        documentNumber: documentMetadata.documentNumber,
        label,
        documentTitle: documentMetadata.title,
      });
    }
  }

  const retrievalContext = buildRetrievalContext({
    documents,
    citations,
    articleCoord,
    warnings,
  });

  return {
    success: true,
    query: trimmedQuery,
    document: documentMetadata,
    documents,
    citations,
    articles: entities.articleReferences,
    warnings,
    effectiveDocNumber,
    resolutionMethod,
    candidateDocuments: candidateDocuments.map((c) => ({
      documentNumber: c.documentNumber,
      title: c.title,
      documentType: c.documentType,
      issuer: c.issuer,
      effectiveStatus: c.effectiveStatus,
    })),
    retrievalContext,
  };
}

function buildRetrievalContext({
  documents,
  citations,
  articleCoord,
  warnings,
}: {
  documents: LegalDocument[];
  citations: Array<{ id: string; documentNumber: string; label: string; documentTitle: string }>;
  articleCoord: { article: string | null; clause: string | null; point: string | null };
  warnings: string[];
}): string {
  const parts: string[] = [];

  if (warnings.length > 0) {
    parts.push(`[LƯU Ý]: ${warnings.join("; ")}`);
  }

  if (documents.length > 0) {
    for (const doc of documents.slice(0, 3)) {
      parts.push(`=== VĂN BẢN: ${doc.documentNumber} ===`);
      if (doc.title) parts.push(`Tên văn bản: ${doc.title}`);
      if (doc.issuer) parts.push(`Cơ quan ban hành: ${doc.issuer}`);
      if (doc.issueDate) parts.push(`Ngày ban hành: ${doc.issueDate}`);
      if (doc.effectiveDate) parts.push(`Ngày hiệu lực: ${doc.effectiveDate}`);
      parts.push(
        `Tình trạng hiệu lực: ${doc.effectiveStatus === "co_hieu_luc" || doc.effectiveStatus === "in_force" ? "✅ Còn hiệu lực" : "⚠️ " + doc.effectiveStatus}`,
      );

      const crossRef = resolveDocumentCrossReferences(doc);
      if (crossRef.replaces.length > 0) {
        const replacesList = crossRef.replaces
          .map((r) => (r.title ? `${r.documentNumber} (${r.title})` : r.documentNumber))
          .join(", ");
        parts.push(`Thay thế cho: ${replacesList}`);
      }
      if (crossRef.supersededBy.length > 0) {
        const supersededList = crossRef.supersededBy
          .map((s) => (s.title ? `${s.documentNumber} (${s.title})` : s.documentNumber))
          .join(", ");
        parts.push(`❌ ĐÃ BỊ THAY THẾ BỞI: ${supersededList}`);
      }

      if (doc.summary) {
        parts.push(`Tóm tắt nội dung chính sách:\n${doc.summary}`);
      }
      if (doc.chapterArticleSummary) {
        parts.push(`Cấu trúc chương / điều:\n${doc.chapterArticleSummary}`);
      }
      if (doc.officialSourceUrls.length > 0) {
        parts.push(`Nguồn chính thức: ${doc.officialSourceUrls.join(", ")}`);
      }
      parts.push("");
    }
  }

  if (citations.length > 0) {
    parts.push("=== TRÍCH DẪN ĐIỀU KHOẢN YÊU CẦU ===");
    for (const cit of citations) {
      parts.push(`- ${cit.label} của văn bản ${cit.documentNumber} (${cit.documentTitle})`);
    }
    parts.push("");
  }

  return parts.join("\n");
}

import type { LegalDocument } from "../domain/types.js";
import { findLegalDocumentByNumber } from "../repositories/legal-repository.js";

export type CrossReferenceInfo = {
  documentNumber: string;
  replaces: Array<{ documentNumber: string; title?: string }>;
  supersededBy: Array<{ documentNumber: string; title?: string }>;
  amends: Array<{ documentNumber: string; title?: string }>;
};

/**
 * Resolves replacement, amendment, and superseded relationships for a legal document.
 */
export function resolveDocumentCrossReferences(doc: LegalDocument): CrossReferenceInfo {
  const replacesWithDetails = doc.replacements.map((num) => {
    const target = findLegalDocumentByNumber(num);
    return {
      documentNumber: num,
      title: target?.title || undefined,
    };
  });

  const supersededWithDetails = doc.supersededBy.map((num) => {
    const target = findLegalDocumentByNumber(num);
    return {
      documentNumber: num,
      title: target?.title || undefined,
    };
  });

  const amendsWithDetails = doc.amends.map((num) => {
    const target = findLegalDocumentByNumber(num);
    return {
      documentNumber: num,
      title: target?.title || undefined,
    };
  });

  return {
    documentNumber: doc.documentNumber,
    replaces: replacesWithDetails,
    supersededBy: supersededWithDetails,
    amends: amendsWithDetails,
  };
}

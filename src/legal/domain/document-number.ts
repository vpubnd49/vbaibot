/**
 * Document number extraction, normalization, and verification.
 */
export const FULL_DOC_NUMBER_REGEX = /\b(\d{1,4}\/\d{4}\/[A-Za-z0-9\u0110\u0111-]+)\b/i;
export const STRICT_DOC_NUMBER_PATTERN = /^\d{1,4}\/\d{4}\/[A-Za-z0-9\u0110\u0111-]+$/;

export function normalizeDocumentNumber(rawNumber = ""): string {
  if (!rawNumber) return "";
  let cleaned = String(rawNumber).trim().toUpperCase();
  cleaned = cleaned.replace(/\s+/g, "");
  return cleaned;
}

export function extractFullDocumentNumber(text = ""): string | null {
  if (!text) return null;
  const match = String(text).match(FULL_DOC_NUMBER_REGEX);
  if (match) {
    return normalizeDocumentNumber(match[1]);
  }
  return null;
}

export function isFullDocumentNumber(number = ""): boolean {
  if (!number) return false;
  const norm = normalizeDocumentNumber(number);
  return STRICT_DOC_NUMBER_PATTERN.test(norm);
}

export function extractPartialDocumentNumber(text = ""): string | null {
  if (!text) return null;
  const match = String(text).match(/\b(\d{1,4}\/\d{4})\b/);
  return match ? match[1] : null;
}

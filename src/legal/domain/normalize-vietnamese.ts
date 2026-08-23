/**
 * Normalizes Vietnamese text by removing diacritics and lowercasing for fuzzy matching.
 */
export function normalizeVietnamese(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

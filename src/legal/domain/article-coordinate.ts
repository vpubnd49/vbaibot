import type { ArticleCoordinate } from "./types.js";

/**
 * Parsing and formatting of Vietnamese Legal Article Coordinates (Điều, Khoản, Điểm).
 */
export function parseArticleCoordinate(text = ""): ArticleCoordinate {
  if (!text || typeof text !== "string") {
    return { article: null, clause: null, point: null, raw: "" };
  }

  // Match pattern: Point [a-z] Clause [0-9]+ Article [0-9]+ (e.g. "điểm a khoản 2 điều 15")
  const fullMatch = text.match(
    /(?:điểm|diem)\s+([a-zđ0-9]+)\s+(?:khoản|khoan)\s+([0-9]+)\s+(?:điều|dieu)\s+([0-9]+[a-z]?)/i,
  );
  if (fullMatch) {
    return {
      article: fullMatch[3].trim(),
      clause: fullMatch[2].trim(),
      point: fullMatch[1].trim(),
      raw: fullMatch[0].trim(),
    };
  }

  // Match pattern: Clause [0-9]+ Article [0-9]+ (e.g. "khoản 3 điều 20")
  const clauseArticleMatch = text.match(
    /(?:khoản|khoan)\s+([0-9]+)\s+(?:điều|dieu)\s+([0-9]+[a-z]?)/i,
  );
  if (clauseArticleMatch) {
    return {
      article: clauseArticleMatch[2].trim(),
      clause: clauseArticleMatch[1].trim(),
      point: null,
      raw: clauseArticleMatch[0].trim(),
    };
  }

  // Match pattern: Article [0-9]+ Clause [0-9]+ Point [a-z] (e.g. "điều 15 khoản 2 điểm a")
  const articleClausePointMatch = text.match(
    /(?:điều|dieu)\s+([0-9]+[a-z]?)(?:\s+(?:khoản|khoan)\s+([0-9]+))?(?:\s+(?:điểm|diem)\s+([a-zđ0-9]+))?/i,
  );
  if (articleClausePointMatch && articleClausePointMatch[1]) {
    return {
      article: articleClausePointMatch[1].trim(),
      clause: articleClausePointMatch[2] ? articleClausePointMatch[2].trim() : null,
      point: articleClausePointMatch[3] ? articleClausePointMatch[3].trim() : null,
      raw: articleClausePointMatch[0].trim(),
    };
  }

  return { article: null, clause: null, point: null, raw: "" };
}

export function formatArticleCoordinate(coord: {
  article: string | null;
  clause?: string | null;
  point?: string | null;
}): string {
  if (!coord.article) return "";
  const parts: string[] = [];
  if (coord.point) parts.push(`Điểm ${coord.point}`);
  if (coord.clause) parts.push(`Khoản ${coord.clause}`);
  parts.push(`Điều ${coord.article}`);
  return parts.join(" ");
}

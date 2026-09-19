/** Connector Cổng Pháp luật quốc gia: https://phapluat.gov.vn */
import fs from "node:fs/promises";
import path from "node:path";
import { dataDir } from "../../config/env.js";

const BASE_URL = "https://phapluat.gov.vn";
const SEARCH_URL = `${BASE_URL}/api/legal-documents`;
const USER_AGENT = "Mozilla/5.0 (compatible; LegalResearchBot/1.0)";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;

/** Tạo liên kết tra cứu chuẩn, dùng khi API bị WAF hoặc người dùng muốn mở nguồn gốc. */
export function buildPhapLuatSearchUrl(keyword: string): string {
  const clean = keyword.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return clean
    ? `${BASE_URL}/he-thong-van-ban-phap-luat?search=${encodeURIComponent(clean)}`
    : `${BASE_URL}/he-thong-van-ban-phap-luat`;
}

export function buildPhapLuatDetailUrl(id: string, tab = "noidung"): string {
  return `${BASE_URL}/legal-documents/${encodeURIComponent(id.trim())}?tabName=${encodeURIComponent(tab)}`;
}

export type PhapLuatSearchResult = {
  soHieu: string;
  trichYeu: string;
  loaiVB: string;
  ngayBanHanh: string;
  hieuLuc: string;
  detailUrl: string;
  downloadId: string;
};

function isValidPdf(buffer: Buffer): boolean {
  return buffer.length >= 1000 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function normalizeSoHieu(value: string): string {
  return value.replace(/[\s/-]/g, "").toUpperCase();
}

async function pdfContainsDocumentNumber(buffer: Buffer, soHieu?: string): Promise<boolean> {
  if (!soHieu) return true;
  try {
    const pdfModule: any = await import("pdf-parse");
    const parse = typeof pdfModule === "function" ? pdfModule : pdfModule.default;
    if (!parse) return false;
    const parsed = await parse(buffer, { max: 5 });
    return normalizeSoHieu(String(parsed.text || "")).includes(normalizeSoHieu(soHieu));
  } catch {
    return false;
  }
}

type ApiDocument = {
  docGUId?: string;
  docName?: string;
  docNameClear?: string;
  docSummary?: string;
  docIdentity?: string;
  issueDate?: string;
  effectStatusName?: string;
};

function headers(): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
    "X-Requested-With": "XMLHttpRequest",
    "Cache-Control": "no-cache",
  };
}

function extractType(name: string): string {
  const match = name.match(/(?:^|\s)(Luật|Nghị định|Thông tư|Quyết định|Nghị quyết|Pháp lệnh|Chỉ thị|Thông báo|Công văn)\b/i);
  return match?.[1] ?? "Văn bản pháp luật";
}

function mapDocument(item: ApiDocument): PhapLuatSearchResult | null {
  const id = item.docGUId?.trim();
  if (!id) return null;
  const title = (item.docNameClear || item.docName || item.docSummary || "").trim();
  return {
    soHieu: item.docIdentity?.trim() || "",
    trichYeu: title,
    loaiVB: extractType(title),
    ngayBanHanh: item.issueDate?.slice(0, 10) || "",
    hieuLuc: item.effectStatusName?.trim() || "",
    detailUrl: buildPhapLuatDetailUrl(id),
    downloadId: id,
  };
}

export async function searchPhapLuat(keyword: string): Promise<PhapLuatSearchResult[]> {
  const payload = {
    keywords: keyword.trim(),
    isSearchExact: 0,
    issueDateFrom: "",
    issueDateTo: "",
    searchByDate: null,
    pageIndex: 0,
    rowAmount: 20,
    searchOptions: 1,
    sortBy: "issueDate",
    sortOrder: "desc",
    docGroupIds: [], fieldIds: [], effectStatusIds: [], signerIds: [],
    organIds: [], docTypeIds: [], provinceIds: [], wardIds: [], languageId: 1,
    qtdcListFilter: "all",
    qtdcListScope: "all",
  };
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(SEARCH_URL, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Pháp luật quốc gia HTTP ${response.status}`);
      const body = await response.json() as { data?: { docs?: ApiDocument[] } };
      return (body.data?.docs ?? []).map(mapDocument).filter((item): item is PhapLuatSearchResult => item !== null);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function extractFileUrls(html: string): string[] {
  const urls = new Set<string>();
  const pattern = /https:\/\/s3-[^"'\\\s<>]+\.(?:pdf|docx?|xlsx?)(?:\?[^"'\\\s<>]*)?/gi;
  for (const match of html.matchAll(pattern)) urls.add(match[0].replace(/\\u0026/g, "&"));
  return [...urls];
}

export async function downloadPhapLuatDocument(
  downloadId: string,
  format: "pdf" | "doc" | "docx" = "pdf",
  soHieu?: string,
): Promise<{ filePath: string | null; format: string; fileSize: number; error?: string }> {
  const detailUrl = /^https?:\/\//i.test(downloadId) ? downloadId : buildPhapLuatDetailUrl(downloadId);
  const response = await fetch(detailUrl, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) return { filePath: null, format, fileSize: 0, error: `Không đọc được trang chi tiết (HTTP ${response.status})` };
  const urls = extractFileUrls(await response.text());
  // Không fallback sang URL đầu tiên: trang có thể chứa phụ lục/tài liệu liên quan.
  const preferred = urls.find((url) => format === "pdf" ? /\.pdf(?:\?|$)/i.test(url) : new RegExp(`\\.${format}(?:\\?|$)`, "i").test(url));
  if (!preferred) return { filePath: null, format, fileSize: 0, error: `Không tìm thấy tệp ${format.toUpperCase()} đúng định dạng trên Cổng Pháp luật quốc gia` };
  const fileResponse = await fetch(preferred, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
  if (!fileResponse.ok) return { filePath: null, format, fileSize: 0, error: `Tải tệp thất bại (HTTP ${fileResponse.status})` };
  const buffer = Buffer.from(await fileResponse.arrayBuffer());
  if (format === "pdf" && !isValidPdf(buffer)) {
    return { filePath: null, format, fileSize: 0, error: "File tải về không phải PDF hợp lệ hoặc nội dung rỗng" };
  }
  if (format === "pdf" && !(await pdfContainsDocumentNumber(buffer, soHieu))) {
    return { filePath: null, format, fileSize: 0, error: `Nội dung PDF không chứa số hiệu yêu cầu ${soHieu || ""}` };
  }
  const dir = path.join(dataDir, "phapluat");
  await fs.mkdir(dir, { recursive: true });
  const safe = (soHieu || downloadId).replace(/[^\p{L}\p{N}._-]+/gu, "-");
  const ext = path.extname(new URL(preferred).pathname) || `.${format}`;
  const filePath = path.join(dir, `${safe}${ext}`);
  await fs.writeFile(filePath, buffer);
  return { filePath, format: ext.slice(1), fileSize: buffer.length };
}

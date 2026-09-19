/** Connector Cổng Pháp luật quốc gia: https://phapluat.gov.vn */
import fs from "node:fs/promises";
import path from "node:path";
import { dataDir } from "../../config/env.js";

const BASE_URL = "https://phapluat.gov.vn";
const SEARCH_URL = `${BASE_URL}/api/legal-documents`;
const USER_AGENT = "Mozilla/5.0 (compatible; LegalResearchBot/1.0)";

export type PhapLuatSearchResult = {
  soHieu: string;
  trichYeu: string;
  loaiVB: string;
  ngayBanHanh: string;
  hieuLuc: string;
  detailUrl: string;
  downloadId: string;
};

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
    detailUrl: `${BASE_URL}/legal-documents/${encodeURIComponent(id)}?tabName=noidung`,
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
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Pháp luật quốc gia HTTP ${response.status}`);
  const body = await response.json() as { data?: { docs?: ApiDocument[] } };
  return (body.data?.docs ?? []).map(mapDocument).filter((item): item is PhapLuatSearchResult => item !== null);
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
  const detailUrl = `${BASE_URL}/legal-documents/${encodeURIComponent(downloadId)}?tabName=noidung`;
  const response = await fetch(detailUrl, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) return { filePath: null, format, fileSize: 0, error: `Không đọc được trang chi tiết (HTTP ${response.status})` };
  const urls = extractFileUrls(await response.text());
  const preferred = urls.find((url) => format === "pdf" ? url.toLowerCase().includes(".pdf") : url.toLowerCase().includes(`.${format}`)) || urls[0];
  if (!preferred) return { filePath: null, format, fileSize: 0, error: "Không tìm thấy tệp văn bản trên Cổng Pháp luật quốc gia" };
  const fileResponse = await fetch(preferred, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
  if (!fileResponse.ok) return { filePath: null, format, fileSize: 0, error: `Tải tệp thất bại (HTTP ${fileResponse.status})` };
  const buffer = Buffer.from(await fileResponse.arrayBuffer());
  const dir = path.join(dataDir, "phapluat");
  await fs.mkdir(dir, { recursive: true });
  const safe = (soHieu || downloadId).replace(/[^\p{L}\p{N}._-]+/gu, "-");
  const ext = path.extname(new URL(preferred).pathname) || `.${format}`;
  const filePath = path.join(dir, `${safe}${ext}`);
  await fs.writeFile(filePath, buffer);
  return { filePath, format: ext.slice(1), fileSize: buffer.length };
}

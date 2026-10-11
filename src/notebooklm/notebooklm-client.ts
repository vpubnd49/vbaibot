import { getNotebooklmSettings } from "../config/runtime-notebooklm-settings.js";

/**
 * Client REST cho máy chủ notebooklm-mcp (roomi-fields, v3.2).
 *
 * Máy chủ chỉ có MỘT Chrome nên mọi lệnh đi qua hàng đợi tuần tự `serial` -
 * hai lệnh chạy song song dễ giẫm lên nhau trong cùng trang. Lỗi luôn trả về
 * dạng `{ ok:false, error }`, không throw (tool không bao giờ được throw).
 */

export type NlmResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type NlmHealth = { authenticated: boolean; status?: string; version?: string };
export type NlmCreated = { notebook_url: string; notebook_id: string };
export type NlmAnswer = { answer: string; session_id?: string };
export type NlmContentItem = { id: string; type: string; name: string; content?: string };
export type NlmContent = {
  sources: { id: string; name: string }[];
  generatedContent: NlmContentItem[];
};
export type NlmDownload = { filePath: string; mimeType?: string; size?: number };
export type StudioType = "audio_overview" | "video" | "infographic" | "report" | "presentation" | "data_table";

/** Đường dẫn THẤY TỪ TRONG container (mount tương ứng data/notebooklm-inbox|out) */
export const CONTAINER_INBOX = "/inbox";
export const CONTAINER_OUT = "/out";

let chain: Promise<unknown> = Promise.resolve();

/** Chạy tuần tự - lệnh sau chờ lệnh trước xong (kể cả khi lệnh trước lỗi) */
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(job, job);
  chain = run.catch(() => undefined);
  return run;
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  body: Record<string, unknown> | undefined,
  timeoutMs: number,
): Promise<NlmResult<T>> {
  const base = getNotebooklmSettings().apiUrl;
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = (await res.json().catch(() => null)) as
      | { success?: boolean; data?: T; error?: string }
      | null;
    if (!json) return { ok: false, error: `Máy chủ NotebookLM trả HTTP ${res.status} không đọc được` };
    if (json.success === false || !res.ok) {
      return { ok: false, error: json.error || `HTTP ${res.status}` };
    }
    return { ok: true, data: (json.data ?? json) as T };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/timeout|aborted/i.test(msg)) return { ok: false, error: "Máy chủ NotebookLM phản hồi quá lâu" };
    if (/ECONNREFUSED|fetch failed/i.test(msg)) return { ok: false, error: "Máy chủ NotebookLM đang tắt" };
    return { ok: false, error: msg };
  }
}

const MIN = 60_000;

/** Health KHÔNG xếp hàng: phải trả lời ngay cả khi Chrome đang bận tạo audio */
export const nlmHealth = () => call<NlmHealth>("GET", "/health", undefined, 10_000);

/** Mở Chrome hiện trên noVNC để Admin đăng nhập Google - chờ tối đa ~10 phút */
export const nlmSetupAuth = () => call<unknown>("POST", "/setup-auth", { show_browser: true }, 11 * MIN);

export const nlmCreateNotebook = (name: string) =>
  serial(() => call<NlmCreated>("POST", "/notebooks/create", { name }, 3 * MIN));

export function nlmAddSource(
  notebookUrl: string,
  src: { type: "file"; filePath: string; title?: string } | { type: "url" | "youtube"; url: string } | { type: "text"; text: string; title: string },
) {
  const body: Record<string, unknown> = { notebook_url: notebookUrl, source_type: src.type };
  if (src.type === "file") Object.assign(body, { file_path: src.filePath, title: src.title });
  else if (src.type === "text") Object.assign(body, { text: src.text, title: src.title });
  else body.url = src.url;
  return serial(() => call<{ sourceId?: string; sourceName?: string }>("POST", "/content/sources", body, 6 * MIN));
}

export const nlmAsk = (notebookUrl: string, question: string) =>
  serial(() => call<NlmAnswer>("POST", "/ask", { notebook_url: notebookUrl, question, source_format: "footnotes" }, 4 * MIN));

export const nlmGenerate = (notebookUrl: string, type: StudioType, opts: { instructions?: string; language?: string }) =>
  serial(() =>
    call<{ textContent?: string; content?: string; status?: string }>(
      "POST",
      "/content/generate",
      {
        notebook_url: notebookUrl,
        content_type: type,
        language: opts.language ?? "vi",
        // report không nhận custom_instructions (máy chủ trả 400)
        custom_instructions: type === "report" ? undefined : opts.instructions,
      },
      20 * MIN,
    ),
  );

export const nlmListContent = (notebookUrl: string) =>
  serial(() => call<NlmContent>("GET", `/content?notebook_url=${encodeURIComponent(notebookUrl)}`, undefined, 2 * MIN));

export function nlmDownload(notebookUrl: string, type: "audio_overview" | "video" | "infographic", outName: string) {
  const q = new URLSearchParams({ content_type: type, notebook_url: notebookUrl, output_path: `${CONTAINER_OUT}/${outName}` });
  return serial(() => call<NlmDownload>("GET", `/content/download?${q}`, undefined, 6 * MIN));
}

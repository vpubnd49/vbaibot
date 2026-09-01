import { createLogger } from "./logger.js";

const log = createLogger("kie-music");

function normalizeBase(raw: string): string {
  return raw.replace(/\/+$/, "").replace(/\/api\/v1\/?$/, "");
}

export type KieMusicSettings = { baseUrl: string; apiKey: string };
export type KieMusicParams = {
  model: string; prompt: string; title?: string; style?: string; lyrics?: string;
  customMode: boolean; instrumental: boolean; callBackUrl?: string;
};
export type KieMusicResult = { taskId: string; state: string; audioUrls: string[]; failMsg?: string };

export async function createKieMusicTask(settings: KieMusicSettings, params: KieMusicParams, fetchImpl: typeof fetch = fetch): Promise<string> {
  const url = `${normalizeBase(settings.baseUrl)}/api/v1/generate`;
  const body: Record<string, unknown> = { model: params.model, prompt: params.prompt, customMode: params.customMode, instrumental: params.instrumental };
  if (params.title) body.title = params.title;
  if (params.style) body.style = params.style;
  if (params.lyrics) body.lyrics = params.lyrics;
  if (params.callBackUrl) body.callBackUrl = params.callBackUrl;
  const res = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`KIE music tạo task thất bại: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const json = await res.json() as { code?: number; msg?: string; data?: { taskId?: string } };
  if (!json.data?.taskId) throw new Error(`KIE music lỗi: ${json.msg ?? "không có taskId"}`);
  log.info({ taskId: json.data.taskId, model: params.model }, "Đã tạo KIE music task");
  return json.data.taskId;
}

const DEFAULT_POLL_INTERVAL_MS = 5_000;
export async function pollKieMusicUntilDone(settings: KieMusicSettings, taskId: string, timeoutMs: number, fetchImpl: typeof fetch = fetch, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS): Promise<KieMusicResult> {
  const deadline = Date.now() + timeoutMs;
  const url = `${normalizeBase(settings.baseUrl)}/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`;
  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${settings.apiKey}` }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if ([401, 403, 404].includes(res.status)) throw new Error(`KIE music poll thất bại: HTTP ${res.status} ${body.slice(0, 200)}`);
      log.warn({ taskId, status: res.status }, "KIE music poll HTTP lỗi, thử lại"); continue;
    }
    const json = await res.json() as { data?: { status?: string; state?: string; data?: unknown; response?: unknown; result?: unknown; failMsg?: string } };
    const state = String(json.data?.status ?? json.data?.state ?? "unknown");
    const upperState = state.toUpperCase();
    if (["SUCCESS", "COMPLETE", "COMPLETED"].includes(upperState)) {
      const audioUrls: string[] = [];
      collectAudioUrls(json.data, audioUrls);
      log.info({ taskId, state, urls: audioUrls.length }, "KIE music task hoàn thành");
      return { taskId, state, audioUrls };
    }
    if (["FAILED", "FAIL", "ERROR"].includes(upperState)) return { taskId, state, audioUrls: [], failMsg: json.data?.failMsg ?? "Tạo nhạc thất bại" };
    log.debug({ taskId, state }, "KIE music task đang xử lý");
  }
  throw new Error(`KIE music task quá lâu (hơn ${Math.round(timeoutMs / 1000)} giây) nên đã dừng`);
}

export async function downloadKieMusicResult(url: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Tải file nhạc KIE thất bại: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function collectAudioUrls(value: unknown, output: string[], fieldName = ""): void {
  if (typeof value === "string") {
    const isAudioField = /audio|music|sound|stream|source/i.test(fieldName);
    const hasAudioExtension = /\.(mp3|wav|m4a|aac|flac|ogg)(?:[?#]|$)/i.test(value);
    if (/^https?:\/\//i.test(value) && (isAudioField || hasAudioExtension)) output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAudioUrls(item, output, fieldName);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      collectAudioUrls(item, output, key);
    }
  }
}
function sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }

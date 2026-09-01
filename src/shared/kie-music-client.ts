/**
 * Client KIE dành riêng cho Suno v5.5.
 *
 * Suno dùng endpoint KHÁC so với image/video:
 *   Tạo:  POST /api/v1/generate
 *   Poll: GET  /api/v1/generate/record-info?taskId=xxx
 *
 * Response format cũng khác — trả về audio URLs trực tiếp.
 */

import { createLogger } from "./logger.js";

const log = createLogger("kie-music");

function normalizeBase(raw: string): string {
  return raw.replace(/\/+$/, "").replace(/\/api\/v1\/?$/, "");
}

export type KieMusicSettings = {
  baseUrl: string;
  apiKey: string;
};

export type KieMusicParams = {
  model: string;
  prompt: string;
  title?: string;
  style?: string;
  lyrics?: string;
  customMode: boolean;
  instrumental: boolean;
  callBackUrl?: string;
};

export type KieMusicResult = {
  taskId: string;
  state: string;
  audioUrls: string[];
  failMsg?: string;
};

// ---------- createTask ----------

export async function createKieMusicTask(
  settings: KieMusicSettings,
  params: KieMusicParams,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const url = `${normalizeBase(settings.baseUrl)}/api/v1/generate`;
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    customMode: params.customMode,
    instrumental: params.instrumental,
  };
  if (params.title) body.title = params.title;
  if (params.style) body.style = params.style;
  if (params.callBackUrl) body.callBackUrl = params.callBackUrl;

  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`KIE music tạo task thất bại: HTTP ${res.status} ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as { code?: number; msg?: string; data?: { taskId?: string } };
  if (!json.data?.taskId) {
    throw new Error(`KIE music lỗi: ${json.msg ?? "không có taskId"}`);
  }

  log.info({ taskId: json.data.taskId, model: params.model }, "Đã tạo KIE music task");
  return json.data.taskId;
}

// ---------- pollTask ----------

const DEFAULT_POLL_INTERVAL_MS = 5_000;

export async function pollKieMusicUntilDone(
  settings: KieMusicSettings,
  taskId: string,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
): Promise<KieMusicResult> {
  const deadline = Date.now() + timeoutMs;
  const url = `${normalizeBase(settings.baseUrl)}/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`;

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);

    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${settings.apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        throw new Error(`KIE music poll thất bại: HTTP ${res.status} ${body.slice(0, 200)}`);
      }
      log.warn({ taskId, status: res.status }, "KIE music poll HTTP lỗi, thử lại");
      continue;
    }

    const json = (await res.json()) as {
      code?: number;
      data?: {
        taskId?: string;
        status?: string;
        state?: string;
        data?: Array<{ audio_url?: string; audioUrl?: string; source_audio_url?: string; sourceAudioUrl?: string; title?: string; status?: string }>;
        response?: unknown;
        result?: unknown;
        failMsg?: string;
      };
    };

    // Suno có thể dùng "status" hoặc "state" — xử lý cả hai
    const state = json.data?.status ?? json.data?.state ?? "unknown";
    const upperState = state.toUpperCase();

    if (upperState === "SUCCESS" || upperState === "COMPLETE") {
      const audioUrls = (json.data?.data ?? [])
        .flatMap((item) => [item.audio_url, item.audioUrl, item.source_audio_url, item.sourceAudioUrl])
        .filter((u): u is string => Boolean(u));

      // Một số response KIE đặt danh sách kết quả ở response/result thay vì data.
      const nested = (json.data?.response ?? json.data?.result) as
        | { audio_url?: string; audioUrl?: string; audio_urls?: string[]; audioUrls?: string[] }
        | undefined;
      if (audioUrls.length === 0 && nested) {
        audioUrls.push(
          ...(nested.audioUrls ?? nested.audio_urls ?? [nested.audioUrl, nested.audio_url].filter((u): u is string => Boolean(u))),
        );
      }

      log.info({ taskId, state, urls: audioUrls.length }, "KIE music task hoàn thành");
      return { taskId, state, audioUrls };
    }

    if (upperState === "FAILED" || upperState === "FAIL") {
      const failMsg = json.data?.failMsg ?? "Tạo nhạc thất bại";
      log.warn({ taskId, failMsg }, "KIE music task thất bại");
      return { taskId, state, audioUrls: [], failMsg };
    }

    // PENDING, PROCESSING, etc. → tiếp tục poll
    log.debug({ taskId, state }, "KIE music task đang xử lý");
  }

  throw new Error(`KIE music task quá lâu (hơn ${Math.round(timeoutMs / 1000)} giây) nên đã dừng`);
}

// ---------- download ----------

export async function downloadKieMusicResult(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    throw new Error(`Tải file nhạc KIE thất bại: HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ---------- helpers ----------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

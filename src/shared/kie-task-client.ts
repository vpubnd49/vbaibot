/**
 * Client chung cho KIE async task API (Image + Video dùng cùng endpoint).
 *
 * Luồng:  POST /api/v1/jobs/createTask  →  taskId
 *         GET  /api/v1/jobs/recordInfo   →  poll cho đến success/fail
 *         GET  resultUrl                 →  download buffer
 *
 * Không charge cho task fail — nhưng vẫn throw lỗi rõ ràng để tool báo
 * cho người dùng.
 */

import { createLogger } from "./logger.js";

const log = createLogger("kie-task");

/**
 * Chuẩn hoá base URL: bỏ trailing slash VÀ bỏ /api/v1 nếu có
 * → luôn ra dạng "https://api.kie.ai" để ghép path thống nhất.
 */
function normalizeBase(raw: string): string {
  return raw.replace(/\/+$/, "").replace(/\/api\/v1\/?$/, "");
}

export type KieTaskSettings = {
  baseUrl: string;
  apiKey: string;
};

export type KieTaskInput = Record<string, unknown>;

export type KieTaskResult = {
  taskId: string;
  state: string;
  resultUrls: string[];
  failCode?: string;
  failMsg?: string;
};

// ---------- createTask ----------

export async function createKieTask(
  settings: KieTaskSettings,
  model: string,
  input: KieTaskInput,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const url = `${normalizeBase(settings.baseUrl)}/api/v1/jobs/createTask`;
  const body = { model, input };

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
    throw new Error(`KIE createTask thất bại: HTTP ${res.status} ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as { code?: number; msg?: string; data?: { taskId?: string } };
  if (json.code !== 200 || !json.data?.taskId) {
    throw new Error(`KIE createTask lỗi: ${json.msg ?? "không có taskId"}`);
  }

  log.info({ taskId: json.data.taskId, model }, "Đã tạo KIE task");
  return json.data.taskId;
}

// ---------- pollTask ----------

const DEFAULT_POLL_INTERVAL_MS = 5_000;

export async function pollKieTaskUntilDone(
  settings: KieTaskSettings,
  taskId: string,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
): Promise<KieTaskResult> {
  const deadline = Date.now() + timeoutMs;
  const url = `${normalizeBase(settings.baseUrl)}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`;

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);

    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${settings.apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        throw new Error(`KIE poll thất bại: HTTP ${res.status} ${body.slice(0, 200)}`);
      }
      log.warn({ taskId, status: res.status }, "KIE poll HTTP lỗi, thử lại");
      continue;
    }

    const json = (await res.json()) as {
      code?: number;
      data?: {
        taskId?: string;
        state?: string;
        resultJson?: string;
        failCode?: string;
        failMsg?: string;
      };
    };

    const state = json.data?.state ?? "unknown";

    if (state === "success") {
      let resultUrls: string[] = [];
      if (json.data?.resultJson) {
        try {
          const parsed = JSON.parse(json.data.resultJson) as {
            resultUrls?: string[];
            result_urls?: string[];
            videoUrl?: string;
            video_url?: string;
          };
          resultUrls = parsed.resultUrls ?? parsed.result_urls ??
            [parsed.videoUrl, parsed.video_url].filter((u): u is string => Boolean(u));
        } catch {
          log.warn({ taskId }, "Không parse được resultJson");
        }
      }
      log.info({ taskId, state, urls: resultUrls.length }, "KIE task hoàn thành");
      return { taskId, state, resultUrls };
    }

    if (state === "fail") {
      const failMsg = json.data?.failMsg ?? "Không rõ lý do";
      log.warn({ taskId, failCode: json.data?.failCode, failMsg }, "KIE task thất bại");
      return {
        taskId,
        state,
        resultUrls: [],
        failCode: json.data?.failCode,
        failMsg,
      };
    }

    // waiting, queuing, generating → tiếp tục poll
    log.debug({ taskId, state }, "KIE task đang xử lý");
  }

  throw new Error(`KIE task quá lâu (hơn ${Math.round(timeoutMs / 1000)} giây) nên đã dừng`);
}

// ---------- download ----------

export async function downloadKieResult(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    throw new Error(`Tải kết quả KIE thất bại: HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ---------- helpers ----------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

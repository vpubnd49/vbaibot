import { XMLParser } from "fast-xml-parser";
import { env } from "../config/env.js";
import { createLogger } from "../shared/logger.js";
import { ResearchProviderError } from "./research-provider-errors.js";

const log = createLogger("research-http");

export type RequestOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  retry?: boolean;
  signal?: AbortSignal;
};

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB
const CIRCUIT_BREAKER_COOLDOWN_MS = 30_000;
const MAX_FAILURES_BEFORE_TRIP = 3;

type CircuitBreakerState = {
  failures: number;
  lastFailureAt: number;
  openUntil: number;
};

const circuitBreakers = new Map<string, CircuitBreakerState>();
const rateLimiters = new Map<string, number>();

function checkCircuitBreaker(provider: string): void {
  const state = circuitBreakers.get(provider);
  if (!state) return;

  const now = Date.now();
  if (state.openUntil > now) {
    const waitSec = Math.ceil((state.openUntil - now) / 1000);
    throw new ResearchProviderError(
      provider,
      "rate_limited",
      `Circuit breaker đang mở cho ${provider}, vui lòng thử lại sau ${waitSec}s`,
    );
  }
}

function recordFailure(provider: string, status?: number): void {
  const now = Date.now();
  const state = circuitBreakers.get(provider) ?? { failures: 0, lastFailureAt: 0, openUntil: 0 };
  state.failures += 1;
  state.lastFailureAt = now;

  if (status === 429 || state.failures >= MAX_FAILURES_BEFORE_TRIP) {
    state.openUntil = now + CIRCUIT_BREAKER_COOLDOWN_MS;
    log.warn({ provider, failures: state.failures }, "Circuit breaker mở 30s cho provider");
  }
  circuitBreakers.set(provider, state);
}

function recordSuccess(provider: string): void {
  circuitBreakers.delete(provider);
}

async function enforceProviderRateLimit(provider: string, minIntervalMs: number): Promise<void> {
  const lastCall = rateLimiters.get(provider) ?? 0;
  const elapsed = Date.now() - lastCall;
  if (elapsed < minIntervalMs) {
    const delay = minIntervalMs - elapsed;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  rateLimiters.set(provider, Date.now());
}

export function buildUserAgent(contactEmail?: string): string {
  const email = contactEmail || env.RESEARCH_CONTACT_EMAIL || "vbaibot@example.com";
  return `VBAIBot/1.0 (https://github.com/vpubnd49/vbaibot; mailto:${email})`;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  parseTagValue: false,
});

export async function fetchWithPolicy(
  provider: string,
  url: string,
  options: RequestOptions & { minIntervalMs?: number; fetchFn?: typeof fetch } = {},
): Promise<{ status: number; text: string; headers: Headers }> {
  checkCircuitBreaker(provider);
  if (options.minIntervalMs) {
    await enforceProviderRateLimit(provider, options.minIntervalMs);
  }

  const timeoutMs = options.timeoutMs ?? env.RESEARCH_PROVIDER_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_RESPONSE_BYTES;
  const doFetch = options.fetchFn ?? fetch;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error(`Timeout ${timeoutMs}ms`)), timeoutMs);

  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort(options.signal?.reason));
  }

  const headers: Record<string, string> = {
    "User-Agent": buildUserAgent(),
    Accept: "application/json, application/xml, text/xml, text/plain, */*",
    ...options.headers,
  };

  const attempts = options.retry !== false ? 2 : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await doFetch(url, {
        headers,
        signal: controller.signal,
      });

      if (res.status === 429) {
        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) || 10 : 10;
        recordFailure(provider, 429);
        throw new ResearchProviderError(
          provider,
          "rate_limited",
          `Bị giới hạn tốc độ (HTTP 429)`,
          429,
          retryAfter,
        );
      }

      if (res.status === 401 || res.status === 403) {
        throw new ResearchProviderError(
          provider,
          "auth_required",
          `Truy cập bị từ chối hoặc cần API key (HTTP ${res.status})`,
          res.status,
        );
      }

      if (res.status >= 500) {
        recordFailure(provider, res.status);
        if (attempt < attempts) {
          // Jittered backoff 200-400ms
          await new Promise((r) => setTimeout(r, 200 + Math.random() * 200));
          continue;
        }
        throw new ResearchProviderError(
          provider,
          "upstream_error",
          `Máy chủ nguồn lỗi HTTP ${res.status}`,
          res.status,
        );
      }

      if (!res.ok && res.status !== 404) {
        throw new ResearchProviderError(
          provider,
          "upstream_error",
          `HTTP ${res.status}`,
          res.status,
        );
      }

      const text = await res.text();
      if (text.length > maxBytes) {
        throw new ResearchProviderError(
          provider,
          "invalid_response",
          `Kích thước phản hồi vượt quá ${maxBytes} bytes`,
        );
      }

      recordSuccess(provider);
      clearTimeout(timeoutId);
      return { status: res.status, text, headers: res.headers };
    } catch (err) {
      lastError = err;
      if (err instanceof ResearchProviderError) {
        clearTimeout(timeoutId);
        throw err;
      }
      if (controller.signal.aborted) {
        clearTimeout(timeoutId);
        throw new ResearchProviderError(
          provider,
          "timeout",
          `Quá thời gian chờ phản hồi (${timeoutMs}ms)`,
          undefined,
          undefined,
          err,
        );
      }
      if (attempt < attempts) {
        await new Promise((r) => setTimeout(r, 200 + Math.random() * 200));
        continue;
      }
    }
  }

  clearTimeout(timeoutId);
  recordFailure(provider);
  throw new ResearchProviderError(
    provider,
    "upstream_error",
    `Lỗi kết nối: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    undefined,
    undefined,
    lastError,
  );
}

export async function fetchJson<T>(
  provider: string,
  url: string,
  options?: RequestOptions & { minIntervalMs?: number; fetchFn?: typeof fetch },
): Promise<{ status: number; data: T }> {
  const res = await fetchWithPolicy(provider, url, {
    ...options,
    headers: { Accept: "application/json", ...options?.headers },
  });

  if (res.status === 404) {
    throw new ResearchProviderError(provider, "no_results", "Không tìm thấy dữ liệu (404)", 404);
  }

  try {
    const data = JSON.parse(res.text) as T;
    return { status: res.status, data };
  } catch (err) {
    throw new ResearchProviderError(
      provider,
      "invalid_response",
      "Phản hồi không phải JSON hợp lệ",
      res.status,
      undefined,
      err,
    );
  }
}

export async function fetchXml<T = Record<string, unknown>>(
  provider: string,
  url: string,
  options?: RequestOptions & { minIntervalMs?: number; fetchFn?: typeof fetch },
): Promise<{ status: number; data: T }> {
  const res = await fetchWithPolicy(provider, url, {
    ...options,
    headers: { Accept: "application/xml, text/xml, application/atom+xml", ...options?.headers },
  });

  if (res.status === 404) {
    throw new ResearchProviderError(provider, "no_results", "Không tìm thấy dữ liệu (404)", 404);
  }

  try {
    const data = xmlParser.parse(res.text) as T;
    return { status: res.status, data };
  } catch (err) {
    throw new ResearchProviderError(
      provider,
      "invalid_response",
      "Phản hồi không phải XML hợp lệ",
      res.status,
      undefined,
      err,
    );
  }
}

export function parseXmlString<T = Record<string, unknown>>(xmlString: string): T {
  return xmlParser.parse(xmlString) as T;
}

export function resetCircuitBreakersForTesting(): void {
  circuitBreakers.clear();
  rateLimiters.clear();
}

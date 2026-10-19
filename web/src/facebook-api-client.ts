import { request } from "./dashboard-api-client";

/** Khớp GET /api/facebook */
export type FacebookStatus = {
  session: {
    hasSession: boolean;
    userId?: string;
    savedAt?: string;
    source?: "password" | "import" | "env" | "file";
    isHardcoded?: boolean;
    cookieCount?: number;
    health: { lastCheckAt?: string; lastCheckOk?: boolean; lastError?: string };
    pendingVerification: boolean;
    browserAvailable: boolean;
  };
  pages: Array<{
    pageId: string;
    pageName: string;
    pageUrl: string;
    enabled: boolean;
    hasToken: boolean;
    lastCrawledAt: string | null;
  }>;
  totalPosts: number;
  crawlRunning: boolean;
};

export type FacebookLoginResult =
  | { status: "ok"; userId: string }
  | { status: "need_code"; message: string; pageText?: string; screenshot?: string }
  | { status: "need_approval"; message: string; pageText?: string; screenshot?: string }
  | { status: "error"; message: string };

export type FacebookVerifyMethod = "sms" | "app" | "device" | "email";

type WithResult = FacebookStatus & { result: FacebookLoginResult };

export type FacebookMonitor = Omit<FacebookStatus, "pages"> & {
  lastRun: { startedAt: string; finishedAt: string | null; totalNew: number; pagesProcessed: number } | null;
  pages: Array<
    FacebookStatus["pages"][number] & {
      posts: number;
      latestPostAt: string | null;
      lastFetchedAt: string | null;
      lastReport: { at: string; via: string; saved: number; error?: string } | null;
    }
  >;
};

export type FacebookPost = {
  postId: string;
  pageId: string;
  pageName: string;
  message: string;
  permalink: string;
  imageUrl: string | null;
  createdAt: string;
  fetchedAt: string;
  category: string;
};

export const facebookMonitorApi = {
  monitor: () => request<FacebookMonitor>("/api/facebook/monitor"),
  posts: (query: { pageId?: string; q?: string; limit?: number; offset?: number }) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") p.set(k, String(v));
    return request<{ items: FacebookPost[]; total: number }>(`/api/facebook/posts?${p.toString()}`);
  },
  crawlNow: () => request<FacebookStatus>("/api/facebook/crawl", { method: "POST" }),
  addPage: (data: { pageId: string; pageName: string; pageUrl?: string; category?: string }) =>
    request<FacebookStatus & { ok: boolean }>("/api/facebook/pages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  togglePage: (pageId: string, enabled: boolean) =>
    request<FacebookStatus & { ok: boolean }>(`/api/facebook/pages/${encodeURIComponent(pageId)}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),
  deletePage: (pageId: string) =>
    request<FacebookStatus & { ok: boolean }>(`/api/facebook/pages/${encodeURIComponent(pageId)}`, {
      method: "DELETE",
    }),
};

export const facebookApi = {
  get: () => request<FacebookStatus>("/api/facebook"),
  login: (email: string, password: string) =>
    request<WithResult>("/api/facebook/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  verify: (code?: string) =>
    request<WithResult>("/api/facebook/verify", { method: "POST", body: JSON.stringify({ code }) }),
  cancel: () => request<FacebookStatus>("/api/facebook/cancel", { method: "POST" }),
  pending: () => request<FacebookStatus & { result: FacebookLoginResult | null }>("/api/facebook/pending"),
  switchMethod: (method: FacebookVerifyMethod) =>
    request<WithResult>("/api/facebook/method", { method: "POST", body: JSON.stringify({ method }) }),
  importCookies: (cookies: string, saveHardcoded = true) =>
    request<FacebookStatus>("/api/facebook/import", {
      method: "POST",
      body: JSON.stringify({ cookies, saveHardcoded }),
    }),
  testSession: () =>
    request<FacebookStatus & { ok: boolean; error?: string }>("/api/facebook/test-session", { method: "POST" }),
  logout: () => request<FacebookStatus>("/api/facebook/session", { method: "DELETE" }),
  crawlNow: () => request<FacebookStatus>("/api/facebook/crawl", { method: "POST" }),
};

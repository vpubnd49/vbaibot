import { request } from "./dashboard-api-client";

/** Khớp LegalDocRow ở src/legal/services/legal-docs-store.ts */
export type LegalDocItem = {
  id: string;
  source: "chinhphu" | "congbao" | "vbpl" | "phapluat" | "tvpl";
  soHieu: string;
  trichYeu: string;
  loaiVb: string;
  ngayBanHanh: string;
  detailUrl: string;
  fileUrl: string;
  status: "pending" | "downloaded" | "failed" | "no_file" | "duplicate" | "purged";
  origin: "crawler" | "user";
  filePath: string | null;
  fileSize: number;
  attempts: number;
  lastError: string | null;
  discoveredAt: string;
  downloadedAt: string | null;
};

export type LegalCrawlRound = {
  startedAt: string;
  finishedAt: string;
  discovered: { chinhphu: number; congbao: number };
  newDocs: number;
  downloaded: number;
  failed: number;
  purged: { files: number; bytes: number; reason: string[] } | null;
  skippedLowDisk: boolean;
  errors: string[];
};

export type LegalDocsOverview = {
  stats: {
    total: number;
    byStatus: Record<string, number>;
    bySource: Array<{ source: string; total: number; downloaded: number; pending: number; failed: number }>;
    byOrigin: Record<string, number>;
    newToday: number;
    downloadedToday: number;
    totalBytes: number;
    latestIssued: string | null;
  };
  crawler: {
    running: boolean;
    lastRound: LegalCrawlRound | null;
    nextRunAt: string | null;
    intervalMinutes: number;
    downloadsPerRound: number;
    storageDir: string;
    storage: {
      usedBytes: number;
      maxBytes: number;
      retentionDays: number;
      minFreeBytes: number;
      diskFreeBytes: number | null;
    };
  };
  recent: LegalDocItem[];
  province?: {
    qpplCount: number;
    thanhtraCount: number;
    syncRunning: boolean;
  };
};

export type LegalDocsListQuery = { status?: string; source?: string; q?: string; limit?: number; offset?: number };

export const legalDocsApi = {
  overview: () => request<LegalDocsOverview>("/api/legal-docs"),
  list: (query: LegalDocsListQuery) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") p.set(k, String(v));
    return request<{ items: LegalDocItem[]; total: number }>(`/api/legal-docs/list?${p.toString()}`);
  },
  crawl: () => request<{ ok: boolean; started: boolean; message?: string }>("/api/legal-docs/crawl", { method: "POST" }),
  syncProvince: () =>
    request<{ ok: boolean; started: boolean; message?: string }>("/api/legal-docs/sync-province", { method: "POST" }),
  retry: (id: string) => request<{ ok: boolean }>(`/api/legal-docs/retry/${encodeURIComponent(id)}`, { method: "POST" }),
  retryFailed: () => request<{ ok: boolean; count: number }>("/api/legal-docs/retry-failed", { method: "POST" }),
  purge: () => request<{ ok: boolean; files: number; bytes: number; reason: string[] }>("/api/legal-docs/purge", { method: "POST" }),
  fileUrl: (id: string) => `/api/legal-docs/file/${encodeURIComponent(id)}`,
};

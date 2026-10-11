import { request } from "./dashboard-api-client";

/** Cấu hình + trạng thái NotebookLM (khớp GET /api/notebooklm) */
export type NotebooklmStatus = {
  enabled: boolean;
  apiUrl: string;
  publicAccess: boolean;
  maxPerDay: number;
  maxPerDayGlobal: number;
  configured: boolean;
  server: { online: boolean; authenticated: boolean; error?: string };
  usedToday: number;
  notebooks: number;
  login: { running: boolean; startedAt?: string; result?: string };
};

export type NotebooklmUpdate = Partial<
  Pick<NotebooklmStatus, "enabled" | "apiUrl" | "publicAccess" | "maxPerDay" | "maxPerDayGlobal">
>;

export const notebooklmApi = {
  get: () => request<NotebooklmStatus>("/api/notebooklm"),
  update: (update: NotebooklmUpdate) =>
    request<NotebooklmStatus & { ok: true }>("/api/notebooklm", {
      method: "PATCH",
      body: JSON.stringify(update),
    }),
  /** Mở Chrome trên màn hình noVNC để Admin đăng nhập Google (chạy nền) */
  login: () => request<{ ok: true; login: NotebooklmStatus["login"] }>("/api/notebooklm/login", { method: "POST" }),
};

/** Màn hình Chrome của máy chủ, đi qua proxy có kiểm phiên dashboard */
export const NOVNC_URL = "/novnc/vnc.html?path=novnc/websockify&autoconnect=1&resize=scale&reconnect=1";

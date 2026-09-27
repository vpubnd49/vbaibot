import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  listActiveAlerts,
  getHighestAlertLevel,
  countActiveAlerts,
} from "../../realtime/disaster/disaster-alert-store.js";

/**
 * /api/disaster-alerts - API CÔNG KHAI (không cần đăng nhập)
 *
 * Cung cấp dữ liệu cảnh báo thiên tai realtime cho các hệ thống bên ngoài
 * (trang du lịch, app mobile...) embed widget cảnh báo.
 *
 * CORS mở để các frontend khác domain gọi được.
 */
export const disasterAlertPublicRoutes = new Hono();

// Cho phép cross-origin từ các domain dulich, tracuu...
disasterAlertPublicRoutes.use(
  "/*",
  cors({
    origin: [
      "https://dulich.tracuu.lamdong.vn",
      "https://dulich.chauphienbanso.com",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    allowMethods: ["GET"],
    maxAge: 300,
  }),
);

const LEVEL_LABEL: Record<string, string> = {
  green: "Bình thường",
  yellow: "Theo dõi",
  orange: "Cảnh báo",
  red: "KHẨN CẤP",
};

const TYPE_LABEL: Record<string, string> = {
  landslide: "Sạt lở",
  storm: "Mưa bão",
  flood: "Ngập lụt",
  reservoir: "Hồ đập / Xả lũ",
  road_block: "Giao thông đèo",
  general: "Thiên tai",
};

disasterAlertPublicRoutes.get("/", (c) => {
  const level = getHighestAlertLevel();
  const total = countActiveAlerts();
  const alerts = listActiveAlerts(10).map((a) => ({
    id: a.id,
    type: a.type,
    typeLabel: TYPE_LABEL[a.type] ?? a.type,
    level: a.level,
    levelLabel: LEVEL_LABEL[a.level] ?? a.level,
    title: a.title,
    summary: a.summary,
    area: a.area,
    sourceName: a.sourceName,
    sourceUrl: a.sourceUrl,
    publishedAt: a.publishedAt,
    createdAt: a.createdAt,
  }));

  return c.json({
    ok: true,
    highestLevel: level,
    highestLevelLabel: LEVEL_LABEL[level] ?? level,
    totalActive: total,
    alerts,
    updatedAt: new Date().toISOString(),
  });
});

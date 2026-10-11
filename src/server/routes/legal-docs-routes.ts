/**
 * legal-docs-routes.ts — /api/legal-docs
 * Dashboard "Kho văn bản pháp luật": thống kê đã cào / chờ tải / đã tải,
 * kích hoạt cào ngay, tải lại lỗi, tải file đã lưu.
 */
import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { dataDir } from "../../config/env.js";
import { enforceLegalStoragePolicy, getLegalCrawlerState, runLegalCrawlRound } from "../../legal/services/legal-docs-crawler.js";
import {
  getLegalDoc,
  getLegalDocsStats,
  listLegalDocs,
  retryAllFailedLegalDocs,
  retryLegalDoc,
} from "../../legal/services/legal-docs-store.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("legal-docs-routes");

export const legalDocsRoutes = new Hono();

legalDocsRoutes.get("/", (c) => {
  return c.json({
    stats: getLegalDocsStats(),
    crawler: getLegalCrawlerState(),
    recent: listLegalDocs({ limit: 10 }).items,
  });
});

legalDocsRoutes.get("/list", (c) => {
  const q = c.req.query();
  return c.json(
    listLegalDocs({
      status: q.status || undefined,
      source: q.source || undefined,
      q: q.q || undefined,
      limit: q.limit ? Number(q.limit) : 50,
      offset: q.offset ? Number(q.offset) : 0,
    }),
  );
});

legalDocsRoutes.post("/crawl", (c) => {
  if (getLegalCrawlerState().running) return c.json({ ok: true, started: false, message: "Đang có lượt cào chạy" });
  void runLegalCrawlRound().catch((err) => log.error({ err }, "Manual legal crawl failed"));
  return c.json({ ok: true, started: true });
});

legalDocsRoutes.post("/retry-failed", (c) => {
  return c.json({ ok: true, count: retryAllFailedLegalDocs() });
});

// Dọn ngay theo chính sách (quá hạn / vượt dung lượng)
legalDocsRoutes.post("/purge", (c) => {
  return c.json({ ok: true, ...enforceLegalStoragePolicy() });
});

legalDocsRoutes.post("/retry/:id", (c) => {
  const id = decodeURIComponent(c.req.param("id"));
  if (!getLegalDoc(id)) return c.json({ error: "Không tìm thấy văn bản" }, 404);
  retryLegalDoc(id);
  return c.json({ ok: true });
});

legalDocsRoutes.get("/file/:id", (c) => {
  const doc = getLegalDoc(decodeURIComponent(c.req.param("id")));
  if (!doc?.filePath) return c.json({ error: "Văn bản chưa có file" }, 404);
  const resolved = path.resolve(doc.filePath);
  const allowedRoots = [path.resolve(dataDir), path.resolve(process.cwd(), "data")];
  if (!allowedRoots.some((root) => resolved.startsWith(root + path.sep))) {
    return c.json({ error: "Đường dẫn file không hợp lệ" }, 403);
  }
  if (!fs.existsSync(resolved)) return c.json({ error: "File không còn trên máy chủ" }, 404);
  const ext = path.extname(resolved).toLowerCase();
  const type = ext === ".pdf"
    ? "application/pdf"
    : ext === ".docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/msword";
  const name = path.basename(resolved);
  const body = fs.readFileSync(resolved);
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(body.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
});

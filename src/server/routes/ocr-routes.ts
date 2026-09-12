/**
 * ocr-routes.ts
 * API endpoints cho tính năng OCR hàng loạt file qua Dashboard:
 *
 * POST /api/ocr/upload   - Upload nhiều file (multipart/form-data)
 *                          Lưu vào data/shared-files/ocr-{sessionId}/
 *                          Trả về: { sessionId, files: string[], folderPath }
 *
 * POST /api/ocr/run      - Chạy batch OCR cho session đã upload
 *                          Trả về file Excel/Word/CSV ngay trong response
 *
 * DELETE /api/ocr/:sessionId - Dọn dẹp thư mục session
 */
import { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createLogger } from "../../shared/logger.js";
import { dataDir } from "../../config/env.js";
import { batchOcr } from "../../documents/batch-ocr-engine.js";
import { renderXlsxFromRows } from "../../documents/render-xlsx-from-rows.js";
import { renderDocxFromPages } from "../../documents/render-docx-from-pages.js";
import { renderCsvFromRows } from "../../documents/render-text-documents.js";
import { renderPdf } from "../../documents/render-pdf.js";

const log = createLogger("ocr-routes");

// Thư mục gốc lưu session upload OCR
function getOcrUploadDir(): string {
  const dir = path.join(dataDir, "shared-files", "ocr-uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Kích thước tối đa 1 file: 100 MB
const MAX_FILE_BYTES = 100 * 1024 * 1024;
// Số file tối đa 1 session: 200
const MAX_FILES_PER_SESSION = 200;

// Ext được phép upload (bao gồm .zip để upload thư mục nén)
const ALLOWED_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".heic", ".webp",
  ".pdf", ".docx", ".doc", ".xlsx", ".xls", ".ods", ".csv", ".txt", ".md",
  ".zip",  // Thư mục nén — batch-ocr-engine tự giải nén khi OCR
]);

function sanitizeName(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
}

export const ocrRoutes = new Hono()

  /**
   * POST /api/ocr/upload
   * Nhận multipart/form-data với field "files[]" (nhiều file).
   * Lưu vào data/shared-files/ocr-uploads/{sessionId}/
   */
  .post("/upload", async (c) => {
    try {
      const formData = await c.req.formData();
      const uploadedFiles = formData.getAll("files[]") as File[];

      if (!uploadedFiles.length) {
        return c.json({ error: "Không có file nào được gửi lên (field: files[])" }, 400);
      }
      if (uploadedFiles.length > MAX_FILES_PER_SESSION) {
        return c.json({ error: `Quá nhiều file, tối đa ${MAX_FILES_PER_SESSION} file mỗi lần` }, 400);
      }

      // Tạo session directory
      const sessionId = crypto.randomBytes(8).toString("hex");
      const sessionDir = path.join(getOcrUploadDir(), sessionId);
      fs.mkdirSync(sessionDir, { recursive: true });

      const savedFiles: string[] = [];
      const errors: string[] = [];

      for (const file of uploadedFiles) {
        const ext = path.extname(file.name).toLowerCase();
        if (!ALLOWED_EXTS.has(ext)) {
          errors.push(`${file.name}: định dạng không hỗ trợ (${ext})`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          errors.push(`${file.name}: file quá lớn (${Math.round(file.size / 1024 / 1024)} MB > 100 MB)`);
          continue;
        }

        const safeName = sanitizeName(file.name);
        const destPath = path.join(sessionDir, safeName);

        const arrayBuf = await file.arrayBuffer();
        fs.writeFileSync(destPath, Buffer.from(arrayBuf));
        savedFiles.push(safeName);
        log.info({ sessionId, file: safeName, bytes: file.size }, "File OCR đã upload");
      }

      if (savedFiles.length === 0) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        return c.json({ error: "Không lưu được file nào. Lỗi: " + errors.join("; ") }, 400);
      }

      return c.json({
        sessionId,
        folderPath: sessionDir,  // Trả về để tool agent biết đường dẫn
        files: savedFiles,
        totalFiles: savedFiles.length,
        warnings: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      log.error({ err }, "Lỗi upload file OCR");
      return c.json({ error: `Upload thất bại: ${err instanceof Error ? err.message : String(err)}` }, 500);
    }
  })

  /**
   * POST /api/ocr/run
   * Body JSON: {
   *   sessionId: string,
   *   ocrMode: "table" | "text" | "auto",
   *   outputFormat: "excel" | "word" | "csv" | "pdf" | "txt",
   *   sortBy?: "score_desc" | "score_asc" | "name_asc" | "none",
   *   sortColumn?: string,
   *   dedupKey?: string,
   *   customPrompt?: string,
   *   outputFileName?: string,
   * }
   * Trả về file binary với Content-Disposition để trình duyệt tải xuống.
   */
  .post("/run", async (c) => {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Body phải là JSON" }, 400);
    }

    const { sessionId, ocrMode = "auto", outputFormat = "excel",
            sortBy = "none", sortColumn, dedupKey, customPrompt, outputFileName } = body ?? {};

    if (!sessionId || typeof sessionId !== "string" || !/^[a-f0-9]{16}$/.test(sessionId)) {
      return c.json({ error: "sessionId không hợp lệ" }, 400);
    }

    const sessionDir = path.join(getOcrUploadDir(), sessionId);
    if (!fs.existsSync(sessionDir)) {
      return c.json({ error: `Session "${sessionId}" không tồn tại hoặc đã hết hạn` }, 404);
    }

    try {
      log.info({ sessionId, ocrMode, outputFormat, sortBy }, "Bắt đầu OCR session");

      const { rows, text, stats } = await batchOcr(
        { kind: "folder", folderPath: sessionDir },
        { mode: ocrMode, prompt: customPrompt, concurrency: 3, sortBy, sortColumn, dedupKey },
      );

      const ts = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
      const baseName = (outputFileName ?? `OCR_${ts}`).replace(/\.[a-z]+$/i, "");

      let data: Buffer;
      let ext: string;
      let mimeType: string;

      switch (outputFormat) {
        case "excel":
          if (rows.length === 0) {
            return c.json({
              error: "Không trích xuất được bảng dữ liệu từ các file. Thử ocrMode=text.",
              stats,
            }, 422);
          }
          data = await renderXlsxFromRows(rows, { title: baseName, sortColumn });
          ext = "xlsx";
          mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          break;

        case "word":
          const pages = text
            ? [{ filename: "OCR", text }]
            : rows.map((r, i) => ({
                filename: `Mục ${i + 1}`,
                text: Object.entries(r).map(([k, v]) => `${k}: ${v ?? ""}`).join("\n"),
              }));
          data = await renderDocxFromPages(pages, { title: baseName });
          ext = "docx";
          mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          break;

        case "csv":
          if (rows.length === 0) {
            return c.json({ error: "Không có dữ liệu bảng để xuất CSV. Thử outputFormat=txt.", stats }, 422);
          }
          data = renderCsvFromRows(rows);
          ext = "csv";
          mimeType = "text/csv; charset=utf-8";
          break;

        case "pdf":
          const sections = text
            ? [{ title: baseName, paragraphs: text.split("\n").filter(l => l.trim()) }]
            : rows.map((r, i) => ({ title: `Mục ${i + 1}`, paragraphs: Object.entries(r).map(([k, v]) => `${k}: ${v ?? ""}`) }));
          data = renderPdf(baseName, sections);
          ext = "pdf";
          mimeType = "application/pdf";
          break;

        default: // txt
          data = Buffer.from(text || rows.map(r => Object.values(r).join("\t")).join("\n"), "utf-8");
          ext = "txt";
          mimeType = "text/plain; charset=utf-8";
      }

      const fileName = `${baseName}.${ext}`;
      log.info({ sessionId, fileName, bytes: data.length, stats }, "OCR run xong");

      return new Response(data, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          "X-OCR-Stats": JSON.stringify(stats),
          "Content-Length": String(data.length),
        },
      });
    } catch (err) {
      log.error({ err, sessionId }, "OCR run lỗi");
      return c.json({ error: `OCR thất bại: ${err instanceof Error ? err.message : String(err)}` }, 500);
    }
  })

  /**
   * DELETE /api/ocr/:sessionId
   * Dọn dẹp thư mục session sau khi tải xong.
   */
  .delete("/:sessionId", (c) => {
    const sessionId = c.req.param("sessionId");
    if (!/^[a-f0-9]{16}$/.test(sessionId)) {
      return c.json({ error: "sessionId không hợp lệ" }, 400);
    }
    const sessionDir = path.join(getOcrUploadDir(), sessionId);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        log.info({ sessionId }, "OCR session đã dọn dẹp");
      }
      return c.json({ ok: true });
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

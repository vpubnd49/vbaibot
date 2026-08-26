import { tool } from "ai";
import { z } from "zod";
import { getFetchSettings } from "../../config/runtime-tool-settings.js";
import { extractHtmlTitle, htmlToReadableText } from "../../shared/html-to-text.js";
import { fetchViaJinaReader } from "../../shared/jina-reader-fallback.js";
import { createLogger } from "../../shared/logger.js";
import { downloadFromPublicUrl } from "../../shared/safe-remote-download.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { wrapUntrustedContent } from "./wrap-untrusted-content.js";
import { getTuning } from "../../config/runtime-tuning-settings.js";

// HTML 3MB là quá đủ cho trang tin/bài viết; cap TRƯỚC khi parse để trang
// khổng lồ không ăn RAM. Text trả cho model cap riêng (WEB_FETCH_MAX_CHARS)
// để không phình context.
const MAX_HTML_BYTES = 3 * 1024 * 1024;

/**
 * Dưới ngưỡng này coi như "fetch được nhưng rỗng" - trang render bằng
 * JavaScript hay ra vài chục ký tự khung sườn. Đáng để thử lại qua Jina.
 */
const TOO_LITTLE_TEXT = 200;

const log = createLogger("web-fetch");

const ALLOWED_MIME_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "text/plain",
  "text/xml",
  "application/xml",
  "application/json",
  "text/markdown",
  "text/csv",
]);

const SENSITIVE_QUERY_PARAMS = new Set([
  "token",
  "access_token",
  "auth",
  "api_key",
  "apikey",
  "secret",
  "signature",
  "sig",
  "key",
  "code",
  "credential",
  "password",
  "pwd",
]);

/** Kiểm tra buffer xem có phải binary (chứa null byte \0) không */
function isBinaryBuffer(buf: Buffer): boolean {
  const checkLen = Math.min(buf.length, 512);
  for (let i = 0; i < checkLen; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

/** Chặn gửi URL chứa token/auth/userinfo sang dịch vụ bên thứ ba */
export function isSafeForExternalReader(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    for (const key of u.searchParams.keys()) {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) return false;
    }
    return true;
  } catch {
    return false;
  }
}

type FetchedPage = { text: string; title: string; via: "truc-tiep" | "jina-reader" };

/** Tự fetch: nhanh, riêng tư, miễn phí. Hỏng thì trả null để rơi xuống lưới đỡ. */
async function fetchDirect(url: string): Promise<FetchedPage | null> {
  try {
    const file = await downloadFromPublicUrl(url, { maxBytes: MAX_HTML_BYTES });
    const mime = file.mediaType.toLowerCase();

    // Từ chối nội dung binary rõ ràng (ảnh, video, zip...)
    if (mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/")) {
      log.debug({ url, mime }, "Bỏ qua file binary");
      return null;
    }

    // Với octet-stream hoặc type lạ, kiểm tra byte đầu xem có phải binary không
    if (!ALLOWED_MIME_TYPES.has(mime) && !mime.includes("html") && !mime.includes("text") && !mime.includes("xml")) {
      if (isBinaryBuffer(file.data)) {
        log.debug({ url, mime }, "Nội dung sniff thấy binary, bỏ qua");
        return null;
      }
    }

    const isHtml = mime.includes("html") || mime === "application/xhtml+xml" || (!ALLOWED_MIME_TYPES.has(mime) && file.data.toString("utf-8", 0, 100).includes("<html"));
    const raw = file.data.toString("utf-8");
    const text = isHtml ? htmlToReadableText(raw) : raw.trim();
    if (text.length < TOO_LITTLE_TEXT) {
      log.debug({ url, length: text.length }, "Fetch trực tiếp ra quá ít chữ");
      return null;
    }
    return { text, title: isHtml ? extractHtmlTitle(raw) : "", via: "truc-tiep" };
  } catch (err) {
    log.debug({ url, err }, "Fetch trực tiếp thất bại");
    return null;
  }
}

/**
 * Đọc nội dung 1 URL cho agent theo chuỗi 2 tầng (pattern ExtractorChain của
 * GoClaw): tự fetch trước cho nhanh và riêng tư, hỏng hoặc ra quá ít chữ thì
 * đẩy qua Jina Reader - dịch vụ này render được trang JavaScript và qua được
 * một phần chặn bot.
 *
 * Tầng tự fetch đi qua safe-remote-download nên thừa hưởng toàn bộ guard SSRF.
 * Tầng Jina gửi URL ra bên thứ ba, tắt được bằng WEB_FETCH_FALLBACK_ENABLED.
 */
export function createWebFetchTool() {
  return tool({
    description:
      "Đọc nội dung văn bản của 1 trang web theo URL (http/https công khai). Dùng sau web_search để đọc chi tiết, hoặc khi người dùng gửi link. Trang cần đăng nhập thì không đọc được.",
    inputSchema: z.object({
      url: z.string().url().describe("URL đầy đủ, vd https://example.com/bai-viet"),
    }),
    execute: async ({ url }) => {
      const maxChars = getTuning("WEB_FETCH_MAX_CHARS");
      const fetchSettings = getFetchSettings();

      // Đọc lại mỗi lượt - bật/tắt bậc 2 trên dashboard có hiệu lực ngay
      let page = await fetchDirect(url);
      if (!page && fetchSettings.fallbackEnabled) {
        if (isSafeForExternalReader(url)) {
          const jina = await fetchViaJinaReader(url, {
            maxChars,
            apiKey: fetchSettings.jinaApiKey || undefined,
          });
          if (jina) page = { ...jina, via: "jina-reader" };
        } else {
          log.debug({ url }, "URL chứa thông tin nhạy cảm/userinfo, bỏ qua Jina Reader fallback");
        }
      }

      if (!page) {
        return ketQuaLoi(
          `Không đọc được trang ${url}. Trang có thể chặn bot hoặc yêu cầu đăng nhập - thử một nguồn khác.`,
        );
      }

      log.info({ url, via: page.via, length: page.text.length }, "Đã đọc trang web");

      const truncated = page.text.length > maxChars;
      const body = truncated
        ? `${page.text.slice(0, maxChars)}\n[...đã cắt bớt, trang còn dài]`
        : page.text;

      return wrapUntrustedContent(body, `${url}${page.title ? ` - ${page.title}` : ""}`);
    },
  });
}

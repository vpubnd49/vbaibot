import { stripHtmlTags } from "../../shared/html-to-text.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("rss-crawler");

export type RssItem = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Trích xuất các thẻ XML đơn giản từ RSS Feed (Item/Title/Link/PubDate/Description)
 */
export function parseRssXml(xml: string, sourceName: string, maxItems: number = 5): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
    const itemContent = match[1]!;

    const titleMatch = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(itemContent);
    const linkMatch = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(itemContent);
    const dateMatch = /<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i.exec(itemContent);
    const descMatch = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i.exec(itemContent);

    const title = titleMatch ? stripHtmlTags(titleMatch[1]!).trim() : "";
    const link = linkMatch ? linkMatch[1]!.trim() : "";
    const pubDate = dateMatch ? dateMatch[1]!.trim() : "";
    const description = descMatch ? stripHtmlTags(descMatch[1]!).trim() : "";

    if (title && link) {
      items.push({
        title,
        link,
        pubDate,
        description,
        source: sourceName,
      });
    }
  }

  return items;
}

/**
 * Cào dữ liệu từ 1 RSS endpoint với timeout và header tiêu chuẩn
 */
export async function crawlRssFeed(
  url: string,
  sourceName: string,
  maxItems: number = 5,
  fetchFn: typeof fetch = fetch,
): Promise<RssItem[]> {
  try {
    const res = await fetchFn(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      throw new Error(`RSS feed trả HTTP ${res.status}`);
    }

    const text = await res.text();
    return parseRssXml(text, sourceName, maxItems);
  } catch (err) {
    log.warn({ err, url, sourceName }, "Lỗi khi cào RSS Feed");
    return [];
  }
}

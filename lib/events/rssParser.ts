/**
 * Minimal RSS/Atom feed parser. Extracts items from XML feeds
 * without requiring a third-party dependency.
 */

export interface RssFeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
  guid: string | null;
}

export interface RssFeedResult {
  feedTitle: string;
  items: RssFeedItem[];
}

function extractTag(xml: string, tag: string): string {
  const open = new RegExp(`<${tag}[^>]*>`, "i");
  const close = new RegExp(`</${tag}>`, "i");
  const openMatch = open.exec(xml);
  if (!openMatch) return "";
  const startContent = openMatch.index + openMatch[0].length;
  const closeMatch = close.exec(xml.slice(startContent));
  if (!closeMatch) return "";
  return xml.slice(startContent, startContent + closeMatch.index).trim();
}

function extractCdata(text: string): string {
  const m = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(text.trim());
  return m ? m[1] : text;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractAllBetween(xml: string, tag: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(
    `<${tag}[^>]*>([\\s\\S]*?)</${tag}>`,
    "gi",
  );
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1]);
  }
  return results;
}

function parseItem(itemXml: string): RssFeedItem {
  const title = extractCdata(extractTag(itemXml, "title"));
  const link =
    extractCdata(extractTag(itemXml, "link")) ||
    (itemXml.match(/<link[^>]+href="([^"]+)"/i)?.[1] ?? "");
  const description = stripHtml(
    extractCdata(
      extractTag(itemXml, "description") ||
        extractTag(itemXml, "summary") ||
        extractTag(itemXml, "content"),
    ),
  );
  const pubDate =
    extractTag(itemXml, "pubDate") ||
    extractTag(itemXml, "published") ||
    extractTag(itemXml, "updated") ||
    null;
  const guid =
    extractTag(itemXml, "guid") || extractTag(itemXml, "id") || null;

  return { title, link, description, pubDate, guid };
}

export function parseRssFeed(xml: string): RssFeedResult {
  const feedTitle =
    extractCdata(extractTag(xml, "title")) || "Untitled Feed";

  const itemBlocks = extractAllBetween(xml, "item");
  const entryBlocks = extractAllBetween(xml, "entry");

  const items = [...itemBlocks, ...entryBlocks].map(parseItem);

  return { feedTitle, items };
}

export function rssItemsToText(result: RssFeedResult): string {
  const lines: string[] = [`Feed: ${result.feedTitle}`, ""];
  for (const item of result.items) {
    lines.push(`Title: ${item.title}`);
    if (item.link) lines.push(`Link: ${item.link}`);
    if (item.pubDate) lines.push(`Date: ${item.pubDate}`);
    if (item.description)
      lines.push(`Description: ${item.description.slice(0, 1000)}`);
    lines.push("---");
  }
  return lines.join("\n");
}

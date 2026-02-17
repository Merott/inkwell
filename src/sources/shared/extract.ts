import type * as cheerio from "cheerio";
import type { EmbedPlatform } from "../../schema/types.ts";

export function extractJsonLd($: cheerio.CheerioAPI): any {
  let result: any = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "");
      if (data["@type"] === "NewsArticle" || data["@type"] === "Article") {
        result = data;
      }
    } catch {
      // skip malformed JSON-LD
    }
  });
  return result;
}

export function extractOgTags(
  $: cheerio.CheerioAPI,
): Record<string, string> {
  const tags: Record<string, string> = {};
  $("meta[property^='og:']").each((_, el) => {
    const prop = $(el).attr("property");
    const content = $(el).attr("content");
    if (prop && content) tags[prop] = content;
  });
  return tags;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function ensureIso(date: string): string {
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(date)) {
    if (!date.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(date)) {
      return `${date}Z`;
    }
    return new Date(date).toISOString();
  }
  return new Date(date).toISOString();
}

const EMBED_PATTERNS: [RegExp, EmbedPlatform][] = [
  [/youtube\.com|youtu\.be/, "youtube"],
  [/vimeo\.com/, "vimeo"],
  [/dailymotion\.com/, "dailymotion"],
  [/facebook\.com|fb\.watch/, "facebook"],
  [/instagram\.com/, "instagram"],
  [/tiktok\.com/, "tiktok"],
  [/twitter\.com|x\.com/, "x"],
];

export function detectEmbedPlatform(url: string): EmbedPlatform {
  for (const [pattern, platform] of EMBED_PATTERNS) {
    if (pattern.test(url)) return platform;
  }
  return "other";
}

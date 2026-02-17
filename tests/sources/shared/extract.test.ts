import { describe, expect, it } from "bun:test";
import * as cheerio from "cheerio";
import {
  detectEmbedPlatform,
  ensureIso,
  escapeHtml,
  extractJsonLd,
  extractOgTags,
} from "../../../src/sources/shared/extract.ts";

// --- extractJsonLd ---

describe("extractJsonLd", () => {
  it("extracts NewsArticle JSON-LD", () => {
    const $ = cheerio.load(`
      <script type="application/ld+json">{"@type":"NewsArticle","headline":"Test"}</script>
    `);
    const result = extractJsonLd($);
    expect(result).toEqual({ "@type": "NewsArticle", headline: "Test" });
  });

  it("extracts Article JSON-LD", () => {
    const $ = cheerio.load(`
      <script type="application/ld+json">{"@type":"Article","headline":"Test"}</script>
    `);
    const result = extractJsonLd($);
    expect(result).toEqual({ "@type": "Article", headline: "Test" });
  });

  it("ignores non-article JSON-LD types", () => {
    const $ = cheerio.load(`
      <script type="application/ld+json">{"@type":"WebSite","name":"Test"}</script>
    `);
    expect(extractJsonLd($)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    const $ = cheerio.load(`
      <script type="application/ld+json">{not valid json</script>
    `);
    expect(extractJsonLd($)).toBeNull();
  });

  it("returns null when no JSON-LD present", () => {
    const $ = cheerio.load("<html><head></head><body></body></html>");
    expect(extractJsonLd($)).toBeNull();
  });

  it("selects Article over non-article when multiple JSON-LD blocks exist", () => {
    const $ = cheerio.load(`
      <script type="application/ld+json">{"@type":"WebSite","name":"Site"}</script>
      <script type="application/ld+json">{"@type":"Article","headline":"Found"}</script>
    `);
    const result = extractJsonLd($);
    expect(result?.headline).toBe("Found");
  });
});

// --- extractOgTags ---

describe("extractOgTags", () => {
  it("extracts og: meta tags", () => {
    const $ = cheerio.load(`
      <meta property="og:title" content="My Title">
      <meta property="og:description" content="My Desc">
      <meta property="og:image" content="https://example.com/img.jpg">
    `);
    const tags = extractOgTags($);
    expect(tags["og:title"]).toBe("My Title");
    expect(tags["og:description"]).toBe("My Desc");
    expect(tags["og:image"]).toBe("https://example.com/img.jpg");
  });

  it("returns empty object when no og tags", () => {
    const $ = cheerio.load("<html><head></head></html>");
    expect(extractOgTags($)).toEqual({});
  });

  it("skips meta tags without content", () => {
    const $ = cheerio.load(`<meta property="og:title">`);
    expect(extractOgTags($)).toEqual({});
  });
});

// --- escapeHtml ---

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("handles empty strings", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("handles strings with no special characters", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

// --- ensureIso ---

describe("ensureIso", () => {
  it("returns ISO string with Z suffix unchanged", () => {
    const iso = "2026-02-10T12:00:00.000Z";
    expect(ensureIso(iso)).toBe(iso);
  });

  it("appends Z to ISO strings without timezone", () => {
    expect(ensureIso("2026-02-10T12:00:00")).toBe("2026-02-10T12:00:00Z");
  });

  it("converts ISO strings with timezone offset", () => {
    const result = ensureIso("2026-02-10T12:00:00+00:00");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("converts non-ISO date strings", () => {
    const result = ensureIso("February 10, 2026");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// --- detectEmbedPlatform ---

describe("detectEmbedPlatform", () => {
  it("detects YouTube", () => {
    expect(detectEmbedPlatform("https://www.youtube.com/embed/abc")).toBe(
      "youtube",
    );
    expect(detectEmbedPlatform("https://youtu.be/abc")).toBe("youtube");
  });

  it("detects Vimeo", () => {
    expect(detectEmbedPlatform("https://player.vimeo.com/video/123")).toBe(
      "vimeo",
    );
  });

  it("detects Dailymotion", () => {
    expect(
      detectEmbedPlatform("https://www.dailymotion.com/embed/video/abc"),
    ).toBe("dailymotion");
  });

  it("detects Facebook", () => {
    expect(
      detectEmbedPlatform("https://www.facebook.com/plugins/video.php"),
    ).toBe("facebook");
    expect(detectEmbedPlatform("https://fb.watch/abc")).toBe("facebook");
  });

  it("detects Instagram", () => {
    expect(
      detectEmbedPlatform("https://www.instagram.com/p/abc/embed"),
    ).toBe("instagram");
  });

  it("detects TikTok", () => {
    expect(
      detectEmbedPlatform("https://www.tiktok.com/embed/v2/abc"),
    ).toBe("tiktok");
  });

  it("detects X/Twitter", () => {
    expect(
      detectEmbedPlatform("https://platform.twitter.com/embed/Tweet.html"),
    ).toBe("x");
    expect(
      detectEmbedPlatform("https://platform.x.com/embed/Tweet.html"),
    ).toBe("x");
  });

  it("returns other for unknown URLs", () => {
    expect(detectEmbedPlatform("https://example.com/embed")).toBe("other");
  });
});

import { describe, expect, it } from "bun:test";
import { ghostSource } from "../../src/sources/ghost.ts";
import { validateArticle } from "../../src/schema/validate.ts";

const FIXTURE_URL = "https://www.404media.co/test-ghost-article/";

const fixtureHtml = await Bun.file(
  `${import.meta.dir}/../fixtures/ghost/article.html`,
).text();

// --- matches ---

describe("matches", () => {
  it("matches 404media.co URLs", () => {
    expect(
      ghostSource.matches("https://www.404media.co/some-article/"),
    ).toBe(true);
    expect(ghostSource.matches("https://404media.co/some-article/")).toBe(
      true,
    );
    expect(
      ghostSource.matches("http://www.404media.co/another-post/"),
    ).toBe(true);
  });

  it("rejects non-Ghost publisher URLs", () => {
    expect(ghostSource.matches("https://bbc.co.uk/news/article")).toBe(false);
    expect(ghostSource.matches("https://example.com")).toBe(false);
    expect(ghostSource.matches("https://www.itv.com/news/test")).toBe(false);
  });
});

// --- parse ---

describe("parse", () => {
  const article = ghostSource.parse(fixtureHtml, FIXTURE_URL);

  it("passes schema validation", () => {
    expect(() => validateArticle(article)).not.toThrow();
  });

  // Source

  it("sets source fields", () => {
    expect(article.source).toMatchObject({
      url: FIXTURE_URL,
      publisherId: "404-media",
      cmsType: "ghost",
      ingestionMethod: "scrape",
    });
  });

  it("extracts canonical URL", () => {
    expect(article.source.canonicalUrl).toBe(
      "https://www.404media.co/test-ghost-article/",
    );
  });

  // Metadata

  it("extracts title from JSON-LD", () => {
    expect(article.metadata.title).toBe(
      "The Future of Independent Tech Journalism",
    );
  });

  it("extracts publishedAt as ISO datetime", () => {
    expect(article.metadata.publishedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });

  it("extracts modifiedAt from JSON-LD", () => {
    expect(article.metadata.modifiedAt).toBeDefined();
    expect(article.metadata.modifiedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });

  it("extracts thumbnail with dimensions", () => {
    expect(article.metadata.thumbnail).toBeDefined();
    expect(article.metadata.thumbnail!.url).toContain("test-hero.jpg");
    expect(article.metadata.thumbnail!.width).toBe(1200);
    expect(article.metadata.thumbnail!.height).toBe(675);
  });

  it("extracts keywords from JSON-LD", () => {
    expect(article.metadata.keywords).toEqual([
      "Journalism",
      "Technology",
      "Media",
    ]);
  });

  it("extracts tags from body classes", () => {
    expect(article.metadata.tags).toBeDefined();
    expect(article.metadata.tags).toContain("journalism");
    expect(article.metadata.tags).toContain("technology");
  });

  it("extracts excerpt from JSON-LD description", () => {
    expect(article.metadata.excerpt).toContain("small newsrooms");
  });

  it("extracts language", () => {
    expect(article.metadata.language).toBe("en");
  });

  // Authors

  it("extracts author from JSON-LD", () => {
    expect(article.authors).toHaveLength(1);
    expect(article.authors[0]!.name).toBe("Jason Koebler");
  });

  it("extracts author URL", () => {
    expect(article.authors[0]!.url).toContain("jason-koebler");
  });

  // Body

  it("produces non-empty body", () => {
    expect(article.body.length).toBeGreaterThan(0);
  });

  it("contains paragraphs with html format", () => {
    const paragraphs = article.body.filter((c) => c.type === "paragraph");
    expect(paragraphs.length).toBeGreaterThan(0);
    expect((paragraphs[0] as any).format).toBe("html");
  });

  it("preserves links in paragraphs", () => {
    const paragraphs = article.body
      .filter((c) => c.type === "paragraph")
      .map((c) => (c as any).text);
    const hasLink = paragraphs.some((t: string) => t.includes("<a href="));
    expect(hasLink).toBe(true);
  });

  it("preserves bold formatting in paragraphs", () => {
    const paragraphs = article.body
      .filter((c) => c.type === "paragraph")
      .map((c) => (c as any).text);
    const hasBold = paragraphs.some((t: string) => t.includes("<strong>"));
    expect(hasBold).toBe(true);
  });

  it("contains headings", () => {
    const headings = article.body.filter((c) => c.type === "heading");
    expect(headings.length).toBeGreaterThan(0);
    const h2 = headings.find((h: any) => h.level === 2);
    expect(h2).toBeDefined();
    expect((h2 as any).text).toContain("Reader-Supported");
  });

  it("contains h3 headings", () => {
    const h3s = article.body.filter(
      (c) => c.type === "heading" && (c as any).level === 3,
    );
    expect(h3s.length).toBeGreaterThan(0);
  });

  it("contains unordered list", () => {
    const lists = article.body.filter(
      (c) => c.type === "list" && (c as any).style === "unordered",
    );
    expect(lists.length).toBeGreaterThan(0);
    expect((lists[0] as any).items.length).toBeGreaterThanOrEqual(3);
  });

  it("contains ordered list", () => {
    const lists = article.body.filter(
      (c) => c.type === "list" && (c as any).style === "ordered",
    );
    expect(lists.length).toBeGreaterThan(0);
  });

  it("contains blockquote", () => {
    const quotes = article.body.filter((c) => c.type === "blockquote");
    expect(quotes.length).toBeGreaterThan(0);
    expect((quotes[0] as any).text).toContain("accountable");
  });

  it("contains divider from hr", () => {
    const dividers = article.body.filter((c) => c.type === "divider");
    expect(dividers.length).toBeGreaterThan(0);
  });

  it("contains image from kg-image-card", () => {
    const images = article.body.filter((c) => c.type === "image");
    expect(images.length).toBeGreaterThan(0);
    const img = images[0] as any;
    expect(img.url).toContain("newsroom-photo.jpg");
    expect(img.caption).toContain("modern independent newsroom");
  });

  it("contains gallery images from kg-gallery-card", () => {
    const images = article.body.filter((c) => c.type === "image");
    // Should have main image + 3 gallery images
    expect(images.length).toBeGreaterThanOrEqual(4);
  });

  it("contains embed from kg-embed-card", () => {
    const embeds = article.body.filter((c) => c.type === "embed");
    expect(embeds.length).toBeGreaterThan(0);
    const embed = embeds[0] as any;
    expect(embed.platform).toBe("youtube");
    expect(embed.embedUrl).toContain("youtube.com");
    expect(embed.caption).toContain("documentary");
  });

  it("contains video from kg-video-card", () => {
    const videos = article.body.filter((c) => c.type === "video");
    expect(videos.length).toBeGreaterThan(0);
    const video = videos[0] as any;
    expect(video.url).toContain("behind-scenes.mp4");
    // spacergif poster should be filtered out
    expect(video.thumbnailUrl).toBeUndefined();
  });

  it("contains bookmark as paragraph link", () => {
    const paragraphs = article.body.filter((c) => c.type === "paragraph");
    const bookmark = paragraphs.find((p: any) =>
      p.text.includes("Ghost for Independent Journalism"),
    );
    expect(bookmark).toBeDefined();
    expect((bookmark as any).text).toContain("<a href=");
  });

  it("contains codeBlock from pre>code", () => {
    const codeBlocks = article.body.filter((c) => c.type === "codeBlock");
    expect(codeBlocks.length).toBeGreaterThan(0);
    const block = codeBlocks[0] as any;
    expect(block.code).toContain("ghost");
    expect(block.language).toBe("javascript");
  });

  it("converts callout card to blockquote", () => {
    const quotes = article.body.filter((c) => c.type === "blockquote");
    const callout = quotes.find((q: any) => q.text.includes("Subscribe"));
    expect(callout).toBeDefined();
  });

  // Structure

  it("has version field", () => {
    expect(article.version).toBe("1.0");
  });

  it("has extractedAt as ISO datetime", () => {
    expect(article.extractedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });
});

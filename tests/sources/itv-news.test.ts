import { describe, expect, it } from "bun:test";
import { itvNewsSource } from "../../src/sources/itv-news.ts";
import { validateArticle } from "../../src/schema/validate.ts";

const FIXTURE_URL =
  "https://www.itv.com/news/2026-02-11/dawsons-creek-star-james-van-der-beek-has-died-aged-48";

const fixtureHtml = await Bun.file(
  `${import.meta.dir}/../fixtures/itv-news/article.html`,
).text();

// --- matches ---

describe("matches", () => {
  it("matches itv.com/news URLs", () => {
    expect(itvNewsSource.matches("https://www.itv.com/news/some-article")).toBe(
      true,
    );
    expect(itvNewsSource.matches("https://itv.com/news/some-article")).toBe(
      true,
    );
    expect(
      itvNewsSource.matches("http://www.itv.com/news/2026-01-01/test"),
    ).toBe(true);
  });

  it("rejects non-ITV URLs", () => {
    expect(itvNewsSource.matches("https://bbc.co.uk/news/article")).toBe(false);
    expect(itvNewsSource.matches("https://example.com")).toBe(false);
  });

  it("rejects ITV non-news URLs", () => {
    expect(itvNewsSource.matches("https://www.itv.com/hub/show")).toBe(false);
    expect(itvNewsSource.matches("https://www.itv.com/")).toBe(false);
  });
});

// --- parse ---

describe("parse", () => {
  const article = itvNewsSource.parse(fixtureHtml, FIXTURE_URL);

  it("passes schema validation", () => {
    expect(() => validateArticle(article)).not.toThrow();
  });

  // Source

  it("sets source fields", () => {
    expect(article.source).toMatchObject({
      url: FIXTURE_URL,
      publisherId: "itv-news",
      cmsType: "contentful",
      ingestionMethod: "scrape",
    });
    expect(article.source.canonicalUrl).toContain("itv.com/news");
  });

  // Metadata

  it("extracts title", () => {
    expect(article.metadata.title).toContain("James Van Der Beek");
  });

  it("extracts publishedAt as ISO datetime", () => {
    expect(article.metadata.publishedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });

  it("extracts modifiedAt from JSON-LD", () => {
    expect(article.metadata.modifiedAt).toBeDefined();
  });

  it("extracts thumbnail with dimensions", () => {
    expect(article.metadata.thumbnail).toBeDefined();
    expect(article.metadata.thumbnail!.url).toContain("ctfassets.net");
    expect(article.metadata.thumbnail!.width).toBeGreaterThan(0);
    expect(article.metadata.thumbnail!.height).toBeGreaterThan(0);
  });

  it("extracts categories from regions", () => {
    expect(article.metadata.categories).toContain("National");
  });

  it("extracts tags from topics", () => {
    expect(article.metadata.tags).toContain("Entertainment");
  });

  it("extracts keywords from JSON-LD", () => {
    expect(article.metadata.keywords).toBeDefined();
    expect(article.metadata.keywords!.length).toBeGreaterThan(0);
  });

  it("extracts section from JSON-LD", () => {
    expect(article.metadata.section).toBe("national");
  });

  it("extracts language", () => {
    expect(article.metadata.language).toBe("en-GB");
  });

  it("extracts excerpt", () => {
    expect(article.metadata.excerpt).toBeDefined();
    expect(article.metadata.excerpt!.length).toBeGreaterThan(0);
  });

  // Authors

  it("extracts authors", () => {
    // ITV News articles may have byline or fall back to empty
    expect(article.authors).toBeInstanceOf(Array);
  });

  // Body

  it("produces non-empty body", () => {
    expect(article.body.length).toBeGreaterThan(0);
  });

  it("contains paragraphs", () => {
    const paragraphs = article.body.filter((c) => c.type === "paragraph");
    expect(paragraphs.length).toBeGreaterThan(0);
  });

  it("paragraphs use html format", () => {
    const paragraph = article.body.find((c) => c.type === "paragraph");
    expect(paragraph).toBeDefined();
    expect((paragraph as any).format).toBe("html");
  });

  it("contains dividers from hr blocks", () => {
    const dividers = article.body.filter((c) => c.type === "divider");
    expect(dividers.length).toBeGreaterThan(0);
  });

  it("contains images from embedded entries", () => {
    const images = article.body.filter((c) => c.type === "image");
    expect(images.length).toBeGreaterThan(0);
    const img = images[0] as any;
    expect(img.url).toBeDefined();
  });

  it("contains rawHtml for podcast embeds", () => {
    const raw = article.body.filter((c) => c.type === "rawHtml");
    expect(raw.length).toBeGreaterThan(0);
    expect((raw[0] as any).html).toContain("podcast");
  });

  it("preserves bold formatting in paragraphs", () => {
    const htmlParagraphs = article.body
      .filter((c) => c.type === "paragraph")
      .map((c) => (c as any).text);
    const hasBold = htmlParagraphs.some((t: string) =>
      t.includes("<strong>"),
    );
    expect(hasBold).toBe(true);
  });

  it("converts tile-links to paragraph links", () => {
    const htmlParagraphs = article.body
      .filter((c) => c.type === "paragraph")
      .map((c) => (c as any).text);
    const hasLink = htmlParagraphs.some((t: string) => t.includes("<a href="));
    expect(hasLink).toBe(true);
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

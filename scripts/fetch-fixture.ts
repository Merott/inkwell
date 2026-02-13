/**
 * One-time script to fetch a real ITV News article and save a trimmed fixture.
 * Usage: bun scripts/fetch-fixture.ts <url> <output-path>
 */
import { chromium } from "playwright";
import * as cheerio from "cheerio";

const url = process.argv[2];
const output = process.argv[3];

if (!url || !output) {
  console.error(
    "Usage: bun tests/fixtures/fetch-fixture.ts <url> <output-path>",
  );
  process.exit(1);
}

const browser = await chromium.launch({ headless: false });
try {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

  await page.waitForFunction(
    () =>
      (document.getElementById("__NEXT_DATA__")?.textContent?.length ?? 0) > 0,
    { timeout: 10_000 },
  );

  // Dismiss cookie consent
  try {
    const acceptBtn = page.locator(
      '.cassie-pre-banner button:has-text("Accept")',
    );
    if (await acceptBtn.isVisible({ timeout: 2_000 })) {
      await acceptBtn.click();
    }
  } catch {}

  const html = await page.content();
  await context.close();

  // Strip excess — keep only what the parser needs
  const $ = cheerio.load(html);

  // Remove scripts except __NEXT_DATA__ and JSON-LD
  $("script").each((_, el) => {
    const $el = $(el);
    if ($el.attr("id") === "__NEXT_DATA__") return;
    if ($el.attr("type") === "application/ld+json") return;
    $el.remove();
  });

  // Remove stylesheets, style tags, iframes, noscript, comments
  $("link[rel='stylesheet'], style, iframe, noscript").remove();

  // Remove tracking pixels and ad elements
  $("img[width='1'][height='1'], [data-ad], .ad-slot").remove();

  // Remove preload/prefetch links
  $("link[rel='preload'], link[rel='prefetch'], link[rel='dns-prefetch']").remove();

  // Keep: meta og tags, canonical link, __NEXT_DATA__, JSON-LD
  // Remove other meta tags that aren't needed
  $("meta").each((_, el) => {
    const $el = $(el);
    const property = $el.attr("property") ?? "";
    const name = $el.attr("name") ?? "";
    if (
      property.startsWith("og:") ||
      name === "description" ||
      $el.attr("charset")
    )
      return;
    $el.remove();
  });

  // Move __NEXT_DATA__ to <head> (it lives in <body> in Next.js pages)
  const nextData = $("#__NEXT_DATA__");
  if (nextData.length) {
    $("head").append(nextData);
  }

  // Remove body content (parser uses <head> data + __NEXT_DATA__ via Cheerio)
  $("body").empty();

  const trimmed = $.html();
  await Bun.write(output, trimmed);
  console.log(`Fixture saved to ${output} (${trimmed.length} bytes)`);
} finally {
  await browser.close();
}

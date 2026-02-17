/**
 * One-time script to fetch a Ghost article and save a trimmed fixture.
 * Ghost serves static HTML — no Playwright needed, just fetch + Cheerio.
 * Usage: bun scripts/fetch-ghost-fixture.ts <url> <output-path>
 */
import * as cheerio from "cheerio";

const url = process.argv[2];
const output = process.argv[3];

if (!url || !output) {
  console.error(
    "Usage: bun scripts/fetch-ghost-fixture.ts <url> <output-path>",
  );
  process.exit(1);
}

const res = await fetch(url);
if (!res.ok) {
  console.error(`Fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const html = await res.text();
const $ = cheerio.load(html);

// Remove scripts (keep JSON-LD)
$("script").each((_, el) => {
  const $el = $(el);
  if ($el.attr("type") === "application/ld+json") return;
  $el.remove();
});

// Remove stylesheets, style tags, noscript
$("link[rel='stylesheet'], style, noscript").remove();

// Remove preload/prefetch links
$("link[rel='preload'], link[rel='prefetch'], link[rel='dns-prefetch']").remove();

// Keep: meta og tags, canonical link, JSON-LD, charset
$("meta").each((_, el) => {
  const $el = $(el);
  const property = $el.attr("property") ?? "";
  const name = $el.attr("name") ?? "";
  if (
    property.startsWith("og:") ||
    property.startsWith("article:") ||
    name === "description" ||
    $el.attr("charset")
  )
    return;
  $el.remove();
});

// Remove nav, header, footer, sidebar, aside
$("nav, header, footer, aside, .sidebar").remove();

// Remove tracking pixels, ad elements
$("img[width='1'][height='1'], [data-ad], .ad-slot").remove();

// Remove post-author section (after article content)
$(".post-author").remove();

// Remove post-access-cta (subscription prompts)
$(".post-access-cta").remove();

const trimmed = $.html();
await Bun.write(output, trimmed);
console.log(`Fixture saved to ${output} (${trimmed.length} bytes)`);

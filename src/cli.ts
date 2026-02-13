import { itvNewsSource } from "./sources/itv-news.ts";
import { validateArticle } from "./schema/validate.ts";
import type { ArticleSource } from "./sources/types.ts";

const sources: ArticleSource[] = [itvNewsSource];

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error("Usage: bun run scrape <article-url>");
    process.exit(1);
  }

  const source = sources.find((s) => s.matches(url));
  if (!source) {
    console.error(`No source found for URL: ${url}`);
    process.exit(1);
  }

  console.error(`Scraping with ${source.id}...`);
  const raw = await source.scrape(url);

  console.error("Validating...");
  const article = validateArticle(raw);

  console.log(JSON.stringify(article, null, 2));
  console.error("Done.");
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});

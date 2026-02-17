# ADR-004: Homepage Discovery

## Status

Accepted

## Context

Inkwell can extract articles from individual URLs (`scrape`), but has no way to *discover* which articles exist on a publisher's site. For publishers without RSS feeds, the only option is polling their homepage. Without discovery, Inkwell is a manual tool rather than an ingestion engine.

## Decision

### Discovery as an optional extension of ArticleSource

We extended the `ArticleSource` interface with optional methods rather than creating a separate discovery abstraction:

- `parseArticles(html, url)` — pure function: HTML in, `DiscoveredArticle[]` out
- `scrapeArticles(url?)` — async wrapper: fetches homepage, calls `parseArticles()`
- `homepageUrl` — optional property for the publisher's default homepage

This mirrors the existing `parseArticle`/`scrapeArticle` split: pure extraction vs. fetch+extract.

**Why optional?** Not all sources need homepage discovery (some may use RSS or API). Making methods optional avoids forcing all sources to implement a no-op.

### CMS-aware selectors over generic heuristics

Each source uses CMS-specific selectors and data extraction:

- **Ghost**: CSS selectors for `.post-card` elements with prioritised arrays for title, link, excerpt, image, and date — resilient to theme variations.
- **ITV News**: Primary strategy extracts from `__NEXT_DATA__` JSON (Next.js SSR data), with a DOM fallback parsing `<a href>` tags matching ITV's article URL pattern.

**Why not a generic link extractor?** Publisher homepages are highly varied. CMS-aware extraction gives us structured metadata (title, excerpt, thumbnail, date) rather than just bare URLs. The same rationale as ADR-002's shared/CMS-specific boundary applies.

### DiscoveredArticle as a lightweight type

`DiscoveredArticle` captures what's visible on a homepage card — URL, title, excerpt, thumbnail, date, sourceId. It intentionally lacks full article content (body, authors, etc.). Discovery is about *finding* articles; scraping fills in the details.

### Publisher ids vs. source ids

The CLI `discover` command resolves by **publisher id**, not source id. A source like `ghost` is a CMS parser — it can serve multiple publishers. Each publisher (e.g. `404-media`) has its own id and homepage URL, registered in the source's `publishers` array.

This means `discover 404-media` works, but `discover ghost` does not — because `ghost` is a CMS type, not a publisher. For single-publisher sources like `itv-news`, the publisher id and source id happen to be the same.

Publisher ids are stable across domain changes — if 404media.co became 404media.com, the id `404-media` wouldn't change.

### Single-page scope

Initial implementation discovers articles from a single homepage load. Pagination (Ghost `/page/2/`, ITV infinite scroll) is out of scope. This covers the most recent articles, which is sufficient for frequent polling.

## Consequences

- Sources can be discovered from → scraped → validated in a pipeline
- New CLI command: `bun run discover <homepage-url | publisher-id>`
- Each source exposes a `publishers` array mapping publisher ids to homepage URLs
- Each new source must implement `discover()` if homepage polling is relevant
- No state tracking — caller determines which articles are new
- Pagination and scheduling are deferred to future work

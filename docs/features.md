# Inkwell — Core Features

## Multi-Source Ingestion

Inkwell determines the best ingestion strategy per publisher, in order of preference:

1. **CMS API** — richest, most structured data; available for some CMSes (Ghost Content API, WordPress REST API, Contentful, etc.)
2. **RSS/Atom feeds** — widely available, good for article discovery and basic metadata; often lacks full article body or rich media
3. **HTML scraping** — universal fallback; extracts directly from the publisher's rendered pages

For any given publisher, Inkwell may combine strategies — e.g., RSS for article discovery and change detection, then scraping or API for full content extraction.

## Content Extraction

Inkwell extracts the following from each article:

### Metadata
- Title and subtitle
- Author(s) — name, bio, avatar, URL
- Publication date and last modified date
- Canonical URL
- Language
- Categories and tags/keywords
- Excerpt / summary
- Thumbnail / hero image

### Article Body (Structured)
The body is extracted as a **structured component tree**, not flat HTML. Components include:
- Paragraph
- Heading (with level)
- Image (with caption, credit, alt text, dimensions)
- Video embed
- Social embed (YouTube, Facebook, Instagram, TikTok, X)
- Blockquote / pull quote
- Ordered and unordered lists
- Code block
- Horizontal rule
- Table
- Raw HTML (escape hatch for unsupported content)

### Media
- Images: URL, alt text, caption, credit/attribution, dimensions, format
- Videos: URL, embed URL, thumbnail, duration, platform
- Social embeds: platform, embed URL/ID, fallback content

### Paywall & Access
- Paywall status (free, metered, premium)
- Paywall boundary marker (where the free preview ends)
- Access tier / subscription level

### Related Content
- Read-next / related article links
- Series or collection membership

## CMS-Aware Parsing

Inkwell maintains **CMS-specific parsers** that leverage known HTML structures, class names, metadata patterns, and API schemas. These provide more reliable extraction than generic scraping.

Supported CMSes (initial):
- WordPress (including WordPress VIP)
- Ghost
- Squarespace
- Webflow
- Drupal
- Medium
- Wix
- Craft CMS
- Contentful
- Contentstack
- RebelMouse
- Bespoke / unknown (generic fallback parser)

When the CMS is unknown, Inkwell falls back to generic extraction using common semantic HTML patterns, Open Graph / JSON-LD metadata, and heuristics.

Extraction cannot be a "blunt instrument" — each publisher needs tight guardrails. CMS-specific parsers are a starting point, but per-publisher configuration and overrides are essential given the variation in themes, plugins, and custom markup.

## Content Discovery

Inkwell supports multiple discovery modes:

### Homepage Discovery

For publishers without RSS feeds or APIs, Inkwell polls their homepage to discover articles. Each source implements CMS-aware extraction to find article cards and extract metadata.

**Currently supported:**
- **Ghost** (404 Media) — CSS selector-based extraction of `.post-card` elements. Extracts title, URL, excerpt, thumbnail (`data-src`), and publish date from card markup. Deduplicates hero/grid duplicates.
- **ITV News** — Primary: extracts from `__NEXT_DATA__` JSON (Next.js SSR props) across `topStories`, `popular`, `collections`, and `latest` sections. Fallback: DOM-based extraction of `<a href>` matching ITV article URL patterns. Filters external/watch URLs.

**Scope:** Single homepage page per poll. Pagination (Ghost `/page/2/`, ITV infinite scroll) is deferred.

**CLI:** `bun run discover <homepage-url | publisher-id>` (e.g. `discover 404-media`, `discover itv-news`)

### Poll Mode (Implemented)
- `bun run poll` runs the full discover → scrape → write cycle for all enabled publishers
- Tracks state in SQLite (`data/inkwell.db`) — articles progress through `discovered` → `scraped` | `failed`
- Idempotent: re-running skips already-scraped articles, retries failed ones
- Writes validated JSON to `output/<publisherId>/<date>-<slug>.json`
- Scheduling (cron/interval) deferred — currently manual invocation

### Push Mode (Real-Time)
- Receives webhook or API notifications from publishers or their CMS
- Processes immediately — critical for **breaking news** and time-sensitive content
- Schema includes urgency/priority signals to inform downstream processing

## Scale

- Hundreds of publisher sites
- Poll frequency TBD — Flatplan's feed spec states feeds are "fetched continually"; actual interval to be confirmed
- Push mode for real-time where available

## Error Detection & Observability

Inkwell surfaces extraction failures clearly and categorically:

- **Structural errors**: expected HTML/feed structure not found — the most common failure mode, typically caused by publishers changing their site frontend or API content
- **Content errors**: extracted content fails validation (missing required fields, empty body, malformed embeds) — critical because ANF will reject an entire article for a single malformed embed
- **Fetch errors**: site unreachable, rate limited, authentication failure
- **Degradation warnings**: extraction succeeded but with reduced fidelity (e.g., images without captions, missing author) — especially problematic for breaking news where missing content is unacceptable

This categorization is the foundation for the future self-healing pipeline (Sentry → GitHub issue → AI agent fix → PR → deploy).

## ANF Transformer

Inkwell includes an Apple News Format transformer that converts intermediary JSON into valid ANF `ArticleDocument` JSON.

### Component Mapping

All 14 intermediary body component types are mapped to ANF roles:

| Intermediary Type | ANF Role |
|---|---|
| paragraph | body |
| heading (1-6) | heading1–heading6 |
| blockquote | quote |
| pullquote | pullquote |
| list (ordered/unordered) | body (HTML `<ol>`/`<ul>`) |
| codeBlock, preformatted | body (HTML `<pre>`) |
| image | photo |
| video | video |
| embed (YouTube, Vimeo, etc.) | embedwebvideo |
| embed (X, Instagram, Facebook, TikTok) | tweet, instagram, facebook_post, tiktok |
| divider | divider |
| table | htmltable |
| rawHtml | dropped (with warning) |
| adPlacement | banner_advertisement |

Unsupported embed platforms fall back to body text with a warning.

### HTML Sanitizer

Text components with `format: "html"` are sanitized before output:

- **Allowlist**: `a`, `b`, `strong`, `em`, `i`, `code`, `del`, `s`, `sub`, `sup`, `br`, `ul`, `ol`, `li`, `p`, `pre`, `blockquote`
- **Substitutions**: `mark` → `b`, `cite`/`u`/`ins` → `em`
- **Disallowed tags**: unwrapped (children preserved, tag removed)
- **Attributes**: stripped except `href` on `<a>`

### Default Typography & Layout

The transformer ships with default `componentTextStyles` covering body, headings 1–6, captions, quotes, pullquotes, and monospace. Serif body text (Georgia), sans-serif headings (HelveticaNeue-Bold), with sensible font sizes and line heights.

Inter-component spacing is controlled via `componentLayouts` — named layout definitions with `margin: { top, bottom }` values. Each component references a layout by name (e.g. `bodyLayout`, `headingLayout`, `photoLayout`). This is distinct from `paragraphSpacing` in text styles, which only controls spacing between paragraphs *within* a single text component.

### Integration

- `bun run transform <path>` — standalone CLI for single file or batch conversion
- `bun run poll --transform` — transforms each article immediately after scraping
- ANF output goes to `output/<publisherId>/anf/<date>-<slug>/article.json`

### Error Strategy

- **Per-component**: lenient — unsupported components are dropped with warnings, not errors
- **Per-document**: strict — the assembled document is validated against a Zod schema; invalid documents throw

## Per-Publisher Configuration

Each publisher has a configuration record specifying:

- Site URL and feed URL(s)
- CMS type (or "unknown" for auto-detection)
- Preferred ingestion method (RSS, API, scrape, or auto)
- API credentials (if applicable)
- Custom content selectors or extraction hints (if needed)
- Polling frequency
- Priority/urgency tier (for breaking news support)
- Paywall access credentials (if applicable)

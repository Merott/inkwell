# Inkwell — Architecture Overview

> No technology choices are made in this document. This describes the logical components and their responsibilities.

## System Boundary

Inkwell's contract:

- **Input**: a publisher configuration (site URL, CMS type, credentials, preferences)
- **Output**: validated intermediary JSON documents, one per article

The long-term intent is for transformers to be separate services (see [ADR-001](decisions/001-transformer-coupling.md)). For the PoC, the ANF transformer is co-located inside this repository as a decoupled module — it consumes intermediary JSON through the public `Article` type and imports nothing from the source/pipeline code (see [ADR-006](decisions/006-anf-transformer-module.md)).

## Pipeline Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                            Inkwell                               │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌─────────┐   ┌────────┐  ┌───┐ │
│  │  Source   │──▶│ Discovery│──▶│ Content │──▶│ Parser/│──▶│Val│ │
│  │ Resolver  │   │(optional)│   │ Fetcher │   │Extract.│  │   │ │
│  └──────────┘   └──────────┘   └─────────┘   └────────┘  └───┘ │
│       ▲                                                    │    │
│       │                                                    ▼    │
│  ┌──────────┐                                       ┌──────────┐│
│  │Publisher │                                       │Intermediary│
│  │  Config  │                                       │   JSON    ││
│  └──────────┘                                       └──────────┘│
└──────────────────────────────────────────────────────────────────┘
                                                          │
                            ┌─────────────────────────────┤
                            ▼                             ▼
                  ┌──────────────────┐      ┌───────────────────────┐
                  │  ANF Transformer │      │  Future Transformers   │
                  │  (co-located)    │      │  (RSS, Google News...) │
                  └──────────────────┘      └───────────────────────┘
```

## Components

### Source Resolver

Determines the best ingestion strategy for a given publisher.

**Inputs**: publisher config (CMS type, available feeds, API access, preferences)

**Outputs**: an ingestion plan — which method(s) to use and in what combination

**Responsibilities**:
- Select ingestion method: CMS API, RSS/Atom feed, HTML scraping, or a combination
- Handle fallback logic (e.g., if API is unavailable, fall back to RSS + scrape)
- Resolve feed URLs, API endpoints, and entry points for scraping

### Article Discovery

Discovers which articles exist on a publisher's homepage. Optional step — for publishers without RSS feeds or API-based discovery.

**Inputs**: homepage URL (or pre-fetched HTML)

**Outputs**: `DiscoveredArticle[]` — lightweight article references (URL, title, excerpt, thumbnail, date)

**Responsibilities**:
- CMS-aware extraction of article cards from homepage HTML
- Deduplication by URL
- Resolve relative URLs to absolute
- Filter non-article links (tag pages, about pages, external links)

Each source implements `parseArticles(html, url)` (pure extraction) and `scrapeArticles(url?)` (fetch + extract), mirroring the `parseArticle`/`scrapeArticle` pattern. See [ADR-004](decisions/004-homepage-discovery.md).

### Content Fetcher

Retrieves raw content from the publisher's site.

**Inputs**: ingestion plan from Source Resolver

**Outputs**: raw content (HTML pages, feed XML, API JSON responses)

**Responsibilities**:
- HTTP fetching with appropriate headers, authentication, rate limiting
- Handle pagination (feeds with multiple pages, API cursors)
- Detect new and updated content (compare with previously seen articles)
- Respect robots.txt and publisher-specified crawl policies
- Support both poll (scheduled fetch) and push (webhook receiver) modes

### Parser / Extractor

Converts raw content into structured data.

**Inputs**: raw content + CMS type hint

**Outputs**: unvalidated intermediary JSON

**Responsibilities**:
- CMS-specific parsing when CMS type is known (WordPress, Ghost, etc.)
- Generic fallback parsing using semantic HTML, Open Graph, JSON-LD, microdata
- Structured body extraction — convert HTML article body into component tree
- Media extraction — images, videos, social embeds with full metadata
- Metadata extraction — title, authors, dates, categories, paywall info
- Related content / read-next link extraction

This is the most complex component. It contains a **parser registry** — a set of CMS-specific parsers plus a generic fallback, selected based on the publisher's CMS type.

#### Shared Utilities

Common logic lives in `src/sources/shared/` and is used by all CMS-specific parsers:

**Extraction** (`shared/extract.ts`):
- `extractJsonLd($)` — finds JSON-LD NewsArticle/Article from `<script type="application/ld+json">`
- `extractOgTags($)` — extracts `og:*` meta tags into a key-value map
- `escapeHtml(str)` — HTML entity escaping for `&`, `<`, `>`, `"`
- `ensureIso(date)` — normalizes date strings to ISO 8601
- `detectEmbedPlatform(url)` — maps iframe/embed URLs to platform enum (youtube, vimeo, x, etc.)

**Playwright** (`shared/playwright.ts`):
- `createPlaywrightFetcher(options?)` — factory for sources that need a headed browser (e.g. ITV News). Manages browser/context/page lifecycle with `init()` / `dispose()` hooks. When `init()` is called (e.g. by the poll orchestrator), a single browser window is reused across all fetches. For standalone CLI calls, a temporary browser is launched and closed per request. Sources pass an `onLoad` callback for CMS-specific page waits.

CMS-specific logic (DOM traversal strategy, content selectors, metadata extraction from CMS-specific data structures) stays in each parser. The shared/CMS-specific boundary: **anything that depends on standard HTML conventions (JSON-LD, OG, HTML entities) is shared; anything that depends on a CMS's DOM structure or data format is CMS-specific.**

### ANF Transformer (`src/transformers/anf/`)

Converts validated intermediary JSON into Apple News Format `ArticleDocument` JSON.

**Inputs**: `Article` (validated intermediary JSON)

**Outputs**: `AnfArticleDocument` (validated ANF JSON) + warnings

**Architecture**:
- Pure function: `transformToAnf(Article) → { document, warnings }` — no side effects, no source imports
- Decoupled from extraction: consumes only the `Article` type from `@/schema/types.ts`, imports nothing from `src/sources/` or `src/pipeline/`
- Component mappers: each intermediary body component type maps to an ANF role via a switch dispatch in `components.ts`
- HTML sanitizer (`html.ts`): tag allowlist + substitution, ensures HTML content is ANF-safe
- Document assembly (`document.ts`): builds the top-level `ArticleDocument` with metadata, layout, default `componentTextStyles`, and `componentLayouts` (inter-component spacing via margins)
- Zod validation (`validate.ts`): validates the assembled document before returning

**Error strategy**: lenient per-component (unsupported types dropped with warnings), strict per-document (Zod validation throws on invalid output). See [ADR-006](decisions/006-anf-transformer-module.md).

### Schema Validator

Validates extractor output against the intermediary JSON schema.

**Inputs**: unvalidated intermediary JSON

**Outputs**: validated intermediary JSON, or categorized errors

**Responsibilities**:
- Schema validation (required fields, types, structure)
- Content quality checks (e.g., body not empty, title present, at least one author)
- Categorize validation failures for observability (see features.md — Error Detection)

## Ingestion Modes

### Poll Mode

```
Scheduler → Source Resolver → Content Fetcher → Parser → Validator → Output
```

- Runs on a configurable schedule per publisher (frequency TBD)
- Fetches feeds or pages, diffs against known articles, processes new/updated content
- Suitable for most publishers

### Push Mode

```
Webhook Endpoint → Parser → Validator → Output
```

- Publisher's CMS sends a webhook or API call when content is published/updated
- Bypasses Source Resolver and Content Fetcher — content arrives directly
- Critical for breaking news and time-sensitive content
- Requires publisher-side integration (CMS plugin, webhook config)

## Per-Publisher Configuration

Each publisher is represented by a configuration record:

| Field | Description |
|---|---|
| `id` | Unique publisher identifier |
| `name` | Publisher display name |
| `siteUrl` | Publisher's website URL |
| `cmsType` | CMS identifier or "unknown" |
| `ingestionMethod` | Preferred method: `auto`, `api`, `rss`, `scrape` |
| `feedUrls` | RSS/Atom feed URLs (if available) |
| `apiConfig` | API endpoint, credentials, version (if applicable) |
| `selectors` | Custom CSS selectors or extraction hints (if needed) |
| `pollFrequency` | How often to check for new content |
| `priorityTier` | Urgency level (e.g., `standard`, `breaking`) |
| `paywallAccess` | Credentials for accessing paywalled content |

## Pipeline Orchestration Layer

The poll orchestrator (`src/pipeline/poll.ts`) wires the components together into a repeatable cycle:

```
┌─────────────────────────────────────────────────────┐
│                   Poll Orchestrator                   │
│                                                       │
│  for each enabled publisher:                          │
│    1. source.discoverArticles(homepageUrl)             │
│    2. diff against DB → insert new as 'discovered'    │
│    3. query DB for scrapeable (discovered | failed)   │
│    4. source.scrape(url) → validate → write to disk   │
│    5. update DB status (scraped | failed)             │
└───────┬──────────────┬──────────────┬─────────────────┘
        │              │              │
   Publishers     State Store     Output Writer
   Config          (SQLite)       (JSON files)
```

### Publisher Registry (`src/publishers.ts`)

Single source of truth for publisher definitions. Each entry maps a publisher ID to a source ID and homepage URL. Validated with Zod at load time.

### State Store (`src/pipeline/db/`)

SQLite database (via `bun:sqlite` + Drizzle ORM) tracking discovered and scraped articles. Articles table with URL as primary key, status enum (`discovered` → `scraped` | `failed`), and output path. Idempotent inserts prevent re-processing. See [ADR-005](decisions/005-pipeline-state-sqlite.md).

### Output Writer (`src/pipeline/output.ts`)

Writes validated article JSON to `output/<publisherId>/<date>-<slug>.json`. Articles are validated before writing.

## Open Architectural Questions

1. ~~**State management**: where does Inkwell track which articles have been seen/processed?~~ **Resolved**: SQLite with Drizzle ORM — see [ADR-005](decisions/005-pipeline-state-sqlite.md)
2. **Queue/event system**: does Inkwell push validated JSON to a queue for transformers to consume, write to a store, or call transformer APIs directly?
3. **Retry and failure handling**: how does Inkwell handle transient fetch failures vs. persistent structural changes? Current approach: retry failed articles once per poll cycle, no backoff.
4. **Multi-tenancy**: is there one Inkwell instance for all publishers, or isolated instances per publisher / group?

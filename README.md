# Inkwell

A proof-of-concept content ingestion engine.

Extracts structured content from publisher websites and outputs normalized intermediary JSON for downstream transformation to Apple News Format (ANF) and other syndication platforms.

```
        Publisher Sites
       ┌───┬───┬───┬───┐
     Ghost WP  CF  ...
       └───┴───┴───┴───┘
               │
  ┌────────────┼────────────┐
  │         Inkwell         │
  │                         │
  │   CMS-specific parsers  │
  │            │            │
  │     Intermediary JSON   │
  └────────────┼────────────┘
               │
       ┌───────┼───────┐
      ANF    RSS    Google
                     News
```

## The idea

Publishers use dozens of different CMSes, each with its own content structure. Rather than building bespoke scrapers that output directly to each syndication format, Inkwell extracts content into a single normalized intermediary — a structured component tree with rich metadata — that any downstream transformer can consume.

Add a new publisher by writing one parser. Add a new syndication target by writing one transformer. Neither needs to know about the other.

The intermediary boundary enables:

- **Testability** — each parser is tested in isolation against an HTML fixture and validated against the schema. When a publisher changes their markup, the failing test pinpoints exactly which parser broke.
- **Reliability** — Zod validation sits between extraction and output. Malformed extractions fail fast with structured errors rather than silently producing broken content downstream.
- **Scalability** — parsers and transformers scale independently — scraping hundreds of sites is I/O-bound; transforming JSON is CPU-light and fast.
- **Reprocessing** — when a transformer is fixed or a new platform is added, all previously extracted content can be reprocessed without re-scraping publisher sites.
- **Self-healing potential** — isolated parsers with deterministic test fixtures are ideal targets for automated repair. When a publisher changes their markup, an AI agent can pick up the failing test, generate a fix, and open a PR — see [vision](docs/vision.md).

Designed and built with [Claude Code](https://claude.ai/claude-code) — see commit history.

## Status

The core extraction pipeline works end-to-end for two source types, with an ANF transformer that converts intermediary JSON to Apple News Format:

| Source | CMS | Method |
|---|---|---|
| [404 Media](https://www.404media.co/) | Ghost | HTTP fetch + Cheerio |
| [ITV News](https://www.itv.com/news/) | Contentful (Next.js) | Playwright + Cheerio |

An orchestration layer (`poll` command) runs the full discover → scrape → write cycle with SQLite state tracking, so the same command can run repeatedly without re-scraping articles.

## Getting started

**Prerequisites:** [Bun](https://bun.sh/) v1.3+

```sh
bun install
```

ITV News scraping requires a headed browser:

```sh
bunx playwright install chromium
```

### Scrape an article

```sh
bun run scrape <article-url>
```

Outputs validated intermediary JSON to stdout.

### Discover articles from a publisher's homepage

```sh
bun run discover <homepage-url | publisher-id>
```

### Poll: discover + scrape pipeline

```sh
# Poll all enabled publishers
bun run poll

# Poll a single publisher
bun run poll --publisher 404-media
```

Discovers new articles, scrapes them, writes validated JSON to `output/<publisherId>/`, and tracks state in `data/inkwell.db`. Running the same command again skips already-scraped articles.

### Transform intermediary JSON to Apple News Format

```sh
# Transform a single file
bun run transform output/404-media/2026-02-18-my-article.json

# Transform all JSON files in a directory
bun run transform output/404-media/
```

ANF output is written to `output/<publisherId>/anf/<date>-<slug>/article.json` (one directory per article, compatible with Apple News Preview).

The transform can also run automatically after scraping:

```sh
bun run poll --transform
```

### Run tests

```sh
bun test
```

## Scripts

| Script | Description |
|---|---|
| `bun run scrape <url>` | Scrape an article and output JSON |
| `bun run discover <target>` | Discover articles from a homepage or publisher |
| `bun run poll` | Full discover + scrape pipeline (all publishers) |
| `bun run poll --publisher <id>` | Poll a single publisher |
| `bun run poll --transform` | Poll + transform scraped articles to ANF |
| `bun run transform <path>` | Transform intermediary JSON to ANF (file or directory) |
| `bun test` | Run all tests |
| `bun run check` | Lint and format check (biome) |
| `bun run format` | Auto-fix lint and formatting |

A pre-commit hook (via [lefthook](https://github.com/evilmartians/lefthook)) runs biome on staged files.

## Project structure

```
src/
  cli.ts                  CLI entry point (scrape, discover, poll commands)
  publishers.ts          Publisher registry (validated with Zod)
  schema/
    types.ts              Intermediary JSON type definitions
    validate.ts           Zod schema validation
  sources/
    ghost.ts              Ghost CMS parser
    itv-news.ts           ITV News (Contentful) parser
    shared/extract.ts     Shared extraction utilities (JSON-LD, OG tags, etc.)
    shared/playwright.ts  Shared Playwright browser lifecycle (for headed sources)
    types.ts              ArticleSource interface
    index.ts              Source registry + getSourceById helper
  pipeline/
    poll.ts               Poll orchestrator (discover → scrape → write)
    output.ts             Article JSON file writer (intermediary + ANF)
    db/
      schema.ts           Drizzle ORM table definitions
      client.ts           SQLite connection (bun:sqlite + Drizzle)
      queries.ts          Typed query helpers (insert, status transitions)
  transformers/
    anf/
      index.ts            Public API: transformToAnf(Article) → AnfArticleDocument
      types.ts            ANF TypeScript type definitions
      components.ts       Component mappers (14 intermediary types → ANF roles)
      document.ts         Document assembly, componentTextStyles + componentLayouts
      html.ts             HTML sanitizer (tag allowlist + substitution)
      validate.ts         Zod schema validation for ANF output
tests/
  fixtures/               HTML fixtures for parser tests
  pipeline/               Pipeline component tests
docs/
  vision.md               Product vision and mission
  architecture.md         System architecture overview
  schema.md               Intermediary JSON schema documentation
  features.md             Feature roadmap
  assumptions.md          Working assumptions and risks
  plans/                  Design documents
  decisions/              Architecture Decision Records (ADRs)
output/                   Generated article JSON (gitignored)
data/                     SQLite database (gitignored)
```

## Further reading

- [Vision and mission](docs/vision.md)
- [Architecture overview](docs/architecture.md)
- [Intermediary JSON schema](docs/schema.md)
- [Decision records](docs/decisions/)

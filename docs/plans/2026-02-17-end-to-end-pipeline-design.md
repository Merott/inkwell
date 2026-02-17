# End-to-End Pipeline Design

**Date:** 2026-02-17
**Status:** In Progress

## Goal

Turn Inkwell from a stateless CLI tool into a pipeline that can run on a schedule: discover new articles, scrape them, track state, and write output to disk.

## Architecture

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

## Components

### Publisher Registry (`src/publishers.ts`)
- Single source of truth for all publisher definitions
- Typed array validated with Zod at load time
- Maps publisher ID → source ID + homepage URL
- Exports `getPublisher(id)`, `getEnabledPublishers()`

### State Store (`src/pipeline/db/`)
- SQLite via `bun:sqlite` + Drizzle ORM
- Single `articles` table: `url` (PK), `publisherId`, `discoveredAt`, `scrapedAt?`, `status`, `error?`, `outputPath?`
- Status enum: `discovered` → `scraped` | `failed`
- DB file at `data/inkwell.db` (gitignored)
- In-memory DB (`:memory:`) for tests

### Output Writer (`src/pipeline/output.ts`)
- Writes validated article JSON to `output/<publisherId>/<date>-<slug>.json`
- Slug extracted from article URL path
- Date from `publishedAt`, fallback to current date

### Poll Orchestrator (`src/pipeline/poll.ts`)
- `pollPublisher(config, source, db)` → per-publisher poll cycle
- `pollAll(options?)` → iterates enabled publishers
- Returns `{ discovered, scraped, failed, skipped }` counts
- One article failure doesn't halt the run

### CLI Integration (`src/cli.ts`)
- New `poll` command: `bun run poll [--publisher <id>] [--all]`
- Summary table to stderr, detailed JSON to stdout

## Design Decisions

- **SQLite over flat files for state** — need idempotent upserts and status queries; SQLite is zero-config, embedded, and Drizzle provides typed queries
- **Drizzle ORM** — lightweight, type-safe, supports `bun:sqlite` natively
- **Retry: once per cycle** — failed articles are retried on next poll, no backoff logic (YAGNI)
- **No Playwright sharing** — each ITV scrape launches its own browser; optimise later if slow
- **Publisher config separate from sources** — sources define CMS parsing logic, publisher config defines which publishers are active and their homepages

## File Structure

```
src/
  publishers.ts             # Publisher registry
  pipeline/
    poll.ts                # Orchestrator
    output.ts              # JSON file writer
    db/
      schema.ts            # Drizzle table definitions
      client.ts            # DB connection + migrations
      queries.ts           # Typed query helpers
```

# ADR-005: SQLite for Pipeline State Management

**Date:** 2026-02-17
**Status:** Accepted

## Context

Inkwell's poll orchestrator needs to track which articles have been discovered and scraped so that repeated runs are idempotent — already-scraped articles are skipped, failed articles are retried.

## Decision

Use SQLite (via `bun:sqlite`) with Drizzle ORM for local state management.

- Single `articles` table with URL as primary key
- Status enum: `discovered` → `scraped` | `failed`
- DB file at `data/inkwell.db` (gitignored)
- In-memory DB (`:memory:`) for tests

## Alternatives Considered

- **Flat file (JSON)** — simpler but no idempotent upserts, slow for lookups as article count grows, no concurrent access safety
- **External database (Postgres, etc.)** — overkill for a PoC, adds deployment complexity
- **In-memory only** — no persistence across runs

## Consequences

- Zero-config: SQLite is embedded, no server process needed
- Drizzle provides typed queries with `bun:sqlite` native driver (no `better-sqlite3`)
- WAL mode enabled for concurrent read safety
- Schema defined in code (`src/pipeline/db/schema.ts`) with auto-create on connection
- Future: can migrate to Drizzle's migration system if schema evolves

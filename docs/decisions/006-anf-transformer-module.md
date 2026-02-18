# ADR-006: ANF Transformer as Co-Located Module

**Date:** 2026-02-18
**Status:** Accepted

## Context

Inkwell's intermediary JSON needs to be transformed into Apple News Format (ANF) for syndication. ADR-001 decided that transformers should be separate services. However, for the PoC, we need a working ANF transformer without the overhead of a separate repository, build system, and deployment.

## Decisions

### 1. Co-located module, not a separate repo

The ANF transformer lives at `src/transformers/anf/` inside the Inkwell repository. It is architecturally decoupled — it imports only the `Article` type from `@/schema/types.ts` and nothing from `src/sources/` or `src/pipeline/`. This makes future extraction to a separate package straightforward.

**Why:** Separate repo adds build/deploy overhead that doesn't help during PoC. The decoupling boundary is enforced by import discipline, not repo separation.

### 2. Filtered HTML over Markdown for text components

ANF supports `html`, `markdown`, and `none` text formats. We chose to pass through filtered HTML rather than converting to Markdown.

**Why:** The intermediary JSON already stores rich text as HTML. Converting HTML to Markdown is lossy (no standard for round-tripping) and introduces a dependency. ANF's HTML support covers our needs. The sanitizer strips disallowed tags and attributes, substitutes semantic equivalents (`mark` to `b`, `cite` to `em`), and preserves only `href` on `<a>` tags.

### 3. Lenient per-component, strict per-document error strategy

Individual component mapping failures produce warnings but do not abort the transform. The assembled document is then validated with Zod — if the result is structurally invalid (e.g., zero components after dropping), validation throws.

**Why:** ANF rejects entire articles for any structural error. Being lenient at the component level maximises content throughput (a dropped `rawHtml` block shouldn't kill an otherwise valid article). Being strict at the document level catches assembly bugs and ensures output is always valid ANF.

### 4. Default componentTextStyles with sensible typography

The transformer includes a default set of `componentTextStyles` covering body, headings 1-6, captions, quotes, pullquotes, and monospace. These use IowanOldStyle for body, HelveticaNeue-Bold for headings, and Menlo for code.

**Why:** ANF requires `componentTextStyles` for text rendering. Defaults provide a readable baseline without requiring per-publisher configuration. Publishers can override these later via configuration.

### 5. Dual integration: standalone CLI + poll flag

Two entry points: `bun run transform <path>` for batch/ad-hoc conversion of existing intermediary JSON, and `bun run poll --transform` for transforming articles immediately after scraping.

**Why:** Standalone CLI enables reprocessing without re-scraping (a key benefit from ADR-001). The `--transform` flag supports the common case where you want the full pipeline in one command.

## Consequences

- ANF transformer shares the same repo, test runner, and CI as extraction — simpler for PoC
- Import discipline (no source/pipeline imports) must be maintained manually; a future lint rule could enforce this
- Extracting to a separate package later requires moving `src/transformers/anf/` and the `Article` type — no other dependencies to untangle
- Default text styles may need publisher-specific overrides as the product matures

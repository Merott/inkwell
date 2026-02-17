# ADR-002: Shared Extraction Utilities

**Date**: 2026-02-13
**Status**: Accepted

## Context

Building the second CMS parser (Ghost) revealed that several extraction functions in the ITV News/Contentful parser were not CMS-specific — they operate on standard HTML conventions (JSON-LD, Open Graph, HTML entities, ISO dates). Duplicating them across parsers would create maintenance burden and inconsistency.

## Decision

Extract reusable extraction logic into `src/sources/shared/extract.ts`. Each CMS parser imports shared utilities and keeps only CMS-specific logic (DOM selectors, data structure traversal, content mapping).

**Shared** (standard HTML conventions):
- `extractJsonLd($)` — JSON-LD structured data
- `extractOgTags($)` — Open Graph meta tags
- `escapeHtml(str)` — HTML entity escaping
- `ensureIso(date)` — date normalization
- `detectEmbedPlatform(url)` — embed URL → platform mapping

**CMS-specific** (stays in each parser):
- Content container selectors (`.gh-content`, `#__NEXT_DATA__`)
- Body traversal strategy (DOM walk vs JSON blob)
- Metadata assembly from CMS-specific data structures
- Fetch strategy (Playwright vs simple fetch)

## Consequences

- New parsers get metadata extraction for free by importing shared utils
- Shared utils are independently unit-tested (`tests/sources/shared/extract.test.ts`)
- Adding a new embed platform is a single change in shared code
- The boundary is clear: standard HTML = shared, CMS DOM = parser-specific

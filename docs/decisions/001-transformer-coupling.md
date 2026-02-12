# ADR-001: Transformer Coupling

**Status**: Accepted
**Date**: 2026-02-12

## Context

Inkwell extracts content from publisher websites and produces a normalized intermediary JSON. This JSON must then be transformed into platform-specific formats — Apple News Format (ANF), RSS, Google News markup, Flipboard, etc.

The question: should these transformers live inside Inkwell, or be separate services?

## Decision

**Transformers are separate services.** Inkwell's sole responsibility is ingestion through to validated intermediary JSON. Each downstream syndication format is handled by its own transformer service that consumes Inkwell's output.

## Options Considered

### Option A: Transformers Inside Inkwell

Inkwell takes a URL and outputs ANF, RSS, etc. directly.

| Pros | Cons |
|---|---|
| Single service to deploy and monitor | Tightly couples ingestion with output formatting |
| No inter-service communication overhead | Adding a new platform requires modifying the scraper |
| Intermediary schema is an internal detail | Harder to isolate scraping bugs from transformation bugs |
| Faster end-to-end processing | ANF fix requires redeploying the scraper |

### Option B: Separate Services (Chosen)

Inkwell outputs intermediary JSON. Separate transformer services consume it.

| Pros | Cons |
|---|---|
| Clear separation of concerns | More infrastructure to manage |
| Intermediary JSON is a stable, versioned contract | Schema becomes a public API — breaking changes are harder |
| New syndication targets without touching Inkwell | Serialization/deserialization overhead between services |
| Can reprocess existing JSON without re-scraping | |
| Different scaling profiles (scraping = I/O heavy, transforms = CPU light) | |
| Independent team velocity — scraping team vs. format team | |
| Clearer error boundaries for self-healing AI | |

### Option C: Plugin Hybrid

Single Inkwell service with pluggable transformer modules.

| Pros | Cons |
|---|---|
| Single deployment simplicity | Plugin architecture complexity without isolation benefit |
| Transformers swappable without core changes | Still redeploys everything together |
| Internal schema flexibility | Doesn't achieve independent scaling |

## Rationale

Option B wins on the criteria that matter most.

Currently, engineers span the entire conversion process from scraper to ANF. Decoupling the scraper is an explicit goal — it will make a significant difference to team focus and velocity.

1. **Self-healing pipeline clarity** — when an error surfaces, it's immediately clear whether it's an extraction problem (Inkwell) or a transformation problem (downstream). The primary pain point is publisher-side changes breaking extraction — isolating that from ANF transformation makes errors actionable.

2. **ANF strictness isolation** — ANF is extremely strict (a single malformed embed = article rejected by Apple). Separating extraction from transformation means extraction quality issues are caught at the intermediary JSON boundary, not discovered when Apple rejects the article.

3. **Reprocessing without re-scraping** — when a transformer is fixed or a new platform is added, all previously extracted content can be reprocessed without hitting publisher sites again.

4. **Independent evolution** — syndication platforms change their format requirements independently of publisher site changes. Decoupling means these two sources of change don't interfere with each other. Once ANF is nailed, other outputs are simple in comparison — separate services let the team focus on ANF quality without the scraper getting in the way.

5. **Scale characteristics** — scraping hundreds of sites is I/O bound; transforming JSON to ANF is CPU-light and fast. These benefit from independent scaling strategies.

## Consequences

- The intermediary JSON schema is a **versioned contract** between Inkwell and all downstream consumers. Changes must be managed carefully (backward compatibility, versioning).
- Need an inter-service communication mechanism (event queue, API, or shared store) — to be decided during implementation.
- More services to deploy, monitor, and maintain.
- Inkwell can be developed and tested in complete isolation from syndication platform specifics.

# Inkwell — Architecture Overview

> No technology choices are made in this document. This describes the logical components and their responsibilities.

## System Boundary

Inkwell's contract:

- **Input**: a publisher configuration (site URL, CMS type, credentials, preferences)
- **Output**: validated intermediary JSON documents, one per article

Inkwell does **not** transform content into Apple News Format or any other syndication-specific format. Transformers are separate services that consume Inkwell's output (see [ADR-001](decisions/001-transformer-coupling.md)).

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Inkwell                          │
│                                                         │
│  ┌──────────┐   ┌─────────┐   ┌───────────┐   ┌─────┐ │
│  │  Source   │──▶│ Content │──▶│  Parser / │──▶│Valid-│ │
│  │ Resolver  │   │ Fetcher │   │ Extractor │   │ator │ │
│  └──────────┘   └─────────┘   └───────────┘   └─────┘ │
│       ▲                                           │     │
│       │                                           ▼     │
│  ┌──────────┐                              ┌──────────┐ │
│  │Publisher │                              │Intermediary│ │
│  │  Config  │                              │   JSON    │ │
│  └──────────┘                              └──────────┘ │
└─────────────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                                    ┌───────────────────────┐
                                    │  Downstream Services   │
                                    │  (ANF Transformer,     │
                                    │   RSS Generator, etc.) │
                                    └───────────────────────┘
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

## Open Architectural Questions

1. **State management**: where does Inkwell track which articles have been seen/processed? Internal database? External store?
2. **Queue/event system**: does Inkwell push validated JSON to a queue for transformers to consume, write to a store, or call transformer APIs directly?
3. **Retry and failure handling**: how does Inkwell handle transient fetch failures vs. persistent structural changes?
4. **Multi-tenancy**: is there one Inkwell instance for all publishers, or isolated instances per publisher / group?

These will be resolved during implementation planning.

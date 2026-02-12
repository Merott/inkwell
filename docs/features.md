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

Inkwell supports two ingestion modes:

### Poll Mode (Scheduled)
- Checks RSS feeds, API endpoints, or sitemaps/homepages on a configurable schedule (frequency TBD — see [assumptions](assumptions.md#high-risk))
- Detects new and updated articles
- Suitable for most publishers

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

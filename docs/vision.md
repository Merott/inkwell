# Inkwell

**A content ingestion engine.**

## Problem

Publishers want their content on Apple News, Flipboard, Google News, and other syndication platforms — but lack the technical skills to get it there. A content syndication platform can abstract this complexity away, offering a no-code path from CMS to syndication.

The ingestion layer — the part that reads a publisher's site and extracts their content — needs improvement. The current system ingests via RSS feeds and APIs, but the majority of problems stem from publishers making changes to their site frontend or API content. At the scale of hundreds of sites, these changes are frequent and unpredictable, and the extraction needs tight, per-publisher guardrails rather than a one-size-fits-all approach.

## Mission

Reliably extract rich, structured content from any publisher website and normalize it into a universal intermediary format — regardless of the source CMS, feed availability, or site structure.

## What Inkwell Is

Inkwell is the **content source of truth**. It sits at the start of the content pipeline:

```
Publisher's Site → [Inkwell] → Intermediary JSON → [Transformers] → ANF / RSS / Google News / etc.
```

It is not a product publishers interact with directly. It powers content delivery behind the scenes.

## What Inkwell Owns

- Detecting the best ingestion strategy per publisher (RSS, API, or HTML scraping)
- Fetching and parsing content from any supported source
- Extracting articles with full fidelity: body, metadata, media, embeds, paywall markers
- Outputting a validated intermediary JSON document per article

## What Inkwell Does Not Own

- Transformation to Apple News Format or other syndication-specific formats (separate services)
- Publishing or delivery to syndication platforms
- Publisher-facing UI or configuration

## Target Users

Engineers. Inkwell is an internal service that serves publishers indirectly by powering the content pipeline.

## Future Vision

Inkwell is designed as the foundation for a **self-healing content pipeline**:

1. Extraction errors in production surface in monitoring (e.g. Sentry or equivalent)
2. Errors automatically trigger issue creation in the team's source control platform (e.g. GitHub)
3. An AI agent picks up the issue and opens a PR with a fix, including a Playwright test recording as proof
4. A human reviews and merges
5. As trust in the AI grows, the loop tightens — eventually reaching fully automated fix-and-deploy

This is a long-term vision. The immediate goal is a solid, well-structured scraper that makes this future possible.

> **Note**: Several statements in this document are working assumptions. See [assumptions.md](assumptions.md) for the full list and risk assessment.

## Supported Publishers

Publishers use a wide range of CMSes including WordPress, Ghost, Squarespace, Webflow, Drupal, Medium, Wix, Craft CMS, Contentful, Contentstack, RebelMouse, and bespoke/custom systems. Inkwell must handle all of these, leveraging CMS-specific knowledge where available for more reliable extraction.

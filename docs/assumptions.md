# Inkwell — Working Assumptions

Assumptions made during initial design that need validation with Flatplan. Grouped by risk level — **high-risk** assumptions could significantly alter design decisions if wrong.

## High Risk

### Current system & process

| # | Assumption | What we don't know | Documented in |
|---|---|---|---|
| 1 | Inkwell will serve both Flatplan and Press Publish | Whether Press Publish has its own ingestion path or architecture | vision.md |
| 2 | Flatplan uses (or will use) Sentry for monitoring | No knowledge of current observability tooling | vision.md |

### Scale & frequency

| # | Assumption | What we don't know | Documented in |
|---|---|---|---|
| 3 | Polling frequency TBD | Feed spec says "fetched continually" — actual interval unknown. Could be minutes, not hours. | features.md |

### Publisher capabilities

| # | Assumption | What we don't know | Documented in |
|---|---|---|---|
| 4 | Publishers can/will configure webhooks for push mode | How many publishers have webhook capabilities or willingness to set them up | features.md, architecture.md |
| 5 | Publishers provide authenticated access for paywalled content | Whether and how publishers grant Flatplan access behind paywalls | features.md |
| 6 | Paywall boundaries are detectable from server-rendered HTML | Many paywalls are JS-rendered client-side; may not be extractable via scraping | features.md, schema.md |

### Architecture

| # | Assumption | What we don't know | Documented in |
|---|---|---|---|
| 7 | Intermediary JSON will be persisted for reprocessing | Haven't decided storage strategy; reprocessing benefit depends on this | decisions/001 |

## Medium Risk

### Content & extraction

| # | Assumption | What we don't know | Documented in |
|---|---|---|---|
| 8 | CMS API is always the richest ingestion source | Content received via API can also change unexpectedly; API reliability varies by CMS/publisher | features.md |
| 9 | Social embeds we need: YouTube, Facebook, Instagram, TikTok, X, Dailymotion | Actual embed frequency across Flatplan's publisher base; may be missing Reddit, LinkedIn, Threads, Pinterest | features.md, schema.md |
| 10 | Series/collection membership is extractable | Don't know how many publishers use series, or if it's exposed in markup | features.md |
| 11 | "At least one author" is a quality requirement | Wire service articles, editorial board pieces may not have named authors | architecture.md |
| 12 | Ad placement hints belong in the intermediary schema | Don't know if Flatplan injects ads at the transformer level or handles it outside the content pipeline | schema.md |

### Platform specs

| # | Assumption | What we don't know | Documented in |
|---|---|---|---|
| 13 | ANF thumbnail requires min 300x300, aspect 1:2 to 3:1 | Sourced from research but may be outdated; Apple may have changed constraints | schema.md |
| 14 | ANF image limits: max 20MB, max 6000x6000px | Same — needs verification against current docs | schema.md |
| 15 | Our schema is a true superset of all downstream targets | Haven't inventoried Google News, Flipboard, SmartNews requirements in detail | schema.md |

## Low Risk

### Design decisions

| # | Assumption | What we don't know | Documented in |
|---|---|---|---|
| 16 | Ingestion preference order: API > RSS > scrape | Sensible default but may not hold for every publisher | features.md |
| 17 | Three urgency levels (standard, priority, breaking) are sufficient | Whether Flatplan's pipeline has any urgency concept today | schema.md |
| 18 | Three paywall statuses (free, metered, premium) are sufficient | Real-world paywall variety (geographic, registration, tiered freemium) | schema.md, features.md |
| 19 | Error categories (structural, content, fetch, degradation) are comprehensive | May need auth expiry, rate limiting, or other categories | features.md |
| 20 | robots.txt compliance is required | If publishers contractually grant access, robots.txt may not apply | architecture.md |
| 21 | Push mode webhooks deliver only a notification (not full content) | Some CMSes may send full payloads; others send just a URL | architecture.md |


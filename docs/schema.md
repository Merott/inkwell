# Inkwell — Intermediary JSON Schema

This document defines the normalized intermediary JSON structure that Inkwell produces per article. It is designed as a **platform-agnostic superset** — rich enough to express everything that any downstream syndication target (ANF, RSS, Google News, Flipboard, etc.) might need.

> This is a design document, not a JSON Schema file. A formal JSON Schema will be created during implementation.

## Design Principles

1. **Superset over intersection** — capture everything any target platform could use, even if some targets ignore certain fields
2. **Structured over raw** — article bodies are component trees, not HTML strings
3. **Explicit over inferred** — metadata like paywall status or content urgency is explicitly declared, not left for downstream consumers to guess
4. **Extensible** — new component types or metadata fields can be added without breaking existing consumers

## Top-Level Structure

```json
{
  "version": "1.0",
  "extractedAt": "2026-02-12T12:00:00Z",
  "source": { ... },
  "metadata": { ... },
  "authors": [ ... ],
  "body": [ ... ],
  "media": [ ... ],
  "relatedContent": [ ... ],
  "paywall": { ... },
  "custom": { ... }
}
```

| Field | Required | Description |
|---|---|---|
| `version` | Yes | Schema version (semver) |
| `extractedAt` | Yes | ISO 8601 timestamp of extraction |
| `source` | Yes | Where this content was extracted from |
| `metadata` | Yes | Article metadata |
| `authors` | Yes | List of authors (may be empty) |
| `body` | Yes | Structured article body as component array |
| `media` | No | Standalone media assets referenced by body components |
| `relatedContent` | No | Related articles, read-next links |
| `paywall` | No | Paywall/access information |
| `custom` | No | Publisher-specific or CMS-specific extra data |

## Source

Provenance information for the extracted content.

```json
{
  "source": {
    "url": "https://example.com/articles/my-article",
    "canonicalUrl": "https://example.com/articles/my-article",
    "publisherId": "pub_abc123",
    "cmsType": "wordpress",
    "ingestionMethod": "scrape",
    "feedUrl": "https://example.com/feed.xml"
  }
}
```

## Metadata

```json
{
  "metadata": {
    "title": "Article Title",
    "subtitle": "Optional subtitle or dek",
    "excerpt": "Short summary or description",
    "language": "en",
    "publishedAt": "2026-02-12T10:00:00Z",
    "modifiedAt": "2026-02-12T11:00:00Z",
    "categories": ["Politics", "World"],
    "tags": ["election", "EU"],
    "keywords": ["election", "european union", "politics"],
    "section": "World News",
    "thumbnail": {
      "url": "https://example.com/images/thumb.jpg",
      "altText": "Description of image",
      "width": 1200,
      "height": 630
    },
    "urgency": "standard",
    "contentRating": "general"
  }
}
```

| Field | Required | Notes |
|---|---|---|
| `title` | Yes | |
| `subtitle` | No | Also known as dek, standfirst, subheadline |
| `excerpt` | No | For feed/preview purposes |
| `language` | Yes | BCP 47 language tag. Required by ANF. |
| `publishedAt` | Yes | ISO 8601 |
| `modifiedAt` | No | ISO 8601 |
| `categories` | No | Broad editorial categories |
| `tags` | No | Granular topic tags |
| `keywords` | No | SEO keywords (may overlap with tags) |
| `section` | No | Site section the article belongs to |
| `thumbnail` | No | Hero/preview image. ANF requires min 300x300, aspect 1:2 to 3:1. |
| `urgency` | No | `"standard"` \| `"priority"` \| `"breaking"` — signals for downstream processing speed |
| `contentRating` | No | `"general"` \| `"mature"` — maps to ANF explicit content flag |

## Authors

```json
{
  "authors": [
    {
      "name": "Jane Doe",
      "url": "https://example.com/authors/jane-doe",
      "bio": "Senior correspondent covering world politics.",
      "avatar": {
        "url": "https://example.com/images/jane.jpg",
        "altText": "Jane Doe headshot"
      }
    }
  ]
}
```

## Body

The article body is an ordered array of **components**. This is a structured tree, not HTML — enabling lossless transformation to ANF components, RSS content, or any other format.

### Component Types

#### Text Components

```json
{ "type": "paragraph", "text": "Article text with <em>inline</em> formatting.", "format": "html" }
{ "type": "heading", "level": 2, "text": "Section Title", "format": "text" }
{ "type": "blockquote", "text": "A notable quote.", "attribution": "Source Name" }
{ "type": "pullquote", "text": "A highlighted excerpt.", "attribution": "Source Name" }
{ "type": "list", "style": "unordered", "items": ["First item", "Second item"] }
{ "type": "list", "style": "ordered", "items": ["Step one", "Step two"] }
{ "type": "codeBlock", "code": "const x = 1;", "language": "javascript" }
{ "type": "preformatted", "text": "Preformatted text block" }
```

The `format` field on text components indicates how inline formatting is expressed:
- `"text"` — plain text, no formatting
- `"html"` — inline HTML tags (`<em>`, `<strong>`, `<a>`, `<code>`, etc.)
- `"markdown"` — Markdown inline syntax (ANF supports Markdown natively)

#### Media Components

```json
{
  "type": "image",
  "url": "https://example.com/images/hero.jpg",
  "caption": "Description of what's shown",
  "credit": "Photo: John Smith / Agency",
  "altText": "Accessible description",
  "width": 2400,
  "height": 1600,
  "mediaRef": "media_001"
}
```

```json
{
  "type": "video",
  "url": "https://example.com/video.m3u8",
  "thumbnailUrl": "https://example.com/video-thumb.jpg",
  "caption": "Video description",
  "credit": "Video: Example News",
  "duration": 120
}
```

```json
{
  "type": "embed",
  "platform": "youtube",
  "embedUrl": "https://www.youtube.com/watch?v=abc123",
  "caption": "Optional caption",
  "fallbackText": "Watch on YouTube: Video Title"
}
```

Supported `platform` values: `"youtube"`, `"vimeo"`, `"dailymotion"`, `"facebook"`, `"instagram"`, `"tiktok"`, `"x"`, `"other"`

> **ANF note**: ANF has native component types for embeds — `EmbedWebVideo` (YouTube, Vimeo, Dailymotion only), `Tweet`, `Instagram`, `FacebookPost`, `TikTok`. These are rendered natively by Apple News, not via iframes. iframes and JavaScript are **not supported** in ANF.

#### Structural Components

```json
{ "type": "divider" }
{ "type": "table", "rows": [["Header 1", "Header 2"], ["Cell 1", "Cell 2"]], "headerRows": 1 }
{ "type": "rawHtml", "html": "<div class='custom-widget'>...</div>" }
```

`rawHtml` is an escape hatch for content that doesn't map to any structured component. Downstream transformers may strip or convert this.

#### Advertising Hints

```json
{ "type": "adPlacement", "slot": "mid-article" }
```

> **ANF note**: ANF supports BannerAdvertisement and MediumRectangleAdvertisement components, plus AdvertisementAutoPlacement for automatic ad insertion.

## Media Registry

Standalone media assets referenced by body components via `mediaRef`. This avoids duplicating metadata when the same image appears multiple times.

```json
{
  "media": [
    {
      "id": "media_001",
      "type": "image",
      "url": "https://example.com/images/hero.jpg",
      "mimeType": "image/jpeg",
      "width": 2400,
      "height": 1600,
      "altText": "Accessible description",
      "caption": "Description of what's shown",
      "credit": "Photo: John Smith / Agency",
      "fileSize": 245000
    }
  ]
}
```

> **ANF note**: ANF supports JPEG, PNG, GIF, and WebP. Max 20MB, max 6000x6000px.

## Related Content

```json
{
  "relatedContent": [
    {
      "type": "readNext",
      "title": "Related Article Title",
      "url": "https://example.com/related-article"
    },
    {
      "type": "series",
      "title": "Part 2 of 5: Series Name",
      "url": "https://example.com/series/part-2"
    }
  ]
}
```

## Paywall

```json
{
  "paywall": {
    "status": "metered",
    "previewBoundary": 3,
    "accessTier": "premium"
  }
}
```

| Field | Description |
|---|---|
| `status` | `"free"` \| `"metered"` \| `"premium"` |
| `previewBoundary` | Body component index where free preview ends |
| `accessTier` | Publisher-defined access level label |

> **ANF note**: ANF itself has no paywall markup within the article JSON. Paywall behavior is controlled at the API/channel level (e.g., `isPreview`, section assignment). However, Inkwell captures paywall info from the source site so downstream services can make the right API-level decisions.

## ANF Mapping Reference

High-level mapping from Inkwell components to ANF components (detailed mapping is the ANF transformer's responsibility):

| Inkwell Component | ANF Component |
|---|---|
| `paragraph` | `Body` |
| `heading` | `Heading` / `Title` |
| `image` | `Image` / `Photo` / `Figure` |
| `video` | `Video` (HLS) / `EmbedWebVideo` |
| `embed` (YouTube/Vimeo) | `EmbedWebVideo` |
| `embed` (Dailymotion) | `EmbedWebVideo` |
| `embed` (X/Twitter) | `Tweet` |
| `embed` (Instagram) | `Instagram` |
| `embed` (Facebook) | `FacebookPost` |
| `embed` (TikTok) | `TikTok` |
| `blockquote` | `Quote` |
| `pullquote` | `PullQuote` |
| `list` | `Body` (with Markdown list syntax) |
| `divider` | `Divider` |
| `adPlacement` | `BannerAdvertisement` / `MediumRectangleAdvertisement` |
| `rawHtml` | Stripped or converted |

### Key ANF Constraints

For reference when designing extractors — content that Inkwell captures but ANF cannot directly represent:

- **No iframes or JavaScript** — all content must map to ANF components
- **Limited HTML subset** in text — only: `<a>`, `<b>`, `<blockquote>`, `<br>`, `<code>`, `<del>`, `<em>`, `<h1>`-`<h6>`, `<li>`, `<ol>`, `<p>`, `<pre>`, `<s>`, `<strong>`, `<sub>`, `<sup>`, `<ul>` (no `<div>`, `<table>`, `<img>`, `<video>`, `<script>`, `<style>`)
- **Web video limited to YouTube, Vimeo, Dailymotion** — other platforms need fallback handling
- **Image limits**: max 20MB, max 6000x6000px, JPEG/PNG/GIF/WebP only
- **No custom fonts via URL** — only system fonts or bundled fonts

### Key ANF References

- [Apple News Format documentation](https://developer.apple.com/documentation/apple_news/apple_news_format)
- [ANF component reference](https://developer.apple.com/documentation/apple_news/apple_news_format/components)
- [JSON structure and ArticleDocument](https://developer.apple.com/documentation/applenews/json-concepts-and-article-structure)
- [Using Markdown with ANF](https://developer.apple.com/documentation/applenews/using-markdown-with-apple-news-format)
- [Using HTML with ANF](https://developer.apple.com/documentation/apple_news/apple_news_format/components/using_html_with_apple_news_format)
- [Image, video, and font specs](https://support.apple.com/guide/news-publisher/image-video-and-font-specifications-apd6b6859a53/icloud)
- [Managing advertisements](https://developer.apple.com/documentation/apple_news/apple_news_format/managing_advertisements_in_your_article)
- [Article metadata fields](https://developer.apple.com/documentation/applenewsapi/create-article-metadata-fields)
- [Community ANF JSON Schema](https://github.com/lonelyplanet/apple-news-format-schema)

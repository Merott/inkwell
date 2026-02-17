# ANF Transformer Design

## Goal

Build an Apple News Format (ANF) transformer that consumes Inkwell's intermediary JSON and outputs valid ANF `ArticleDocument` JSON. Proves the intermediary schema is sufficient for downstream transformation.

## Decisions

- Lives in `src/transformers/anf/` — same repo, decoupled in code (no imports from `src/sources/`)
- Full component coverage — all 14 intermediary component types mapped
- Filtered HTML — inline HTML passed through allowlist sanitizer (no Markdown conversion)
- Standalone CLI + optional `--transform` flag on poll
- Pure function — no I/O in the transformer itself

## Module Structure

```
src/transformers/anf/
├── index.ts              # Public API: transformToAnf(article) → TransformResult
├── types.ts              # ANF TypeScript types (ArticleDocument, components, etc.)
├── document.ts           # Top-level document assembly (metadata, layout, identifier)
├── components.ts         # Inkwell → ANF component mappers
├── html.ts               # HTML allowlist sanitizer
└── validate.ts           # Zod schema for ANF output validation
```

## Component Mapping

| Inkwell | ANF `role` | Notes |
|---|---|---|
| `paragraph` | `body` | HTML filtered through allowlist |
| `heading` | `heading1`–`heading6` | `level` → role |
| `blockquote` | `quote` | Attribution appended as styled text if present |
| `pullquote` | `pullquote` | Same attribution handling |
| `list` | `body` | Items → HTML `<ul>`/`<ol>` list markup |
| `codeBlock` | `body` | Wrapped in `<pre>`, monospace componentTextStyle |
| `preformatted` | `body` | Same monospace treatment |
| `image` | `photo` | `caption` as child caption component |
| `video` | `video` | `stillURL` from `thumbnailUrl` |
| `embed` (youtube/vimeo/dailymotion) | `embedwebvideo` | ANF-native web video |
| `embed` (x) | `tweet` | ANF-native |
| `embed` (instagram) | `instagram` | ANF-native |
| `embed` (facebook) | `facebook_post` | ANF-native |
| `embed` (tiktok) | `tiktok` | ANF-native |
| `embed` (other) | `body` | Fallback: `fallbackText` + link |
| `divider` | `divider` | Direct |
| `table` | `htmltable` | Build `<table>` from `rows[][]` + `headerRows` |
| `rawHtml` | *dropped* | Warning logged. No safe ANF equivalent. |
| `adPlacement` | `bannerAdvertisement` | `bannerType: "any"` |

## Document Assembly

```json
{
  "version": "1.9",
  "identifier": "<publisherId>-<slug>",
  "title": "metadata.title",
  "subtitle": "metadata.subtitle",
  "language": "metadata.language",
  "layout": { "columns": 7, "width": 1024 },
  "components": [ ... ],
  "componentTextStyles": { ... },
  "metadata": {
    "authors": ["authors[].name"],
    "excerpt": "metadata.excerpt",
    "canonicalURL": "source.canonicalUrl ?? source.url",
    "thumbnailURL": "metadata.thumbnail.url",
    "dateCreated": "metadata.publishedAt",
    "datePublished": "metadata.publishedAt",
    "dateModified": "metadata.modifiedAt"
  }
}
```

### Default componentTextStyles

Minimal set for readable output:
- `default-body` — 16pt serif
- `default-heading-1` through `default-heading-6` — scaled sizes
- `default-caption` — smaller, muted
- `default-pullquote` — italic, larger
- `default-quote` — italic body
- `default-monospace` — monospace for code/preformatted

### Layout

Standard ANF 7-column grid at 1024pt. All components full-width by default.

## HTML Sanitizer

Strict allowlist filter using Cheerio.

**Allowed tags**: `<a>`, `<b>`, `<strong>`, `<em>`, `<i>`, `<code>`, `<del>`, `<s>`, `<sub>`, `<sup>`, `<br>`, `<ul>`, `<ol>`, `<li>`, `<p>`, `<pre>`, `<blockquote>`

**Allowed attributes**: `href` on `<a>` only.

**Behaviour**:
- Allowed tags pass through
- Disallowed tags unwrapped by default (keep inner text, remove tag)
- Substitution map for tags with semantic intent: `<mark>` → `<b>`, `<cite>` → `<em>`, `<u>` → `<em>`, `<ins>` → `<em>`
- Disallowed attributes stripped
- Empty tags after stripping removed

## Error Handling

**Lenient per-component, strict per-document.**

- Per-component: skip + warn on transform failure. One bad component doesn't kill the article.
- Per-document: final ANF must pass Zod validation. Missing required fields = hard error.

### TransformResult

```ts
interface TransformResult {
  document: AnfArticleDocument
  warnings: TransformWarning[]
}
```

Warnings emitted for: dropped `rawHtml`, unsupported embed fallbacks, stripped/substituted HTML tags, missing optional fields (e.g. no thumbnail).

## Integration

- `bun run transform <path>` — single file or directory batch
- `bun run poll --transform` — transforms in-memory after each scrape
- ANF output: `output/<publisherId>/anf/<date>-<slug>.json`

## Testing

**Unit — component mappers** (`tests/transformers/anf/components.test.ts`):
One test per component type → expected ANF output.

**Unit — HTML sanitizer** (`tests/transformers/anf/html.test.ts`):
Allowlist pass-through, unwrap, substitution, attribute stripping, nested structures.

**Integration — full document** (`tests/transformers/anf/document.test.ts`):
Complete Article fixture → valid ANF document. Reuse Ghost/ITV fixtures for end-to-end proof.

## ANF References

- [ANF documentation](https://developer.apple.com/documentation/apple_news/apple_news_format)
- [Component reference](https://developer.apple.com/documentation/apple_news/apple_news_format/components)
- [Using HTML with ANF](https://developer.apple.com/documentation/apple_news/apple_news_format/components/using_html_with_apple_news_format)
- [Community ANF JSON Schema](https://github.com/lonelyplanet/apple-news-format-schema)

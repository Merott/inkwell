# ANF Transformer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Inkwell intermediary JSON into valid Apple News Format (ANF) ArticleDocument JSON.

**Architecture:** Pure transformer function (Article → AnfArticleDocument) with HTML sanitizer, per-component mappers, and Zod validation. Decoupled module at `src/transformers/anf/` with no imports from `src/sources/`. CLI + pipeline integration.

**Tech Stack:** TypeScript (strict), Zod v4 (`zod/v4`), Cheerio (HTML sanitizer), Bun test runner.

**Design doc:** `docs/plans/2026-02-17-anf-transformer-design.md`

---

## Phase 1: Foundation — Types + HTML Sanitizer

### Task 1: ANF TypeScript Types

**Files:**
- Create: `src/transformers/anf/types.ts`

**Step 1: Create ANF type definitions**

```ts
// ANF ArticleDocument — top-level structure
// Reference: https://developer.apple.com/documentation/applenews/json-concepts-and-article-structure

export interface AnfArticleDocument {
  version: string
  identifier: string
  title: string
  subtitle?: string
  language: string
  layout: AnfLayout
  components: AnfComponent[]
  componentTextStyles: Record<string, AnfComponentTextStyle>
  metadata?: AnfMetadata
}

export interface AnfLayout {
  columns: number
  width: number
}

export interface AnfMetadata {
  authors?: string[]
  excerpt?: string
  canonicalURL?: string
  thumbnailURL?: string
  dateCreated?: string
  datePublished?: string
  dateModified?: string
}

// Component text styles
export interface AnfComponentTextStyle {
  fontName?: string
  fontSize?: number
  lineHeight?: number
  textAlignment?: 'left' | 'center' | 'right' | 'justified' | 'none'
  textColor?: string
  fontWeight?: string
  fontStyle?: string
  paragraphSpacingBefore?: number
  paragraphSpacingAfter?: number
}

// Components — discriminated union on `role`
export type AnfComponent =
  | AnfBodyComponent
  | AnfHeadingComponent
  | AnfQuoteComponent
  | AnfPullquoteComponent
  | AnfPhotoComponent
  | AnfVideoComponent
  | AnfEmbedWebVideoComponent
  | AnfTweetComponent
  | AnfInstagramComponent
  | AnfFacebookPostComponent
  | AnfTikTokComponent
  | AnfDividerComponent
  | AnfHtmlTableComponent
  | AnfBannerAdvertisementComponent
  | AnfCaptionComponent

export interface AnfBodyComponent {
  role: 'body'
  text: string
  format?: 'html' | 'markdown' | 'none'
  textStyle?: string
  layout?: string
}

export interface AnfHeadingComponent {
  role:
    | 'heading1'
    | 'heading2'
    | 'heading3'
    | 'heading4'
    | 'heading5'
    | 'heading6'
  text: string
  format?: 'html' | 'markdown' | 'none'
  textStyle?: string
}

export interface AnfQuoteComponent {
  role: 'quote'
  text: string
  format?: 'html' | 'markdown' | 'none'
  textStyle?: string
}

export interface AnfPullquoteComponent {
  role: 'pullquote'
  text: string
  format?: 'html' | 'markdown' | 'none'
  textStyle?: string
}

export interface AnfPhotoComponent {
  role: 'photo'
  URL: string
  caption?: string | AnfCaptionDescriptor
  accessibilityCaption?: string
}

export interface AnfCaptionDescriptor {
  text: string
  format?: 'html' | 'markdown' | 'none'
  textStyle?: string
}

export interface AnfCaptionComponent {
  role: 'caption'
  text: string
  format?: 'html' | 'markdown' | 'none'
  textStyle?: string
}

export interface AnfVideoComponent {
  role: 'video'
  URL: string
  stillURL?: string
  caption?: string
  accessibilityCaption?: string
}

export interface AnfEmbedWebVideoComponent {
  role: 'embedwebvideo'
  URL: string
  caption?: string
  accessibilityCaption?: string
}

export interface AnfTweetComponent {
  role: 'tweet'
  URL: string
}

export interface AnfInstagramComponent {
  role: 'instagram'
  URL: string
}

export interface AnfFacebookPostComponent {
  role: 'facebook_post'
  URL: string
}

export interface AnfTikTokComponent {
  role: 'tiktok'
  URL: string
}

export interface AnfDividerComponent {
  role: 'divider'
}

export interface AnfHtmlTableComponent {
  role: 'htmltable'
  html: string
}

export interface AnfBannerAdvertisementComponent {
  role: 'banner_advertisement'
  bannerType?: 'any' | 'standard' | 'double_height' | 'large'
}
```

**Step 2: Commit**

```
git add src/transformers/anf/types.ts
git commit -m "Add ANF TypeScript type definitions"
```

---

### Task 2: HTML Sanitizer

**Files:**
- Create: `tests/transformers/anf/html.test.ts`
- Create: `src/transformers/anf/html.ts`

**Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'bun:test'
import { sanitizeHtml } from '@/transformers/anf/html.ts'

describe('sanitizeHtml', () => {
  describe('allowed tags pass through', () => {
    it('keeps basic formatting tags', () => {
      expect(sanitizeHtml('<em>italic</em>')).toBe('<em>italic</em>')
      expect(sanitizeHtml('<strong>bold</strong>')).toBe(
        '<strong>bold</strong>',
      )
      expect(sanitizeHtml('<b>bold</b>')).toBe('<b>bold</b>')
      expect(sanitizeHtml('<i>italic</i>')).toBe('<i>italic</i>')
    })

    it('keeps links with href', () => {
      expect(sanitizeHtml('<a href="https://example.com">link</a>')).toBe(
        '<a href="https://example.com">link</a>',
      )
    })

    it('keeps code, del, sub, sup, br', () => {
      expect(sanitizeHtml('<code>x</code>')).toBe('<code>x</code>')
      expect(sanitizeHtml('<del>removed</del>')).toBe('<del>removed</del>')
      expect(sanitizeHtml('<sub>2</sub>')).toBe('<sub>2</sub>')
      expect(sanitizeHtml('<sup>2</sup>')).toBe('<sup>2</sup>')
      expect(sanitizeHtml('line<br>break')).toBe('line<br>break')
    })

    it('keeps list tags', () => {
      expect(sanitizeHtml('<ul><li>item</li></ul>')).toBe(
        '<ul><li>item</li></ul>',
      )
      expect(sanitizeHtml('<ol><li>item</li></ol>')).toBe(
        '<ol><li>item</li></ol>',
      )
    })

    it('keeps p, pre, blockquote', () => {
      expect(sanitizeHtml('<p>text</p>')).toBe('<p>text</p>')
      expect(sanitizeHtml('<pre>code</pre>')).toBe('<pre>code</pre>')
      expect(sanitizeHtml('<blockquote>quote</blockquote>')).toBe(
        '<blockquote>quote</blockquote>',
      )
    })

    it('keeps s tag', () => {
      expect(sanitizeHtml('<s>struck</s>')).toBe('<s>struck</s>')
    })
  })

  describe('disallowed tags unwrapped', () => {
    it('unwraps span', () => {
      expect(sanitizeHtml('<span class="x">text</span>')).toBe('text')
    })

    it('unwraps div', () => {
      expect(sanitizeHtml('<div>content</div>')).toBe('content')
    })

    it('unwraps font', () => {
      expect(sanitizeHtml('<font color="red">text</font>')).toBe('text')
    })

    it('unwraps nested disallowed tags', () => {
      expect(
        sanitizeHtml('<div><span>inner</span></div>'),
      ).toBe('inner')
    })
  })

  describe('tag substitution', () => {
    it('substitutes mark with b', () => {
      expect(sanitizeHtml('<mark>highlighted</mark>')).toBe(
        '<b>highlighted</b>',
      )
    })

    it('substitutes cite with em', () => {
      expect(sanitizeHtml('<cite>reference</cite>')).toBe(
        '<em>reference</em>',
      )
    })

    it('substitutes u with em', () => {
      expect(sanitizeHtml('<u>underlined</u>')).toBe('<em>underlined</em>')
    })

    it('substitutes ins with em', () => {
      expect(sanitizeHtml('<ins>inserted</ins>')).toBe('<em>inserted</em>')
    })
  })

  describe('attribute filtering', () => {
    it('strips non-href attributes from links', () => {
      expect(
        sanitizeHtml('<a href="https://x.com" class="link" target="_blank">text</a>'),
      ).toBe('<a href="https://x.com">text</a>')
    })

    it('strips all attributes from non-link tags', () => {
      expect(sanitizeHtml('<em class="bold" id="x">text</em>')).toBe(
        '<em>text</em>',
      )
    })
  })

  describe('nested structures', () => {
    it('preserves nested allowed tags', () => {
      expect(sanitizeHtml('<strong><em>bold italic</em></strong>')).toBe(
        '<strong><em>bold italic</em></strong>',
      )
    })

    it('unwraps disallowed within allowed', () => {
      expect(
        sanitizeHtml('<strong><span>text</span></strong>'),
      ).toBe('<strong>text</strong>')
    })
  })

  describe('plain text passthrough', () => {
    it('returns plain text unchanged', () => {
      expect(sanitizeHtml('just plain text')).toBe('just plain text')
    })

    it('returns empty string for empty input', () => {
      expect(sanitizeHtml('')).toBe('')
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/transformers/anf/html.test.ts`
Expected: FAIL — module not found

**Step 3: Implement HTML sanitizer**

```ts
import * as cheerio from 'cheerio'

const ALLOWED_TAGS = new Set([
  'a', 'b', 'strong', 'em', 'i', 'code', 'del', 's',
  'sub', 'sup', 'br', 'ul', 'ol', 'li', 'p', 'pre', 'blockquote',
])

const TAG_SUBSTITUTIONS: Record<string, string> = {
  mark: 'b',
  cite: 'em',
  u: 'em',
  ins: 'em',
}

export function sanitizeHtml(html: string): string {
  if (!html) return ''

  const $ = cheerio.load(html, { xml: false }, false)

  // Process bottom-up so children are handled before parents
  const elements = $('*').toArray().reverse()

  for (const el of elements) {
    if (el.type !== 'tag') continue

    const tagName = el.tagName.toLowerCase()
    const $el = $(el)

    // Check substitution first
    const substitute = TAG_SUBSTITUTIONS[tagName]
    if (substitute) {
      // Replace tag name by wrapping inner content
      const inner = $el.html() ?? ''
      $el.replaceWith(`<${substitute}>${inner}</${substitute}>`)
      continue
    }

    // Allowed tag — strip disallowed attributes
    if (ALLOWED_TAGS.has(tagName)) {
      const attribs = el.attribs
      for (const attr of Object.keys(attribs)) {
        if (tagName === 'a' && attr === 'href') continue
        $el.removeAttr(attr)
      }
      continue
    }

    // Disallowed tag — unwrap (keep children, remove tag)
    $el.replaceWith($el.html() ?? '')
  }

  return $.html() ?? ''
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/transformers/anf/html.test.ts`
Expected: ALL PASS

**Step 5: Run full suite for regressions**

Run: `bun test`
Expected: 173 + new tests passing

**Step 6: Lint**

Run: `bun run check`

**Step 7: Commit**

```
git add src/transformers/anf/html.ts tests/transformers/anf/html.test.ts
git commit -m "Add ANF HTML sanitizer with allowlist filtering and tag substitution"
```

---

## Phase 2: Component Mappers

### Task 3: Component Mappers

**Files:**
- Create: `tests/transformers/anf/components.test.ts`
- Create: `src/transformers/anf/components.ts`

**Step 1: Write failing tests**

Tests cover every Inkwell body component type mapped to its ANF equivalent. Import types from `@/schema/types.ts` for input and `@/transformers/anf/types.ts` for expected output.

The function under test: `transformComponent(component: BodyComponent): { result: AnfComponent | AnfComponent[] | null, warnings: TransformWarning[] }`

Returns `null` for dropped components (rawHtml), an array when a component expands to multiple ANF components (photo + caption), or a single component otherwise.

```ts
import { describe, expect, it } from 'bun:test'
import type {
  AdPlacement,
  Blockquote,
  CodeBlock,
  Divider,
  EmbedComponent,
  Heading,
  ImageComponent,
  List,
  Paragraph,
  Preformatted,
  Pullquote,
  RawHtml,
  Table,
  VideoComponent,
} from '@/schema/types.ts'
import { transformComponent } from '@/transformers/anf/components.ts'

describe('transformComponent', () => {
  describe('paragraph', () => {
    it('maps to body with html format', () => {
      const input: Paragraph = {
        type: 'paragraph',
        text: '<em>hello</em> world',
        format: 'html',
      }
      const { result, warnings } = transformComponent(input)
      expect(result).toEqual({
        role: 'body',
        text: '<em>hello</em> world',
        format: 'html',
        textStyle: 'default-body',
      })
      expect(warnings).toEqual([])
    })

    it('sanitizes html in paragraph text', () => {
      const input: Paragraph = {
        type: 'paragraph',
        text: '<span class="x"><em>hello</em></span>',
        format: 'html',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        role: 'body',
        text: '<em>hello</em>',
      })
    })

    it('maps plain text paragraphs without format field', () => {
      const input: Paragraph = {
        type: 'paragraph',
        text: 'plain text',
        format: 'text',
      }
      const { result } = transformComponent(input)
      expect(result).toEqual({
        role: 'body',
        text: 'plain text',
        textStyle: 'default-body',
      })
    })
  })

  describe('heading', () => {
    it('maps level 1 to heading1', () => {
      const input: Heading = {
        type: 'heading',
        level: 1,
        text: 'Title',
        format: 'text',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({ role: 'heading1', text: 'Title' })
    })

    it('maps level 3 to heading3', () => {
      const input: Heading = {
        type: 'heading',
        level: 3,
        text: 'Subtitle',
        format: 'text',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({ role: 'heading3' })
    })

    it('applies heading textStyle', () => {
      const input: Heading = {
        type: 'heading',
        level: 2,
        text: 'H2',
        format: 'text',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({ textStyle: 'default-heading-2' })
    })
  })

  describe('blockquote', () => {
    it('maps to quote role', () => {
      const input: Blockquote = {
        type: 'blockquote',
        text: 'A quote',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        role: 'quote',
        text: 'A quote',
        textStyle: 'default-quote',
      })
    })

    it('appends attribution to text', () => {
      const input: Blockquote = {
        type: 'blockquote',
        text: 'A quote',
        attribution: 'Someone',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        text: 'A quote\n\u2014 Someone',
      })
    })
  })

  describe('pullquote', () => {
    it('maps to pullquote role', () => {
      const input: Pullquote = {
        type: 'pullquote',
        text: 'Key point',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        role: 'pullquote',
        text: 'Key point',
        textStyle: 'default-pullquote',
      })
    })
  })

  describe('list', () => {
    it('maps unordered list to body with ul markup', () => {
      const input: List = {
        type: 'list',
        style: 'unordered',
        items: ['First', 'Second'],
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        role: 'body',
        text: '<ul><li>First</li><li>Second</li></ul>',
        format: 'html',
      })
    })

    it('maps ordered list to body with ol markup', () => {
      const input: List = {
        type: 'list',
        style: 'ordered',
        items: ['Step 1', 'Step 2'],
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        role: 'body',
        text: '<ol><li>Step 1</li><li>Step 2</li></ol>',
        format: 'html',
      })
    })
  })

  describe('codeBlock', () => {
    it('maps to body with pre-wrapped text and monospace style', () => {
      const input: CodeBlock = {
        type: 'codeBlock',
        code: 'const x = 1',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        role: 'body',
        text: '<pre>const x = 1</pre>',
        format: 'html',
        textStyle: 'default-monospace',
      })
    })
  })

  describe('preformatted', () => {
    it('maps to body with pre-wrapped text and monospace style', () => {
      const input: Preformatted = {
        type: 'preformatted',
        text: 'preformatted text',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        role: 'body',
        text: '<pre>preformatted text</pre>',
        format: 'html',
        textStyle: 'default-monospace',
      })
    })
  })

  describe('image', () => {
    it('maps to photo with URL', () => {
      const input: ImageComponent = {
        type: 'image',
        url: 'https://example.com/img.jpg',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        role: 'photo',
        URL: 'https://example.com/img.jpg',
      })
    })

    it('maps altText to accessibilityCaption', () => {
      const input: ImageComponent = {
        type: 'image',
        url: 'https://example.com/img.jpg',
        altText: 'A description',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        accessibilityCaption: 'A description',
      })
    })

    it('maps caption as inline caption descriptor', () => {
      const input: ImageComponent = {
        type: 'image',
        url: 'https://example.com/img.jpg',
        caption: 'Photo caption',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        caption: { text: 'Photo caption', textStyle: 'default-caption' },
      })
    })

    it('includes credit in caption', () => {
      const input: ImageComponent = {
        type: 'image',
        url: 'https://example.com/img.jpg',
        caption: 'Photo caption',
        credit: 'John Smith',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        caption: {
          text: 'Photo caption \u2014 John Smith',
          textStyle: 'default-caption',
        },
      })
    })

    it('uses credit as caption when no caption provided', () => {
      const input: ImageComponent = {
        type: 'image',
        url: 'https://example.com/img.jpg',
        credit: 'John Smith',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        caption: { text: 'John Smith', textStyle: 'default-caption' },
      })
    })
  })

  describe('video', () => {
    it('maps to video with URL', () => {
      const input: VideoComponent = {
        type: 'video',
        url: 'https://example.com/video.m3u8',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        role: 'video',
        URL: 'https://example.com/video.m3u8',
      })
    })

    it('maps thumbnailUrl to stillURL', () => {
      const input: VideoComponent = {
        type: 'video',
        url: 'https://example.com/video.m3u8',
        thumbnailUrl: 'https://example.com/thumb.jpg',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        stillURL: 'https://example.com/thumb.jpg',
      })
    })
  })

  describe('embed', () => {
    it('maps youtube to embedwebvideo', () => {
      const input: EmbedComponent = {
        type: 'embed',
        platform: 'youtube',
        embedUrl: 'https://www.youtube.com/watch?v=abc',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        role: 'embedwebvideo',
        URL: 'https://www.youtube.com/watch?v=abc',
      })
    })

    it('maps vimeo to embedwebvideo', () => {
      const input: EmbedComponent = {
        type: 'embed',
        platform: 'vimeo',
        embedUrl: 'https://vimeo.com/123',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({ role: 'embedwebvideo' })
    })

    it('maps dailymotion to embedwebvideo', () => {
      const input: EmbedComponent = {
        type: 'embed',
        platform: 'dailymotion',
        embedUrl: 'https://www.dailymotion.com/video/x123',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({ role: 'embedwebvideo' })
    })

    it('maps x/twitter to tweet', () => {
      const input: EmbedComponent = {
        type: 'embed',
        platform: 'x',
        embedUrl: 'https://x.com/user/status/123',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        role: 'tweet',
        URL: 'https://x.com/user/status/123',
      })
    })

    it('maps instagram to instagram', () => {
      const input: EmbedComponent = {
        type: 'embed',
        platform: 'instagram',
        embedUrl: 'https://www.instagram.com/p/abc/',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({ role: 'instagram' })
    })

    it('maps facebook to facebook_post', () => {
      const input: EmbedComponent = {
        type: 'embed',
        platform: 'facebook',
        embedUrl: 'https://www.facebook.com/post/123',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({ role: 'facebook_post' })
    })

    it('maps tiktok to tiktok', () => {
      const input: EmbedComponent = {
        type: 'embed',
        platform: 'tiktok',
        embedUrl: 'https://www.tiktok.com/@user/video/123',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({ role: 'tiktok' })
    })

    it('maps other platform to body fallback with warning', () => {
      const input: EmbedComponent = {
        type: 'embed',
        platform: 'other',
        embedUrl: 'https://unknown.com/embed/123',
        fallbackText: 'Watch on Unknown',
      }
      const { result, warnings } = transformComponent(input)
      expect(result).toMatchObject({
        role: 'body',
        text: 'Watch on Unknown',
      })
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toMatchObject({ type: 'unsupported_embed' })
    })

    it('uses embedUrl as fallback text when fallbackText missing', () => {
      const input: EmbedComponent = {
        type: 'embed',
        platform: 'other',
        embedUrl: 'https://unknown.com/embed/123',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        role: 'body',
        text: '<a href="https://unknown.com/embed/123">https://unknown.com/embed/123</a>',
        format: 'html',
      })
    })

    it('includes caption on embedwebvideo', () => {
      const input: EmbedComponent = {
        type: 'embed',
        platform: 'youtube',
        embedUrl: 'https://www.youtube.com/watch?v=abc',
        caption: 'A video',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({ caption: 'A video' })
    })
  })

  describe('divider', () => {
    it('maps to divider', () => {
      const input: Divider = { type: 'divider' }
      const { result } = transformComponent(input)
      expect(result).toEqual({ role: 'divider' })
    })
  })

  describe('table', () => {
    it('maps to htmltable with generated HTML', () => {
      const input: Table = {
        type: 'table',
        rows: [
          ['Name', 'Age'],
          ['Alice', '30'],
        ],
        headerRows: 1,
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({ role: 'htmltable' })
      const html = (result as any).html
      expect(html).toContain('<thead>')
      expect(html).toContain('<th>Name</th>')
      expect(html).toContain('<th>Age</th>')
      expect(html).toContain('<tbody>')
      expect(html).toContain('<td>Alice</td>')
    })

    it('renders table without header rows', () => {
      const input: Table = {
        type: 'table',
        rows: [
          ['A', 'B'],
          ['C', 'D'],
        ],
      }
      const { result } = transformComponent(input)
      const html = (result as any).html
      expect(html).not.toContain('<thead>')
      expect(html).toContain('<td>A</td>')
    })
  })

  describe('rawHtml', () => {
    it('returns null and emits warning', () => {
      const input: RawHtml = {
        type: 'rawHtml',
        html: '<div class="widget">custom</div>',
      }
      const { result, warnings } = transformComponent(input)
      expect(result).toBeNull()
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toMatchObject({ type: 'dropped_component' })
    })
  })

  describe('adPlacement', () => {
    it('maps to banner_advertisement', () => {
      const input: AdPlacement = {
        type: 'adPlacement',
        slot: 'mid-article',
      }
      const { result } = transformComponent(input)
      expect(result).toEqual({
        role: 'banner_advertisement',
        bannerType: 'any',
      })
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/transformers/anf/components.test.ts`
Expected: FAIL — module not found

**Step 3: Implement component mappers**

```ts
import type {
  BodyComponent,
  EmbedComponent,
  ImageComponent,
  Table,
} from '@/schema/types.ts'
import type {
  AnfComponent,
} from '@/transformers/anf/types.ts'
import { sanitizeHtml } from '@/transformers/anf/html.ts'

export interface TransformWarning {
  type: 'dropped_component' | 'unsupported_embed' | 'html_sanitized' | 'missing_field'
  message: string
  component?: string
}

interface ComponentResult {
  result: AnfComponent | null
  warnings: TransformWarning[]
}

const WEB_VIDEO_PLATFORMS = new Set(['youtube', 'vimeo', 'dailymotion'])

const SOCIAL_ROLE_MAP: Record<string, string> = {
  x: 'tweet',
  instagram: 'instagram',
  facebook: 'facebook_post',
  tiktok: 'tiktok',
}

export function transformComponent(component: BodyComponent): ComponentResult {
  switch (component.type) {
    case 'paragraph':
      return {
        result: {
          role: 'body',
          text: component.format === 'html' ? sanitizeHtml(component.text) : component.text,
          ...(component.format === 'html' ? { format: 'html' } : {}),
          textStyle: 'default-body',
        },
        warnings: [],
      }

    case 'heading': {
      const role = `heading${component.level}` as AnfComponent['role']
      return {
        result: {
          role,
          text: component.format === 'html' ? sanitizeHtml(component.text) : component.text,
          ...(component.format === 'html' ? { format: 'html' } : {}),
          textStyle: `default-heading-${component.level}`,
        } as AnfComponent,
        warnings: [],
      }
    }

    case 'blockquote': {
      const text = component.attribution
        ? `${component.text}\n\u2014 ${component.attribution}`
        : component.text
      return {
        result: { role: 'quote', text, textStyle: 'default-quote' },
        warnings: [],
      }
    }

    case 'pullquote': {
      const text = component.attribution
        ? `${component.text}\n\u2014 ${component.attribution}`
        : component.text
      return {
        result: { role: 'pullquote', text, textStyle: 'default-pullquote' },
        warnings: [],
      }
    }

    case 'list': {
      const tag = component.style === 'ordered' ? 'ol' : 'ul'
      const items = component.items.map((i) => `<li>${i}</li>`).join('')
      return {
        result: {
          role: 'body',
          text: `<${tag}>${items}</${tag}>`,
          format: 'html',
          textStyle: 'default-body',
        },
        warnings: [],
      }
    }

    case 'codeBlock':
      return {
        result: {
          role: 'body',
          text: `<pre>${component.code}</pre>`,
          format: 'html',
          textStyle: 'default-monospace',
        },
        warnings: [],
      }

    case 'preformatted':
      return {
        result: {
          role: 'body',
          text: `<pre>${component.text}</pre>`,
          format: 'html',
          textStyle: 'default-monospace',
        },
        warnings: [],
      }

    case 'image':
      return transformImage(component)

    case 'video':
      return {
        result: {
          role: 'video',
          URL: component.url,
          ...(component.thumbnailUrl ? { stillURL: component.thumbnailUrl } : {}),
          ...(component.caption ? { caption: component.caption } : {}),
          ...(component.caption
            ? { accessibilityCaption: component.caption }
            : {}),
        },
        warnings: [],
      }

    case 'embed':
      return transformEmbed(component)

    case 'divider':
      return { result: { role: 'divider' }, warnings: [] }

    case 'table':
      return transformTable(component)

    case 'rawHtml':
      return {
        result: null,
        warnings: [
          {
            type: 'dropped_component',
            message: `Dropped rawHtml component — no safe ANF equivalent`,
            component: 'rawHtml',
          },
        ],
      }

    case 'adPlacement':
      return {
        result: { role: 'banner_advertisement', bannerType: 'any' },
        warnings: [],
      }
  }
}

function transformImage(component: ImageComponent): ComponentResult {
  const captionText = [component.caption, component.credit]
    .filter(Boolean)
    .join(' \u2014 ')

  return {
    result: {
      role: 'photo',
      URL: component.url,
      ...(captionText
        ? { caption: { text: captionText, textStyle: 'default-caption' } }
        : {}),
      ...(component.altText
        ? { accessibilityCaption: component.altText }
        : {}),
    },
    warnings: [],
  }
}

function transformEmbed(component: EmbedComponent): ComponentResult {
  // ANF-native web video (YouTube, Vimeo, Dailymotion)
  if (WEB_VIDEO_PLATFORMS.has(component.platform)) {
    return {
      result: {
        role: 'embedwebvideo',
        URL: component.embedUrl,
        ...(component.caption ? { caption: component.caption } : {}),
      },
      warnings: [],
    }
  }

  // ANF-native social embeds
  const socialRole = SOCIAL_ROLE_MAP[component.platform]
  if (socialRole) {
    return {
      result: { role: socialRole, URL: component.embedUrl } as AnfComponent,
      warnings: [],
    }
  }

  // Fallback for unsupported platforms
  const fallbackText = component.fallbackText
    ? component.fallbackText
    : `<a href="${component.embedUrl}">${component.embedUrl}</a>`
  const hasHtml = !component.fallbackText

  return {
    result: {
      role: 'body',
      text: fallbackText,
      ...(hasHtml ? { format: 'html' } : {}),
      textStyle: 'default-body',
    },
    warnings: [
      {
        type: 'unsupported_embed',
        message: `Unsupported embed platform "${component.platform}" — using fallback text`,
        component: 'embed',
      },
    ],
  }
}

function transformTable(component: Table): ComponentResult {
  const headerCount = component.headerRows ?? 0
  const headerRows = component.rows.slice(0, headerCount)
  const bodyRows = component.rows.slice(headerCount)

  let html = '<table>'

  if (headerRows.length > 0) {
    html += '<thead>'
    for (const row of headerRows) {
      html += `<tr>${row.map((c) => `<th>${c}</th>`).join('')}</tr>`
    }
    html += '</thead>'
  }

  if (bodyRows.length > 0) {
    html += '<tbody>'
    for (const row of bodyRows) {
      html += `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`
    }
    html += '</tbody>'
  }

  html += '</table>'

  return { result: { role: 'htmltable', html }, warnings: [] }
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/transformers/anf/components.test.ts`
Expected: ALL PASS

**Step 5: Run full suite + lint**

Run: `bun test && bun run check`

**Step 6: Commit**

```
git add src/transformers/anf/components.ts tests/transformers/anf/components.test.ts
git commit -m "Add ANF component mappers for all intermediary body types"
```

---

## Phase 3: Document Assembly + Validation

### Task 4: ANF Zod Validation Schema

**Files:**
- Create: `src/transformers/anf/validate.ts`

**Step 1: Create ANF Zod schema**

Validate the ANF output document structure. Doesn't need to be exhaustive — just enough to catch structural issues (missing required fields, wrong types).

```ts
import { z } from 'zod/v4'
import type { AnfArticleDocument } from '@/transformers/anf/types.ts'

const anfMetadataSchema = z.object({
  authors: z.array(z.string()).optional(),
  excerpt: z.string().optional(),
  canonicalURL: z.string().url().optional(),
  thumbnailURL: z.string().url().optional(),
  dateCreated: z.string().datetime().optional(),
  datePublished: z.string().datetime().optional(),
  dateModified: z.string().datetime().optional(),
})

const anfComponentSchema = z.object({
  role: z.string().min(1),
}).passthrough()

const anfDocumentSchema = z.object({
  version: z.string().min(1),
  identifier: z.string().min(1).max(64),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  language: z.string().min(1),
  layout: z.object({
    columns: z.number().int().positive(),
    width: z.number().int().positive(),
  }),
  components: z.array(anfComponentSchema).min(1),
  componentTextStyles: z.record(z.string(), z.object({}).passthrough()),
  metadata: anfMetadataSchema.optional(),
})

export function validateAnfDocument(data: unknown): AnfArticleDocument {
  return anfDocumentSchema.parse(data) as AnfArticleDocument
}
```

**Step 2: Commit**

```
git add src/transformers/anf/validate.ts
git commit -m "Add ANF output Zod validation schema"
```

---

### Task 5: Document Assembly + Public API

**Files:**
- Create: `tests/transformers/anf/document.test.ts`
- Create: `src/transformers/anf/document.ts`
- Create: `src/transformers/anf/index.ts`

**Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'bun:test'
import type { Article } from '@/schema/types.ts'
import { transformToAnf } from '@/transformers/anf/index.ts'

function sampleArticle(): Article {
  return {
    version: '1.0',
    extractedAt: '2026-02-17T12:00:00Z',
    source: {
      url: 'https://www.404media.co/test-article/',
      canonicalUrl: 'https://www.404media.co/test-article/',
      publisherId: '404-media',
      cmsType: 'ghost',
      ingestionMethod: 'scrape',
    },
    metadata: {
      title: 'Test Article Title',
      subtitle: 'A subtitle',
      excerpt: 'An excerpt for preview.',
      language: 'en',
      publishedAt: '2026-02-17T10:00:00Z',
      modifiedAt: '2026-02-17T11:00:00Z',
      categories: ['Tech'],
      tags: ['testing'],
      thumbnail: {
        url: 'https://example.com/thumb.jpg',
        altText: 'Thumbnail',
        width: 1200,
        height: 630,
      },
    },
    authors: [
      { name: 'Alice Smith' },
      { name: 'Bob Jones' },
    ],
    body: [
      { type: 'heading', level: 1, text: 'Main Heading', format: 'text' },
      { type: 'paragraph', text: '<em>First</em> paragraph.', format: 'html' },
      { type: 'image', url: 'https://example.com/photo.jpg', caption: 'A photo', altText: 'Photo description' },
      { type: 'paragraph', text: 'Second paragraph.', format: 'text' },
      { type: 'divider' },
      { type: 'blockquote', text: 'A notable quote.', attribution: 'Someone' },
      { type: 'rawHtml', html: '<div>custom widget</div>' },
    ],
  }
}

describe('transformToAnf', () => {
  it('produces a valid ANF document', () => {
    const { document, warnings } = transformToAnf(sampleArticle())
    expect(document.version).toBe('1.9')
    expect(document.identifier).toBe('404-media-test-article')
    expect(document.title).toBe('Test Article Title')
    expect(document.subtitle).toBe('A subtitle')
    expect(document.language).toBe('en')
  })

  it('sets layout defaults', () => {
    const { document } = transformToAnf(sampleArticle())
    expect(document.layout).toEqual({ columns: 7, width: 1024 })
  })

  it('maps metadata correctly', () => {
    const { document } = transformToAnf(sampleArticle())
    expect(document.metadata?.authors).toEqual(['Alice Smith', 'Bob Jones'])
    expect(document.metadata?.excerpt).toBe('An excerpt for preview.')
    expect(document.metadata?.canonicalURL).toBe(
      'https://www.404media.co/test-article/',
    )
    expect(document.metadata?.thumbnailURL).toBe(
      'https://example.com/thumb.jpg',
    )
    expect(document.metadata?.datePublished).toBe('2026-02-17T10:00:00Z')
    expect(document.metadata?.dateModified).toBe('2026-02-17T11:00:00Z')
  })

  it('transforms body components', () => {
    const { document } = transformToAnf(sampleArticle())
    // rawHtml dropped, so 6 components from 7 input
    expect(document.components).toHaveLength(6)
    expect(document.components[0]).toMatchObject({ role: 'heading1' })
    expect(document.components[1]).toMatchObject({ role: 'body' })
    expect(document.components[2]).toMatchObject({ role: 'photo' })
    expect(document.components[3]).toMatchObject({ role: 'body' })
    expect(document.components[4]).toMatchObject({ role: 'divider' })
    expect(document.components[5]).toMatchObject({ role: 'quote' })
  })

  it('collects warnings for dropped components', () => {
    const { warnings } = transformToAnf(sampleArticle())
    expect(warnings.some((w) => w.type === 'dropped_component')).toBe(true)
  })

  it('includes default componentTextStyles', () => {
    const { document } = transformToAnf(sampleArticle())
    expect(document.componentTextStyles['default-body']).toBeDefined()
    expect(document.componentTextStyles['default-heading-1']).toBeDefined()
    expect(document.componentTextStyles['default-caption']).toBeDefined()
    expect(document.componentTextStyles['default-pullquote']).toBeDefined()
    expect(document.componentTextStyles['default-quote']).toBeDefined()
    expect(document.componentTextStyles['default-monospace']).toBeDefined()
  })

  it('uses source.url when canonicalUrl missing', () => {
    const article = sampleArticle()
    delete (article.source as any).canonicalUrl
    const { document } = transformToAnf(article)
    expect(document.metadata?.canonicalURL).toBe(
      'https://www.404media.co/test-article/',
    )
  })

  it('generates identifier from publisherId and slug', () => {
    const { document } = transformToAnf(sampleArticle())
    expect(document.identifier).toBe('404-media-test-article')
  })

  it('throws on empty body after transformation', () => {
    const article = sampleArticle()
    article.body = [{ type: 'rawHtml', html: '<div>only raw</div>' }]
    expect(() => transformToAnf(article)).toThrow()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/transformers/anf/document.test.ts`
Expected: FAIL — module not found

**Step 3: Implement document assembly**

`src/transformers/anf/document.ts`:
```ts
import type { Article } from '@/schema/types.ts'
import { transformComponent } from '@/transformers/anf/components.ts'
import type { TransformWarning } from '@/transformers/anf/components.ts'
import type {
  AnfArticleDocument,
  AnfComponent,
  AnfComponentTextStyle,
} from '@/transformers/anf/types.ts'

export function buildIdentifier(publisherId: string, url: string) {
  const path = new URL(url).pathname
  const segments = path.split('/').filter(Boolean)
  const slug = segments.at(-1) ?? 'untitled'
  return `${publisherId}-${slug}`.slice(0, 64)
}

export function buildDefaultTextStyles(): Record<string, AnfComponentTextStyle> {
  return {
    'default-body': {
      fontName: 'IowanOldStyle',
      fontSize: 16,
      lineHeight: 24,
      paragraphSpacingBefore: 6,
      paragraphSpacingAfter: 6,
    },
    'default-heading-1': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 32,
      lineHeight: 38,
      paragraphSpacingBefore: 12,
      paragraphSpacingAfter: 8,
    },
    'default-heading-2': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 26,
      lineHeight: 32,
      paragraphSpacingBefore: 10,
      paragraphSpacingAfter: 6,
    },
    'default-heading-3': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 22,
      lineHeight: 28,
      paragraphSpacingBefore: 8,
      paragraphSpacingAfter: 6,
    },
    'default-heading-4': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 20,
      lineHeight: 26,
      paragraphSpacingBefore: 8,
      paragraphSpacingAfter: 4,
    },
    'default-heading-5': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 18,
      lineHeight: 24,
      paragraphSpacingBefore: 6,
      paragraphSpacingAfter: 4,
    },
    'default-heading-6': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 16,
      lineHeight: 22,
      paragraphSpacingBefore: 6,
      paragraphSpacingAfter: 4,
    },
    'default-caption': {
      fontName: 'HelveticaNeue',
      fontSize: 13,
      lineHeight: 18,
      textColor: '#6B7280',
      fontStyle: 'italic',
    },
    'default-pullquote': {
      fontName: 'IowanOldStyle-Italic',
      fontSize: 24,
      lineHeight: 32,
      textAlignment: 'center',
      fontStyle: 'italic',
    },
    'default-quote': {
      fontName: 'IowanOldStyle-Italic',
      fontSize: 16,
      lineHeight: 24,
      fontStyle: 'italic',
    },
    'default-monospace': {
      fontName: 'Menlo-Regular',
      fontSize: 14,
      lineHeight: 20,
    },
  }
}

export function assembleDocument(
  article: Article,
): { document: AnfArticleDocument; warnings: TransformWarning[] } {
  const warnings: TransformWarning[] = []
  const components: AnfComponent[] = []

  for (const bodyComponent of article.body) {
    const { result, warnings: componentWarnings } =
      transformComponent(bodyComponent)
    warnings.push(...componentWarnings)

    if (result !== null) {
      components.push(result)
    }
  }

  const document: AnfArticleDocument = {
    version: '1.9',
    identifier: buildIdentifier(
      article.source.publisherId,
      article.source.url,
    ),
    title: article.metadata.title,
    ...(article.metadata.subtitle
      ? { subtitle: article.metadata.subtitle }
      : {}),
    language: article.metadata.language,
    layout: { columns: 7, width: 1024 },
    components,
    componentTextStyles: buildDefaultTextStyles(),
    metadata: {
      ...(article.authors.length > 0
        ? { authors: article.authors.map((a) => a.name) }
        : {}),
      ...(article.metadata.excerpt
        ? { excerpt: article.metadata.excerpt }
        : {}),
      canonicalURL:
        article.source.canonicalUrl ?? article.source.url,
      ...(article.metadata.thumbnail?.url
        ? { thumbnailURL: article.metadata.thumbnail.url }
        : {}),
      dateCreated: article.metadata.publishedAt,
      datePublished: article.metadata.publishedAt,
      ...(article.metadata.modifiedAt
        ? { dateModified: article.metadata.modifiedAt }
        : {}),
    },
  }

  return { document, warnings }
}
```

`src/transformers/anf/index.ts`:
```ts
import type { Article } from '@/schema/types.ts'
import type { TransformWarning } from '@/transformers/anf/components.ts'
import { assembleDocument } from '@/transformers/anf/document.ts'
import type { AnfArticleDocument } from '@/transformers/anf/types.ts'
import { validateAnfDocument } from '@/transformers/anf/validate.ts'

export interface TransformResult {
  document: AnfArticleDocument
  warnings: TransformWarning[]
}

export function transformToAnf(article: Article): TransformResult {
  const { document, warnings } = assembleDocument(article)

  // Validate — throws ZodError if document is structurally invalid
  validateAnfDocument(document)

  return { document, warnings }
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/transformers/anf/document.test.ts`
Expected: ALL PASS

**Step 5: Run full suite + lint**

Run: `bun test && bun run check`

**Step 6: Commit**

```
git add src/transformers/anf/document.ts src/transformers/anf/index.ts src/transformers/anf/validate.ts tests/transformers/anf/document.test.ts
git commit -m "Add ANF document assembly, validation, and public API"
```

---

## Phase 4: CLI + Pipeline Integration

### Task 6: CLI `transform` Command

**Files:**
- Modify: `src/cli.ts`
- Modify: `package.json` (add `transform` script)

**Step 1: Add transform command to CLI**

In `src/cli.ts`, add `transform` to the command routing:

```ts
// Add to the if/else chain after 'poll':
} else if (command === 'transform') {
  await transform(args.slice(1))
}
```

Add the `transform` function:

```ts
async function transform(args: string[]) {
  const target = args[0]
  if (!target) {
    console.error('Usage: bun run transform <path-to-json-or-directory>')
    process.exit(1)
  }

  const { transformToAnf } = await import('./transformers/anf/index.ts')
  const { validateArticle } = await import('./schema/validate.ts')
  const { readFile, readdir, mkdir, writeFile } = await import('node:fs/promises')
  const { join, dirname } = await import('node:path')
  const { stat } = await import('node:fs/promises')

  const stats = await stat(target)
  const files = stats.isDirectory()
    ? (await readdir(target)).filter((f) => f.endsWith('.json')).map((f) => join(target, f))
    : [target]

  let transformed = 0
  let failed = 0

  for (const file of files) {
    try {
      const raw = JSON.parse(await readFile(file, 'utf-8'))
      const article = validateArticle(raw)
      const { document, warnings } = transformToAnf(article)

      // Write ANF to sibling anf/ directory
      const anfPath = file.replace(/\/([^/]+)\.json$/, '/anf/$1.json')
      await mkdir(dirname(anfPath), { recursive: true })
      await writeFile(anfPath, JSON.stringify(document, null, 2), 'utf-8')

      transformed++
      if (warnings.length > 0) {
        console.error(`  ${file}: ${warnings.length} warning(s)`)
        for (const w of warnings) {
          console.error(`    - ${w.message}`)
        }
      }
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  FAIL ${file}: ${msg}`)
    }
  }

  console.error(`\nTransformed ${transformed} file(s), ${failed} failed.`)
}
```

Update usage string:
```
console.error('  bun run transform <path-to-json-or-directory>')
```

**Step 2: Add script to `package.json`**

Add `"transform": "bun src/cli.ts transform"` to scripts.

**Step 3: Run full suite + lint**

Run: `bun test && bun run check`

**Step 4: Commit**

```
git add src/cli.ts package.json
git commit -m "Add CLI transform command for intermediary-to-ANF conversion"
```

---

### Task 7: Pipeline `--transform` Flag

**Files:**
- Modify: `src/pipeline/poll.ts`
- Modify: `src/pipeline/output.ts`
- Modify: `src/cli.ts` (pass flag)
- Create: `tests/transformers/anf/integration.test.ts`

**Step 1: Add ANF output helper to `src/pipeline/output.ts`**

```ts
export function buildAnfOutputPath(publisherId: string, article: Article) {
  const date = article.metadata.publishedAt
    ? article.metadata.publishedAt.slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const slug = slugFromUrl(article.source.url)
  return join('output', publisherId, 'anf', `${date}-${slug}.json`)
}

export async function writeAnfDocument(
  publisherId: string,
  article: Article,
  anfDocument: unknown,
  baseDir = '.',
) {
  const relPath = buildAnfOutputPath(publisherId, article)
  const fullPath = join(baseDir, relPath)

  await mkdir(dirname(fullPath), { recursive: true })
  await writeFile(fullPath, JSON.stringify(anfDocument, null, 2), 'utf-8')

  return relPath
}
```

**Step 2: Add `transform` option to `pollPublisher`**

In `src/pipeline/poll.ts`, add optional `transform` param:

```ts
export interface PollOptions {
  transform?: boolean
}
```

Update `pollPublisher` signature to accept options, and after `writeArticle`, if transform is enabled:

```ts
if (options?.transform) {
  const { transformToAnf } = await import('@/transformers/anf/index.ts')
  const { writeAnfDocument } = await import('@/pipeline/output.ts')
  const { document, warnings } = transformToAnf(article)
  const anfPath = await writeAnfDocument(config.id, article, document, baseDir)
  console.error(`    ANF: ${anfPath}`)
  if (warnings.length > 0) {
    for (const w of warnings) console.error(`    ⚠ ${w.message}`)
  }
}
```

**Step 3: Parse `--transform` flag in CLI poll command**

In `src/cli.ts` `poll()` function, parse the flag:

```ts
let transformFlag = false
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--transform') transformFlag = true
}
```

Pass to `pollPublisher`/`pollAll`.

**Step 4: Write integration test**

Test transforms a real article fixture through the full pipeline.

```ts
import { describe, expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ghostSource } from '@/sources/ghost.ts'
import { transformToAnf } from '@/transformers/anf/index.ts'
import { validateAnfDocument } from '@/transformers/anf/validate.ts'

describe('end-to-end: Ghost fixture → ANF', () => {
  it('transforms a Ghost article to valid ANF', async () => {
    const fixturePath = join(import.meta.dir, '../../fixtures/404-media-article.html')
    const html = await readFile(fixturePath, 'utf-8')

    const article = ghostSource.parseArticle(html, 'https://www.404media.co/test-article/')
    const { document, warnings } = transformToAnf(article)

    // Should produce valid ANF
    expect(() => validateAnfDocument(document)).not.toThrow()

    // Required fields present
    expect(document.version).toBe('1.9')
    expect(document.title).toBeTruthy()
    expect(document.language).toBeTruthy()
    expect(document.components.length).toBeGreaterThan(0)

    // Components should include expected types
    const roles = document.components.map((c) => c.role)
    expect(roles).toContain('body')
  })
})
```

**Step 5: Run tests + lint**

Run: `bun test && bun run check`

**Step 6: Commit**

```
git add src/pipeline/poll.ts src/pipeline/output.ts src/cli.ts tests/transformers/anf/integration.test.ts
git commit -m "Add --transform flag to poll and end-to-end integration test"
```

---

## Phase 5: Docs + Wrap

### Task 8: Update Documentation

**Files:**
- Modify: `README.md` — add transform CLI usage
- Modify: `docs/features.md` — document ANF transformer capability
- Modify: `docs/architecture.md` — add transformer module to architecture
- Create: `docs/decisions/006-anf-transformer-module.md`

Update all living docs per CLAUDE.md instructions. Record the key decisions:
- Transformer as co-located module (not separate service) for PoC
- Filtered HTML over Markdown for ANF text
- Lenient per-component, strict per-document error strategy
- Default componentTextStyles with sensible typography

**Commit:**

```
git add README.md docs/
git commit -m "Update docs with ANF transformer architecture and usage"
```

---

## Unresolved Questions

None — all design decisions resolved during brainstorming.

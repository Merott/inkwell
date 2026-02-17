import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import type {
  Article,
  Author,
  BodyComponent,
  DiscoveredArticle,
  ImageRef,
  Metadata,
  Source,
} from '@/schema/types.ts'
import {
  detectEmbedPlatform,
  ensureIso,
  escapeHtml,
  extractJsonLd,
  extractOgTags,
} from './shared/extract.ts'
import type { ArticleSource } from './types.ts'

const GHOST_PUBLISHERS: {
  id: string
  pattern: RegExp
  homepageUrl: string
}[] = [
  {
    id: '404-media',
    pattern: /^https?:\/\/(www\.)?404media\.co\//,
    homepageUrl: 'https://www.404media.co/',
  },
]

export const ghostSource: ArticleSource = {
  id: 'ghost',
  homepageUrl: GHOST_PUBLISHERS[0]?.homepageUrl,
  publishers: GHOST_PUBLISHERS.map((p) => ({
    id: p.id,
    homepageUrl: p.homepageUrl,
  })),

  matches(url: string): boolean {
    return GHOST_PUBLISHERS.some((p) => p.pattern.test(url))
  },

  parseArticle(html: string, url: string): Article {
    return parse(html, url)
  },

  async scrapeArticle(url: string): Promise<Article> {
    const res = await fetch(url)
    if (!res.ok)
      throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)
    const html = await res.text()
    return this.parseArticle(html, url)
  },

  parseArticles(html: string, url: string): DiscoveredArticle[] {
    return discoverFromHomepage(html, url)
  },

  async scrapeArticles(url?: string): Promise<DiscoveredArticle[]> {
    const targetUrl = url ?? this.homepageUrl
    if (!targetUrl) throw new Error('No homepage URL configured')
    const res = await fetch(targetUrl)
    if (!res.ok)
      throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)
    const html = await res.text()
    return discoverFromHomepage(html, targetUrl)
  },
}

// --- Discovery ---

const CARD_SELECTORS = ['.post-card']

const CARD_TITLE_SELECTORS = ['.post-card__title > a', '.post-card__title']
const CARD_LINK_SELECTORS = [
  '.post-card__title > a',
  'a.post-card__image',
  'h4 a',
]
const CARD_EXCERPT_SELECTORS = ['.post-card__excerpt']
const CARD_IMAGE_SELECTORS = [
  '.post-card__image img[data-src]',
  '.post-card__image img[src]',
]
const CARD_DATE_SELECTORS = ['time.byline__date[datetime]', 'time[datetime]']

function discoverFromHomepage(html: string, url: string): DiscoveredArticle[] {
  const $ = cheerio.load(html)
  const publisher = resolvePublisherForUrl(url)
  const seen = new Set<string>()
  const articles: DiscoveredArticle[] = []

  for (const sel of CARD_SELECTORS) {
    $(sel).each((_, el) => {
      const $card = $(el)
      const article = extractCard($, $card, url, publisher.id)
      if (article && !seen.has(article.url)) {
        seen.add(article.url)
        articles.push(article)
      }
    })
  }

  return articles
}

function resolvePublisherForUrl(url: string) {
  const match = GHOST_PUBLISHERS.find((p) => p.pattern.test(url))
  if (!match) throw new Error(`No Ghost publisher for URL: ${url}`)
  return match
}

function extractCard(
  _$: cheerio.CheerioAPI,
  $card: cheerio.Cheerio<Element>,
  baseUrl: string,
  publisherId: string,
): DiscoveredArticle | null {
  const link = findFirst($card, CARD_LINK_SELECTORS, ($el) => $el.attr('href'))
  if (!link) return null

  const absoluteUrl = new URL(link, baseUrl).href

  const title = findFirst($card, CARD_TITLE_SELECTORS, ($el) =>
    $el.text().trim(),
  )
  if (!title) return null

  const excerpt =
    findFirst($card, CARD_EXCERPT_SELECTORS, ($el) => $el.text().trim()) ||
    undefined

  const thumbnail = extractCardImage($card, baseUrl)
  const publishedAt = extractCardDate($card)

  return {
    url: absoluteUrl,
    title,
    excerpt,
    thumbnail,
    publishedAt,
    sourceId: publisherId,
  }
}

function findFirst(
  $card: cheerio.Cheerio<Element>,
  selectors: string[],
  extract: ($el: cheerio.Cheerio<Element>) => string | undefined,
): string | undefined {
  for (const sel of selectors) {
    const $el = $card.find(sel).first()
    if ($el.length) {
      const value = extract($el)
      if (value) return value
    }
  }
  return undefined
}

function extractCardImage(
  $card: cheerio.Cheerio<Element>,
  baseUrl: string,
): ImageRef | undefined {
  for (const sel of CARD_IMAGE_SELECTORS) {
    const $img = $card.find(sel).first()
    if ($img.length) {
      const rawUrl = $img.attr('data-src') ?? $img.attr('src')
      if (rawUrl && !rawUrl.includes('placeholder')) {
        return { url: new URL(rawUrl, baseUrl).href }
      }
    }
  }
  return undefined
}

function extractCardDate($card: cheerio.Cheerio<Element>): string | undefined {
  for (const sel of CARD_DATE_SELECTORS) {
    const $time = $card.find(sel).first()
    if ($time.length) {
      const datetime = $time.attr('datetime')
      if (datetime) return ensureIso(datetime)
    }
  }
  return undefined
}

// --- Parse ---

function parse(html: string, url: string): Article {
  const $ = cheerio.load(html)
  const jsonLd = extractJsonLd($)
  const ogTags = extractOgTags($)
  const canonical =
    $('link[rel="canonical"]').attr('href') ?? ogTags['og:url'] ?? url

  const publisher = resolvePublisher(url)
  const source = buildSource(url, canonical, publisher.id)
  const metadata = buildMetadata($, jsonLd, ogTags)
  const authors = buildAuthors(jsonLd)
  const body = buildBody($)

  return {
    version: '1.0',
    extractedAt: new Date().toISOString(),
    source,
    metadata,
    authors,
    body,
  }
}

function resolvePublisher(url: string) {
  const match = GHOST_PUBLISHERS.find((p) => p.pattern.test(url))
  if (!match) throw new Error(`No Ghost publisher for URL: ${url}`)
  return match
}

// --- Builders ---

function buildSource(
  url: string,
  canonicalUrl: string,
  publisherId: string,
): Source {
  return {
    url,
    canonicalUrl,
    publisherId,
    cmsType: 'ghost',
    ingestionMethod: 'scrape',
  }
}

function buildMetadata(
  $: cheerio.CheerioAPI,
  // biome-ignore lint/suspicious/noExplicitAny: Untyped third-party JSON-LD data
  jsonLd: any,
  ogTags: Record<string, string>,
): Metadata {
  const title = jsonLd?.headline ?? ogTags['og:title'] ?? 'Untitled'
  const publishedAt =
    jsonLd?.datePublished ??
    ogTags['article:published_time'] ??
    new Date().toISOString()

  const thumbnail = buildThumbnail(jsonLd, ogTags)

  const keywords = jsonLd?.keywords
    ? typeof jsonLd.keywords === 'string'
      ? jsonLd.keywords.split(',').map((k: string) => k.trim())
      : jsonLd.keywords
    : undefined

  // Ghost stores tags in body classes: "tag-foo tag-bar"
  const bodyClass = $('body').attr('class') ?? ''
  const tags = [
    ...new Set(
      bodyClass
        .split(/\s+/)
        .filter((c) => c.startsWith('tag-'))
        .map((c) => c.replace('tag-', '').replace(/-/g, ' ')),
    ),
  ]

  return {
    title,
    excerpt: jsonLd?.description ?? ogTags['og:description'],
    language: ogTags['og:locale']?.replace('_', '-') ?? 'en',
    publishedAt: ensureIso(publishedAt),
    modifiedAt: jsonLd?.dateModified
      ? ensureIso(jsonLd.dateModified)
      : undefined,
    keywords: keywords?.length ? keywords : undefined,
    tags: tags.length ? tags : undefined,
    thumbnail,
  }
}

function buildThumbnail(
  // biome-ignore lint/suspicious/noExplicitAny: Untyped third-party JSON-LD data
  jsonLd: any,
  ogTags: Record<string, string>,
): ImageRef | undefined {
  if (jsonLd?.image) {
    const img = jsonLd.image
    return {
      url: typeof img === 'string' ? img : img.url,
      width: typeof img === 'object' ? img.width : undefined,
      height: typeof img === 'object' ? img.height : undefined,
    }
  }
  if (ogTags['og:image']) {
    return {
      url: ogTags['og:image'],
      width: ogTags['og:image:width']
        ? parseInt(ogTags['og:image:width'], 10)
        : undefined,
      height: ogTags['og:image:height']
        ? parseInt(ogTags['og:image:height'], 10)
        : undefined,
    }
  }
  return undefined
}

// biome-ignore lint/suspicious/noExplicitAny: Untyped third-party JSON-LD data
function buildAuthors(jsonLd: any): Author[] {
  if (!jsonLd?.author) return []

  const authors = Array.isArray(jsonLd.author) ? jsonLd.author : [jsonLd.author]

  return (
    authors
      // biome-ignore lint/suspicious/noExplicitAny: Untyped JSON-LD author array
      .filter((a: any) => a.name)
      // biome-ignore lint/suspicious/noExplicitAny: Untyped JSON-LD author array
      .map((a: any) => ({
        name: a.name,
        url: a.url,
      }))
  )
}

// --- Body conversion ---

/**
 * Ghost content container selectors, in priority order.
 * 404 Media uses `post__content`, standard Casper uses `gh-content`.
 */
const CONTENT_SELECTORS = [
  '.post__content',
  '.gh-content',
  '.post-content',
  'article .content',
]

function findContentRoot($: cheerio.CheerioAPI) {
  for (const sel of CONTENT_SELECTORS) {
    const el = $(sel)
    if (el.length) return el
  }
  // Fallback: try the article tag itself
  return $('article')
}

function buildBody($: cheerio.CheerioAPI): BodyComponent[] {
  const root = findContentRoot($)
  const components: BodyComponent[] = []

  root.children().each((_, el) => {
    const result = convertElement($, el)
    if (result) {
      if (Array.isArray(result)) {
        components.push(...result)
      } else {
        components.push(result)
      }
    }
  })

  return components
}

function convertElement(
  $: cheerio.CheerioAPI,
  el: Element,
): BodyComponent | BodyComponent[] | null {
  const $el = $(el)
  const tag = el.tagName

  if (tag === 'p') return convertParagraph($, $el)
  if (tag === 'h2' || tag === 'h3' || tag === 'h4')
    return convertHeading($el, Number(tag[1]))
  if (tag === 'blockquote') return convertBlockquote($, $el)
  if (tag === 'ul') return convertList($, $el, 'unordered')
  if (tag === 'ol') return convertList($, $el, 'ordered')
  if (tag === 'hr') return { type: 'divider' }
  if (tag === 'figure') return convertFigure($, $el)
  if (tag === 'pre') return convertCodeBlock($, $el)

  // Ghost Koenig cards rendered as divs
  if (tag === 'div') return convertDiv($, $el)

  return null
}

function convertParagraph(
  _$: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
): BodyComponent | null {
  const html = $el.html()?.trim()
  if (!html) return null
  return { type: 'paragraph', text: html, format: 'html' }
}

function convertHeading(
  $el: cheerio.Cheerio<Element>,
  level: number,
): BodyComponent {
  return { type: 'heading', level, text: $el.text().trim(), format: 'text' }
}

function convertBlockquote(
  _$: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
): BodyComponent {
  return { type: 'blockquote', text: $el.text().trim() }
}

function convertList(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
  style: 'ordered' | 'unordered',
): BodyComponent {
  const items: string[] = []
  $el.children('li').each((_, li) => {
    const html = $(li).html()?.trim()
    if (html) items.push(html)
  })
  return { type: 'list', style, items }
}

function convertFigure(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
): BodyComponent | BodyComponent[] | null {
  // Gallery card — multiple images
  if ($el.hasClass('kg-gallery-card')) {
    return convertGallery($, $el)
  }

  // Embed card — iframe
  if ($el.hasClass('kg-embed-card')) {
    return convertEmbed($, $el)
  }

  // Bookmark card — link preview
  if ($el.hasClass('kg-bookmark-card')) {
    return convertBookmark($, $el)
  }

  // Video card — self-hosted video
  if ($el.hasClass('kg-video-card')) {
    return convertVideo($, $el)
  }

  // Image card (or generic figure with img)
  const img = $el.find('img').first()
  if (img.length) {
    return convertImage($, $el, img)
  }

  return null
}

function convertImage(
  _$: cheerio.CheerioAPI,
  $figure: cheerio.Cheerio<Element>,
  $img: cheerio.Cheerio<Element>,
): BodyComponent {
  const url = $img.attr('src') ?? ''
  const altText = $img.attr('alt') || undefined
  const caption = $figure.find('figcaption').text().trim() || undefined
  const widthAttr = $img.attr('width')
  const width = widthAttr ? parseInt(widthAttr, 10) : undefined
  const heightAttr = $img.attr('height')
  const height = heightAttr ? parseInt(heightAttr, 10) : undefined

  // Image URL may be relative on Ghost
  return {
    type: 'image',
    url,
    altText,
    caption,
    width,
    height,
  }
}

function convertGallery(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
): BodyComponent[] {
  const images: BodyComponent[] = []
  $el.find('img').each((_, img) => {
    const $img = $(img)
    images.push({
      type: 'image',
      url: $img.attr('src') ?? '',
      altText: $img.attr('alt') || undefined,
    })
  })
  return images
}

function convertEmbed(
  _$: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
): BodyComponent | null {
  const iframe = $el.find('iframe').first()
  const embedUrl = iframe.attr('src')
  if (!embedUrl) return null

  const caption = $el.find('figcaption').text().trim() || undefined
  const platform = detectEmbedPlatform(embedUrl)

  return {
    type: 'embed',
    platform,
    embedUrl,
    caption,
  }
}

function convertBookmark(
  _$: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
): BodyComponent {
  const link = $el.find('a.kg-bookmark-container').first()
  const href = link.attr('href') ?? ''
  const title = $el.find('.kg-bookmark-title').text().trim() || 'Bookmark'
  return {
    type: 'paragraph',
    text: `<a href="${escapeHtml(href)}">${escapeHtml(title)}</a>`,
    format: 'html',
  }
}

function convertVideo(
  _$: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
): BodyComponent {
  const video = $el.find('video').first()
  const url = video.attr('src') ?? ''
  const poster = video.attr('poster') ?? undefined
  const caption = $el.find('figcaption').text().trim() || undefined

  // Filter out spacer.png poster URLs
  const thumbnailUrl =
    poster && !poster.includes('spacergif') ? poster : undefined

  return {
    type: 'video',
    url,
    thumbnailUrl,
    caption,
  }
}

function convertCodeBlock(
  _$: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
): BodyComponent {
  const code = $el.find('code').first()
  const language = code.attr('class')?.replace('language-', '') || undefined
  return {
    type: 'codeBlock',
    code: code.text(),
    language,
  }
}

function convertDiv(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
): BodyComponent | BodyComponent[] | null {
  // Callout card
  if ($el.hasClass('kg-callout-card')) {
    const text = $el.find('.kg-callout-text').text().trim()
    if (text) return { type: 'blockquote', text }
    return null
  }

  // Skip ad containers and other non-content divs
  if ($el.hasClass('outpost-pub-container')) return null
  if ($el.hasClass('post-author')) return null
  if ($el.hasClass('post-access-cta')) return null
  if ($el.hasClass('post-sneak-peek')) {
    // Paywalled preview — still parse its children
    const components: BodyComponent[] = []
    $el.children().each((_, child) => {
      const result = convertElement($, child)
      if (result) {
        if (Array.isArray(result)) components.push(...result)
        else components.push(result)
      }
    })
    return components.length ? components : null
  }

  return null
}

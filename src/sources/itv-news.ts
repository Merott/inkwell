import * as cheerio from 'cheerio'
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
  ensureIso,
  escapeHtml,
  extractJsonLd,
  extractOgTags,
} from './shared/extract.ts'
import { createPlaywrightFetcher } from './shared/playwright.ts'
import type { ArticleSource } from './types.ts'

interface ContentfulNode {
  nodeType?: string
  value?: string
  content?: ContentfulNode[]
  marks?: { type: string }[]
  // biome-ignore lint/suspicious/noExplicitAny: data payload varies by content type
  data?: Record<string, any>
  contentType?: string
}

const ITV_HOMEPAGE_URL = 'https://www.itv.com/news'

const fetcher = createPlaywrightFetcher({ headless: false })

async function fetchHtml(url: string) {
  return fetcher.fetchHtml(url, async (page) => {
    // Wait for Next.js data to be present
    await page.waitForFunction(
      () =>
        (document.getElementById('__NEXT_DATA__')?.textContent?.length ?? 0) >
        0,
      { timeout: 10_000 },
    )

    // Dismiss cookie consent (ITV uses Cassie widget)
    try {
      const acceptBtn = page.locator(
        '.cassie-pre-banner button:has-text("Accept")',
      )
      if (await acceptBtn.isVisible({ timeout: 2_000 })) {
        await acceptBtn.click()
      }
    } catch {
      // No consent banner or already dismissed
    }
  })
}

export const itvNewsSource: ArticleSource = {
  id: 'itv-news',
  homepageUrl: ITV_HOMEPAGE_URL,
  publishers: [{ id: 'itv-news', homepageUrl: ITV_HOMEPAGE_URL }],

  matches(url: string): boolean {
    return /^https?:\/\/(www\.)?itv\.com\/news\//.test(url)
  },

  parseArticle(html: string, url: string): Article {
    return parse(html, url)
  },

  async scrapeArticle(url: string): Promise<Article> {
    const html = await fetchHtml(url)
    return this.parseArticle(html, url)
  },

  parseArticles(html: string, _url: string): DiscoveredArticle[] {
    return discoverFromHomepage(html)
  },

  async scrapeArticles(url?: string): Promise<DiscoveredArticle[]> {
    const html = await fetchHtml(url ?? ITV_HOMEPAGE_URL)
    return discoverFromHomepage(html)
  },

  init: () => fetcher.init(),
  dispose: () => fetcher.dispose(),
}

// --- Discovery ---

/** Matches ITV article URLs: news/YYYY-MM-DD/slug or news/region/YYYY-MM-DD/slug */
const ITV_ARTICLE_LINK_PATTERN =
  /^news\/(?:[\w-]+\/)*\d{4}-\d{2}-\d{2}\/[\w-]+$/

function discoverFromHomepage(html: string): DiscoveredArticle[] {
  const $ = cheerio.load(html)
  const nextData = extractNextData($)
  if (!nextData) return discoverFromDom($)

  const pageProps = nextData.props?.pageProps
  if (!pageProps) return discoverFromDom($)

  const seen = new Set<string>()
  const articles: DiscoveredArticle[] = []

  function addItem(item: {
    title?: string
    link?: string
    summary?: string
    displayDate?: string
    externalUrl?: boolean
    image?: { url?: string; width?: number; height?: number }
  }) {
    if (!item.title || !item.link) return
    if (item.externalUrl) return
    if (!ITV_ARTICLE_LINK_PATTERN.test(item.link)) return

    const absoluteUrl = `https://www.itv.com/${item.link}`
    if (seen.has(absoluteUrl)) return
    seen.add(absoluteUrl)

    const thumbnail: ImageRef | undefined = item.image?.url
      ? {
          url: item.image.url,
          width: item.image.width,
          height: item.image.height,
        }
      : undefined

    articles.push({
      url: absoluteUrl,
      title: item.title,
      excerpt: item.summary || undefined,
      thumbnail,
      publishedAt: item.displayDate ? ensureIso(item.displayDate) : undefined,
      sourceId: 'itv-news',
    })
  }

  // topStories, popular, collections — standard shape
  for (const section of ['topStories', 'popular'] as const) {
    for (const item of pageProps[section]?.items ?? []) {
      addItem(item)
    }
  }

  for (const collection of pageProps.collections ?? []) {
    for (const item of collection.items ?? []) {
      addItem(item)
    }
  }

  // latest — wrapped in { fields: { ... } }, link omits "news/" prefix
  for (const wrapper of pageProps.latest?.items ?? []) {
    const fields = wrapper.fields
    if (!fields) continue
    addItem({
      ...fields,
      link: fields.link ? `news/${fields.link}` : undefined,
    })
  }

  return articles.length > 0 ? articles : discoverFromDom($)
}

/** Fallback: extract article URLs from DOM anchor tags */
function discoverFromDom($: cheerio.CheerioAPI): DiscoveredArticle[] {
  const seen = new Set<string>()
  const articles: DiscoveredArticle[] = []

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return

    const match = href.match(/\/news\/(?:[\w-]+\/)*(\d{4}-\d{2}-\d{2}\/[\w-]+)/)
    if (!match) return

    const absoluteUrl = new URL(href, 'https://www.itv.com').href
    if (seen.has(absoluteUrl)) return
    seen.add(absoluteUrl)

    const title = $(el).text().trim()
    articles.push({
      url: absoluteUrl,
      title: title || 'Untitled',
      sourceId: 'itv-news',
    })
  })

  return articles
}

// --- Parse ---

function parse(html: string, url: string): Article {
  const $ = cheerio.load(html)
  const nextData = extractNextData($)

  if (!nextData) {
    throw new Error('Could not find __NEXT_DATA__ in page')
  }

  const article = nextData.props?.pageProps?.article
  if (!article) {
    throw new Error('No article data found in __NEXT_DATA__')
  }

  const jsonLd = extractJsonLd($)
  const ogTags = extractOgTags($)
  const canonical = $('link[rel="canonical"]').attr('href') ?? url

  const source = buildSource(url, canonical)
  const metadata = buildMetadata(article, jsonLd, ogTags)
  const authors = buildAuthors(article, jsonLd)
  const body = buildBody(article.body?.content ?? [])

  return {
    version: '1.0',
    extractedAt: new Date().toISOString(),
    source,
    metadata,
    authors,
    body,
  }
}

// --- Data extraction helpers ---

// biome-ignore lint/suspicious/noExplicitAny: Untyped CMS JSON payload
function extractNextData($: cheerio.CheerioAPI): any {
  const script = $('#__NEXT_DATA__').html()
  if (!script) return null
  try {
    return JSON.parse(script)
  } catch {
    return null
  }
}

// --- Builders ---

function buildSource(url: string, canonicalUrl: string): Source {
  return {
    url,
    canonicalUrl,
    publisherId: 'itv-news',
    cmsType: 'contentful',
    ingestionMethod: 'scrape',
  }
}

function buildMetadata(
  // biome-ignore lint/suspicious/noExplicitAny: Untyped CMS JSON payload
  article: any,
  // biome-ignore lint/suspicious/noExplicitAny: Untyped CMS JSON payload
  jsonLd: any,
  ogTags: Record<string, string>,
): Metadata {
  const title =
    article.title ?? jsonLd?.headline ?? ogTags['og:title'] ?? 'Untitled'
  const publishedAt =
    article.displayDate ?? jsonLd?.datePublished ?? new Date().toISOString()

  const thumbnail: ImageRef | undefined = article.image
    ? {
        url: article.image.url,
        altText: article.image.description ?? article.image.caption,
        width: article.image.width,
        height: article.image.height,
      }
    : ogTags['og:image']
      ? {
          url: ogTags['og:image'],
          width: ogTags['og:image:width']
            ? parseInt(ogTags['og:image:width'], 10)
            : undefined,
          height: ogTags['og:image:height']
            ? parseInt(ogTags['og:image:height'], 10)
            : undefined,
        }
      : undefined

  const categories = article.regions
    // biome-ignore lint/suspicious/noExplicitAny: Untyped CMS data
    ?.map((r: any) => r.label)
    .filter(Boolean) as string[] | undefined

  const tags = article.topics
    ? ([
        // biome-ignore lint/suspicious/noExplicitAny: Untyped CMS data
        ...new Set(article.topics.map((t: any) => t.label).filter(Boolean)),
      ] as string[])
    : undefined

  const keywords = jsonLd?.keywords
    ? typeof jsonLd.keywords === 'string'
      ? jsonLd.keywords.split(',').map((k: string) => k.trim())
      : jsonLd.keywords
    : undefined

  return {
    title,
    subtitle: article.shortTitle !== title ? article.shortTitle : undefined,
    excerpt: article.summary ?? jsonLd?.description ?? ogTags['og:description'],
    language: ogTags['og:locale']?.replace('_', '-') ?? 'en-GB',
    publishedAt: ensureIso(publishedAt),
    modifiedAt: jsonLd?.dateModified
      ? ensureIso(jsonLd.dateModified)
      : undefined,
    categories: categories?.length ? categories : undefined,
    tags: tags?.length ? tags : undefined,
    keywords: keywords?.length ? keywords : undefined,
    section: jsonLd?.articleSection ?? article.regions?.[0]?.label,
    thumbnail,
    urgency: article.label === 'breaking' ? 'breaking' : undefined,
  }
}

function buildAuthors(
  // biome-ignore lint/suspicious/noExplicitAny: Untyped CMS JSON payload
  article: any,
  // biome-ignore lint/suspicious/noExplicitAny: Untyped CMS JSON payload
  jsonLd: any,
): Author[] {
  // ITV JSON-LD usually has generic "ITV News" as author.
  // Try to extract byline from body content first.
  const byline = extractByline(article.body?.content ?? [])
  if (byline) {
    return [{ name: byline }]
  }

  if (jsonLd?.author) {
    const a = jsonLd.author
    if (Array.isArray(a)) {
      // biome-ignore lint/suspicious/noExplicitAny: Untyped CMS data
      return a.map((auth: any) => ({ name: auth.name ?? 'Unknown' }))
    }
    if (a.name && a.name !== 'ITV News') {
      return [{ name: a.name }]
    }
  }

  return []
}

/**
 * ITV articles often have a byline paragraph like "By Deputy Content Editor Sophia Ankel"
 * near the top of the body, typically right after an `hr` divider.
 */
function extractByline(content: ContentfulNode[]): string | null {
  for (let i = 0; i < Math.min(content.length, 8); i++) {
    const block = content[i]
    if (block?.nodeType !== 'paragraph') continue
    const text = getPlainText(block).trim()
    const match = text.match(/^By\s+(?:[\w\s]+?Editor\s+)?(.+)/i)
    if (match) {
      return match[1]?.trim() ?? null
    }
  }
  return null
}

// --- Body conversion ---

function buildBody(content: ContentfulNode[]): BodyComponent[] {
  const components: BodyComponent[] = []

  for (const block of content) {
    const component = convertBlock(block)
    if (component) {
      if (Array.isArray(component)) {
        components.push(...component)
      } else {
        components.push(component)
      }
    }
  }

  return components
}

function convertBlock(
  block: ContentfulNode,
): BodyComponent | BodyComponent[] | null {
  switch (block.nodeType) {
    case 'paragraph':
      return convertParagraph(block)
    case 'heading-2':
      return convertHeading(block, 2)
    case 'heading-3':
      return convertHeading(block, 3)
    case 'heading-4':
      return convertHeading(block, 4)
    case 'hr':
      return { type: 'divider' }
    case 'unordered-list':
      return convertList(block, 'unordered')
    case 'ordered-list':
      return convertList(block, 'ordered')
    case 'blockquote':
      return convertBlockquote(block)
    case 'embedded-entry-block':
      return convertEmbeddedEntry(block)
    default:
      return null
  }
}

function convertParagraph(block: ContentfulNode): BodyComponent | null {
  const html = renderRichText(block.content ?? [])
  if (!html.trim()) return null
  return { type: 'paragraph', text: html, format: 'html' }
}

function convertHeading(block: ContentfulNode, level: number): BodyComponent {
  const text = getPlainText(block)
  return { type: 'heading', level, text, format: 'text' }
}

function convertList(
  block: ContentfulNode,
  style: 'ordered' | 'unordered',
): BodyComponent {
  const items: string[] = []
  for (const li of block.content ?? []) {
    // Each list-item contains paragraph(s)
    const parts: string[] = []
    for (const child of li.content ?? []) {
      parts.push(renderRichText(child.content ?? []))
    }
    items.push(parts.join(' '))
  }
  return { type: 'list', style, items }
}

function convertBlockquote(block: ContentfulNode): BodyComponent {
  const parts: string[] = []
  for (const child of block.content ?? []) {
    parts.push(getPlainText(child))
  }
  return { type: 'blockquote', text: parts.join('\n') }
}

function convertEmbeddedEntry(
  block: ContentfulNode,
): BodyComponent | BodyComponent[] | null {
  const contentType = block.contentType ?? block.data?.contentType
  const data = block.data ?? {}

  switch (contentType) {
    case 'image':
      return {
        type: 'image',
        url: data.url,
        caption: data.caption,
        credit: data.credit || undefined,
        altText: data.description ?? data.caption,
      }
    case 'Brightcove':
      return {
        type: 'video',
        url: `https://players.brightcove.net/${data.accountId}/${data.playerId}_default/index.html?videoId=${data.id}`,
        thumbnailUrl: data.poster?.url,
        caption: data.guidance || undefined,
      }
    case 'tile-links': {
      const articles = (data.articles ?? []) as {
        link?: string
        title?: string
        shortTitle?: string
      }[]
      return articles.map((a) => ({
        type: 'paragraph' as const,
        text: `<a href="https://www.itv.com/news/${a.link}">${escapeHtml(a.shortTitle ?? a.title ?? 'Related article')}</a>`,
        format: 'html' as const,
      }))
    }
    case 'podcast-show':
      return {
        type: 'rawHtml',
        html: `<!-- podcast: ${escapeHtml(data.title ?? data.id ?? '')} -->`,
      }
    default:
      return null
  }
}

// --- Rich text rendering ---

function renderRichText(nodes: ContentfulNode[]): string {
  return nodes.map(renderNode).join('')
}

function renderNode(node: ContentfulNode): string {
  if (node.nodeType === 'text') {
    let text = escapeHtml(node.value ?? '')
    for (const mark of node.marks ?? []) {
      switch (mark.type) {
        case 'bold':
          text = `<strong>${text}</strong>`
          break
        case 'italic':
          text = `<em>${text}</em>`
          break
        case 'underline':
          text = `<u>${text}</u>`
          break
        case 'code':
          text = `<code>${text}</code>`
          break
      }
    }
    return text
  }

  if (node.nodeType === 'hyperlink') {
    const href = escapeHtml(node.data?.uri ?? '')
    const inner = renderRichText(node.content ?? [])
    return `<a href="${href}">${inner}</a>`
  }

  // Fallback: render children
  return renderRichText(node.content ?? [])
}

function getPlainText(block: ContentfulNode): string {
  if (!block) return ''
  if (block.nodeType === 'text') return block.value ?? ''
  return (block.content ?? []).map(getPlainText).join('')
}

import { describe, expect, it } from 'bun:test'
import type {
  DiscoveredArticle,
  ImageComponent,
  Paragraph,
  RawHtml,
} from '@/schema/types.ts'
import { validateArticle, validateDiscoveryResult } from '@/schema/validate.ts'
import { itvNewsSource } from '@/sources/itv-news.ts'

const FIXTURE_URL =
  'https://www.itv.com/news/2026-02-11/dawsons-creek-star-james-van-der-beek-has-died-aged-48'
const HOMEPAGE_URL = 'https://www.itv.com/news'

const fixtureHtml = await Bun.file(
  `${import.meta.dir}/../fixtures/itv-news/article.html`,
).text()

const homepageHtml = await Bun.file(
  `${import.meta.dir}/../fixtures/itv-news/homepage.html`,
).text()

// --- matches ---

describe('matches', () => {
  it('matches itv.com/news URLs', () => {
    expect(itvNewsSource.matches('https://www.itv.com/news/some-article')).toBe(
      true,
    )
    expect(itvNewsSource.matches('https://itv.com/news/some-article')).toBe(
      true,
    )
    expect(
      itvNewsSource.matches('http://www.itv.com/news/2026-01-01/test'),
    ).toBe(true)
  })

  it('rejects non-ITV URLs', () => {
    expect(itvNewsSource.matches('https://bbc.co.uk/news/article')).toBe(false)
    expect(itvNewsSource.matches('https://example.com')).toBe(false)
  })

  it('rejects ITV non-news URLs', () => {
    expect(itvNewsSource.matches('https://www.itv.com/hub/show')).toBe(false)
    expect(itvNewsSource.matches('https://www.itv.com/')).toBe(false)
  })
})

// --- parseArticle ---

describe('parseArticle', () => {
  const article = itvNewsSource.parseArticle(fixtureHtml, FIXTURE_URL)

  it('passes schema validation', () => {
    expect(() => validateArticle(article)).not.toThrow()
  })

  // Source

  it('sets source fields', () => {
    expect(article.source).toMatchObject({
      url: FIXTURE_URL,
      publisherId: 'itv-news',
      cmsType: 'contentful',
      ingestionMethod: 'scrape',
    })
    expect(article.source.canonicalUrl).toContain('itv.com/news')
  })

  // Metadata

  it('extracts title', () => {
    expect(article.metadata.title).toContain('James Van Der Beek')
  })

  it('extracts publishedAt as ISO datetime', () => {
    expect(article.metadata.publishedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    )
  })

  it('extracts modifiedAt from JSON-LD', () => {
    expect(article.metadata.modifiedAt).toBeDefined()
  })

  it('extracts thumbnail with dimensions', () => {
    expect(article.metadata.thumbnail).toBeDefined()
    expect(article.metadata.thumbnail?.url).toContain('ctfassets.net')
    expect(article.metadata.thumbnail?.width).toBeGreaterThan(0)
    expect(article.metadata.thumbnail?.height).toBeGreaterThan(0)
  })

  it('extracts categories from regions', () => {
    expect(article.metadata.categories).toContain('National')
  })

  it('extracts tags from topics', () => {
    expect(article.metadata.tags).toContain('Entertainment')
  })

  it('extracts keywords from JSON-LD', () => {
    expect(article.metadata.keywords).toBeDefined()
    expect(article.metadata.keywords?.length).toBeGreaterThan(0)
  })

  it('extracts section from JSON-LD', () => {
    expect(article.metadata.section).toBe('national')
  })

  it('extracts language', () => {
    expect(article.metadata.language).toBe('en-GB')
  })

  it('extracts excerpt', () => {
    expect(article.metadata.excerpt).toBeDefined()
    expect(article.metadata.excerpt?.length).toBeGreaterThan(0)
  })

  // Authors

  it('extracts authors', () => {
    // ITV News articles may have byline or fall back to empty
    expect(article.authors).toBeInstanceOf(Array)
  })

  // Body

  it('produces non-empty body', () => {
    expect(article.body.length).toBeGreaterThan(0)
  })

  it('contains paragraphs', () => {
    const paragraphs = article.body.filter((c) => c.type === 'paragraph')
    expect(paragraphs.length).toBeGreaterThan(0)
  })

  it('paragraphs use html format', () => {
    const paragraph = article.body.find((c) => c.type === 'paragraph')
    expect(paragraph).toBeDefined()
    expect((paragraph as Paragraph).format).toBe('html')
  })

  it('contains dividers from hr blocks', () => {
    const dividers = article.body.filter((c) => c.type === 'divider')
    expect(dividers.length).toBeGreaterThan(0)
  })

  it('contains images from embedded entries', () => {
    const images = article.body.filter((c) => c.type === 'image')
    expect(images.length).toBeGreaterThan(0)
    const img = images[0] as ImageComponent
    expect(img.url).toBeDefined()
  })

  it('contains rawHtml for podcast embeds', () => {
    const raw = article.body.filter((c) => c.type === 'rawHtml')
    expect(raw.length).toBeGreaterThan(0)
    expect((raw[0] as RawHtml).html).toContain('podcast')
  })

  it('preserves bold formatting in paragraphs', () => {
    const htmlParagraphs = article.body
      .filter((c) => c.type === 'paragraph')
      .map((c) => (c as Paragraph).text)
    const hasBold = htmlParagraphs.some((t: string) => t.includes('<strong>'))
    expect(hasBold).toBe(true)
  })

  it('converts tile-links to paragraph links', () => {
    const htmlParagraphs = article.body
      .filter((c) => c.type === 'paragraph')
      .map((c) => (c as Paragraph).text)
    const hasLink = htmlParagraphs.some((t: string) => t.includes('<a href='))
    expect(hasLink).toBe(true)
  })

  // Structure

  it('has version field', () => {
    expect(article.version).toBe('1.0')
  })

  it('has extractedAt as ISO datetime', () => {
    expect(article.extractedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})

// --- parseArticles ---

describe('parseArticles', () => {
  const articles = itvNewsSource.parseArticles?.(homepageHtml, HOMEPAGE_URL)

  it('extracts articles from __NEXT_DATA__', () => {
    expect(articles.length).toBeGreaterThanOrEqual(5)
  })

  it('deduplicates articles by URL', () => {
    const urls = articles.map((a: DiscoveredArticle) => a.url)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('returns absolute URLs', () => {
    for (const article of articles) {
      expect(article.url).toMatch(/^https?:\/\//)
    }
  })

  it('filters out externalUrl items', () => {
    const watchLinks = articles.filter((a: DiscoveredArticle) =>
      a.url.includes('/watch/'),
    )
    expect(watchLinks).toHaveLength(0)
  })

  it('extracts title', () => {
    const pm = articles.find((a: DiscoveredArticle) =>
      a.title.includes('PM to hold talks'),
    )
    expect(pm).toBeDefined()
  })

  it('extracts summary as excerpt', () => {
    const pm = articles.find((a: DiscoveredArticle) =>
      a.title.includes('PM to hold talks'),
    )
    expect(pm?.excerpt).toContain('trade deal')
  })

  it('extracts thumbnail', () => {
    const pm = articles.find((a: DiscoveredArticle) =>
      a.title.includes('PM to hold talks'),
    )
    expect(pm?.thumbnail).toBeDefined()
    expect(pm?.thumbnail?.url).toContain('pm-eu-talks.jpg')
  })

  it('extracts thumbnail dimensions', () => {
    const pm = articles.find((a: DiscoveredArticle) =>
      a.title.includes('PM to hold talks'),
    )
    expect(pm?.thumbnail?.width).toBe(1600)
    expect(pm?.thumbnail?.height).toBe(900)
  })

  it('extracts publishedAt', () => {
    const pm = articles.find((a: DiscoveredArticle) =>
      a.title.includes('PM to hold talks'),
    )
    expect(pm?.publishedAt).toContain('2026-02-17')
  })

  it('includes regional articles', () => {
    const regional = articles.find((a: DiscoveredArticle) =>
      a.url.includes('/anglia/'),
    )
    expect(regional).toBeDefined()
  })

  it('includes latest items (fields wrapper)', () => {
    const jackson = articles.find((a: DiscoveredArticle) =>
      a.title.includes('Jesse Jackson'),
    )
    expect(jackson).toBeDefined()
    expect(jackson?.url).toContain('/news/2026-02-17/jesse-jackson')
  })

  it('includes collection items', () => {
    const weather = articles.find((a: DiscoveredArticle) =>
      a.title.includes('Weather warning'),
    )
    expect(weather).toBeDefined()
  })

  it('sets sourceId to itv-news', () => {
    for (const article of articles) {
      expect(article.sourceId).toBe('itv-news')
    }
  })

  it('passes discovery result validation', () => {
    const result = {
      articles,
      discoveredAt: new Date().toISOString(),
      sourceUrl: HOMEPAGE_URL,
      sourceId: 'itv-news',
    }
    expect(() => validateDiscoveryResult(result)).not.toThrow()
  })
})

describe('homepageUrl', () => {
  it('has homepageUrl defined', () => {
    expect(itvNewsSource.homepageUrl).toBe('https://www.itv.com/news')
  })
})

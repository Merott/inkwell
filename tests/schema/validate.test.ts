import { describe, expect, it } from 'bun:test'
import type { Article, DiscoveryResult } from '@/schema/types.ts'
import { validateArticle, validateDiscoveryResult } from '@/schema/validate.ts'

function validArticle(): Article {
  return {
    version: '1.0',
    extractedAt: new Date().toISOString(),
    source: {
      url: 'https://example.com/article',
      canonicalUrl: 'https://example.com/article',
      publisherId: 'test',
      cmsType: 'test',
      ingestionMethod: 'scrape',
    },
    metadata: {
      title: 'Test Article',
      language: 'en',
      publishedAt: new Date().toISOString(),
    },
    authors: [{ name: 'Test Author' }],
    body: [{ type: 'paragraph', text: 'Hello world', format: 'text' }],
  }
}

describe('validateArticle', () => {
  it('accepts a valid article', () => {
    expect(() => validateArticle(validArticle())).not.toThrow()
  })

  it('rejects missing title', () => {
    const a = validArticle()
    ;(a.metadata as any).title = undefined
    expect(() => validateArticle(a)).toThrow()
  })

  it('rejects empty title', () => {
    const a = validArticle()
    a.metadata.title = ''
    expect(() => validateArticle(a)).toThrow()
  })

  it('rejects missing body', () => {
    const a = validArticle()
    a.body = []
    expect(() => validateArticle(a)).toThrow()
  })

  it('rejects invalid source URL', () => {
    const a = validArticle()
    a.source.url = 'not-a-url'
    expect(() => validateArticle(a)).toThrow()
  })

  it('rejects invalid ingestionMethod', () => {
    const a = validArticle()
    ;(a.source as any).ingestionMethod = 'magic'
    expect(() => validateArticle(a)).toThrow()
  })

  it('rejects invalid datetime', () => {
    const a = validArticle()
    a.metadata.publishedAt = 'not-a-date'
    expect(() => validateArticle(a)).toThrow()
  })

  it('rejects invalid body component type', () => {
    const a = validArticle()
    ;(a.body as any) = [{ type: 'unknown', text: 'hi' }]
    expect(() => validateArticle(a)).toThrow()
  })

  it('rejects heading with invalid level', () => {
    const a = validArticle()
    a.body = [{ type: 'heading', level: 7, text: 'Bad', format: 'text' }]
    expect(() => validateArticle(a)).toThrow()
  })

  it('accepts optional fields when missing', () => {
    const a = validArticle()
    delete a.media
    delete a.relatedContent
    delete a.paywall
    delete a.custom
    expect(() => validateArticle(a)).not.toThrow()
  })

  it('accepts all body component types', () => {
    const a = validArticle()
    a.body = [
      { type: 'paragraph', text: 'p', format: 'html' },
      { type: 'heading', level: 2, text: 'h', format: 'text' },
      { type: 'blockquote', text: 'q' },
      { type: 'list', style: 'unordered', items: ['a', 'b'] },
      { type: 'divider' },
      { type: 'image', url: 'https://example.com/img.jpg' },
      {
        type: 'video',
        url: 'https://example.com/vid.mp4',
      },
      { type: 'rawHtml', html: '<div>raw</div>' },
    ]
    expect(() => validateArticle(a)).not.toThrow()
  })
})

function validDiscoveryResult(): DiscoveryResult {
  return {
    articles: [
      {
        url: 'https://example.com/article-1',
        title: 'Test Article',
        sourceId: 'test',
      },
    ],
    discoveredAt: new Date().toISOString(),
    sourceUrl: 'https://example.com/',
    sourceId: 'test',
  }
}

describe('validateDiscoveryResult', () => {
  it('accepts a valid discovery result', () => {
    expect(() => validateDiscoveryResult(validDiscoveryResult())).not.toThrow()
  })

  it('accepts articles with all optional fields', () => {
    const r = validDiscoveryResult()
    r.articles = [
      {
        url: 'https://example.com/article-1',
        title: 'Full Article',
        excerpt: 'An excerpt from the article.',
        thumbnail: {
          url: 'https://example.com/thumb.jpg',
          width: 800,
          height: 450,
        },
        publishedAt: '2026-02-17T10:30:00.000Z',
        sourceId: 'test',
      },
    ]
    expect(() => validateDiscoveryResult(r)).not.toThrow()
  })

  it('rejects article with invalid URL', () => {
    const r = validDiscoveryResult()
    r.articles[0]!.url = 'not-a-url'
    expect(() => validateDiscoveryResult(r)).toThrow()
  })

  it('rejects article with empty title', () => {
    const r = validDiscoveryResult()
    r.articles[0]!.title = ''
    expect(() => validateDiscoveryResult(r)).toThrow()
  })

  it('rejects invalid discoveredAt datetime', () => {
    const r = validDiscoveryResult()
    r.discoveredAt = 'not-a-date'
    expect(() => validateDiscoveryResult(r)).toThrow()
  })

  it('rejects invalid sourceUrl', () => {
    const r = validDiscoveryResult()
    r.sourceUrl = 'not-a-url'
    expect(() => validateDiscoveryResult(r)).toThrow()
  })

  it('accepts empty articles array', () => {
    const r = validDiscoveryResult()
    r.articles = []
    expect(() => validateDiscoveryResult(r)).not.toThrow()
  })

  it('rejects article with invalid publishedAt', () => {
    const r = validDiscoveryResult()
    r.articles[0]!.publishedAt = 'bad-date'
    expect(() => validateDiscoveryResult(r)).toThrow()
  })

  it('returns typed DiscoveryResult', () => {
    const result = validateDiscoveryResult(validDiscoveryResult())
    expect(result.sourceId).toBe('test')
    expect(result.articles).toHaveLength(1)
    expect(result.articles[0]!.title).toBe('Test Article')
  })
})

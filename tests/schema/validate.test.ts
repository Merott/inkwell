import { describe, expect, it } from 'bun:test'
import type { Article } from '@/schema/types.ts'
import { validateArticle } from '@/schema/validate.ts'

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

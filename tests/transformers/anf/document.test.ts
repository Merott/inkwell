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
    authors: [{ name: 'Alice Smith' }, { name: 'Bob Jones' }],
    body: [
      { type: 'heading', level: 1, text: 'Main Heading', format: 'text' },
      { type: 'paragraph', text: '<em>First</em> paragraph.', format: 'html' },
      {
        type: 'image',
        url: 'https://example.com/photo.jpg',
        caption: 'A photo',
        altText: 'Photo description',
      },
      { type: 'paragraph', text: 'Second paragraph.', format: 'text' },
      { type: 'divider' },
      {
        type: 'blockquote',
        text: 'A notable quote.',
        attribution: 'Someone',
      },
      { type: 'rawHtml', html: '<div>custom widget</div>' },
    ],
  }
}

describe('transformToAnf', () => {
  it('produces a valid ANF document', () => {
    const { document } = transformToAnf(sampleArticle())
    expect(document.version).toBe('1.9')
    expect(document.identifier).toBe('404-media-test-article')
    expect(document.title).toBe('Test Article Title')
    expect(document.subtitle).toBe('A subtitle')
    expect(document.language).toBe('en')
  })

  it('sets layout defaults', () => {
    const { document } = transformToAnf(sampleArticle())
    expect(document.layout).toEqual({
      columns: 7,
      width: 1024,
      margin: 60,
      gutter: 20,
    })
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

  it('transforms body components with header image', () => {
    const { document } = transformToAnf(sampleArticle())
    // 1 header image + 6 body (rawHtml dropped) = 7
    expect(document.components).toHaveLength(7)
    expect(document.components[0]).toMatchObject({
      role: 'photo',
      URL: 'https://example.com/thumb.jpg',
    })
    expect(document.components[1]).toMatchObject({ role: 'heading1' })
    expect(document.components[2]).toMatchObject({ role: 'body' })
    expect(document.components[3]).toMatchObject({ role: 'photo' })
    expect(document.components[4]).toMatchObject({ role: 'body' })
    expect(document.components[5]).toMatchObject({ role: 'divider' })
    expect(document.components[6]).toMatchObject({ role: 'quote' })
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
    delete article.metadata.thumbnail
    expect(() => transformToAnf(article)).toThrow()
  })
})

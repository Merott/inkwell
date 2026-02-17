import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildOutputPath,
  slugFromUrl,
  writeArticle,
} from '@/pipeline/output.ts'
import type { Article } from '@/schema/types.ts'

describe('slugFromUrl', () => {
  test('extracts slug from Ghost URL', () => {
    expect(slugFromUrl('https://www.404media.co/my-article/')).toBe(
      'my-article',
    )
  })

  test('extracts slug from ITV News URL', () => {
    expect(
      slugFromUrl('https://www.itv.com/news/2024-01-15/some-headline-here'),
    ).toBe('some-headline-here')
  })

  test('handles URL without trailing slash', () => {
    expect(slugFromUrl('https://example.com/posts/hello-world')).toBe(
      'hello-world',
    )
  })

  test('handles URL with file extension', () => {
    expect(slugFromUrl('https://example.com/article.html')).toBe('article')
  })

  test('handles root path', () => {
    expect(slugFromUrl('https://example.com/')).toBe('untitled')
  })
})

describe('buildOutputPath', () => {
  const baseArticle: Article = {
    version: '1.0',
    extractedAt: '2026-01-15T12:00:00Z',
    source: {
      url: 'https://www.404media.co/my-great-article/',
      publisherId: '404-media',
      cmsType: 'ghost',
      ingestionMethod: 'scrape',
    },
    metadata: {
      title: 'Test',
      language: 'en',
      publishedAt: '2026-01-15T10:00:00Z',
    },
    authors: [{ name: 'Test' }],
    body: [{ type: 'paragraph', text: 'Hello', format: 'text' }],
  }

  test('builds path from publishedAt date and slug', () => {
    const path = buildOutputPath('404-media', baseArticle)
    expect(path).toBe('output/404-media/2026-01-15-my-great-article.json')
  })

  test('uses current date when publishedAt is missing', () => {
    const article: Article = {
      ...baseArticle,
      metadata: { ...baseArticle.metadata, publishedAt: '' },
    }
    // publishedAt is empty → falls back to current date
    const path = buildOutputPath('404-media', article)
    const today = new Date().toISOString().slice(0, 10)
    expect(path).toBe(`output/404-media/${today}-my-great-article.json`)
  })
})

describe('writeArticle', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `inkwell-test-${Date.now()}`)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  const validArticle: Article = {
    version: '1.0',
    extractedAt: '2026-01-15T12:00:00Z',
    source: {
      url: 'https://www.404media.co/test-article/',
      publisherId: '404-media',
      cmsType: 'ghost',
      ingestionMethod: 'scrape',
    },
    metadata: {
      title: 'Test Article',
      language: 'en',
      publishedAt: '2026-01-15T10:00:00Z',
    },
    authors: [{ name: 'Author' }],
    body: [{ type: 'paragraph', text: 'Body text', format: 'text' }],
  }

  test('writes JSON file and returns relative path', async () => {
    const relPath = await writeArticle('404-media', validArticle, tempDir)
    expect(relPath).toBe('output/404-media/2026-01-15-test-article.json')

    const fullPath = join(tempDir, relPath)
    const content = JSON.parse(await readFile(fullPath, 'utf-8'))
    expect(content.metadata.title).toBe('Test Article')
  })

  test('creates directories recursively', async () => {
    const relPath = await writeArticle('404-media', validArticle, tempDir)
    const fullPath = join(tempDir, relPath)
    const content = await readFile(fullPath, 'utf-8')
    expect(JSON.parse(content)).toBeDefined()
  })
})

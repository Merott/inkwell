import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDb, type InkwellDb } from '@/pipeline/db/client.ts'
import { getArticle } from '@/pipeline/db/queries.ts'
import { pollAll, pollPublisher } from '@/pipeline/poll.ts'
import type { PublisherConfig } from '@/publishers.ts'
import type { Article, DiscoveredArticle } from '@/schema/types.ts'
import type { ArticleSource } from '@/sources/types.ts'

const fakeArticle: Article = {
  version: '1.0',
  extractedAt: '2026-01-15T12:00:00Z',
  source: {
    url: 'https://example.com/post-1',
    publisherId: 'test-pub',
    cmsType: 'test',
    ingestionMethod: 'scrape',
  },
  metadata: {
    title: 'Test Post 1',
    language: 'en',
    publishedAt: '2026-01-15T10:00:00Z',
  },
  authors: [{ name: 'Author' }],
  body: [{ type: 'paragraph', text: 'Hello', format: 'text' }],
}

function makeFakeSource(
  discovered: DiscoveredArticle[] = [],
  scrapeResult: Article | Error = fakeArticle,
): ArticleSource {
  return {
    id: 'test-source',
    matches: () => true,
    parseArticle: () => fakeArticle,
    scrapeArticle: async (url: string) => {
      if (scrapeResult instanceof Error) throw scrapeResult
      return {
        ...scrapeResult,
        source: { ...scrapeResult.source, url },
      }
    },
    scrapeArticles: async () => discovered,
  }
}

const testConfig: PublisherConfig = {
  id: 'test-pub',
  name: 'Test Publisher',
  sourceId: 'test-source',
  homepageUrl: 'https://example.com/',
  enabled: true,
}

let db: InkwellDb
let tempDir: string

beforeEach(async () => {
  db = createDb(':memory:')
  tempDir = join(tmpdir(), `inkwell-poll-test-${Date.now()}`)
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

describe('pollPublisher', () => {
  test('discovers and scrapes new articles', async () => {
    const source = makeFakeSource([
      {
        url: 'https://example.com/post-1',
        title: 'Post 1',
        sourceId: 'test-source',
      },
      {
        url: 'https://example.com/post-2',
        title: 'Post 2',
        sourceId: 'test-source',
      },
    ])

    const result = await pollPublisher(testConfig, source, db, tempDir)

    expect(result.discovered).toBe(2)
    expect(result.scraped).toBe(2)
    expect(result.failed).toBe(0)

    // Verify articles in DB
    const a1 = getArticle(db, 'https://example.com/post-1')
    expect(a1?.status).toBe('scraped')
    expect(a1?.outputPath).toBeTruthy()

    const a2 = getArticle(db, 'https://example.com/post-2')
    expect(a2?.status).toBe('scraped')
  })

  test('skips already-scraped articles', async () => {
    const source = makeFakeSource([
      {
        url: 'https://example.com/post-1',
        title: 'Post 1',
        sourceId: 'test-source',
      },
    ])

    // First poll
    await pollPublisher(testConfig, source, db, tempDir)

    // Second poll — same articles
    const result = await pollPublisher(testConfig, source, db, tempDir)

    expect(result.discovered).toBe(0)
    expect(result.scraped).toBe(0)
  })

  test('retries failed articles', async () => {
    const failingSource = makeFakeSource(
      [
        {
          url: 'https://example.com/post-1',
          title: 'Post 1',
          sourceId: 'test-source',
        },
      ],
      new Error('timeout'),
    )

    // First poll — article fails
    const r1 = await pollPublisher(testConfig, failingSource, db, tempDir)
    expect(r1.failed).toBe(1)

    // Fix the source
    const fixedSource = makeFakeSource([
      {
        url: 'https://example.com/post-1',
        title: 'Post 1',
        sourceId: 'test-source',
      },
    ])

    // Second poll — article retried and succeeds
    const r2 = await pollPublisher(testConfig, fixedSource, db, tempDir)
    expect(r2.scraped).toBe(1)
    expect(r2.failed).toBe(0)
  })

  test('one failure does not halt the run', async () => {
    let callCount = 0
    const source: ArticleSource = {
      id: 'test-source',
      matches: () => true,
      parseArticle: () => fakeArticle,
      scrapeArticle: async (url: string) => {
        callCount++
        if (url.includes('bad')) throw new Error('parse error')
        return { ...fakeArticle, source: { ...fakeArticle.source, url } }
      },
      scrapeArticles: async () => [
        {
          url: 'https://example.com/good-1',
          title: 'Good 1',
          sourceId: 'test-source',
        },
        {
          url: 'https://example.com/bad-1',
          title: 'Bad 1',
          sourceId: 'test-source',
        },
        {
          url: 'https://example.com/good-2',
          title: 'Good 2',
          sourceId: 'test-source',
        },
      ],
    }

    const result = await pollPublisher(testConfig, source, db, tempDir)

    expect(callCount).toBe(3) // all 3 attempted
    expect(result.scraped).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.url).toContain('bad-1')
  })

  test('empty discovery results in no scrapes', async () => {
    const source = makeFakeSource([])
    const result = await pollPublisher(testConfig, source, db, tempDir)

    expect(result.discovered).toBe(0)
    expect(result.scraped).toBe(0)
    expect(result.failed).toBe(0)
  })

  test('calls init() and dispose() lifecycle hooks', async () => {
    let initCalled = false
    let disposeCalled = false
    const source = makeFakeSource([
      {
        url: 'https://example.com/post-1',
        title: 'Post 1',
        sourceId: 'test-source',
      },
    ])
    source.init = async () => {
      initCalled = true
    }
    source.dispose = async () => {
      disposeCalled = true
    }

    await pollPublisher(testConfig, source, db, tempDir)

    expect(initCalled).toBe(true)
    expect(disposeCalled).toBe(true)
  })

  test('calls dispose() even when scraping fails', async () => {
    let disposeCalled = false
    const source = makeFakeSource(
      [
        {
          url: 'https://example.com/post-1',
          title: 'Post 1',
          sourceId: 'test-source',
        },
      ],
      new Error('boom'),
    )
    source.dispose = async () => {
      disposeCalled = true
    }

    await pollPublisher(testConfig, source, db, tempDir)

    expect(disposeCalled).toBe(true)
  })
})

describe('pollAll', () => {
  test('iterates enabled publishers', async () => {
    const pub1: PublisherConfig = {
      ...testConfig,
      id: 'pub-1',
      name: 'Pub 1',
      homepageUrl: 'https://example.com/pub1/',
    }
    const pub2: PublisherConfig = {
      ...testConfig,
      id: 'pub-2',
      name: 'Pub 2',
      homepageUrl: 'https://example.com/pub2/',
    }

    // Return different URLs based on homepage to avoid PK conflicts
    const source: ArticleSource = {
      id: 'test-source',
      matches: () => true,
      parseArticle: () => fakeArticle,
      scrapeArticle: async (url: string) => ({
        ...fakeArticle,
        source: { ...fakeArticle.source, url },
      }),
      scrapeArticles: async (url?: string) => {
        const suffix = url?.includes('pub1') ? '1' : '2'
        return [
          {
            url: `https://example.com/pub${suffix}-article`,
            title: `Article ${suffix}`,
            sourceId: 'test-source',
          },
        ]
      },
    }

    const summary = await pollAll([pub1, pub2], () => source, db, tempDir)

    expect(summary.results).toHaveLength(2)
    expect(summary.totals.discovered).toBe(2)
    expect(summary.totals.scraped).toBe(2)
  })

  test('skips publisher with unknown source', async () => {
    const summary = await pollAll([testConfig], () => undefined, db, tempDir)

    expect(summary.results).toHaveLength(0)
  })
})

describe('integration: full cycle to filesystem', () => {
  test('writes article JSON files to disk', async () => {
    const source = makeFakeSource([
      {
        url: 'https://example.com/post-1',
        title: 'Post 1',
        sourceId: 'test-source',
      },
    ])

    const result = await pollPublisher(testConfig, source, db, tempDir)

    expect(result.scraped).toBe(1)

    // Verify file written
    const article = getArticle(db, 'https://example.com/post-1')
    expect(article?.outputPath).toBeTruthy()

    const fullPath = join(tempDir, article?.outputPath ?? '')
    const content = JSON.parse(await readFile(fullPath, 'utf-8'))
    expect(content.metadata.title).toBe('Test Post 1')
    expect(content.source.url).toBe('https://example.com/post-1')
  })
})

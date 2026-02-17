import { beforeEach, describe, expect, test } from 'bun:test'
import { createDb, type InkwellDb } from '@/pipeline/db/client.ts'
import {
  getArticle,
  getScrapeable,
  insertDiscovered,
  markFailed,
  markScraped,
} from '@/pipeline/db/queries.ts'

let db: InkwellDb

beforeEach(() => {
  db = createDb(':memory:')
})

describe('insertDiscovered', () => {
  test('inserts new URLs and returns count', () => {
    const count = insertDiscovered(db, [
      { url: 'https://example.com/a', publisherId: 'test-pub' },
      { url: 'https://example.com/b', publisherId: 'test-pub' },
    ])
    expect(count).toBe(2)
  })

  test('returns 0 for empty array', () => {
    expect(insertDiscovered(db, [])).toBe(0)
  })

  test('idempotent — re-discovering same URL is a no-op', () => {
    insertDiscovered(db, [
      { url: 'https://example.com/a', publisherId: 'test-pub' },
    ])
    const count = insertDiscovered(db, [
      { url: 'https://example.com/a', publisherId: 'test-pub' },
    ])
    expect(count).toBe(0)
  })

  test('sets status to discovered', () => {
    insertDiscovered(db, [
      { url: 'https://example.com/a', publisherId: 'test-pub' },
    ])
    const article = getArticle(db, 'https://example.com/a')
    expect(article).toBeDefined()
    expect(article?.status).toBe('discovered')
    expect(article?.publisherId).toBe('test-pub')
    expect(article?.discoveredAt).toBeTruthy()
  })
})

describe('getScrapeable', () => {
  test('returns discovered articles', () => {
    insertDiscovered(db, [
      { url: 'https://example.com/a', publisherId: 'pub-1' },
    ])
    const results = getScrapeable(db, 'pub-1')
    expect(results).toHaveLength(1)
    expect(results[0]?.url).toBe('https://example.com/a')
  })

  test('returns failed articles (for retry)', () => {
    insertDiscovered(db, [
      { url: 'https://example.com/a', publisherId: 'pub-1' },
    ])
    markFailed(db, 'https://example.com/a', 'timeout')
    const results = getScrapeable(db, 'pub-1')
    expect(results).toHaveLength(1)
    expect(results[0]?.status).toBe('failed')
  })

  test('excludes scraped articles', () => {
    insertDiscovered(db, [
      { url: 'https://example.com/a', publisherId: 'pub-1' },
    ])
    markScraped(db, 'https://example.com/a', 'output/pub-1/article.json')
    const results = getScrapeable(db, 'pub-1')
    expect(results).toHaveLength(0)
  })

  test('filters by publisherId', () => {
    insertDiscovered(db, [
      { url: 'https://example.com/a', publisherId: 'pub-1' },
      { url: 'https://example.com/b', publisherId: 'pub-2' },
    ])
    const results = getScrapeable(db, 'pub-1')
    expect(results).toHaveLength(1)
    expect(results[0]?.publisherId).toBe('pub-1')
  })
})

describe('markScraped', () => {
  test('transitions discovered → scraped', () => {
    insertDiscovered(db, [
      { url: 'https://example.com/a', publisherId: 'pub-1' },
    ])
    markScraped(db, 'https://example.com/a', 'output/pub-1/article.json')

    const article = getArticle(db, 'https://example.com/a')
    expect(article?.status).toBe('scraped')
    expect(article?.scrapedAt).toBeTruthy()
    expect(article?.outputPath).toBe('output/pub-1/article.json')
    expect(article?.error).toBeNull()
  })

  test('transitions failed → scraped (clears error)', () => {
    insertDiscovered(db, [
      { url: 'https://example.com/a', publisherId: 'pub-1' },
    ])
    markFailed(db, 'https://example.com/a', 'timeout')
    markScraped(db, 'https://example.com/a', 'output/pub-1/article.json')

    const article = getArticle(db, 'https://example.com/a')
    expect(article?.status).toBe('scraped')
    expect(article?.error).toBeNull()
  })
})

describe('markFailed', () => {
  test('transitions discovered → failed with error message', () => {
    insertDiscovered(db, [
      { url: 'https://example.com/a', publisherId: 'pub-1' },
    ])
    markFailed(db, 'https://example.com/a', 'Connection refused')

    const article = getArticle(db, 'https://example.com/a')
    expect(article?.status).toBe('failed')
    expect(article?.error).toBe('Connection refused')
  })
})

describe('getArticle', () => {
  test('returns undefined for unknown URL', () => {
    expect(getArticle(db, 'https://example.com/nope')).toBeUndefined()
  })
})

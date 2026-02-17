import { describe, expect, test } from 'bun:test'
import {
  getAllPublishers,
  getEnabledPublishers,
  getPublisher,
} from '@/publishers.ts'
import { getSourceById } from '@/sources/index.ts'

describe('publishers config', () => {
  test('all publishers have required fields', () => {
    for (const pub of getAllPublishers()) {
      expect(pub.id).toBeTruthy()
      expect(pub.name).toBeTruthy()
      expect(pub.sourceId).toBeTruthy()
      expect(pub.homepageUrl).toMatch(/^https?:\/\//)
      expect(typeof pub.enabled).toBe('boolean')
    }
  })

  test('no duplicate IDs', () => {
    const ids = getAllPublishers().map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('every publisher references a valid sourceId', () => {
    for (const pub of getAllPublishers()) {
      const source = getSourceById(pub.sourceId)
      expect(source).toBeDefined()
    }
  })

  test('getPublisher returns matching publisher', () => {
    const pub = getPublisher('404-media')
    expect(pub).toBeDefined()
    expect(pub?.name).toBe('404 Media')
    expect(pub?.sourceId).toBe('ghost')
  })

  test('getPublisher returns undefined for unknown ID', () => {
    expect(getPublisher('nonexistent')).toBeUndefined()
  })

  test('getEnabledPublishers returns only enabled publishers', () => {
    const enabled = getEnabledPublishers()
    expect(enabled.length).toBeGreaterThan(0)
    for (const pub of enabled) {
      expect(pub.enabled).toBe(true)
    }
  })
})

describe('getSourceById', () => {
  test('returns ghost source', () => {
    const source = getSourceById('ghost')
    expect(source).toBeDefined()
    expect(source?.id).toBe('ghost')
  })

  test('returns itv-news source', () => {
    const source = getSourceById('itv-news')
    expect(source).toBeDefined()
    expect(source?.id).toBe('itv-news')
  })

  test('returns undefined for unknown source', () => {
    expect(getSourceById('nonexistent')).toBeUndefined()
  })
})

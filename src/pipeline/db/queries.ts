import { and, eq, inArray } from 'drizzle-orm'
import type { InkwellDb } from './client.ts'
import { articles } from './schema.ts'

export function insertDiscovered(
  db: InkwellDb,
  urls: { url: string; publisherId: string }[],
) {
  if (urls.length === 0) return 0

  const now = new Date().toISOString()
  const result = db
    .insert(articles)
    .values(
      urls.map((u) => ({
        url: u.url,
        publisherId: u.publisherId,
        discoveredAt: now,
        status: 'discovered' as const,
      })),
    )
    .onConflictDoNothing()
    .run()

  return result.changes
}

export function getScrapeable(db: InkwellDb, publisherId: string) {
  return db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.publisherId, publisherId),
        inArray(articles.status, ['discovered', 'failed']),
      ),
    )
    .all()
}

export function markScraped(db: InkwellDb, url: string, outputPath: string) {
  db.update(articles)
    .set({
      status: 'scraped',
      scrapedAt: new Date().toISOString(),
      outputPath,
      error: null,
    })
    .where(eq(articles.url, url))
    .run()
}

export function markFailed(db: InkwellDb, url: string, error: string) {
  db.update(articles)
    .set({
      status: 'failed',
      error,
    })
    .where(eq(articles.url, url))
    .run()
}

export function getArticle(db: InkwellDb, url: string) {
  return db.select().from(articles).where(eq(articles.url, url)).get()
}

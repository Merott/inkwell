import type { InkwellDb } from '@/pipeline/db/client.ts'
import {
  getScrapeable,
  insertDiscovered,
  markFailed,
  markScraped,
} from '@/pipeline/db/queries.ts'
import { writeArticle } from '@/pipeline/output.ts'
import type { PublisherConfig } from '@/publishers.ts'
import type { ArticleSource } from '@/sources/types.ts'

export interface PollResult {
  publisherId: string
  discovered: number
  scraped: number
  failed: number
  skipped: number
  errors: { url: string; error: string }[]
}

export interface PollSummary {
  results: PollResult[]
  totals: {
    discovered: number
    scraped: number
    failed: number
    skipped: number
  }
}

export async function pollPublisher(
  config: PublisherConfig,
  source: ArticleSource,
  db: InkwellDb,
  baseDir = '.',
): Promise<PollResult> {
  const result: PollResult = {
    publisherId: config.id,
    discovered: 0,
    scraped: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  // 1. Discover articles from homepage
  if (!source.scrapeArticles) {
    console.error(`Source ${source.id} does not support discovery, skipping`)
    return result
  }

  await source.init?.()
  try {
    const articles = await source.scrapeArticles(config.homepageUrl)

    // 2. Diff against DB — insert new as 'discovered'
    const newCount = insertDiscovered(
      db,
      articles.map((a) => ({ url: a.url, publisherId: config.id })),
    )
    result.discovered = newCount

    // 3. Query DB for scrapeable articles
    const scrapeable = getScrapeable(db, config.id)
    result.skipped = articles.length - newCount - (scrapeable.length - newCount)

    // 4. Scrape each article
    for (const row of scrapeable) {
      try {
        console.error(`  Scraping: ${row.url}`)
        const article = await source.scrapeArticle(row.url)
        const outputPath = await writeArticle(config.id, article, baseDir)
        markScraped(db, row.url, outputPath)
        result.scraped++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        markFailed(db, row.url, message)
        result.failed++
        result.errors.push({ url: row.url, error: message })
        console.error(`  Failed: ${row.url} — ${message}`)
      }
    }
  } finally {
    await source.dispose?.()
  }

  return result
}

export async function pollAll(
  publishers: PublisherConfig[],
  getSource: (sourceId: string) => ArticleSource | undefined,
  db: InkwellDb,
  baseDir = '.',
): Promise<PollSummary> {
  const results: PollResult[] = []
  const totals = { discovered: 0, scraped: 0, failed: 0, skipped: 0 }

  for (const config of publishers) {
    const source = getSource(config.sourceId)
    if (!source) {
      console.error(
        `No source found for ${config.sourceId}, skipping ${config.id}`,
      )
      continue
    }

    console.error(`\nPolling ${config.name} (${config.id})...`)
    const result = await pollPublisher(config, source, db, baseDir)
    results.push(result)

    totals.discovered += result.discovered
    totals.scraped += result.scraped
    totals.failed += result.failed
    totals.skipped += result.skipped
  }

  return { results, totals }
}

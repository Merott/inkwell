import { validateArticle, validateDiscoveryResult } from './schema/validate.ts'
import * as sources from './sources/index.ts'
import type { ArticleSource } from './sources/types.ts'

const allSources: ArticleSource[] = Object.values(sources).filter(
  (v): v is ArticleSource => typeof v === 'object' && v !== null && 'id' in v,
)

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'discover') {
    await discover(args[1])
  } else if (command === 'scrape') {
    await scrape(args[1])
  } else if (command === 'poll') {
    await poll(args.slice(1))
  } else if (command && /^https?:\/\//.test(command)) {
    // Bare URL — treat as scrape for backward compatibility
    await scrape(command)
  } else {
    console.error('Usage:')
    console.error('  bun run scrape <article-url>')
    console.error('  bun run discover <homepage-url | publisher-id>')
    console.error('  bun run poll [--publisher <id>] [--all]')
    process.exit(1)
  }
}

async function scrape(url: string | undefined) {
  if (!url) {
    console.error('Usage: bun run scrape <article-url>')
    process.exit(1)
  }

  const source = allSources.find((s) => s.matches(url))
  if (!source) {
    console.error(`No source found for URL: ${url}`)
    process.exit(1)
  }

  console.error(`Scraping with ${source.id}...`)
  const raw = await source.scrapeArticle(url)

  console.error('Validating...')
  const article = validateArticle(raw)

  console.log(JSON.stringify(article, null, 2))
  console.error('Done.')
}

async function discover(target: string | undefined) {
  if (!target) {
    console.error('Usage: bun run discover <homepage-url | publisher-id>')
    process.exit(1)
  }

  let source: ArticleSource | undefined
  let url: string | undefined

  if (/^https?:\/\//.test(target)) {
    // Resolve by URL
    url = target
    source = allSources.find(
      (s) => s.homepageUrl === target || s.matches(target),
    )
  } else {
    // Resolve by publisher id across all sources
    for (const s of allSources) {
      const pub = s.publishers?.find((p) => p.id === target)
      if (pub) {
        source = s
        url = pub.homepageUrl
        break
      }
    }
  }

  if (!source) {
    console.error(`No source or publisher found for: ${target}`)
    process.exit(1)
  }

  if (!source.scrapeArticles) {
    console.error(`Source ${source.id} does not support discovery`)
    process.exit(1)
  }

  console.error(`Discovering articles from ${source.id}...`)
  const articles = await source.scrapeArticles(url)

  console.error('Validating...')
  const result = validateDiscoveryResult({
    articles,
    discoveredAt: new Date().toISOString(),
    sourceUrl: url ?? source.homepageUrl ?? target,
    sourceId: source.id,
  })

  console.log(JSON.stringify(result, null, 2))
  console.error(`Done. Found ${result.articles.length} articles.`)
}

async function poll(args: string[]) {
  const { getEnabledPublishers, getPublisher } = await import('./publishers.ts')
  const { getSourceById } = await import('./sources/index.ts')
  const { createDb } = await import('./pipeline/db/client.ts')
  const { pollAll, pollPublisher } = await import('./pipeline/poll.ts')

  const db = createDb()

  let publisherFlag: string | undefined
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--publisher' && args[i + 1]) {
      publisherFlag = args[i + 1]
    }
  }

  if (publisherFlag) {
    const config = getPublisher(publisherFlag)
    if (!config) {
      console.error(`Unknown publisher: ${publisherFlag}`)
      process.exit(1)
    }
    const source = getSourceById(config.sourceId)
    if (!source) {
      console.error(`No source found for ${config.sourceId}`)
      process.exit(1)
    }

    console.error(`Polling ${config.name} (${config.id})...`)
    const result = await pollPublisher(config, source, db)
    console.log(JSON.stringify(result, null, 2))
    printResultSummary([result])
  } else {
    const publishers = getEnabledPublishers()
    console.error(`Polling ${publishers.length} enabled publisher(s)...\n`)
    const summary = await pollAll(publishers, getSourceById, db)
    console.log(JSON.stringify(summary, null, 2))
    printResultSummary(summary.results)
    console.error(`\nTotals: ${fmt(summary.totals)}`)
  }
}

function fmt(t: {
  discovered: number
  scraped: number
  failed: number
  skipped: number
}) {
  return `${t.discovered} discovered, ${t.scraped} scraped, ${t.failed} failed, ${t.skipped} skipped`
}

function printResultSummary(
  results: {
    publisherId: string
    discovered: number
    scraped: number
    failed: number
    skipped: number
  }[],
) {
  console.error('\n--- Summary ---')
  for (const r of results) {
    console.error(`  ${r.publisherId}: ${fmt(r)}`)
  }
}

main().catch((err) => {
  console.error('Error:', err.message ?? err)
  process.exit(1)
})

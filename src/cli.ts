import { validateArticle, validateDiscoveryResult } from './schema/validate.ts'
import * as sources from './sources/index.ts'
import type { ArticleSource } from './sources/types.ts'

const allSources: ArticleSource[] = Object.values(sources)

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'discover') {
    await discover(args[1])
  } else if (command === 'scrape') {
    await scrape(args[1])
  } else if (command && /^https?:\/\//.test(command)) {
    // Bare URL — treat as scrape for backward compatibility
    await scrape(command)
  } else {
    console.error('Usage:')
    console.error('  bun run scrape <article-url>')
    console.error('  bun run discover <homepage-url | publisher-id>')
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
  const raw = await source.scrape(url)

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

  if (!source.discoverArticles) {
    console.error(`Source ${source.id} does not support discovery`)
    process.exit(1)
  }

  console.error(`Discovering articles from ${source.id}...`)
  const articles = await source.discoverArticles(url)

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

main().catch((err) => {
  console.error('Error:', err.message ?? err)
  process.exit(1)
})

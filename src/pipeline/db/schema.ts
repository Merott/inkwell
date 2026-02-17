import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const articles = sqliteTable('articles', {
  url: text('url').primaryKey(),
  publisherId: text('publisher_id').notNull(),
  discoveredAt: text('discovered_at').notNull(),
  scrapedAt: text('scraped_at'),
  status: text('status', {
    enum: ['discovered', 'scraped', 'failed'],
  }).notNull(),
  error: text('error'),
  outputPath: text('output_path'),
})

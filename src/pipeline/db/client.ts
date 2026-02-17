import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from './schema.ts'

export function createDb(path = 'data/inkwell.db') {
  if (path !== ':memory:') {
    const dir = path.substring(0, path.lastIndexOf('/'))
    if (dir) {
      const fs = require('node:fs')
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  const sqlite = new Database(path)
  sqlite.exec('PRAGMA journal_mode = WAL')

  // Auto-create table if not exists
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      url TEXT PRIMARY KEY,
      publisher_id TEXT NOT NULL,
      discovered_at TEXT NOT NULL,
      scraped_at TEXT,
      status TEXT NOT NULL CHECK(status IN ('discovered', 'scraped', 'failed')),
      error TEXT,
      output_path TEXT
    )
  `)

  return drizzle(sqlite, { schema })
}

export type InkwellDb = ReturnType<typeof createDb>

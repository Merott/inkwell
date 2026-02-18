import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Article } from '@/schema/types.ts'
import { validateArticle } from '@/schema/validate.ts'

export function slugFromUrl(url: string) {
  const path = new URL(url).pathname
  // Take last meaningful segment, strip trailing slash
  const segments = path.split('/').filter(Boolean)
  const last = segments.at(-1) ?? 'untitled'
  // Remove file extensions
  return last.replace(/\.\w+$/, '')
}

export function buildOutputPath(publisherId: string, article: Article) {
  const date = article.metadata.publishedAt
    ? article.metadata.publishedAt.slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const slug = slugFromUrl(article.source.url)
  return join('output', publisherId, `${date}-${slug}.json`)
}

export function buildAnfOutputPath(publisherId: string, article: Article) {
  const date = article.metadata.publishedAt
    ? article.metadata.publishedAt.slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const slug = slugFromUrl(article.source.url)
  return join('output', publisherId, 'anf', `${date}-${slug}.json`)
}

export async function writeArticle(
  publisherId: string,
  article: Article,
  baseDir = '.',
) {
  const validated = validateArticle(article)
  const relPath = buildOutputPath(publisherId, validated)
  const fullPath = join(baseDir, relPath)

  await mkdir(dirname(fullPath), { recursive: true })
  await writeFile(fullPath, JSON.stringify(validated, null, 2), 'utf-8')

  return relPath
}

export async function writeAnfDocument(
  publisherId: string,
  article: Article,
  anfDocument: unknown,
  baseDir = '.',
) {
  const relPath = buildAnfOutputPath(publisherId, article)
  const fullPath = join(baseDir, relPath)

  await mkdir(dirname(fullPath), { recursive: true })
  await writeFile(fullPath, JSON.stringify(anfDocument, null, 2), 'utf-8')

  return relPath
}

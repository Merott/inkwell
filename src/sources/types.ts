import type { Article } from '@/schema/types.ts'

export interface ArticleSource {
  id: string
  matches(url: string): boolean
  parse(html: string, url: string): Article
  scrape(url: string): Promise<Article>
}

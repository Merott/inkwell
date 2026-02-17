import type { Article, DiscoveredArticle } from '@/schema/types.ts'

export interface Publisher {
  id: string
  homepageUrl: string
}

export interface ArticleSource {
  id: string
  homepageUrl?: string
  publishers?: Publisher[]
  matches(url: string): boolean
  parseArticle(html: string, url: string): Article
  scrapeArticle(url: string): Promise<Article>
  parseArticles?(html: string, url: string): DiscoveredArticle[]
  scrapeArticles?(url?: string): Promise<DiscoveredArticle[]>
  init?(): Promise<void>
  dispose?(): Promise<void>
}

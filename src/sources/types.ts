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
  parse(html: string, url: string): Article
  scrape(url: string): Promise<Article>
  discover?(html: string, url: string): DiscoveredArticle[]
  discoverArticles?(url?: string): Promise<DiscoveredArticle[]>
}

import type { Article } from "../schema/types.ts";

export interface ArticleSource {
  id: string;
  canHandle(url: string): boolean;
  scrape(url: string): Promise<Article>;
}

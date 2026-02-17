import type { ArticleSource } from './types.ts'

export { ghostSource } from './ghost.ts'
export { itvNewsSource } from './itv-news.ts'

import { ghostSource } from './ghost.ts'
import { itvNewsSource } from './itv-news.ts'

const allSources: ArticleSource[] = [ghostSource, itvNewsSource]

export function getSourceById(id: string) {
  return allSources.find((s) => s.id === id)
}

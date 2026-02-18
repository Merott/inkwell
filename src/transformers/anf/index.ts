import type { Article } from '@/schema/types.ts'
import type { TransformWarning } from '@/transformers/anf/components.ts'
import { assembleDocument } from '@/transformers/anf/document.ts'
import type { AnfArticleDocument } from '@/transformers/anf/types.ts'
import { validateAnfDocument } from '@/transformers/anf/validate.ts'

export interface TransformResult {
  document: AnfArticleDocument
  warnings: TransformWarning[]
}

export function transformToAnf(article: Article): TransformResult {
  const { document, warnings } = assembleDocument(article)
  validateAnfDocument(document) // throws ZodError if invalid
  return { document, warnings }
}

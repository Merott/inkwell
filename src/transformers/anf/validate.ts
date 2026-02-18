import { z } from 'zod/v4'
import type { AnfArticleDocument } from '@/transformers/anf/types.ts'

const anfMetadataSchema = z.object({
  authors: z.array(z.string()).optional(),
  excerpt: z.string().optional(),
  canonicalURL: z.string().url().optional(),
  thumbnailURL: z.string().url().optional(),
  dateCreated: z.string().datetime().optional(),
  datePublished: z.string().datetime().optional(),
  dateModified: z.string().datetime().optional(),
})

const anfComponentSchema = z
  .object({
    role: z.string().min(1),
  })
  .passthrough()

const anfDocumentSchema = z.object({
  version: z.string().min(1),
  identifier: z.string().min(1).max(64),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  language: z.string().min(1),
  layout: z.object({
    columns: z.number().int().positive(),
    width: z.number().int().positive(),
  }),
  components: z.array(anfComponentSchema).min(1),
  componentTextStyles: z.record(z.string(), z.object({}).passthrough()),
  metadata: anfMetadataSchema.optional(),
})

export function validateAnfDocument(data: unknown): AnfArticleDocument {
  return anfDocumentSchema.parse(data) as AnfArticleDocument
}

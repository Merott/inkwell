import type { Article } from '@/schema/types.ts'
import {
  type TransformWarning,
  transformComponent,
} from '@/transformers/anf/components.ts'
import type {
  AnfArticleDocument,
  AnfComponent,
  AnfComponentTextStyle,
} from '@/transformers/anf/types.ts'

export function buildIdentifier(publisherId: string, url: string) {
  const slug = extractSlug(url)
  const raw = `${publisherId}-${slug}`
  return raw.slice(0, 64)
}

function extractSlug(url: string) {
  try {
    const pathname = new URL(url).pathname
    // Remove leading/trailing slashes, take the last segment
    const segments = pathname.split('/').filter(Boolean)
    return segments[segments.length - 1] ?? 'article'
  } catch {
    return 'article'
  }
}

export function buildDefaultTextStyles(): Record<
  string,
  AnfComponentTextStyle
> {
  return {
    'default-body': {
      fontName: 'IowanOldStyle',
      fontSize: 16,
      lineHeight: 24,
      paragraphSpacingBefore: 6,
      paragraphSpacingAfter: 6,
    },
    'default-heading-1': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 32,
      lineHeight: 38,
      paragraphSpacingBefore: 12,
      paragraphSpacingAfter: 8,
    },
    'default-heading-2': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 26,
      lineHeight: 32,
      paragraphSpacingBefore: 10,
      paragraphSpacingAfter: 6,
    },
    'default-heading-3': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 22,
      lineHeight: 28,
      paragraphSpacingBefore: 8,
      paragraphSpacingAfter: 6,
    },
    'default-heading-4': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 20,
      lineHeight: 26,
      paragraphSpacingBefore: 8,
      paragraphSpacingAfter: 4,
    },
    'default-heading-5': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 18,
      lineHeight: 24,
      paragraphSpacingBefore: 6,
      paragraphSpacingAfter: 4,
    },
    'default-heading-6': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 16,
      lineHeight: 22,
      paragraphSpacingBefore: 6,
      paragraphSpacingAfter: 4,
    },
    'default-caption': {
      fontName: 'HelveticaNeue',
      fontSize: 13,
      lineHeight: 18,
      textColor: '#6B7280',
      fontStyle: 'italic',
    },
    'default-pullquote': {
      fontName: 'IowanOldStyle-Italic',
      fontSize: 24,
      lineHeight: 32,
      textAlignment: 'center',
      fontStyle: 'italic',
    },
    'default-quote': {
      fontName: 'IowanOldStyle-Italic',
      fontSize: 16,
      lineHeight: 24,
      fontStyle: 'italic',
    },
    'default-monospace': {
      fontName: 'Menlo-Regular',
      fontSize: 14,
      lineHeight: 20,
    },
  }
}

export interface AssembleResult {
  document: AnfArticleDocument
  warnings: TransformWarning[]
}

export function assembleDocument(article: Article): AssembleResult {
  const warnings: TransformWarning[] = []
  const components: AnfComponent[] = []

  for (const bodyComponent of article.body) {
    const { result, warnings: componentWarnings } =
      transformComponent(bodyComponent)
    warnings.push(...componentWarnings)
    if (result !== null) {
      components.push(result)
    }
  }

  const metadata: AnfArticleDocument['metadata'] = {
    canonicalURL: article.source.canonicalUrl ?? article.source.url,
    dateCreated: article.metadata.publishedAt,
    datePublished: article.metadata.publishedAt,
  }

  if (article.authors.length > 0) {
    metadata.authors = article.authors.map((a) => a.name)
  }

  if (article.metadata.excerpt) {
    metadata.excerpt = article.metadata.excerpt
  }

  if (article.metadata.thumbnail?.url) {
    metadata.thumbnailURL = article.metadata.thumbnail.url
  }

  if (article.metadata.modifiedAt) {
    metadata.dateModified = article.metadata.modifiedAt
  }

  const document: AnfArticleDocument = {
    version: '1.9',
    identifier: buildIdentifier(
      article.source.publisherId,
      article.source.canonicalUrl ?? article.source.url,
    ),
    title: article.metadata.title,
    language: article.metadata.language,
    layout: { columns: 7, width: 1024 },
    components,
    componentTextStyles: buildDefaultTextStyles(),
    metadata,
  }

  if (article.metadata.subtitle) {
    document.subtitle = article.metadata.subtitle
  }

  return { document, warnings }
}

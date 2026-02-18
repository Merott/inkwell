import type { Article } from '@/schema/types.ts'
import {
  type TransformWarning,
  transformComponent,
} from '@/transformers/anf/components.ts'
import type {
  AnfArticleDocument,
  AnfComponent,
  AnfComponentLayout,
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
      fontName: 'Georgia',
      fontSize: 18,
      lineHeight: 28,
      paragraphSpacingBefore: 12,
      paragraphSpacingAfter: 12,
    },
    'default-heading-1': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 34,
      lineHeight: 42,
      paragraphSpacingBefore: 28,
      paragraphSpacingAfter: 12,
    },
    'default-heading-2': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 28,
      lineHeight: 36,
      paragraphSpacingBefore: 24,
      paragraphSpacingAfter: 10,
    },
    'default-heading-3': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 24,
      lineHeight: 32,
      paragraphSpacingBefore: 22,
      paragraphSpacingAfter: 8,
    },
    'default-heading-4': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 21,
      lineHeight: 28,
      paragraphSpacingBefore: 20,
      paragraphSpacingAfter: 8,
    },
    'default-heading-5': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 19,
      lineHeight: 26,
      paragraphSpacingBefore: 18,
      paragraphSpacingAfter: 6,
    },
    'default-heading-6': {
      fontName: 'HelveticaNeue-Bold',
      fontSize: 18,
      lineHeight: 24,
      paragraphSpacingBefore: 18,
      paragraphSpacingAfter: 6,
    },
    'default-caption': {
      fontName: 'HelveticaNeue',
      fontSize: 14,
      lineHeight: 20,
      textColor: '#6B7280',
      fontStyle: 'italic',
    },
    'default-pullquote': {
      fontName: 'Georgia',
      fontSize: 26,
      lineHeight: 36,
      textAlignment: 'center',
      fontStyle: 'italic',
      paragraphSpacingBefore: 20,
      paragraphSpacingAfter: 20,
    },
    'default-quote': {
      fontName: 'Georgia',
      fontSize: 18,
      lineHeight: 28,
      fontStyle: 'italic',
      paragraphSpacingBefore: 16,
      paragraphSpacingAfter: 16,
    },
    'default-monospace': {
      fontName: 'Menlo-Regular',
      fontSize: 15,
      lineHeight: 22,
      paragraphSpacingBefore: 12,
      paragraphSpacingAfter: 12,
    },
  }
}

export function buildDefaultComponentLayouts(): Record<
  string,
  AnfComponentLayout
> {
  return {
    bodyLayout: {
      columnStart: 0,
      columnSpan: 7,
      margin: { top: 15, bottom: 15 },
    },
    headingLayout: {
      columnStart: 0,
      columnSpan: 7,
      margin: { top: 30, bottom: 10 },
    },
    photoLayout: {
      columnStart: 0,
      columnSpan: 7,
      margin: { top: 20, bottom: 20 },
    },
    headerPhotoLayout: {
      columnStart: 0,
      columnSpan: 7,
      margin: { top: 0, bottom: 20 },
    },
    quoteLayout: {
      columnStart: 0,
      columnSpan: 7,
      margin: { top: 24, bottom: 24 },
    },
    pullquoteLayout: {
      columnStart: 1,
      columnSpan: 5,
      margin: { top: 24, bottom: 24 },
    },
    dividerLayout: {
      columnStart: 2,
      columnSpan: 3,
      margin: { top: 24, bottom: 24 },
    },
    videoLayout: {
      columnStart: 0,
      columnSpan: 7,
      margin: { top: 20, bottom: 20 },
    },
    socialEmbedLayout: {
      columnStart: 1,
      columnSpan: 5,
      margin: { top: 20, bottom: 20 },
    },
    tableLayout: {
      columnStart: 0,
      columnSpan: 7,
      margin: { top: 15, bottom: 15 },
    },
    adLayout: {
      columnStart: 0,
      columnSpan: 7,
      margin: { top: 20, bottom: 20 },
    },
  }
}

const ROLE_TO_LAYOUT: Record<string, string> = {
  body: 'bodyLayout',
  heading1: 'headingLayout',
  heading2: 'headingLayout',
  heading3: 'headingLayout',
  heading4: 'headingLayout',
  heading5: 'headingLayout',
  heading6: 'headingLayout',
  photo: 'photoLayout',
  quote: 'quoteLayout',
  pullquote: 'pullquoteLayout',
  divider: 'dividerLayout',
  video: 'videoLayout',
  embedwebvideo: 'videoLayout',
  tweet: 'socialEmbedLayout',
  instagram: 'socialEmbedLayout',
  facebook_post: 'socialEmbedLayout',
  tiktok: 'socialEmbedLayout',
  htmltable: 'tableLayout',
  banner_advertisement: 'adLayout',
}

export interface AssembleResult {
  document: AnfArticleDocument
  warnings: TransformWarning[]
}

export function assembleDocument(article: Article): AssembleResult {
  const warnings: TransformWarning[] = []
  const components: AnfComponent[] = []

  // Add thumbnail as header image if available
  if (article.metadata.thumbnail?.url) {
    const headerImage: AnfComponent = {
      role: 'photo',
      URL: article.metadata.thumbnail.url,
      layout: 'headerPhotoLayout',
      ...(article.metadata.thumbnail.altText
        ? { accessibilityCaption: article.metadata.thumbnail.altText }
        : {}),
    }
    components.push(headerImage)
  }

  for (const bodyComponent of article.body) {
    const { result, warnings: componentWarnings } =
      transformComponent(bodyComponent)
    warnings.push(...componentWarnings)
    if (result !== null) {
      // Assign layout reference based on role
      const layoutName = ROLE_TO_LAYOUT[result.role]
      if (layoutName) {
        ;(result as Record<string, unknown>).layout = layoutName
      }
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
    layout: { columns: 7, width: 1024, margin: 60, gutter: 20 },
    components,
    componentTextStyles: buildDefaultTextStyles(),
    componentLayouts: buildDefaultComponentLayouts(),
    metadata,
  }

  if (article.metadata.subtitle) {
    document.subtitle = article.metadata.subtitle
  }

  return { document, warnings }
}

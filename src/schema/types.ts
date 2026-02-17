export interface Article {
  version: string
  extractedAt: string
  source: Source
  metadata: Metadata
  authors: Author[]
  body: BodyComponent[]
  media?: MediaAsset[]
  relatedContent?: RelatedContent[]
  paywall?: Paywall
  custom?: Record<string, unknown>
}

export interface Source {
  url: string
  canonicalUrl?: string
  publisherId: string
  cmsType: string
  ingestionMethod: 'scrape' | 'feed' | 'api'
  feedUrl?: string
}

export interface Metadata {
  title: string
  subtitle?: string
  excerpt?: string
  language: string
  publishedAt: string
  modifiedAt?: string
  categories?: string[]
  tags?: string[]
  keywords?: string[]
  section?: string
  thumbnail?: ImageRef
  urgency?: 'standard' | 'priority' | 'breaking'
  contentRating?: 'general' | 'mature'
}

export interface ImageRef {
  url: string
  altText?: string
  width?: number
  height?: number
}

export interface Author {
  name: string
  url?: string
  bio?: string
  avatar?: ImageRef
}

// Body components — discriminated union on `type`

export type BodyComponent =
  | Paragraph
  | Heading
  | Blockquote
  | Pullquote
  | List
  | CodeBlock
  | Preformatted
  | ImageComponent
  | VideoComponent
  | EmbedComponent
  | Divider
  | Table
  | RawHtml
  | AdPlacement

export type TextFormat = 'text' | 'html' | 'markdown'

export interface Paragraph {
  type: 'paragraph'
  text: string
  format: TextFormat
}

export interface Heading {
  type: 'heading'
  level: number
  text: string
  format: TextFormat
}

export interface Blockquote {
  type: 'blockquote'
  text: string
  attribution?: string
}

export interface Pullquote {
  type: 'pullquote'
  text: string
  attribution?: string
}

export interface List {
  type: 'list'
  style: 'ordered' | 'unordered'
  items: string[]
}

export interface CodeBlock {
  type: 'codeBlock'
  code: string
  language?: string
}

export interface Preformatted {
  type: 'preformatted'
  text: string
}

export interface ImageComponent {
  type: 'image'
  url: string
  caption?: string
  credit?: string
  altText?: string
  width?: number
  height?: number
  mediaRef?: string
}

export interface VideoComponent {
  type: 'video'
  url: string
  thumbnailUrl?: string
  caption?: string
  credit?: string
  duration?: number
}

export type EmbedPlatform =
  | 'youtube'
  | 'vimeo'
  | 'dailymotion'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'x'
  | 'other'

export interface EmbedComponent {
  type: 'embed'
  platform: EmbedPlatform
  embedUrl: string
  caption?: string
  fallbackText?: string
}

export interface Divider {
  type: 'divider'
}

export interface Table {
  type: 'table'
  rows: string[][]
  headerRows?: number
}

export interface RawHtml {
  type: 'rawHtml'
  html: string
}

export interface AdPlacement {
  type: 'adPlacement'
  slot: string
}

export interface MediaAsset {
  id: string
  type: 'image' | 'video' | 'audio'
  url: string
  mimeType?: string
  width?: number
  height?: number
  altText?: string
  caption?: string
  credit?: string
  fileSize?: number
}

export interface RelatedContent {
  type: 'readNext' | 'series'
  title: string
  url: string
}

export interface Paywall {
  status: 'free' | 'metered' | 'premium'
  previewBoundary?: number
  accessTier?: string
}

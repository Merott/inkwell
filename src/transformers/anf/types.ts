// ANF ArticleDocument — top-level structure
// Reference: https://developer.apple.com/documentation/applenews/json-concepts-and-article-structure

export interface AnfArticleDocument {
  version: string
  identifier: string
  title: string
  subtitle?: string
  language: string
  layout: AnfLayout
  components: AnfComponent[]
  componentTextStyles: Record<string, AnfComponentTextStyle>
  componentLayouts?: Record<string, AnfComponentLayout>
  metadata?: AnfMetadata
}

export interface AnfComponentLayout {
  columnStart?: number
  columnSpan?: number
  margin?: { top?: number; bottom?: number }
}

export interface AnfLayout {
  columns: number
  width: number
  margin: number
  gutter: number
}

export interface AnfMetadata {
  authors?: string[]
  excerpt?: string
  canonicalURL?: string
  thumbnailURL?: string
  dateCreated?: string
  datePublished?: string
  dateModified?: string
}

// Component text styles
export interface AnfComponentTextStyle {
  fontName?: string
  fontSize?: number
  lineHeight?: number
  textAlignment?: 'left' | 'center' | 'right' | 'justified' | 'none'
  textColor?: string
  fontWeight?: string
  fontStyle?: string
  paragraphSpacingBefore?: number
  paragraphSpacingAfter?: number
}

// Components — discriminated union on `role`
export type AnfComponent =
  | AnfBodyComponent
  | AnfHeadingComponent
  | AnfQuoteComponent
  | AnfPullquoteComponent
  | AnfPhotoComponent
  | AnfCaptionComponent
  | AnfVideoComponent
  | AnfEmbedWebVideoComponent
  | AnfTweetComponent
  | AnfInstagramComponent
  | AnfFacebookPostComponent
  | AnfTikTokComponent
  | AnfDividerComponent
  | AnfHtmlTableComponent
  | AnfBannerAdvertisementComponent

export type AnfTextFormat = 'html' | 'markdown' | 'none'

export interface AnfBodyComponent {
  role: 'body'
  text: string
  format?: AnfTextFormat
  textStyle?: string
  layout?: string
}

export type AnfHeadingRole =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'

export interface AnfHeadingComponent {
  role: AnfHeadingRole
  text: string
  format?: AnfTextFormat
  textStyle?: string
  layout?: string
}

export interface AnfQuoteComponent {
  role: 'quote'
  text: string
  format?: AnfTextFormat
  textStyle?: string
  layout?: string
}

export interface AnfPullquoteComponent {
  role: 'pullquote'
  text: string
  format?: AnfTextFormat
  textStyle?: string
  layout?: string
}

export interface AnfPhotoComponent {
  role: 'photo'
  URL: string
  caption?: string | AnfCaptionDescriptor
  accessibilityCaption?: string
  layout?: string
}

export interface AnfCaptionDescriptor {
  text: string
  format?: AnfTextFormat
  textStyle?: string
}

export interface AnfCaptionComponent {
  role: 'caption'
  text: string
  format?: AnfTextFormat
  textStyle?: string
  layout?: string
}

export interface AnfVideoComponent {
  role: 'video'
  URL: string
  stillURL?: string
  caption?: string
  accessibilityCaption?: string
  layout?: string
}

export interface AnfEmbedWebVideoComponent {
  role: 'embedwebvideo'
  URL: string
  caption?: string
  accessibilityCaption?: string
  layout?: string
}

export interface AnfTweetComponent {
  role: 'tweet'
  URL: string
  layout?: string
}

export interface AnfInstagramComponent {
  role: 'instagram'
  URL: string
  layout?: string
}

export interface AnfFacebookPostComponent {
  role: 'facebook_post'
  URL: string
  layout?: string
}

export interface AnfTikTokComponent {
  role: 'tiktok'
  URL: string
  layout?: string
}

export interface AnfDividerComponent {
  role: 'divider'
  layout?: string
}

export interface AnfHtmlTableComponent {
  role: 'htmltable'
  html: string
  layout?: string
}

export interface AnfBannerAdvertisementComponent {
  role: 'banner_advertisement'
  bannerType?: 'any' | 'standard' | 'double_height' | 'large'
  layout?: string
}

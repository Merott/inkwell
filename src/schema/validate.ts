import { z } from "zod/v4";
import type { Article } from "./types.ts";

const imageRefSchema = z.object({
  url: z.string().url(),
  altText: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const sourceSchema = z.object({
  url: z.string().url(),
  canonicalUrl: z.string().url().optional(),
  publisherId: z.string(),
  cmsType: z.string(),
  ingestionMethod: z.enum(["scrape", "feed", "api"]),
  feedUrl: z.string().url().optional(),
});

const metadataSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  excerpt: z.string().optional(),
  language: z.string().min(1),
  publishedAt: z.string().datetime(),
  modifiedAt: z.string().datetime().optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  section: z.string().optional(),
  thumbnail: imageRefSchema.optional(),
  urgency: z.enum(["standard", "priority", "breaking"]).optional(),
  contentRating: z.enum(["general", "mature"]).optional(),
});

const authorSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().optional(),
  bio: z.string().optional(),
  avatar: imageRefSchema.optional(),
});

const textFormat = z.enum(["text", "html", "markdown"]);

const paragraphSchema = z.object({
  type: z.literal("paragraph"),
  text: z.string(),
  format: textFormat,
});

const headingSchema = z.object({
  type: z.literal("heading"),
  level: z.number().int().min(1).max(6),
  text: z.string(),
  format: textFormat,
});

const blockquoteSchema = z.object({
  type: z.literal("blockquote"),
  text: z.string(),
  attribution: z.string().optional(),
});

const pullquoteSchema = z.object({
  type: z.literal("pullquote"),
  text: z.string(),
  attribution: z.string().optional(),
});

const listSchema = z.object({
  type: z.literal("list"),
  style: z.enum(["ordered", "unordered"]),
  items: z.array(z.string()).min(1),
});

const codeBlockSchema = z.object({
  type: z.literal("codeBlock"),
  code: z.string(),
  language: z.string().optional(),
});

const preformattedSchema = z.object({
  type: z.literal("preformatted"),
  text: z.string(),
});

const imageComponentSchema = z.object({
  type: z.literal("image"),
  url: z.string().url(),
  caption: z.string().optional(),
  credit: z.string().optional(),
  altText: z.string().optional(),
  mediaRef: z.string().optional(),
});

const videoComponentSchema = z.object({
  type: z.literal("video"),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  caption: z.string().optional(),
  credit: z.string().optional(),
  duration: z.number().positive().optional(),
});

const embedComponentSchema = z.object({
  type: z.literal("embed"),
  platform: z.enum([
    "youtube",
    "vimeo",
    "dailymotion",
    "facebook",
    "instagram",
    "tiktok",
    "x",
    "other",
  ]),
  embedUrl: z.string().url(),
  caption: z.string().optional(),
  fallbackText: z.string().optional(),
});

const dividerSchema = z.object({ type: z.literal("divider") });

const tableSchema = z.object({
  type: z.literal("table"),
  rows: z.array(z.array(z.string())).min(1),
  headerRows: z.number().int().nonnegative().optional(),
});

const rawHtmlSchema = z.object({
  type: z.literal("rawHtml"),
  html: z.string(),
});

const adPlacementSchema = z.object({
  type: z.literal("adPlacement"),
  slot: z.string(),
});

const bodyComponentSchema = z.discriminatedUnion("type", [
  paragraphSchema,
  headingSchema,
  blockquoteSchema,
  pullquoteSchema,
  listSchema,
  codeBlockSchema,
  preformattedSchema,
  imageComponentSchema,
  videoComponentSchema,
  embedComponentSchema,
  dividerSchema,
  tableSchema,
  rawHtmlSchema,
  adPlacementSchema,
]);

const mediaAssetSchema = z.object({
  id: z.string(),
  type: z.enum(["image", "video", "audio"]),
  url: z.string().url(),
  mimeType: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  altText: z.string().optional(),
  caption: z.string().optional(),
  credit: z.string().optional(),
  fileSize: z.number().int().positive().optional(),
});

const relatedContentSchema = z.object({
  type: z.enum(["readNext", "series"]),
  title: z.string(),
  url: z.string().url(),
});

const paywallSchema = z.object({
  status: z.enum(["free", "metered", "premium"]),
  previewBoundary: z.number().int().nonnegative().optional(),
  accessTier: z.string().optional(),
});

const articleSchema = z.object({
  version: z.string(),
  extractedAt: z.string().datetime(),
  source: sourceSchema,
  metadata: metadataSchema,
  authors: z.array(authorSchema),
  body: z.array(bodyComponentSchema).min(1),
  media: z.array(mediaAssetSchema).optional(),
  relatedContent: z.array(relatedContentSchema).optional(),
  paywall: paywallSchema.optional(),
  custom: z.record(z.string(), z.unknown()).optional(),
});

export function validateArticle(data: unknown): Article {
  return articleSchema.parse(data) as Article;
}

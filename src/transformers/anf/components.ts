import type { BodyComponent } from '@/schema/types.ts'
import { sanitizeHtml } from '@/transformers/anf/html.ts'
import type { AnfComponent, AnfHeadingRole } from '@/transformers/anf/types.ts'

export interface TransformWarning {
  type:
    | 'dropped_component'
    | 'unsupported_embed'
    | 'html_sanitized'
    | 'missing_field'
  message: string
  component?: string
}

export interface ComponentResult {
  result: AnfComponent | null
  warnings: TransformWarning[]
}

export function transformComponent(component: BodyComponent): ComponentResult {
  switch (component.type) {
    case 'paragraph':
      return transformParagraph(component)
    case 'heading':
      return transformHeading(component)
    case 'blockquote':
      return transformBlockquote(component)
    case 'pullquote':
      return transformPullquote(component)
    case 'list':
      return transformList(component)
    case 'codeBlock':
      return transformCodeBlock(component)
    case 'preformatted':
      return transformPreformatted(component)
    case 'image':
      return transformImage(component)
    case 'video':
      return transformVideo(component)
    case 'embed':
      return transformEmbed(component)
    case 'divider':
      return ok({ role: 'divider' })
    case 'table':
      return transformTable(component)
    case 'rawHtml':
      return {
        result: null,
        warnings: [
          {
            type: 'dropped_component',
            message: 'rawHtml component dropped — not supported in ANF',
            component: 'rawHtml',
          },
        ],
      }
    case 'adPlacement':
      return ok({ role: 'banner_advertisement', bannerType: 'any' })
  }
}

function ok(result: AnfComponent): ComponentResult {
  return { result, warnings: [] }
}

function transformParagraph(
  component: Extract<BodyComponent, { type: 'paragraph' }>,
): ComponentResult {
  const warnings: TransformWarning[] = []
  const isHtml = component.format === 'html'

  let text = component.text
  if (isHtml) {
    const sanitized = sanitizeHtml(text)
    if (sanitized !== text) {
      warnings.push({
        type: 'html_sanitized',
        message: 'HTML was sanitized for paragraph component',
        component: 'paragraph',
      })
      text = sanitized
    }
  }

  const result: AnfComponent = {
    role: 'body',
    text,
    ...(isHtml && { format: 'html' as const }),
    textStyle: 'default-body',
  }

  return { result, warnings }
}

function transformHeading(
  component: Extract<BodyComponent, { type: 'heading' }>,
): ComponentResult {
  const level = Math.max(1, Math.min(6, component.level))
  const role = `heading${level}` as AnfHeadingRole
  const isHtml = component.format === 'html'
  const warnings: TransformWarning[] = []

  let text = component.text
  if (isHtml) {
    const sanitized = sanitizeHtml(text)
    if (sanitized !== text) {
      warnings.push({
        type: 'html_sanitized',
        message: 'HTML was sanitized for heading component',
        component: 'heading',
      })
      text = sanitized
    }
  }

  const result: AnfComponent = {
    role,
    text,
    ...(isHtml && { format: 'html' as const }),
    textStyle: `default-heading-${level}`,
  }

  return { result, warnings }
}

function appendAttribution(text: string, attribution?: string) {
  if (attribution) {
    return `${text}\n\u2014 ${attribution}`
  }
  return text
}

function transformBlockquote(
  component: Extract<BodyComponent, { type: 'blockquote' }>,
): ComponentResult {
  return ok({
    role: 'quote',
    text: appendAttribution(component.text, component.attribution),
    textStyle: 'default-quote',
  })
}

function transformPullquote(
  component: Extract<BodyComponent, { type: 'pullquote' }>,
): ComponentResult {
  return ok({
    role: 'pullquote',
    text: appendAttribution(component.text, component.attribution),
    textStyle: 'default-pullquote',
  })
}

function transformList(
  component: Extract<BodyComponent, { type: 'list' }>,
): ComponentResult {
  const tag = component.style === 'ordered' ? 'ol' : 'ul'
  const items = component.items.map((item) => `<li>${item}</li>`).join('')
  return ok({
    role: 'body',
    text: `<${tag}>${items}</${tag}>`,
    format: 'html',
    textStyle: 'default-body',
  })
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function transformCodeBlock(
  component: Extract<BodyComponent, { type: 'codeBlock' }>,
): ComponentResult {
  return ok({
    role: 'body',
    text: `<pre>${escapeHtml(component.code)}</pre>`,
    format: 'html',
    textStyle: 'default-monospace',
  })
}

function transformPreformatted(
  component: Extract<BodyComponent, { type: 'preformatted' }>,
): ComponentResult {
  return ok({
    role: 'body',
    text: `<pre>${escapeHtml(component.text)}</pre>`,
    format: 'html',
    textStyle: 'default-monospace',
  })
}

function transformImage(
  component: Extract<BodyComponent, { type: 'image' }>,
): ComponentResult {
  const result: Record<string, unknown> = {
    role: 'photo',
    URL: component.url,
  }

  // Build caption
  if (component.caption && component.credit) {
    result.caption = {
      text: `${component.caption} \u2014 ${component.credit}`,
      textStyle: 'default-caption',
    }
  } else if (component.caption) {
    result.caption = {
      text: component.caption,
      textStyle: 'default-caption',
    }
  } else if (component.credit) {
    result.caption = {
      text: component.credit,
      textStyle: 'default-caption',
    }
  }

  if (component.altText) {
    result.accessibilityCaption = component.altText
  }

  return ok(result as AnfComponent)
}

function transformVideo(
  component: Extract<BodyComponent, { type: 'video' }>,
): ComponentResult {
  const result: Record<string, unknown> = {
    role: 'video',
    URL: component.url,
  }

  if (component.thumbnailUrl) {
    result.stillURL = component.thumbnailUrl
  }

  if (component.caption) {
    result.caption = component.caption
  }

  return ok(result as AnfComponent)
}

const VIDEO_EMBED_PLATFORMS = new Set(['youtube', 'vimeo', 'dailymotion'])

const SOCIAL_EMBED_ROLES: Record<string, string> = {
  x: 'tweet',
  instagram: 'instagram',
  facebook: 'facebook_post',
  tiktok: 'tiktok',
}

function transformEmbed(
  component: Extract<BodyComponent, { type: 'embed' }>,
): ComponentResult {
  // Video embeds
  if (VIDEO_EMBED_PLATFORMS.has(component.platform)) {
    const result: Record<string, unknown> = {
      role: 'embedwebvideo',
      URL: component.embedUrl,
    }
    if (component.caption) {
      result.caption = component.caption
    }
    return ok(result as AnfComponent)
  }

  // Social embeds
  const socialRole = SOCIAL_EMBED_ROLES[component.platform]
  if (socialRole) {
    return ok({
      role: socialRole,
      URL: component.embedUrl,
    } as AnfComponent)
  }

  // Unsupported/other embeds — fallback to body
  const warnings: TransformWarning[] = [
    {
      type: 'unsupported_embed',
      message: `Unsupported embed platform "${component.platform}" — rendered as body text fallback`,
      component: 'embed',
    },
  ]

  if (component.fallbackText) {
    return {
      result: {
        role: 'body',
        text: component.fallbackText,
        textStyle: 'default-body',
      },
      warnings,
    }
  }

  return {
    result: {
      role: 'body',
      text: `<a href="${component.embedUrl}">${component.embedUrl}</a>`,
      format: 'html',
      textStyle: 'default-body',
    },
    warnings,
  }
}

function transformTable(
  component: Extract<BodyComponent, { type: 'table' }>,
): ComponentResult {
  const headerCount = component.headerRows ?? 0
  const headerRows = component.rows.slice(0, headerCount)
  const bodyRows = component.rows.slice(headerCount)

  let html = '<table>'

  if (headerRows.length > 0) {
    html += '<thead>'
    for (const row of headerRows) {
      html += '<tr>'
      for (const cell of row) {
        html += `<th>${cell}</th>`
      }
      html += '</tr>'
    }
    html += '</thead>'
  }

  html += '<tbody>'
  for (const row of bodyRows) {
    html += '<tr>'
    for (const cell of row) {
      html += `<td>${cell}</td>`
    }
    html += '</tr>'
  }
  html += '</tbody></table>'

  return ok({ role: 'htmltable', html })
}

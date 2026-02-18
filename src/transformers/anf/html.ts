import * as cheerio from 'cheerio'

const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'strong',
  'em',
  'i',
  'code',
  'del',
  's',
  'sub',
  'sup',
  'br',
  'ul',
  'ol',
  'li',
  'p',
  'pre',
  'blockquote',
])

const TAG_SUBSTITUTIONS: Record<string, string> = {
  mark: 'b',
  cite: 'em',
  u: 'em',
  ins: 'em',
}

export function sanitizeHtml(html: string): string {
  if (!html) return ''

  const $ = cheerio.load(html, { xml: false }, false)

  // Process bottom-up so children are handled before parents
  const elements = $('*').toArray().reverse()

  for (const el of elements) {
    if (el.type !== 'tag') continue

    const tagName = el.tagName.toLowerCase()
    const $el = $(el)

    // Check substitution first
    const substitute = TAG_SUBSTITUTIONS[tagName]
    if (substitute) {
      const inner = $el.html() ?? ''
      $el.replaceWith(`<${substitute}>${inner}</${substitute}>`)
      continue
    }

    // Allowed tag — strip disallowed attributes
    if (ALLOWED_TAGS.has(tagName)) {
      const attribs = el.attribs
      for (const attr of Object.keys(attribs)) {
        if (tagName === 'a' && attr === 'href') continue
        $el.removeAttr(attr)
      }
      continue
    }

    // Disallowed tag — unwrap (keep children, remove tag)
    $el.replaceWith($el.html() ?? '')
  }

  return $.html() ?? ''
}

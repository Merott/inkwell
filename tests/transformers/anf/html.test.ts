import { describe, expect, it } from 'bun:test'
import { sanitizeHtml } from '@/transformers/anf/html.ts'

describe('sanitizeHtml', () => {
  describe('allowed tags pass through', () => {
    it('keeps basic formatting tags', () => {
      expect(sanitizeHtml('<em>italic</em>')).toBe('<em>italic</em>')
      expect(sanitizeHtml('<strong>bold</strong>')).toBe(
        '<strong>bold</strong>',
      )
      expect(sanitizeHtml('<b>bold</b>')).toBe('<b>bold</b>')
      expect(sanitizeHtml('<i>italic</i>')).toBe('<i>italic</i>')
    })

    it('keeps links with href', () => {
      expect(sanitizeHtml('<a href="https://example.com">link</a>')).toBe(
        '<a href="https://example.com">link</a>',
      )
    })

    it('keeps code, del, sub, sup, br', () => {
      expect(sanitizeHtml('<code>x</code>')).toBe('<code>x</code>')
      expect(sanitizeHtml('<del>removed</del>')).toBe('<del>removed</del>')
      expect(sanitizeHtml('<sub>2</sub>')).toBe('<sub>2</sub>')
      expect(sanitizeHtml('<sup>2</sup>')).toBe('<sup>2</sup>')
      expect(sanitizeHtml('line<br>break')).toBe('line<br>break')
    })

    it('keeps list tags', () => {
      expect(sanitizeHtml('<ul><li>item</li></ul>')).toBe(
        '<ul><li>item</li></ul>',
      )
      expect(sanitizeHtml('<ol><li>item</li></ol>')).toBe(
        '<ol><li>item</li></ol>',
      )
    })

    it('keeps p, pre, blockquote', () => {
      expect(sanitizeHtml('<p>text</p>')).toBe('<p>text</p>')
      expect(sanitizeHtml('<pre>code</pre>')).toBe('<pre>code</pre>')
      expect(sanitizeHtml('<blockquote>quote</blockquote>')).toBe(
        '<blockquote>quote</blockquote>',
      )
    })

    it('keeps s tag', () => {
      expect(sanitizeHtml('<s>struck</s>')).toBe('<s>struck</s>')
    })
  })

  describe('disallowed tags unwrapped', () => {
    it('unwraps span', () => {
      expect(sanitizeHtml('<span class="x">text</span>')).toBe('text')
    })

    it('unwraps div', () => {
      expect(sanitizeHtml('<div>content</div>')).toBe('content')
    })

    it('unwraps font', () => {
      expect(sanitizeHtml('<font color="red">text</font>')).toBe('text')
    })

    it('unwraps nested disallowed tags', () => {
      expect(sanitizeHtml('<div><span>inner</span></div>')).toBe('inner')
    })
  })

  describe('tag substitution', () => {
    it('substitutes mark with b', () => {
      expect(sanitizeHtml('<mark>highlighted</mark>')).toBe(
        '<b>highlighted</b>',
      )
    })

    it('substitutes cite with em', () => {
      expect(sanitizeHtml('<cite>reference</cite>')).toBe('<em>reference</em>')
    })

    it('substitutes u with em', () => {
      expect(sanitizeHtml('<u>underlined</u>')).toBe('<em>underlined</em>')
    })

    it('substitutes ins with em', () => {
      expect(sanitizeHtml('<ins>inserted</ins>')).toBe('<em>inserted</em>')
    })
  })

  describe('attribute filtering', () => {
    it('strips non-href attributes from links', () => {
      expect(
        sanitizeHtml(
          '<a href="https://x.com" class="link" target="_blank">text</a>',
        ),
      ).toBe('<a href="https://x.com">text</a>')
    })

    it('strips all attributes from non-link tags', () => {
      expect(sanitizeHtml('<em class="bold" id="x">text</em>')).toBe(
        '<em>text</em>',
      )
    })
  })

  describe('nested structures', () => {
    it('preserves nested allowed tags', () => {
      expect(sanitizeHtml('<strong><em>bold italic</em></strong>')).toBe(
        '<strong><em>bold italic</em></strong>',
      )
    })

    it('unwraps disallowed within allowed', () => {
      expect(sanitizeHtml('<strong><span>text</span></strong>')).toBe(
        '<strong>text</strong>',
      )
    })
  })

  describe('plain text passthrough', () => {
    it('returns plain text unchanged', () => {
      expect(sanitizeHtml('just plain text')).toBe('just plain text')
    })

    it('returns empty string for empty input', () => {
      expect(sanitizeHtml('')).toBe('')
    })
  })
})

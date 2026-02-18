import { describe, expect, it } from 'bun:test'
import type {
  AdPlacement,
  Blockquote,
  CodeBlock,
  Divider,
  EmbedComponent,
  Heading,
  ImageComponent,
  List,
  Paragraph,
  Preformatted,
  Pullquote,
  RawHtml,
  Table,
  VideoComponent,
} from '@/schema/types.ts'
import { transformComponent } from '@/transformers/anf/components.ts'

describe('transformComponent', () => {
  describe('paragraph', () => {
    it('maps to body role with html format', () => {
      const paragraph: Paragraph = {
        type: 'paragraph',
        text: '<p>Hello <em>world</em></p>',
        format: 'html',
      }
      const { result, warnings } = transformComponent(paragraph)
      expect(result).toEqual({
        role: 'body',
        text: '<p>Hello <em>world</em></p>',
        format: 'html',
        textStyle: 'default-body',
      })
      expect(warnings).toEqual([])
    })

    it('sanitizes html and emits warning when modified', () => {
      const paragraph: Paragraph = {
        type: 'paragraph',
        text: '<p>Hello <span>world</span></p>',
        format: 'html',
      }
      const { result, warnings } = transformComponent(paragraph)
      expect(result).toEqual({
        role: 'body',
        text: '<p>Hello world</p>',
        format: 'html',
        textStyle: 'default-body',
      })
      expect(warnings).toEqual([
        {
          type: 'html_sanitized',
          message: 'HTML was sanitized for paragraph component',
          component: 'paragraph',
        },
      ])
    })

    it('does not set format for plain text', () => {
      const paragraph: Paragraph = {
        type: 'paragraph',
        text: 'Just plain text',
        format: 'text',
      }
      const { result } = transformComponent(paragraph)
      expect(result).toEqual({
        role: 'body',
        text: 'Just plain text',
        textStyle: 'default-body',
      })
    })

    it('does not emit warning when html is unchanged after sanitization', () => {
      const paragraph: Paragraph = {
        type: 'paragraph',
        text: '<p>Clean <strong>html</strong></p>',
        format: 'html',
      }
      const { warnings } = transformComponent(paragraph)
      expect(warnings).toEqual([])
    })
  })

  describe('heading', () => {
    it('maps level 1 to heading1 role', () => {
      const heading: Heading = {
        type: 'heading',
        level: 1,
        text: 'Title',
        format: 'text',
      }
      const { result } = transformComponent(heading)
      expect(result).toEqual({
        role: 'heading1',
        text: 'Title',
        textStyle: 'default-heading-1',
      })
    })

    it('maps level 3 to heading3 role', () => {
      const heading: Heading = {
        type: 'heading',
        level: 3,
        text: 'Subtitle',
        format: 'text',
      }
      const { result } = transformComponent(heading)
      expect(result).toEqual({
        role: 'heading3',
        text: 'Subtitle',
        textStyle: 'default-heading-3',
      })
    })

    it('sets format html when input format is html', () => {
      const heading: Heading = {
        type: 'heading',
        level: 2,
        text: '<strong>Bold</strong> heading',
        format: 'html',
      }
      const { result } = transformComponent(heading)
      expect(result).toEqual({
        role: 'heading2',
        text: '<strong>Bold</strong> heading',
        format: 'html',
        textStyle: 'default-heading-2',
      })
    })

    it('clamps level to valid range', () => {
      const heading: Heading = {
        type: 'heading',
        level: 9,
        text: 'Deep heading',
        format: 'text',
      }
      const { result } = transformComponent(heading)
      expect(result).toEqual({
        role: 'heading6',
        text: 'Deep heading',
        textStyle: 'default-heading-6',
      })
    })
  })

  describe('blockquote', () => {
    it('maps to quote role', () => {
      const blockquote: Blockquote = {
        type: 'blockquote',
        text: 'To be or not to be',
      }
      const { result } = transformComponent(blockquote)
      expect(result).toEqual({
        role: 'quote',
        text: 'To be or not to be',
        textStyle: 'default-quote',
      })
    })

    it('appends attribution with em dash', () => {
      const blockquote: Blockquote = {
        type: 'blockquote',
        text: 'To be or not to be',
        attribution: 'Shakespeare',
      }
      const { result } = transformComponent(blockquote)
      expect(result).toEqual({
        role: 'quote',
        text: 'To be or not to be\n\u2014 Shakespeare',
        textStyle: 'default-quote',
      })
    })
  })

  describe('pullquote', () => {
    it('maps to pullquote role', () => {
      const pullquote: Pullquote = {
        type: 'pullquote',
        text: 'A great insight',
      }
      const { result } = transformComponent(pullquote)
      expect(result).toEqual({
        role: 'pullquote',
        text: 'A great insight',
        textStyle: 'default-pullquote',
      })
    })

    it('appends attribution with em dash', () => {
      const pullquote: Pullquote = {
        type: 'pullquote',
        text: 'A great insight',
        attribution: 'Author',
      }
      const { result } = transformComponent(pullquote)
      expect(result).toEqual({
        role: 'pullquote',
        text: 'A great insight\n\u2014 Author',
        textStyle: 'default-pullquote',
      })
    })
  })

  describe('list', () => {
    it('wraps unordered list items in ul/li', () => {
      const list: List = {
        type: 'list',
        style: 'unordered',
        items: ['First', 'Second'],
      }
      const { result } = transformComponent(list)
      expect(result).toEqual({
        role: 'body',
        text: '<ul><li>First</li><li>Second</li></ul>',
        format: 'html',
        textStyle: 'default-body',
      })
    })

    it('wraps ordered list items in ol/li', () => {
      const list: List = {
        type: 'list',
        style: 'ordered',
        items: ['Alpha', 'Beta', 'Gamma'],
      }
      const { result } = transformComponent(list)
      expect(result).toEqual({
        role: 'body',
        text: '<ol><li>Alpha</li><li>Beta</li><li>Gamma</li></ol>',
        format: 'html',
        textStyle: 'default-body',
      })
    })
  })

  describe('codeBlock', () => {
    it('wraps code in pre tag', () => {
      const codeBlock: CodeBlock = {
        type: 'codeBlock',
        code: 'const x = 1',
        language: 'typescript',
      }
      const { result } = transformComponent(codeBlock)
      expect(result).toEqual({
        role: 'body',
        text: '<pre>const x = 1</pre>',
        format: 'html',
        textStyle: 'default-monospace',
      })
    })

    it('escapes html entities in code', () => {
      const codeBlock: CodeBlock = {
        type: 'codeBlock',
        code: '<div class="test">hello</div>',
      }
      const { result } = transformComponent(codeBlock)
      expect(result).toEqual({
        role: 'body',
        text: '<pre>&lt;div class=&quot;test&quot;&gt;hello&lt;/div&gt;</pre>',
        format: 'html',
        textStyle: 'default-monospace',
      })
    })
  })

  describe('preformatted', () => {
    it('wraps text in pre tag', () => {
      const preformatted: Preformatted = {
        type: 'preformatted',
        text: 'Preformatted text',
      }
      const { result } = transformComponent(preformatted)
      expect(result).toEqual({
        role: 'body',
        text: '<pre>Preformatted text</pre>',
        format: 'html',
        textStyle: 'default-monospace',
      })
    })

    it('escapes HTML entities in preformatted text', () => {
      const input: Preformatted = {
        type: 'preformatted',
        text: 'x < y && z > 0',
      }
      const { result } = transformComponent(input)
      expect(result).toMatchObject({
        text: '<pre>x &lt; y &amp;&amp; z &gt; 0</pre>',
      })
    })
  })

  describe('image', () => {
    it('maps to photo with uppercase URL', () => {
      const image: ImageComponent = {
        type: 'image',
        url: 'https://example.com/photo.jpg',
      }
      const { result } = transformComponent(image)
      expect(result).toEqual({
        role: 'photo',
        URL: 'https://example.com/photo.jpg',
      })
    })

    it('maps altText to accessibilityCaption', () => {
      const image: ImageComponent = {
        type: 'image',
        url: 'https://example.com/photo.jpg',
        altText: 'A scenic view',
      }
      const { result } = transformComponent(image)
      expect(result).toEqual({
        role: 'photo',
        URL: 'https://example.com/photo.jpg',
        accessibilityCaption: 'A scenic view',
      })
    })

    it('creates CaptionDescriptor for caption only', () => {
      const image: ImageComponent = {
        type: 'image',
        url: 'https://example.com/photo.jpg',
        caption: 'A beautiful sunset',
      }
      const { result } = transformComponent(image)
      expect(result).toEqual({
        role: 'photo',
        URL: 'https://example.com/photo.jpg',
        caption: {
          text: 'A beautiful sunset',
          textStyle: 'default-caption',
        },
      })
    })

    it('joins caption and credit with em dash', () => {
      const image: ImageComponent = {
        type: 'image',
        url: 'https://example.com/photo.jpg',
        caption: 'A beautiful sunset',
        credit: 'Photo by John',
      }
      const { result } = transformComponent(image)
      expect(result).toEqual({
        role: 'photo',
        URL: 'https://example.com/photo.jpg',
        caption: {
          text: 'A beautiful sunset \u2014 Photo by John',
          textStyle: 'default-caption',
        },
      })
    })

    it('uses credit alone as caption', () => {
      const image: ImageComponent = {
        type: 'image',
        url: 'https://example.com/photo.jpg',
        credit: 'Photo by Jane',
      }
      const { result } = transformComponent(image)
      expect(result).toEqual({
        role: 'photo',
        URL: 'https://example.com/photo.jpg',
        caption: {
          text: 'Photo by Jane',
          textStyle: 'default-caption',
        },
      })
    })
  })

  describe('video', () => {
    it('maps to video with uppercase URL', () => {
      const video: VideoComponent = {
        type: 'video',
        url: 'https://example.com/video.mp4',
      }
      const { result } = transformComponent(video)
      expect(result).toEqual({
        role: 'video',
        URL: 'https://example.com/video.mp4',
      })
    })

    it('maps thumbnailUrl to stillURL', () => {
      const video: VideoComponent = {
        type: 'video',
        url: 'https://example.com/video.mp4',
        thumbnailUrl: 'https://example.com/thumb.jpg',
      }
      const { result } = transformComponent(video)
      expect(result).toEqual({
        role: 'video',
        URL: 'https://example.com/video.mp4',
        stillURL: 'https://example.com/thumb.jpg',
      })
    })

    it('passes through caption', () => {
      const video: VideoComponent = {
        type: 'video',
        url: 'https://example.com/video.mp4',
        caption: 'Video caption',
      }
      const { result } = transformComponent(video)
      expect(result).toEqual({
        role: 'video',
        URL: 'https://example.com/video.mp4',
        caption: 'Video caption',
      })
    })
  })

  describe('embed', () => {
    it('maps youtube to embedwebvideo', () => {
      const embed: EmbedComponent = {
        type: 'embed',
        platform: 'youtube',
        embedUrl: 'https://youtube.com/watch?v=abc',
      }
      const { result } = transformComponent(embed)
      expect(result).toEqual({
        role: 'embedwebvideo',
        URL: 'https://youtube.com/watch?v=abc',
      })
    })

    it('maps vimeo to embedwebvideo', () => {
      const embed: EmbedComponent = {
        type: 'embed',
        platform: 'vimeo',
        embedUrl: 'https://vimeo.com/12345',
      }
      const { result } = transformComponent(embed)
      expect(result).toEqual({
        role: 'embedwebvideo',
        URL: 'https://vimeo.com/12345',
      })
    })

    it('maps dailymotion to embedwebvideo', () => {
      const embed: EmbedComponent = {
        type: 'embed',
        platform: 'dailymotion',
        embedUrl: 'https://dailymotion.com/video/xyz',
      }
      const { result } = transformComponent(embed)
      expect(result).toEqual({
        role: 'embedwebvideo',
        URL: 'https://dailymotion.com/video/xyz',
      })
    })

    it('passes caption through for embedwebvideo', () => {
      const embed: EmbedComponent = {
        type: 'embed',
        platform: 'youtube',
        embedUrl: 'https://youtube.com/watch?v=abc',
        caption: 'Watch this',
      }
      const { result } = transformComponent(embed)
      expect(result).toEqual({
        role: 'embedwebvideo',
        URL: 'https://youtube.com/watch?v=abc',
        caption: 'Watch this',
      })
    })

    it('maps x to tweet', () => {
      const embed: EmbedComponent = {
        type: 'embed',
        platform: 'x',
        embedUrl: 'https://x.com/user/status/123',
      }
      const { result } = transformComponent(embed)
      expect(result).toEqual({
        role: 'tweet',
        URL: 'https://x.com/user/status/123',
      })
    })

    it('maps instagram to instagram', () => {
      const embed: EmbedComponent = {
        type: 'embed',
        platform: 'instagram',
        embedUrl: 'https://instagram.com/p/abc',
      }
      const { result } = transformComponent(embed)
      expect(result).toEqual({
        role: 'instagram',
        URL: 'https://instagram.com/p/abc',
      })
    })

    it('maps facebook to facebook_post', () => {
      const embed: EmbedComponent = {
        type: 'embed',
        platform: 'facebook',
        embedUrl: 'https://facebook.com/post/123',
      }
      const { result } = transformComponent(embed)
      expect(result).toEqual({
        role: 'facebook_post',
        URL: 'https://facebook.com/post/123',
      })
    })

    it('maps tiktok to tiktok', () => {
      const embed: EmbedComponent = {
        type: 'embed',
        platform: 'tiktok',
        embedUrl: 'https://tiktok.com/@user/video/123',
      }
      const { result } = transformComponent(embed)
      expect(result).toEqual({
        role: 'tiktok',
        URL: 'https://tiktok.com/@user/video/123',
      })
    })

    it('maps other embed with fallbackText to body with warning', () => {
      const embed: EmbedComponent = {
        type: 'embed',
        platform: 'other',
        embedUrl: 'https://example.com/widget',
        fallbackText: 'See the widget',
      }
      const { result, warnings } = transformComponent(embed)
      expect(result).toEqual({
        role: 'body',
        text: 'See the widget',
        textStyle: 'default-body',
      })
      expect(warnings).toEqual([
        {
          type: 'unsupported_embed',
          message:
            'Unsupported embed platform "other" — rendered as body text fallback',
          component: 'embed',
        },
      ])
    })

    it('maps other embed without fallbackText to linked body', () => {
      const embed: EmbedComponent = {
        type: 'embed',
        platform: 'other',
        embedUrl: 'https://example.com/widget',
      }
      const { result, warnings } = transformComponent(embed)
      expect(result).toEqual({
        role: 'body',
        text: '<a href="https://example.com/widget">https://example.com/widget</a>',
        format: 'html',
        textStyle: 'default-body',
      })
      expect(warnings).toEqual([
        {
          type: 'unsupported_embed',
          message:
            'Unsupported embed platform "other" — rendered as body text fallback',
          component: 'embed',
        },
      ])
    })
  })

  describe('divider', () => {
    it('maps to divider role', () => {
      const divider: Divider = { type: 'divider' }
      const { result, warnings } = transformComponent(divider)
      expect(result).toEqual({ role: 'divider' })
      expect(warnings).toEqual([])
    })
  })

  describe('table', () => {
    it('builds htmltable with tbody only when no header rows', () => {
      const table: Table = {
        type: 'table',
        rows: [
          ['A', 'B'],
          ['C', 'D'],
        ],
      }
      const { result } = transformComponent(table)
      expect(result).toEqual({
        role: 'htmltable',
        html: '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
      })
    })

    it('builds htmltable with thead and tbody when headerRows specified', () => {
      const table: Table = {
        type: 'table',
        rows: [
          ['Name', 'Age'],
          ['Alice', '30'],
          ['Bob', '25'],
        ],
        headerRows: 1,
      }
      const { result } = transformComponent(table)
      expect(result).toEqual({
        role: 'htmltable',
        html: '<table><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr><tr><td>Bob</td><td>25</td></tr></tbody></table>',
      })
    })

    it('handles multiple header rows', () => {
      const table: Table = {
        type: 'table',
        rows: [
          ['Category', 'Value'],
          ['Sub', 'Detail'],
          ['Data1', '100'],
        ],
        headerRows: 2,
      }
      const { result } = transformComponent(table)
      expect(result).toEqual({
        role: 'htmltable',
        html: '<table><thead><tr><th>Category</th><th>Value</th></tr><tr><th>Sub</th><th>Detail</th></tr></thead><tbody><tr><td>Data1</td><td>100</td></tr></tbody></table>',
      })
    })
  })

  describe('rawHtml', () => {
    it('returns null with dropped_component warning', () => {
      const rawHtml: RawHtml = {
        type: 'rawHtml',
        html: '<iframe src="https://example.com"></iframe>',
      }
      const { result, warnings } = transformComponent(rawHtml)
      expect(result).toBeNull()
      expect(warnings).toEqual([
        {
          type: 'dropped_component',
          message: 'rawHtml component dropped — not supported in ANF',
          component: 'rawHtml',
        },
      ])
    })
  })

  describe('adPlacement', () => {
    it('maps to banner_advertisement with bannerType any', () => {
      const ad: AdPlacement = {
        type: 'adPlacement',
        slot: 'mid-article',
      }
      const { result, warnings } = transformComponent(ad)
      expect(result).toEqual({
        role: 'banner_advertisement',
        bannerType: 'any',
      })
      expect(warnings).toEqual([])
    })
  })
})

import { describe, expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ghostSource } from '@/sources/ghost.ts'
import { transformToAnf } from '@/transformers/anf/index.ts'
import { validateAnfDocument } from '@/transformers/anf/validate.ts'

describe('end-to-end: Ghost fixture -> ANF', () => {
  it('transforms a Ghost article to valid ANF', async () => {
    const fixturePath = join(
      import.meta.dir,
      '../../fixtures/ghost/article.html',
    )
    const html = await readFile(fixturePath, 'utf-8')

    const article = ghostSource.parseArticle(
      html,
      'https://www.404media.co/test-article/',
    )
    const { document } = transformToAnf(article)

    // Should produce valid ANF
    expect(() => validateAnfDocument(document)).not.toThrow()

    // Required fields present
    expect(document.version).toBe('1.9')
    expect(document.title).toBeTruthy()
    expect(document.language).toBeTruthy()
    expect(document.components.length).toBeGreaterThan(0)

    // Components should include expected types
    const roles = document.components.map((c) => c.role)
    expect(roles).toContain('body')
  })
})

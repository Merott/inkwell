import {
  type Browser,
  type BrowserContext,
  chromium,
  type Page,
} from 'playwright'

export interface PlaywrightFetcher {
  init(): Promise<void>
  dispose(): Promise<void>
  fetchHtml(
    url: string,
    onLoad?: (page: Page) => Promise<void>,
  ): Promise<string>
}

export function createPlaywrightFetcher(options?: {
  headless?: boolean
}): PlaywrightFetcher {
  const headless = options?.headless ?? false

  let sharedBrowser: Browser | null = null
  let sharedContext: BrowserContext | null = null
  let sharedPage: Page | null = null

  return {
    async init() {
      if (!sharedBrowser) {
        sharedBrowser = await chromium.launch({ headless })
        sharedContext = await sharedBrowser.newContext()
        sharedPage = await sharedContext.newPage()
      }
    },

    async dispose() {
      sharedPage = null
      if (sharedContext) {
        await sharedContext.close()
        sharedContext = null
      }
      if (sharedBrowser) {
        await sharedBrowser.close()
        sharedBrowser = null
      }
    },

    async fetchHtml(url, onLoad) {
      if (sharedPage) {
        return fetchWithPage(sharedPage, url, onLoad)
      }

      const browser = await chromium.launch({ headless })
      try {
        const context = await browser.newContext()
        const page = await context.newPage()
        try {
          return await fetchWithPage(page, url, onLoad)
        } finally {
          await context.close()
        }
      } finally {
        await browser.close()
      }
    },
  }
}

async function fetchWithPage(
  page: Page,
  url: string,
  onLoad?: (page: Page) => Promise<void>,
) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  if (onLoad) {
    await onLoad(page)
  }
  return await page.content()
}

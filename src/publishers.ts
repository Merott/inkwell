import { z } from 'zod/v4'

const publisherConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sourceId: z.string().min(1),
  homepageUrl: z.url(),
  enabled: z.boolean(),
})

export type PublisherConfig = z.infer<typeof publisherConfigSchema>

const publishers: PublisherConfig[] = [
  {
    id: '404-media',
    name: '404 Media',
    sourceId: 'ghost',
    homepageUrl: 'https://www.404media.co/',
    enabled: true,
  },
  {
    id: 'itv-news',
    name: 'ITV News',
    sourceId: 'itv-news',
    homepageUrl: 'https://www.itv.com/news',
    enabled: true,
  },
]

function validate(configs: PublisherConfig[]) {
  const ids = new Set<string>()
  for (const config of configs) {
    publisherConfigSchema.parse(config)
    if (ids.has(config.id)) {
      throw new Error(`Duplicate publisher ID: ${config.id}`)
    }
    ids.add(config.id)
  }
  return configs
}

const validatedPublishers = validate(publishers)

export function getPublisher(id: string) {
  return validatedPublishers.find((p) => p.id === id)
}

export function getEnabledPublishers() {
  return validatedPublishers.filter((p) => p.enabled)
}

export function getAllPublishers() {
  return validatedPublishers
}

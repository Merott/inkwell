import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/pipeline/db/schema.ts',
  out: './drizzle',
})

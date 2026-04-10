import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: 'postgresql://postgres:careos@localhost:5432/careos',
  },
})

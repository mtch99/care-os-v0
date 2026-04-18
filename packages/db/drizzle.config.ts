import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:careos@localhost:5432/careos',
  },
})

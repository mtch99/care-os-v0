import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
// @ts-expect-error — no type declarations shipped
import drizzle from 'eslint-plugin-drizzle'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import next from '@next/eslint-plugin-next'
import prettierConfig from 'eslint-config-prettier'

export default defineConfig([
  // Ignored paths
  globalIgnores(['**/dist/**', '**/node_modules/**', '**/.turbo/**', '**/coverage/**']),

  // Base JS rules
  js.configs.recommended,

  // TypeScript strict type-checked rules.
  // Uses projectService (TypeScript Language Service API) which correctly handles
  // moduleResolution: "bundler" — do NOT switch to parserOptions.project with node16.
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.ts'],
          defaultProject: 'tsconfig.base.json',
        },
        // @ts-expect-error — import.meta.dirname requires module:"NodeNext" but base tsconfig uses "ESNext"
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Drizzle — enforces .where() on updates/deletes to prevent full-table writes
  {
    plugins: { drizzle },
    rules: {
      'drizzle/enforce-delete-with-where': 'error',
      'drizzle/enforce-update-with-where': 'error',
    },
  },

  // React + Next.js — scoped to app TSX/JSX files only, not backend packages
  {
    files: ['apps/**/*.tsx', 'apps/**/*.jsx'],
    ...react.configs.flat.recommended,
    settings: { react: { version: 'detect' } },
  },
  {
    files: ['apps/**/*.tsx', 'apps/**/*.jsx'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ['apps/web/**/*.tsx', 'apps/web/**/*.jsx', 'apps/web/**/*.ts', 'apps/web/**/*.js'],
    plugins: { '@next/next': next },
    rules: next.configs.recommended.rules,
  },

  // Prettier — must be last to disable all formatting rules that conflict
  prettierConfig,
])

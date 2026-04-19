#!/usr/bin/env tsx
/**
 * CAR-121 throwaway backfill: rewrite label-shape values in repeaterTable
 * `select` cells → key-shape, matching what CAR-122 already did for
 * top-level select / radio / checkboxGroup.
 *
 * Scope: chart_notes.field_values, cells belonging to a repeaterTable
 * column whose type is 'select' AND whose options are declared. Other
 * column types (text, narrative) are left untouched. Free-select columns
 * (no `options` declared) are also left untouched.
 *
 * Idempotent: values already matching option.key are left alone. Running a
 * second time against the same DB rewrites zero rows.
 *
 * Safety gate: refuses to run if any referenced template_version fails
 * templateContentSchemaV2.parse — that means the template is still on an
 * older schema and should be reseeded first.
 *
 * One-time use. Committed for audit trail; do not reuse for future
 * migrations without reading the new field-config surface.
 *
 * Run: pnpm tsx scripts/backfill/car-121-repeater-options-to-key.ts
 *
 * Requires DATABASE_URL in the environment (same convention as
 * scripts/backfill/car-122-options-label-to-key.ts). In a worktree,
 * `pnpm db:up` rewrites the URL in apps/api/.env and packages/db/.env;
 * export it from one of those before running.
 */

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { templateContentSchemaV2 } from '@careos/api-contract'
import type { TemplateContentV2 } from '@careos/api-contract'
import { chartNotes, chartNoteTemplates } from '@careos/db'

type Field =
  TemplateContentV2['pages'][number]['sections'][number]['rows'][number]['columns'][number]

interface KeyedOption {
  key: string
  fr: string
  en: string
}

interface RepeaterColumn {
  key: string
  type: 'text' | 'select' | 'narrative'
  options?: KeyedOption[]
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Export it or source the appropriate .env first.')
  process.exit(1)
}

const client = postgres(DATABASE_URL, { max: 2 })
const db = drizzle(client, { schema: { chartNotes, chartNoteTemplates } })

async function main(): Promise<void> {
  const rows = await db
    .select({
      id: chartNotes.id,
      templateVersionId: chartNotes.templateVersionId,
      fieldValues: chartNotes.fieldValues,
    })
    .from(chartNotes)

  if (rows.length === 0) {
    console.log('[car-121-backfill] no chart_notes rows to inspect — done.')
    await client.end()
    return
  }

  const templateCache = new Map<string, TemplateContentV2>()

  let rowsScanned = 0
  let rowsRewritten = 0
  let cellsRewritten = 0
  let rowsUnchanged = 0
  const warnings: string[] = []

  for (const row of rows) {
    rowsScanned++
    const fieldValues = row.fieldValues
    if (fieldValues === null || typeof fieldValues !== 'object') continue

    let template = templateCache.get(row.templateVersionId)
    if (!template) {
      const [tpl] = await db
        .select({ content: chartNoteTemplates.content })
        .from(chartNoteTemplates)
        .where(eq(chartNoteTemplates.id, row.templateVersionId))
        .limit(1)
      if (!tpl) {
        warnings.push(
          `chart_note ${row.id}: referenced template ${row.templateVersionId} not found — skipped`,
        )
        continue
      }
      try {
        template = templateContentSchemaV2.parse(tpl.content)
      } catch (err) {
        console.error(
          `[car-121-backfill] template ${row.templateVersionId} failed schema parse. ` +
            `If you're running this against fixtures, run pnpm db:nuke && pnpm db:seed first.`,
        )
        console.error(err)
        await client.end()
        process.exit(1)
      }
      templateCache.set(row.templateVersionId, template)
    }

    const fieldsByKey = indexFields(template)
    const rewritten: Record<string, unknown> = {}
    let changedCells = 0

    for (const [fieldKey, raw] of Object.entries(fieldValues as Record<string, unknown>)) {
      const field = fieldsByKey.get(fieldKey)
      if (!field || field.type !== 'repeaterTable' || raw === null || !Array.isArray(raw)) {
        rewritten[fieldKey] = raw
        continue
      }

      const columns = (field.config as { columns: RepeaterColumn[] }).columns
      const columnsByKey = new Map(columns.map((c) => [c.key, c]))
      const nextRows: unknown[] = []
      for (const repeaterRow of raw) {
        if (repeaterRow === null || typeof repeaterRow !== 'object' || Array.isArray(repeaterRow)) {
          nextRows.push(repeaterRow)
          continue
        }
        const nextCells: Record<string, unknown> = {}
        for (const [cellKey, cellValue] of Object.entries(repeaterRow as Record<string, unknown>)) {
          const column = columnsByKey.get(cellKey)
          if (!column || column.type !== 'select' || !column.options || cellValue === null) {
            nextCells[cellKey] = cellValue
            continue
          }
          const mapped = mapLabelToKey(cellValue, column.options)
          if (mapped.changed) changedCells++
          else if (mapped.ambiguous) {
            warnings.push(
              `chart_note ${row.id} field ${fieldKey} column ${cellKey}: value ${JSON.stringify(cellValue)} ` +
                `matches neither option.key nor option.fr nor option.en — left as-is`,
            )
          }
          nextCells[cellKey] = mapped.value
        }
        nextRows.push(nextCells)
      }
      rewritten[fieldKey] = nextRows
    }

    if (changedCells > 0) {
      await db.update(chartNotes).set({ fieldValues: rewritten }).where(eq(chartNotes.id, row.id))
      rowsRewritten++
      cellsRewritten += changedCells
      console.log(`chart_note ${row.id}: rewrote ${String(changedCells)} repeater cell(s)`)
    } else {
      rowsUnchanged++
    }
  }

  console.log('---')
  console.log(`[car-121-backfill] scanned ${String(rowsScanned)} chart_note row(s)`)
  console.log(
    `[car-121-backfill] rewrote ${String(rowsRewritten)} row(s), ${String(cellsRewritten)} repeater cell value(s)`,
  )
  console.log(`[car-121-backfill] ${String(rowsUnchanged)} row(s) already on key-shape (no-op)`)
  if (warnings.length > 0) {
    console.log(`[car-121-backfill] ${String(warnings.length)} warning(s):`)
    for (const w of warnings) console.log(`  - ${w}`)
  }

  await client.end()
}

function indexFields(content: TemplateContentV2): Map<string, Field> {
  const map = new Map<string, Field>()
  for (const page of content.pages) {
    for (const section of page.sections) {
      for (const row of section.rows) {
        for (const col of row.columns) {
          map.set(col.key, col)
        }
      }
    }
  }
  return map
}

function mapLabelToKey(
  value: unknown,
  options: ReadonlyArray<KeyedOption>,
): { value: unknown; changed: boolean; ambiguous: boolean } {
  if (typeof value !== 'string') {
    return { value, changed: false, ambiguous: false }
  }
  // Already key-shape (idempotent).
  if (options.some((opt) => opt.key === value)) {
    return { value, changed: false, ambiguous: false }
  }
  const matchByLabel = options.find((opt) => opt.fr === value || opt.en === value)
  if (matchByLabel) {
    return { value: matchByLabel.key, changed: true, ambiguous: false }
  }
  // Matches neither key nor label — leave untouched and surface as warning.
  return { value, changed: false, ambiguous: true }
}

main().catch((err) => {
  console.error('[car-121-backfill] fatal:', err)
  process.exit(1)
})

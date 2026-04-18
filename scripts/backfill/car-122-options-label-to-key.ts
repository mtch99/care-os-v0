#!/usr/bin/env tsx
/**
 * CAR-122 throwaway backfill: rewrite label-shape option values → key-shape
 * across every row in chart_notes.field_values.
 *
 * Scope: select, radio, and checkboxGroup field types only. Other field
 * types (narrative, scale, repeaterTable, table, checkboxWithText, date,
 * diagrams, signature) either do not carry locale-pinned values or already
 * use their own stable identifiers, so they are left untouched.
 *
 * Idempotent: values already matching option.key are left alone. Running a
 * second time against the same DB rewrites zero rows.
 *
 * Safety gate: refuses to run if any referenced template_version fails
 * TemplateSchema.parse (i.e., if any template is still at schemaVersion
 * '0.2' or otherwise drifted). Fix the template before running this.
 *
 * One-time use. Committed for audit trail; do not reuse for future
 * migrations without reading the new field-config surface.
 *
 * Run: pnpm tsx scripts/backfill/car-122-options-label-to-key.ts
 *
 * Requires DATABASE_URL set (copy apps/api/.env to process env or set
 * inline). Does NOT load .env automatically — the caller decides how
 * env is provided. In the typical worktree workflow `pnpm db:up`
 * rewrites apps/api/.env and packages/db/.env; export the URL from
 * one of those before running.
 */

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { templateContentSchemaV2 } from '@careos/api-contract'
import type { TemplateContentV2 } from '@careos/api-contract'
import { chartNotes, chartNoteTemplates } from '@careos/db'

type Field = TemplateContentV2['pages'][number]['sections'][number]['rows'][number]['columns'][number]

interface KeyedOption {
  key: string
  fr: string
  en: string
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
    console.log('[car-122-backfill] no chart_notes rows to inspect — done.')
    await client.end()
    return
  }

  const templateCache = new Map<string, TemplateContentV2>()

  let rowsScanned = 0
  let rowsRewritten = 0
  let optionsRewritten = 0
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
        warnings.push(`chart_note ${row.id}: referenced template ${row.templateVersionId} not found — skipped`)
        continue
      }
      try {
        template = templateContentSchemaV2.parse(tpl.content)
      } catch (err) {
        console.error(
          `[car-122-backfill] template ${row.templateVersionId} failed schema parse. ` +
            `Is it still on schemaVersion 0.2? Run pnpm db:nuke && pnpm db:seed before backfill.`,
        )
        console.error(err)
        await client.end()
        process.exit(1)
      }
      templateCache.set(row.templateVersionId, template)
    }

    const fieldsByKey = indexFields(template)
    const rewritten: Record<string, unknown> = {}
    let changed = 0

    for (const [fieldKey, raw] of Object.entries(fieldValues as Record<string, unknown>)) {
      const field = fieldsByKey.get(fieldKey)
      if (!field) {
        rewritten[fieldKey] = raw
        continue
      }
      if (raw === null) {
        rewritten[fieldKey] = raw
        continue
      }

      if (field.type === 'select' || field.type === 'radio') {
        const options = (field.config as { options: KeyedOption[] }).options
        const mapped = mapLabelToKey(raw, options)
        if (mapped.changed) changed++
        else if (mapped.ambiguous) {
          warnings.push(
            `chart_note ${row.id} field ${fieldKey}: value ${JSON.stringify(raw)} matches neither option.key nor option.fr nor option.en — left as-is`,
          )
        }
        rewritten[fieldKey] = mapped.value
      } else if (field.type === 'checkboxGroup') {
        if (!Array.isArray(raw)) {
          rewritten[fieldKey] = raw
          continue
        }
        const options = (field.config as { options: KeyedOption[] }).options
        const next: unknown[] = []
        let fieldChanged = false
        for (const el of raw) {
          const mapped = mapLabelToKey(el, options)
          if (mapped.changed) fieldChanged = true
          else if (mapped.ambiguous) {
            warnings.push(
              `chart_note ${row.id} field ${fieldKey}: element ${JSON.stringify(el)} matches no option — left as-is`,
            )
          }
          next.push(mapped.value)
        }
        if (fieldChanged) changed++
        rewritten[fieldKey] = next
      } else {
        rewritten[fieldKey] = raw
      }
    }

    if (changed > 0) {
      await db
        .update(chartNotes)
        .set({ fieldValues: rewritten })
        .where(eq(chartNotes.id, row.id))
      rowsRewritten++
      optionsRewritten += changed
      console.log(`chart_note ${row.id}: rewrote ${String(changed)} option(s)`)
    } else {
      rowsUnchanged++
    }
  }

  console.log('---')
  console.log(`[car-122-backfill] scanned ${String(rowsScanned)} chart_note row(s)`)
  console.log(`[car-122-backfill] rewrote ${String(rowsRewritten)} row(s), ${String(optionsRewritten)} option value(s)`)
  console.log(`[car-122-backfill] ${String(rowsUnchanged)} row(s) already on key-shape (no-op)`)
  if (warnings.length > 0) {
    console.log(`[car-122-backfill] ${String(warnings.length)} warning(s):`)
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
  console.error('[car-122-backfill] fatal:', err)
  process.exit(1)
})

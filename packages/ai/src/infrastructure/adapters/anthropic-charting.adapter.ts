import Anthropic from '@anthropic-ai/sdk'
import { templateContentSchemaV2 } from '@careos/api-contract'
import type { TemplateContentV2 } from '@careos/api-contract'
import { z } from 'zod'

import type { AIChartingPort } from '../../domain/ports/ai-charting.port'
import type { ChartNoteDraft } from '../../domain/types/chart-note-draft'

const DEFAULT_MODEL = 'claude-sonnet-4-5'
const TEMPLATE_MAX_TOKENS = 8192
const CHART_NOTE_MAX_TOKENS = 4096

/**
 * JSON Schema for TemplateContentV2 — derived from the Zod source of truth.
 * Used as tool input_schema to force structured JSON output via
 * tool_choice: { type: 'tool', name: '...' }.
 */
const templateContentJsonSchema = z.toJSONSchema(
  templateContentSchemaV2,
) as Anthropic.Tool.InputSchema

const chartNoteDraftJsonSchema: Anthropic.Tool.InputSchema = {
  type: 'object',
  properties: {
    fields: {
      type: 'object',
      additionalProperties: true,
    },
  },
  required: ['fields'],
}

const TEMPLATE_TOOL_NAME = 'generate_template'
const CHART_NOTE_TOOL_NAME = 'generate_chart_note'

const TEMPLATE_SYSTEM_PROMPT = `You are a clinical charting template designer for healthcare practitioners.
You generate structured chart note templates by calling the ${TEMPLATE_TOOL_NAME} tool.

Rules:
- schemaVersion must be "0.3"
- Every field key must be unique across the entire template
- Every page key and section key must be unique
- Labels must include all locales specified in the locale array
- Use appropriate field types: narrative for long text, text for short text, scale for numeric ranges, select/radio for choices, checkboxGroup for multi-select, checkboxWithText for checkboxes with optional notes, date for dates, repeaterTable for dynamic rows, table for fixed grids, legend for read-only text, bodyDiagram/romDiagram for visual input, signature for signatures
- config must match the field type (e.g. scale needs min/max, select needs options array)
- For select / radio / checkboxGroup fields: every option in the options array must include a stable "key" field alongside "fr" and "en". The key is a snake_case slug of the English label (e.g. "Traumatic" → "traumatic", "Post-surgical" → "post_surgical", "Sit to Stand" → "sit_to_stand"). Once written, the key is contract — do not rename it to follow a label edit. Within a single options array, keys must be unique; across fields the same key can appear and is scoped to its containing field.
- Structure the template logically with meaningful page/section organization for the given discipline and appointment type`

const CHART_NOTE_SYSTEM_PROMPT = `You are a clinical charting assistant for healthcare practitioners.
You fill in chart note template fields by calling the ${CHART_NOTE_TOOL_NAME} tool.

Rules:
- Only include fields that have relevant data in the notes
- Match field keys exactly as they appear in the template
- Use the correct value type for each field type:
  - narrative, text, date fields: string value
  - scale fields: number value
  - select, radio fields: the option.key (stable identifier, never the localized fr/en label) of the selected option
  - checkboxGroup fields: array of option.key values (stable identifiers, never localized labels) for each selected option
  - checkboxWithText fields: array of {key, checked, text?} objects — key must match one of the field's items[].key
  - repeaterTable fields: array of {columnKey: value} row objects
  - table fields: {rowKey: value} object
  - bodyDiagram, romDiagram, signature fields: null (AI cannot fill these)
- Extract clinical information accurately from the notes
- Do not fabricate information not present in the notes
- Use professional clinical language appropriate to the discipline`

/**
 * Anthropic adapter implementing AIChartingPort.
 *
 * Uses tool_choice to force structured JSON output. The model is required to
 * call a tool whose input_schema matches the expected shape, guaranteeing
 * parseable JSON. Returns raw parsed JSON — callers validate via domain logic.
 */
export class AnthropicChartingAdapter implements AIChartingPort {
  private readonly model: string

  constructor(
    private readonly client: Anthropic,
    model?: string,
  ) {
    this.model = model ?? DEFAULT_MODEL
  }

  async generateTemplateDraft(input: {
    discipline: string
    appointmentType: string
    preferences: string
    locale: ('fr' | 'en')[]
  }): Promise<TemplateContentV2> {
    const userPrompt = [
      `Discipline: ${input.discipline}`,
      `Appointment type: ${input.appointmentType}`,
      `Locales: ${input.locale.join(', ')}`,
      `Practitioner preferences: ${input.preferences}`,
    ].join('\n')

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: TEMPLATE_MAX_TOKENS,
      system: TEMPLATE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [
        {
          name: TEMPLATE_TOOL_NAME,
          description: 'Generate a chart note template in TemplateContentV2 format.',
          input_schema: templateContentJsonSchema,
        },
      ],
      tool_choice: { type: 'tool', name: TEMPLATE_TOOL_NAME },
    })

    // Safety: tool_choice forces structured output matching the schema, but the
    // cast is unvalidated. Callers must run the result through TemplateSchema.parse().
    return extractToolInput(response, TEMPLATE_TOOL_NAME) as TemplateContentV2
  }

  async generateChartNoteDraft(input: {
    rawNotes: string
    templateContent: TemplateContentV2
    intakeData?: Record<string, unknown>
  }): Promise<ChartNoteDraft> {
    const templateSummary = JSON.stringify(input.templateContent, null, 2)

    const userParts = [
      `Template structure:\n${templateSummary}`,
      `\nRaw session notes:\n${input.rawNotes}`,
    ]

    if (input.intakeData) {
      userParts.push(`\nIntake data:\n${JSON.stringify(input.intakeData, null, 2)}`)
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: CHART_NOTE_MAX_TOKENS,
      system: CHART_NOTE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userParts.join('\n') }],
      tools: [
        {
          name: CHART_NOTE_TOOL_NAME,
          description: 'Generate chart note field values from session notes.',
          input_schema: chartNoteDraftJsonSchema,
        },
      ],
      tool_choice: { type: 'tool', name: CHART_NOTE_TOOL_NAME },
    })

    // Safety: unvalidated cast — callers must verify field keys exist in the
    // template and that value types match the corresponding FieldType.
    return extractToolInput(response, CHART_NOTE_TOOL_NAME) as ChartNoteDraft
  }
}

function extractToolInput(response: Anthropic.Message, toolName: string): unknown {
  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === toolName,
  )

  if (!block) {
    throw new Error(`LLM response did not contain a ${toolName} tool call`)
  }

  return block.input
}

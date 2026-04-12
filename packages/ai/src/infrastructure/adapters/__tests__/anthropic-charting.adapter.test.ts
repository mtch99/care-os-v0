import { describe, it, expect, vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import type { TemplateContentV2 } from '@careos/api-contract'

import { AnthropicChartingAdapter } from '../anthropic-charting.adapter'
import type { ChartNoteDraft } from '../../../domain/types/chart-note-draft'

const TEMPLATE_RESULT: TemplateContentV2 = {
  schemaVersion: '0.2',
  locale: ['fr', 'en'],
  pages: [
    {
      key: 'pg1',
      label: { fr: 'Page 1', en: 'Page 1' },
      sections: [
        {
          key: 's1',
          label: { fr: 'Section 1', en: 'Section 1' },
          rows: [
            {
              columns: [
                {
                  key: 'chief_complaint',
                  label: { fr: 'Motif de consultation', en: 'Chief complaint' },
                  type: 'narrative',
                  required: true,
                  config: {},
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

const CHART_NOTE_RESULT: ChartNoteDraft = {
  fields: {
    chief_complaint: 'Lower back pain radiating to left leg',
    pain_scale: 7,
    affected_areas: ['lumbar', 'left_leg'],
    signature: null,
  },
}

function createSpyClient(toolName: string, toolInput: unknown) {
  const createFn = vi.fn().mockResolvedValue({
    content: [
      {
        type: 'tool_use' as const,
        id: 'toolu_fake',
        name: toolName,
        input: toolInput,
      },
    ],
  })

  const client = { messages: { create: createFn } } as unknown as Anthropic

  return { client, createFn }
}

function createFailingClient(): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Sorry, I cannot help.' }],
      }),
    },
  } as unknown as Anthropic
}

describe('AnthropicChartingAdapter', () => {
  describe('generateTemplateDraft', () => {
    it('throws when response has no tool_use block', async () => {
      const client = createFailingClient()
      const adapter = new AnthropicChartingAdapter(client)

      await expect(
        adapter.generateTemplateDraft({
          discipline: 'physiotherapy',
          appointmentType: 'initial',
          preferences: '',
          locale: ['fr'],
        }),
      ).rejects.toThrow('did not contain a generate_template tool call')
    })
  })

  describe('generateChartNoteDraft', () => {
    it('includes intake data in the prompt when provided', async () => {
      const { client, createFn } = createSpyClient('generate_chart_note', CHART_NOTE_RESULT)
      const adapter = new AnthropicChartingAdapter(client)

      await adapter.generateChartNoteDraft({
        rawNotes: 'Follow-up visit.',
        templateContent: TEMPLATE_RESULT,
        intakeData: { previousDiagnosis: 'L5-S1 herniation' },
      })

      const args = createFn.mock.calls[0][0] as Record<string, unknown>
      const messages = args.messages as Array<{ content: string }>
      expect(messages[0].content).toContain('L5-S1 herniation')
    })

    it('omits intake data from prompt when not provided', async () => {
      const { client, createFn } = createSpyClient('generate_chart_note', CHART_NOTE_RESULT)
      const adapter = new AnthropicChartingAdapter(client)

      await adapter.generateChartNoteDraft({
        rawNotes: 'Initial assessment.',
        templateContent: TEMPLATE_RESULT,
      })

      const args = createFn.mock.calls[0][0] as Record<string, unknown>
      const messages = args.messages as Array<{ content: string }>
      expect(messages[0].content).not.toContain('Intake data')
    })

    it('throws when response has no tool_use block', async () => {
      const client = createFailingClient()
      const adapter = new AnthropicChartingAdapter(client)

      await expect(
        adapter.generateChartNoteDraft({
          rawNotes: 'Some notes.',
          templateContent: TEMPLATE_RESULT,
        }),
      ).rejects.toThrow('did not contain a generate_chart_note tool call')
    })
  })
})

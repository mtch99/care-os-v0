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
    it('returns the tool input as TemplateContentV2', async () => {
      const { client } = createSpyClient('generate_template', TEMPLATE_RESULT)
      const adapter = new AnthropicChartingAdapter(client)

      const result = await adapter.generateTemplateDraft({
        discipline: 'physiotherapy',
        appointmentType: 'initial',
        preferences: 'Focus on ROM assessment',
        locale: ['fr', 'en'],
      })

      expect(result).toEqual(TEMPLATE_RESULT)
    })

    it('passes correct parameters to the API', async () => {
      const { client, createFn } = createSpyClient('generate_template', TEMPLATE_RESULT)
      const adapter = new AnthropicChartingAdapter(client, 'claude-haiku-3')

      await adapter.generateTemplateDraft({
        discipline: 'ergotherapy',
        appointmentType: 'follow_up',
        preferences: 'Include hand function assessment',
        locale: ['en'],
      })

      expect(createFn).toHaveBeenCalledOnce()

      const args = createFn.mock.calls[0][0] as Record<string, unknown>
      expect(args.model).toBe('claude-haiku-3')
      expect(args.tool_choice).toEqual({ type: 'tool', name: 'generate_template' })

      const tools = args.tools as Array<{ name: string }>
      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe('generate_template')

      const messages = args.messages as Array<{ content: string }>
      expect(messages[0].content).toContain('ergotherapy')
      expect(messages[0].content).toContain('follow_up')
    })

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

    it('uses default model when none specified', async () => {
      const { client, createFn } = createSpyClient('generate_template', TEMPLATE_RESULT)
      const adapter = new AnthropicChartingAdapter(client)

      await adapter.generateTemplateDraft({
        discipline: 'physiotherapy',
        appointmentType: 'initial',
        preferences: '',
        locale: ['fr'],
      })

      const args = createFn.mock.calls[0][0] as Record<string, unknown>
      expect(args.model).toBe('claude-sonnet-4-5')
    })
  })

  describe('generateChartNoteDraft', () => {
    it('returns the tool input as ChartNoteDraft', async () => {
      const { client } = createSpyClient('generate_chart_note', CHART_NOTE_RESULT)
      const adapter = new AnthropicChartingAdapter(client)

      const result = await adapter.generateChartNoteDraft({
        rawNotes: 'Patient reports lower back pain, 7/10, radiating to left leg.',
        templateContent: TEMPLATE_RESULT,
      })

      expect(result).toEqual(CHART_NOTE_RESULT)
    })

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

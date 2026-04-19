// Domain — port interface and types
export type { AIChartingPort } from './domain/ports/ai-charting.port'
export type { ChartNoteDraft, ChartNoteDraftFieldValue } from './domain/types/chart-note-draft'

// Infrastructure — adapter and factory
export { AnthropicChartingAdapter } from './infrastructure/adapters/anthropic-charting.adapter'
export { createAnthropicChartingAdapter } from './infrastructure/factory'

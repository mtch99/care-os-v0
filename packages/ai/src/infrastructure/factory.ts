import Anthropic from '@anthropic-ai/sdk'

import type { AIChartingPort } from '../domain/ports/ai-charting.port'
import { AnthropicChartingAdapter } from './adapters/anthropic-charting.adapter'
import { env } from './env'

/**
 * Create a fully-wired AnthropicChartingAdapter from environment variables.
 *
 * Reads ANTHROPIC_API_KEY (required) and ANTHROPIC_MODEL (optional) from
 * the parsed env config, constructs the SDK client, and returns the adapter
 * typed as AIChartingPort.
 */
export function createAnthropicChartingAdapter(): AIChartingPort {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  return new AnthropicChartingAdapter(client, env.ANTHROPIC_MODEL)
}

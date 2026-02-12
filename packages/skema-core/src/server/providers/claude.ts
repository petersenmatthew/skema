// =============================================================================
// Claude Provider - Direct API implementation
// =============================================================================

import type { AIProvider, GenerateOptions } from './index';
import type { AIStreamEvent } from '../ai-provider';
import { CODE_GENERATION_PROMPT } from '../prompts';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export function createClaudeProvider(apiKey: string): AIProvider {
  return {
    name: 'claude',

    isAvailable(): boolean {
      return !!apiKey;
    },

    async *generateStream(prompt: string, options?: GenerateOptions): AsyncIterable<AIStreamEvent> {
      const model = options?.model || DEFAULT_MODEL;

      // Emit init event
      yield {
        type: 'init',
        content: `Starting generation with Claude ${model}`,
        timestamp: new Date().toISOString(),
        provider: 'claude',
      };

      try {
        // Dynamic import to avoid bundling issues
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic({ apiKey });

        const stream = await client.messages.stream({
          model,
          max_tokens: options?.maxTokens || 8192,
          system: CODE_GENERATION_PROMPT,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        for await (const event of stream) {
          if (event.type === 'content_block_delta') {
            const delta = event.delta as { type: string; text?: string };
            if (delta.type === 'text_delta' && delta.text) {
              yield {
                type: 'text',
                content: delta.text,
                timestamp: new Date().toISOString(),
                provider: 'claude',
              };
            }
          }
        }

        yield {
          type: 'done',
          content: 'Generation complete',
          timestamp: new Date().toISOString(),
          provider: 'claude',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        yield {
          type: 'error',
          content: `Claude API error: ${message}`,
          timestamp: new Date().toISOString(),
          provider: 'claude',
        };
      }
    },

    async analyzeImage(base64Image: string, prompt: string, options?: GenerateOptions): Promise<string> {
      const model = options?.model || DEFAULT_MODEL;

      // Clean base64 string
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic({ apiKey });

        const response = await client.messages.create({
          model,
          max_tokens: options?.maxTokens || 1024,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: cleanBase64,
                  },
                },
                {
                  type: 'text',
                  text: prompt,
                },
              ],
            },
          ],
        });

        // Extract text from response
        const textContent = response.content.find((c) => c.type === 'text');
        return textContent && 'text' in textContent ? textContent.text : '';
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Claude vision error: ${message}`);
      }
    },
  };
}

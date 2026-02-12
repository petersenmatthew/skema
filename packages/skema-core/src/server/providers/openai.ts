// =============================================================================
// OpenAI Provider - Direct API implementation
// =============================================================================

import type { AIProvider, GenerateOptions } from './index';
import type { AIStreamEvent } from '../ai-provider';
import { CODE_GENERATION_PROMPT } from '../prompts';

const DEFAULT_MODEL = 'gpt-4o';

export function createOpenAIProvider(apiKey: string): AIProvider {
  return {
    name: 'openai',

    isAvailable(): boolean {
      return !!apiKey;
    },

    async *generateStream(prompt: string, options?: GenerateOptions): AsyncIterable<AIStreamEvent> {
      const model = options?.model || DEFAULT_MODEL;

      // Emit init event
      yield {
        type: 'init',
        content: `Starting generation with OpenAI ${model}`,
        timestamp: new Date().toISOString(),
        provider: 'openai' as const,
      };

      try {
        // Dynamic import to avoid bundling issues if not installed
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey });

        const stream = await client.chat.completions.create({
          model,
          max_tokens: options?.maxTokens || 8192,
          temperature: options?.temperature || 0.7,
          stream: true,
          messages: [
            {
              role: 'system',
              content: CODE_GENERATION_PROMPT,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield {
              type: 'text',
              content,
              timestamp: new Date().toISOString(),
              provider: 'openai' as const,
            };
          }
        }

        yield {
          type: 'done',
          content: 'Generation complete',
          timestamp: new Date().toISOString(),
          provider: 'openai' as const,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        yield {
          type: 'error',
          content: `OpenAI API error: ${message}`,
          timestamp: new Date().toISOString(),
          provider: 'openai' as const,
        };
      }
    },

    async analyzeImage(base64Image: string, prompt: string, options?: GenerateOptions): Promise<string> {
      const model = options?.model || 'gpt-4o';

      // Clean base64 string and ensure proper data URI format
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const dataUri = `data:image/png;base64,${cleanBase64}`;

      try {
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey });

        const response = await client.chat.completions.create({
          model,
          max_tokens: options?.maxTokens || 1024,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: dataUri,
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

        return response.choices[0]?.message?.content || '';
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`OpenAI vision error: ${message}`);
      }
    },
  };
}

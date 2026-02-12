// =============================================================================
// Gemini Provider - Direct API implementation
// =============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProvider, GenerateOptions } from './index';
import { createEventStream } from './index';
import type { AIStreamEvent } from '../ai-provider';
import { CODE_GENERATION_PROMPT } from '../prompts';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export function createGeminiProvider(apiKey: string): AIProvider {
  const genAI = new GoogleGenerativeAI(apiKey);

  return {
    name: 'gemini',

    isAvailable(): boolean {
      return !!apiKey;
    },

    async *generateStream(prompt: string, options?: GenerateOptions): AsyncIterable<AIStreamEvent> {
      const model = options?.model || DEFAULT_MODEL;
      const generativeModel = genAI.getGenerativeModel({ 
        model,
        generationConfig: {
          maxOutputTokens: options?.maxTokens || 8192,
          temperature: options?.temperature || 0.7,
        },
      });

      // Emit init event
      yield {
        type: 'init',
        content: `Starting generation with Gemini ${model}`,
        timestamp: new Date().toISOString(),
        provider: 'gemini',
      };

      try {
        // Build the full prompt with system context
        const fullPrompt = `${CODE_GENERATION_PROMPT}\n\n${prompt}`;
        
        const result = await generativeModel.generateContentStream(fullPrompt);
        
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            yield {
              type: 'text',
              content: text,
              timestamp: new Date().toISOString(),
              provider: 'gemini',
            };
          }
        }

        yield {
          type: 'done',
          content: 'Generation complete',
          timestamp: new Date().toISOString(),
          provider: 'gemini',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        yield {
          type: 'error',
          content: `Gemini API error: ${message}`,
          timestamp: new Date().toISOString(),
          provider: 'gemini',
        };
      }
    },

    async analyzeImage(base64Image: string, prompt: string, options?: GenerateOptions): Promise<string> {
      const model = options?.model || DEFAULT_MODEL;
      const visionModel = genAI.getGenerativeModel({ model });

      // Clean base64 string if needed (remove data URI prefix)
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

      try {
        const result = await visionModel.generateContent([
          prompt,
          {
            inlineData: {
              data: cleanBase64,
              mimeType: 'image/png',
            },
          },
        ]);

        const response = await result.response;
        return response.text();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Gemini vision error: ${message}`);
      }
    },
  };
}

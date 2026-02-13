import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { IMAGE_ANALYSIS_PROMPT } from './prompts';

// =============================================================================
// Types
// =============================================================================

export type VisionProvider = 'gemini' | 'claude' | 'openai';

export const VISION_MODELS: Record<VisionProvider, { models: string[]; default: string }> = {
  gemini: {
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash-preview', 'gemini-3-pro-preview'],
    default: 'gemini-2.5-flash',
  },
  claude: {
    models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929', 'claude-opus-4-6'],
    default: 'claude-haiku-4-5-20251001',
  },
  openai: {
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-5.2'],
    default: 'gpt-4o-mini',
  },
};

export interface VisionAnalysisResult {
  success: boolean;
  description: string;
  provider: VisionProvider;
  error?: string;
}

export interface VisionConfig {
  provider: VisionProvider;
  /** API key for vision API (falls back to env vars) */
  apiKey?: string;
  /** Model to use for vision */
  model?: string;
}

// =============================================================================
// Provider Factory
// =============================================================================

function getProviderModel(provider: VisionProvider, apiKey: string, model?: string) {
  const modelId = model || VISION_MODELS[provider].default;

  switch (provider) {
    case 'gemini': {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(modelId);
    }
    case 'claude': {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(modelId);
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey });
      return openai(modelId);
    }
  }
}

function getEnvVarForProvider(provider: VisionProvider): string | undefined {
  switch (provider) {
    case 'gemini': return process.env.GEMINI_API_KEY;
    case 'claude': return process.env.ANTHROPIC_API_KEY;
    case 'openai': return process.env.OPENAI_API_KEY;
  }
}

function getEnvVarName(provider: VisionProvider): string {
  switch (provider) {
    case 'gemini': return 'GEMINI_API_KEY';
    case 'claude': return 'ANTHROPIC_API_KEY';
    case 'openai': return 'OPENAI_API_KEY';
  }
}

// =============================================================================
// Main Vision Analysis Function
// =============================================================================

/**
 * Analyze an image using the specified AI provider's vision capabilities
 */
export async function analyzeImage(
  base64Image: string,
  config: VisionConfig
): Promise<VisionAnalysisResult> {
  const { provider } = config;

  // Get API key from config or environment
  const apiKey = config.apiKey || getEnvVarForProvider(provider);

  if (!apiKey) {
    return {
      success: false,
      description: '',
      provider,
      error: `No API key found for ${provider} vision. Set ${getEnvVarName(provider)} environment variable.`,
    };
  }

  console.log(`[Vision] Analyzing image with ${provider}...`);

  try {
    // Clean base64 string if needed (remove data URI prefix)
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

    const model = getProviderModel(provider, apiKey, config.model);

    const result = await generateText({
      model,
      maxTokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: Buffer.from(cleanBase64, 'base64'),
              mimeType: 'image/png',
            },
            {
              type: 'text',
              text: IMAGE_ANALYSIS_PROMPT,
            },
          ],
        },
      ],
    });

    return {
      success: true,
      description: result.text,
      provider,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Vision] ${provider} analysis failed:`, message);
    return {
      success: false,
      description: '',
      provider,
      error: message,
    };
  }
}

/**
 * Check if vision analysis is available for a provider
 */
export function isVisionAvailable(provider: VisionProvider): boolean {
  return !!getEnvVarForProvider(provider);
}

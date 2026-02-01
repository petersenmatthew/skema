import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProvider } from './ai-provider';
import { IMAGE_ANALYSIS_PROMPT } from './prompts';

// =============================================================================
// Types
// =============================================================================

export interface VisionAnalysisResult {
  success: boolean;
  description: string;
  provider: AIProvider;
  error?: string;
}

export interface VisionConfig {
  provider: AIProvider;
  /** API key for vision API (falls back to env vars) */
  apiKey?: string;
  /** Model to use for vision */
  model?: string;
}

// =============================================================================
// Gemini Vision
// =============================================================================

async function analyzeWithGemini(
  base64Image: string,
  apiKey: string,
  model: string = 'gemini-2.5-flash'
): Promise<VisionAnalysisResult> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const visionModel = genAI.getGenerativeModel({ model });

    // Clean base64 string if needed (remove data URI prefix)
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

    const result = await visionModel.generateContent([
      IMAGE_ANALYSIS_PROMPT,
      {
        inlineData: {
          data: cleanBase64,
          mimeType: 'image/png',
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    return {
      success: true,
      description: text,
      provider: 'gemini',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Vision] Gemini analysis failed:', message);
    return {
      success: false,
      description: '',
      provider: 'gemini',
      error: message,
    };
  }
}

// =============================================================================
// Claude Vision
// =============================================================================

async function analyzeWithClaude(
  base64Image: string,
  apiKey: string,
  model: string = 'claude-sonnet-4-20250514'
): Promise<VisionAnalysisResult> {
  try {
    // Dynamic import to avoid bundling issues if not installed
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    // Clean base64 string
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
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
              text: IMAGE_ANALYSIS_PROMPT,
            },
          ],
        },
      ],
    });

    // Extract text from response
    const textContent = response.content.find((c) => c.type === 'text');
    const description = textContent && 'text' in textContent ? textContent.text : '';

    return {
      success: true,
      description,
      provider: 'claude',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Vision] Claude analysis failed:', message);
    return {
      success: false,
      description: '',
      provider: 'claude',
      error: message,
    };
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
  let apiKey = config.apiKey;
  if (!apiKey) {
    apiKey = provider === 'gemini'
      ? process.env.GEMINI_API_KEY
      : process.env.ANTHROPIC_API_KEY;
  }

  if (!apiKey) {
    return {
      success: false,
      description: '',
      provider,
      error: `No API key found for ${provider} vision. Set ${provider === 'gemini' ? 'GEMINI_API_KEY' : 'ANTHROPIC_API_KEY'} environment variable.`,
    };
  }

  console.log(`[Vision] Analyzing image with ${provider}...`);

  if (provider === 'gemini') {
    return analyzeWithGemini(base64Image, apiKey, config.model);
  } else {
    return analyzeWithClaude(base64Image, apiKey, config.model);
  }
}

/**
 * Check if vision analysis is available for a provider
 */
export function isVisionAvailable(provider: AIProvider): boolean {
  if (provider === 'gemini') {
    return !!process.env.GEMINI_API_KEY;
  } else {
    return !!process.env.ANTHROPIC_API_KEY;
  }
}

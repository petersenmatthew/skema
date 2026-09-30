import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { IMAGE_ANALYSIS_PROMPT } from './prompts';

// =============================================================================
// Types
// =============================================================================

export type VisionProvider = 'gemini' | 'claude' | 'openai';

/** Used when no model is chosen. Model lists come live from each provider (see listVisionModels). */
export const DEFAULT_VISION_MODELS: Record<VisionProvider, string> = {
  gemini: 'gemini-flash-lite-latest',
  claude: 'claude-haiku-4-5',
  openai: 'gpt-6-luna',
};

export interface VisionModelInfo {
  id: string;
  name: string;
}

export interface VisionModelList {
  models: VisionModelInfo[];
  /** Where the key came from, or null when the provider has no key */
  keySource: 'settings' | 'env' | null;
  error?: string;
}

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
  const modelId = model || DEFAULT_VISION_MODELS[provider];

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

// =============================================================================
// Live Model Lists
// =============================================================================

// Models that take images but are not chat models (embeddings, speech, image/video generation, etc.)
const NON_CHAT_MODEL = /embedding|tts|image|audio|live|realtime|transcribe|search|computer-use|robotics|veo|imagen|lyria|aqa|translate|research|instruct|codex|moderation|dall-e|whisper/;
const MODEL_LIST_TTL_MS = 10 * 60 * 1000;
const modelListCache = new Map<string, { at: number; models: VisionModelInfo[] }>();

async function fetchJson(url: string, headers: Record<string, string>): Promise<any> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchVisionModels(provider: VisionProvider, apiKey: string): Promise<VisionModelInfo[]> {
  switch (provider) {
    case 'gemini': {
      const data = await fetchJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { 'x-goog-api-key': apiKey });
      return (data.models ?? [])
        .filter((m: any) => m.name?.startsWith('models/gemini') && m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => ({ id: m.name.slice('models/'.length), name: m.displayName || m.name.slice('models/'.length) }))
        .sort((a: VisionModelInfo, b: VisionModelInfo) => b.id.localeCompare(a.id, undefined, { numeric: true }));
    }
    case 'claude': {
      // Already newest first
      const data = await fetchJson('https://api.anthropic.com/v1/models?limit=1000', { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' });
      return (data.data ?? []).map((m: any) => ({ id: m.id, name: m.display_name || m.id }));
    }
    case 'openai': {
      // Skip dated snapshots like gpt-6-luna-2026-09-22; the undated alias is listed too
      const data = await fetchJson('https://api.openai.com/v1/models', { Authorization: `Bearer ${apiKey}` });
      return (data.data ?? [])
        .filter((m: any) => /^(gpt-|o\d)/.test(m.id) && !/-\d{4}-\d{2}-\d{2}$/.test(m.id))
        .sort((a: any, b: any) => b.created - a.created)
        .map((m: any) => ({ id: m.id, name: m.id }));
    }
  }
}

/**
 * List a provider's vision-capable chat models, newest first.
 * Uses the given key, or the provider's env var. Falls back to the default model if the request fails.
 */
export async function listVisionModels(provider: VisionProvider, apiKey?: string): Promise<VisionModelList> {
  const key = apiKey || getEnvVarForProvider(provider);
  if (!key) return { models: [], keySource: null };
  const keySource = apiKey ? 'settings' : 'env';

  const cacheKey = `${provider}:${key}`;
  const cached = modelListCache.get(cacheKey);
  if (cached && Date.now() - cached.at < MODEL_LIST_TTL_MS) return { models: cached.models, keySource };

  try {
    const models = (await fetchVisionModels(provider, key)).filter((m) => !NON_CHAT_MODEL.test(m.id));
    modelListCache.set(cacheKey, { at: Date.now(), models });
    return { models, keySource };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Vision] Could not list ${provider} models:`, message);
    const fallback = DEFAULT_VISION_MODELS[provider];
    return { models: [{ id: fallback, name: fallback }], keySource, error: message };
  }
}

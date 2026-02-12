// =============================================================================
// AI Provider Factory - Direct API implementations
// =============================================================================

import type { AIStreamEvent } from '../ai-provider';

// =============================================================================
// Types
// =============================================================================

/**
 * Execution modes:
 * - 'direct-cli': Annotations processed instantly via CLI agents (gemini/claude CLI tools)
 * - 'direct-api': Annotations processed instantly via API SDKs
 * - 'mcp': Annotations routed through an AI agent (Cursor, Claude Desktop, etc.)
 */
export type ExecutionMode = 'direct-cli' | 'direct-api' | 'mcp';
export type ProviderName = 'gemini' | 'claude' | 'openai';

export interface GenerateOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  cwd?: string;
}

export interface AIProvider {
  name: ProviderName;
  /** Generate code/text with streaming */
  generateStream(prompt: string, options?: GenerateOptions): AsyncIterable<AIStreamEvent>;
  /** Analyze an image with vision */
  analyzeImage(base64Image: string, prompt: string, options?: GenerateOptions): Promise<string>;
  /** Check if this provider is available (has API key) */
  isAvailable(): boolean;
}

export interface ProviderConfig {
  mode: ExecutionMode;
  provider: ProviderName;
  apiKey?: string;
  model?: string;
}

// =============================================================================
// Provider Registry
// =============================================================================

const providers: Map<ProviderName, (apiKey: string) => AIProvider> = new Map();

export function registerProvider(name: ProviderName, factory: (apiKey: string) => AIProvider): void {
  providers.set(name, factory);
}

export function getProvider(name: ProviderName, apiKey?: string): AIProvider | null {
  const factory = providers.get(name);
  if (!factory) return null;
  
  // Get API key from param or environment
  const key = apiKey || getApiKeyFromEnv(name);
  if (!key) return null;
  
  return factory(key);
}

export function getAvailableProviders(): ProviderName[] {
  const available: ProviderName[] = [];
  for (const name of providers.keys()) {
    if (getApiKeyFromEnv(name)) {
      available.push(name);
    }
  }
  return available;
}

export function getApiKeyFromEnv(provider: ProviderName): string | undefined {
  switch (provider) {
    case 'gemini':
      return process.env.GEMINI_API_KEY;
    case 'claude':
      return process.env.ANTHROPIC_API_KEY;
    case 'openai':
      return process.env.OPENAI_API_KEY;
    default:
      return undefined;
  }
}

// =============================================================================
// Helper: Create async iterable from events
// =============================================================================

export function createEventStream(): {
  push: (event: AIStreamEvent) => void;
  end: () => void;
  error: (err: Error) => void;
  stream: AsyncIterable<AIStreamEvent>;
} {
  const queue: AIStreamEvent[] = [];
  let done = false;
  let resolveNext: ((result: IteratorResult<AIStreamEvent>) => void) | null = null;
  let rejectNext: ((err: Error) => void) | null = null;

  const push = (event: AIStreamEvent) => {
    if (resolveNext) {
      resolveNext({ value: event, done: false });
      resolveNext = null;
      rejectNext = null;
    } else {
      queue.push(event);
    }
  };

  const end = () => {
    done = true;
    if (resolveNext) {
      resolveNext({ value: undefined as unknown as AIStreamEvent, done: true });
      resolveNext = null;
      rejectNext = null;
    }
  };

  const error = (err: Error) => {
    if (rejectNext) {
      rejectNext(err);
      resolveNext = null;
      rejectNext = null;
    }
    done = true;
  };

  const stream: AsyncIterable<AIStreamEvent> = {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<AIStreamEvent>> {
          if (queue.length > 0) {
            return Promise.resolve({ value: queue.shift()!, done: false });
          }
          if (done) {
            return Promise.resolve({ value: undefined as unknown as AIStreamEvent, done: true });
          }
          return new Promise((resolve, reject) => {
            resolveNext = resolve;
            rejectNext = reject;
          });
        },
      };
    },
  };

  return { push, end, error, stream };
}

// =============================================================================
// Re-export provider implementations
// =============================================================================

export { createGeminiProvider } from './gemini';
export { createClaudeProvider } from './claude';
export { createOpenAIProvider } from './openai';

// Auto-register providers on import
import { createGeminiProvider } from './gemini';
import { createClaudeProvider } from './claude';
import { createOpenAIProvider } from './openai';

registerProvider('gemini', createGeminiProvider);
registerProvider('claude', createClaudeProvider);
registerProvider('openai', createOpenAIProvider);

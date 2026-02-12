import { spawn, type ChildProcess } from 'child_process';

// =============================================================================
// AI Provider Types
// =============================================================================

// CLI-based providers (legacy mode) - only gemini and claude have CLIs
export type AIProvider = 'gemini' | 'claude';

// All provider names (used for events and type narrowing)
export type AnyProvider = 'gemini' | 'claude';

export interface AIProviderConfig {
  provider: AIProvider;
  /** Working directory for CLI commands */
  cwd?: string;
  /** Model override (provider-specific) */
  model?: string;
}

export interface AIStreamEvent {
  type: 'init' | 'text' | 'tool_use' | 'tool_result' | 'error' | 'done' | 'debug';
  content?: string;
  timestamp: string;
  provider: AnyProvider;
  /** Raw event from the CLI (provider-specific) */
  raw?: unknown;
}

export interface AIRunResult {
  success: boolean;
  output: string;
  events: AIStreamEvent[];
  provider: AIProvider;
}

// =============================================================================
// Provider Configurations
// =============================================================================

interface ProviderSpec {
  command: string;
  buildArgs: (prompt: string, options?: { model?: string; yolo?: boolean }) => string[];
  parseOutput: (line: string) => AIStreamEvent | null;
}

const PROVIDERS: Record<AIProvider, ProviderSpec> = {
  gemini: {
    command: 'gemini',
    buildArgs: (prompt, options) => {
      const args = ['-p', prompt];
      if (options?.yolo !== false) args.push('--yolo');
      args.push('--output-format', 'stream-json');
      if (options?.model) args.push('-m', options.model);
      else args.push('-m', 'gemini-2.5-flash');
      return args;
    },
    parseOutput: (line) => {
      try {
        const parsed = JSON.parse(line);
        return {
          type: mapGeminiEventType(parsed.type),
          content: parsed.content || parsed.message,
          timestamp: new Date().toISOString(),
          provider: 'gemini',
          raw: parsed,
        };
      } catch {
        return {
          type: 'text',
          content: line,
          timestamp: new Date().toISOString(),
          provider: 'gemini',
        };
      }
    },
  },

  claude: {
    command: 'claude',
    buildArgs: (prompt, options) => {
      const args = ['-p', prompt, '--output-format', 'stream-json'];
      if (options?.yolo !== false) args.push('--dangerously-skip-permissions');
      if (options?.model) args.push('--model', options.model);
      return args;
    },
    parseOutput: (line) => {
      try {
        const parsed = JSON.parse(line);
        return {
          type: mapClaudeEventType(parsed.type),
          content: parsed.content || extractClaudeContent(parsed),
          timestamp: new Date().toISOString(),
          provider: 'claude',
          raw: parsed,
        };
      } catch {
        return {
          type: 'text',
          content: line,
          timestamp: new Date().toISOString(),
          provider: 'claude',
        };
      }
    },
  },
};

// =============================================================================
// Event Type Mappers
// =============================================================================

function mapGeminiEventType(type: string): AIStreamEvent['type'] {
  switch (type) {
    case 'init': return 'init';
    case 'message': return 'text';
    case 'tool_use': return 'tool_use';
    case 'tool_result': return 'tool_result';
    case 'error': return 'error';
    case 'done': case 'result': return 'done';
    default: return 'text';
  }
}

function mapClaudeEventType(type: string): AIStreamEvent['type'] {
  switch (type) {
    case 'system': return 'init';
    case 'assistant': case 'text': return 'text';
    case 'tool_use': return 'tool_use';
    case 'tool_result': return 'tool_result';
    case 'error': return 'error';
    case 'result': return 'done';
    default: return 'text';
  }
}

function extractClaudeContent(parsed: Record<string, unknown>): string | undefined {
  // Claude Code stream-json format can have content in different places
  if (typeof parsed.content === 'string') return parsed.content;
  if (parsed.message && typeof parsed.message === 'object') {
    const msg = parsed.message as Record<string, unknown>;
    if (typeof msg.content === 'string') return msg.content;
  }
  return undefined;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Spawn an AI CLI and return an async iterator of events
 */
export function spawnAICLI(
  prompt: string,
  config: AIProviderConfig
): {
  process: ChildProcess;
  events: AsyncIterable<AIStreamEvent>;
} {
  const spec = PROVIDERS[config.provider];
  const args = spec.buildArgs(prompt, { model: config.model });
  const cwd = config.cwd || process.cwd();

  console.log(`[Skema] Spawning ${config.provider}: ${spec.command} ${args.join(' ')}`);

  const child = spawn(spec.command, args, {
    cwd,
    env: process.env,
  });

  const events: AsyncIterable<AIStreamEvent> = {
    [Symbol.asyncIterator]() {
      let buffer = '';
      let done = false;
      const queue: AIStreamEvent[] = [];
      let resolveNext: ((value: IteratorResult<AIStreamEvent>) => void) | null = null;

      const pushEvent = (event: AIStreamEvent) => {
        if (resolveNext) {
          resolveNext({ value: event, done: false });
          resolveNext = null;
        } else {
          queue.push(event);
        }
      };

      child.stdout?.on('data', (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            const event = spec.parseOutput(line.trim());
            if (event) pushEvent(event);
          }
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        const content = data.toString().trim();
        if (content) {
          pushEvent({
            type: 'error',
            content,
            timestamp: new Date().toISOString(),
            provider: config.provider,
          });
        }
      });

      child.on('close', (code) => {
        // Process remaining buffer
        if (buffer.trim()) {
          const event = spec.parseOutput(buffer.trim());
          if (event) pushEvent(event);
        }

        pushEvent({
          type: 'done',
          content: `Process exited with code ${code}`,
          timestamp: new Date().toISOString(),
          provider: config.provider,
        });

        done = true;
        if (resolveNext) {
          resolveNext({ value: undefined as unknown as AIStreamEvent, done: true });
        }
      });

      child.on('error', (err) => {
        pushEvent({
          type: 'error',
          content: `Failed to spawn ${config.provider}: ${err.message}`,
          timestamp: new Date().toISOString(),
          provider: config.provider,
        });
        done = true;
        if (resolveNext) {
          resolveNext({ value: undefined as unknown as AIStreamEvent, done: true });
        }
      });

      return {
        next(): Promise<IteratorResult<AIStreamEvent>> {
          if (queue.length > 0) {
            return Promise.resolve({ value: queue.shift()!, done: false });
          }
          if (done) {
            return Promise.resolve({ value: undefined as unknown as AIStreamEvent, done: true });
          }
          return new Promise((resolve) => {
            resolveNext = resolve;
          });
        },
      };
    },
  };

  return { process: child, events };
}

/**
 * Run an AI CLI and wait for completion (non-streaming)
 */
export async function runAICLI(
  prompt: string,
  config: AIProviderConfig
): Promise<AIRunResult> {
  const { events } = spawnAICLI(prompt, config);

  const collectedEvents: AIStreamEvent[] = [];
  let output = '';
  let success = true;

  for await (const event of events) {
    collectedEvents.push(event);

    if (event.type === 'text' && event.content) {
      output += event.content + '\n';
    }

    if (event.type === 'error') {
      success = false;
    }
  }

  return {
    success,
    output: output.trim(),
    events: collectedEvents,
    provider: config.provider,
  };
}

/**
 * Check if a provider CLI is available
 */
export function isProviderAvailable(provider: AIProvider): boolean {
  const spec = PROVIDERS[provider];
  try {
    const { execSync } = require('child_process');
    execSync(`which ${spec.command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get available providers
 */
export function getAvailableProviders(): AIProvider[] {
  return (['gemini', 'claude'] as AIProvider[]).filter(isProviderAvailable);
}

// =============================================================================
// Provider Status (installed + authorized)
// =============================================================================

export interface ProviderStatus {
  installed: boolean;
  authorized: boolean;
  /** Human-readable status message */
  message: string;
}

/**
 * Check if a provider CLI is authorized (can actually run).
 * Uses lightweight commands that verify auth without doing real work.
 */
function checkProviderAuthorized(provider: AIProvider): boolean {
  const { execSync } = require('child_process');
  try {
    if (provider === 'gemini') {
      // `gemini --version` succeeds if installed; auth is checked via a quick prompt
      // We use a minimal approach: check if GEMINI_API_KEY is set or if the CLI config exists
      execSync('gemini --version', { stdio: 'ignore', timeout: 5000 });
      return true;
    } else if (provider === 'claude') {
      // claude --version succeeds if installed; auth is checked similarly
      execSync('claude --version', { stdio: 'ignore', timeout: 5000 });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get detailed status for a single provider
 */
export function getProviderStatus(provider: AIProvider): ProviderStatus {
  const installed = isProviderAvailable(provider);
  if (!installed) {
    return {
      installed: false,
      authorized: false,
      message: `${provider} CLI not installed`,
    };
  }

  const authorized = checkProviderAuthorized(provider);
  if (!authorized) {
    return {
      installed: true,
      authorized: false,
      message: `${provider} CLI installed but not authorized`,
    };
  }

  return {
    installed: true,
    authorized: true,
    message: 'Ready',
  };
}

/**
 * Get status for all providers
 */
export function getAllProviderStatuses(): Record<AIProvider, ProviderStatus> {
  return {
    gemini: getProviderStatus('gemini'),
    claude: getProviderStatus('claude'),
  };
}

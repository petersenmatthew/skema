import { spawn, execSync, type ChildProcess } from 'child_process';
import type { Annotation } from '../types';

// Store annotation ID -> git stash ref for undo functionality
const annotationSnapshots = new Map<string, string>();

/**
 * Create a git snapshot before making changes (for undo support)
 */
function createSnapshot(annotationId: string, cwd: string): string | null {
  try {
    // Create a stash-like commit object without actually stashing
    // This captures the current working directory state
    const stashRef = execSync('git stash create', { cwd, encoding: 'utf-8' }).trim();

    if (stashRef) {
      annotationSnapshots.set(annotationId, stashRef);
      console.log(`[Skema] Created snapshot ${stashRef.slice(0, 7)} for annotation ${annotationId}`);
      return stashRef;
    }

    // If stash create returns empty, there are no changes to snapshot
    // Store current HEAD instead
    const headRef = execSync('git rev-parse HEAD', { cwd, encoding: 'utf-8' }).trim();
    annotationSnapshots.set(annotationId, headRef);
    console.log(`[Skema] Using HEAD ${headRef.slice(0, 7)} for annotation ${annotationId}`);
    return headRef;
  } catch (error) {
    console.error('[Skema] Failed to create snapshot:', error);
    return null;
  }
}

/**
 * Revert changes for an annotation by restoring from snapshot
 */
export function revertAnnotation(annotationId: string, cwd: string = process.cwd()): { success: boolean; message: string } {
  const snapshotRef = annotationSnapshots.get(annotationId);

  if (!snapshotRef) {
    return { success: false, message: `No snapshot found for annotation ${annotationId}` };
  }

  try {
    // Get list of modified files since the snapshot
    const changedFiles = execSync(`git diff --name-only ${snapshotRef}`, { cwd, encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean);

    if (changedFiles.length === 0) {
      annotationSnapshots.delete(annotationId);
      return { success: true, message: 'No changes to revert' };
    }

    // Restore each changed file from the snapshot
    for (const file of changedFiles) {
      try {
        execSync(`git checkout ${snapshotRef} -- "${file}"`, { cwd, encoding: 'utf-8' });
        console.log(`[Skema] Reverted: ${file}`);
      } catch {
        // File might not exist in snapshot (new file), so delete it
        try {
          execSync(`git checkout HEAD -- "${file}"`, { cwd, encoding: 'utf-8' });
        } catch {
          // Ignore if file doesn't exist
        }
      }
    }

    annotationSnapshots.delete(annotationId);
    console.log(`[Skema] Reverted ${changedFiles.length} file(s) for annotation ${annotationId}`);
    return { success: true, message: `Reverted ${changedFiles.length} file(s)` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Skema] Failed to revert:', message);
    return { success: false, message };
  }
}

/**
 * Get all tracked annotation IDs
 */
export function getTrackedAnnotations(): string[] {
  return Array.from(annotationSnapshots.keys());
}

export interface GeminiCLIOptions {
  /** Working directory for Gemini CLI */
  cwd?: string;
  /** API key (defaults to GEMINI_API_KEY env var) */
  apiKey?: string;
  /** Auto-approve all tool calls (default: true) */
  yolo?: boolean;
  /** Output format (default: 'stream-json') */
  outputFormat?: 'text' | 'json' | 'stream-json';
  /** Model to use (default: 'gemini-2.5-flash' for speed) */
  model?: string;
  /** Use minimal/fast prompt (default: true) */
  fastMode?: boolean;
}

export interface ProjectContext {
  pathname?: string;
  viewport?: { width: number; height: number };
}

export interface GeminiCLIEvent {
  type: 'init' | 'message' | 'tool_use' | 'tool_result' | 'error' | 'result' | 'done';
  timestamp?: string;
  content?: string;
  role?: 'user' | 'assistant';
  tool_name?: string;
  tool_id?: string;
  status?: 'success' | 'error';
  code?: number;
  [key: string]: unknown;
}

/**
 * Build a prompt for Gemini CLI from an annotation
 */
export function buildPromptFromAnnotation(
  annotation: Partial<Annotation> & { comment?: string },
  projectContext?: ProjectContext,
  options?: { fastMode?: boolean }
): string {
  const fastMode = options?.fastMode ?? true;

  // Fast mode: minimal prompt for quick changes
  if (fastMode) {
    const selector = (annotation as { selector?: string }).selector || '';
    const text = (annotation as { text?: string }).text || '';
    const tag = (annotation as { tagName?: string }).tagName?.toLowerCase() || '';

    // Build a very concise prompt
    let target = '';
    if (text) {
      target = `"${text.slice(0, 50)}"`;
    } else if (selector) {
      target = `\`${selector}\``;
    } else if (tag) {
      target = `<${tag}>`;
    }

    return `${annotation.comment}${target ? ` (target: ${target})` : ''}. Make the change directly, no explanation needed.`;
  }

  // Detailed mode: full context
  let prompt = `Make this code change: "${annotation.comment || 'No specific comment provided'}"

Element: `;

  if (annotation.type === 'dom_selection') {
    const domAnnotation = annotation as {
      tagName?: string;
      selector?: string;
      elementPath?: string;
      text?: string;
      cssClasses?: string;
      attributes?: Record<string, string>;
      elements?: Array<{
        tagName: string;
        selector: string;
        elementPath: string;
        text?: string;
      }>;
    };

    prompt += `<${domAnnotation.tagName?.toLowerCase() || 'unknown'}>`;
    if (domAnnotation.selector) prompt += ` | selector: ${domAnnotation.selector}`;
    if (domAnnotation.text) prompt += ` | text: "${domAnnotation.text.slice(0, 100)}"`;

    if (domAnnotation.elements && domAnnotation.elements.length > 1) {
      prompt += `\n${domAnnotation.elements.length} elements selected`;
    }
  } else if (annotation.type === 'drawing') {
    prompt += `drawing area at (${annotation.boundingBox?.x}, ${annotation.boundingBox?.y})`;
  }

  prompt += `\n\nMake minimal changes. No explanation needed.`;

  return prompt;
}

/**
 * Spawn Gemini CLI and return an async iterator of events
 */
export function spawnGeminiCLI(
  prompt: string,
  options: GeminiCLIOptions = {}
): {
  process: ChildProcess;
  events: AsyncIterable<GeminiCLIEvent>;
} {
  const {
    cwd = process.cwd(),
    apiKey = process.env.GEMINI_API_KEY,
    yolo = true,
    outputFormat = 'stream-json',
    model = 'gemini-2.5-flash',
  } = options;

  const args = ['-p', prompt];

  if (yolo) {
    args.push('--yolo');
  }

  args.push('--output-format', outputFormat);
  args.push('-m', model);

  const gemini = spawn('gemini', args, {
    cwd,
    env: {
      ...process.env,
      ...(apiKey ? { GEMINI_API_KEY: apiKey } : {}),
    },
  });

  const events: AsyncIterable<GeminiCLIEvent> = {
    [Symbol.asyncIterator]() {
      let buffer = '';
      let done = false;
      const queue: GeminiCLIEvent[] = [];
      let resolveNext: ((value: IteratorResult<GeminiCLIEvent>) => void) | null = null;

      const pushEvent = (event: GeminiCLIEvent) => {
        if (resolveNext) {
          resolveNext({ value: event, done: false });
          resolveNext = null;
        } else {
          queue.push(event);
        }
      };

      gemini.stdout.on('data', (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const event = JSON.parse(line) as GeminiCLIEvent;
              pushEvent(event);
            } catch {
              // Raw output, wrap it
              pushEvent({ type: 'message', content: line });
            }
          }
        }
      });

      gemini.stderr.on('data', (data: Buffer) => {
        pushEvent({ type: 'error', content: data.toString() });
      });

      gemini.on('close', (code) => {
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer) as GeminiCLIEvent;
            pushEvent(event);
          } catch {
            pushEvent({ type: 'message', content: buffer });
          }
        }
        pushEvent({ type: 'done', code: code ?? 0 });
        done = true;
        if (resolveNext) {
          resolveNext({ value: undefined as unknown as GeminiCLIEvent, done: true });
        }
      });

      gemini.on('error', (err) => {
        pushEvent({ type: 'error', content: err.message });
        done = true;
        if (resolveNext) {
          resolveNext({ value: undefined as unknown as GeminiCLIEvent, done: true });
        }
      });

      return {
        next(): Promise<IteratorResult<GeminiCLIEvent>> {
          if (queue.length > 0) {
            return Promise.resolve({ value: queue.shift()!, done: false });
          }
          if (done) {
            return Promise.resolve({ value: undefined as unknown as GeminiCLIEvent, done: true });
          }
          return new Promise((resolve) => {
            resolveNext = resolve;
          });
        },
      };
    },
  };

  return { process: gemini, events };
}

/**
 * Create a streaming response for use in API routes (Next.js, Express, etc.)
 */
export function createGeminiCLIStream(
  annotation: Partial<Annotation> & { comment?: string },
  projectContext?: ProjectContext,
  options?: GeminiCLIOptions
): ReadableStream<Uint8Array> {
  const prompt = buildPromptFromAnnotation(annotation, projectContext, { fastMode: options?.fastMode ?? true });
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const { events } = spawnGeminiCLI(prompt, options);

      for await (const event of events) {
        const sseData = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(sseData));

        if (event.type === 'done') {
          controller.close();
          break;
        }
      }
    },
  });
}

/**
 * Run Gemini CLI and wait for completion
 */
export async function runGeminiCLI(
  annotation: Partial<Annotation> & { comment?: string },
  projectContext?: ProjectContext,
  options?: GeminiCLIOptions
): Promise<{
  success: boolean;
  response: string;
  events: GeminiCLIEvent[];
}> {
  const prompt = buildPromptFromAnnotation(annotation, projectContext, { fastMode: options?.fastMode ?? true });
  const { events: eventIterator } = spawnGeminiCLI(prompt, options);

  const events: GeminiCLIEvent[] = [];
  let response = '';
  let success = true;

  for await (const event of eventIterator) {
    events.push(event);

    if (event.type === 'message' && event.role === 'assistant' && event.content) {
      response += event.content;
    }

    if (event.type === 'done' && event.code !== 0) {
      success = false;
    }
  }

  return { success, response, events };
}

// =============================================================================
// Next.js Route Handler - can be directly re-exported
// =============================================================================

/**
 * Next.js App Router POST handler for Gemini CLI
 *
 * Usage in your app/api/gemini/route.ts:
 * ```typescript
 * export { POST, DELETE } from 'skema-core/server';
 * ```
 *
 * Or with custom options:
 * ```typescript
 * import { createGeminiRouteHandler, createRevertRouteHandler } from 'skema-core/server';
 * export const POST = createGeminiRouteHandler({ cwd: '/custom/path' });
 * export const DELETE = createRevertRouteHandler({ cwd: '/custom/path' });
 * ```
 */
export function createGeminiRouteHandler(defaultOptions?: GeminiCLIOptions) {
  return async function POST(request: Request): Promise<Response> {
    const { annotation, projectContext } = await request.json();
    const cwd = defaultOptions?.cwd ?? process.cwd();

    // Create snapshot for undo support (using annotation.id if available)
    const annotationId = annotation.id || `temp-${Date.now()}`;
    createSnapshot(annotationId, cwd);

    const stream = createGeminiCLIStream(annotation, projectContext, {
      cwd,
      ...defaultOptions,
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Annotation-Id': annotationId,
      },
    });
  };
}

/**
 * Next.js App Router DELETE handler for reverting Gemini changes
 */
export function createRevertRouteHandler(defaultOptions?: { cwd?: string }) {
  return async function DELETE(request: Request): Promise<Response> {
    const { annotationId } = await request.json();
    const cwd = defaultOptions?.cwd ?? process.cwd();

    if (!annotationId) {
      return new Response(JSON.stringify({ success: false, message: 'Missing annotationId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = revertAnnotation(annotationId, cwd);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

/**
 * Default POST handler - ready to use in Next.js App Router
 *
 * Usage:
 * ```typescript
 * // app/api/gemini/route.ts
 * export { POST, DELETE } from 'skema-core/server';
 * ```
 */
export const POST = createGeminiRouteHandler();
export const DELETE = createRevertRouteHandler();

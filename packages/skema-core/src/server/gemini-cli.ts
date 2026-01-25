import { spawn, execSync, type ChildProcess } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Annotation, NearbyElement, ProjectStyleContext, ViewportInfo } from '../types';
import { getGridCellReference } from '../lib/utils';

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
  type: 'init' | 'message' | 'tool_use' | 'tool_result' | 'error' | 'result' | 'done' | 'debug';
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
  options?: { fastMode?: boolean; visionDescription?: string }
): string {
  const fastMode = options?.fastMode ?? true;

  // Handle drawing annotations specially - they generate new components
  if (annotation.type === 'drawing') {
    return buildDrawingPrompt(annotation, projectContext, options?.visionDescription);
  }

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
  } else if (annotation.type === 'gesture') {
    const gestureAnnotation = annotation as { gesture?: string; boundingBox?: { x: number; y: number } };
    prompt += `gesture: ${gestureAnnotation.gesture || 'unknown'} at (${gestureAnnotation.boundingBox?.x}, ${gestureAnnotation.boundingBox?.y})`;
  } else {
    // Fallback for any other annotation type
    prompt += `annotation at (${annotation.boundingBox?.x}, ${annotation.boundingBox?.y})`;
  }

  prompt += `\n\nMake minimal changes. No explanation needed.`;

  return prompt;
}

/**
 * Build a specialized prompt for drawing annotations to generate React components
 */
function buildDrawingPrompt(
  annotation: Partial<Annotation> & { comment?: string },
  projectContext?: ProjectContext,
  visionDescription?: string
): string {
  const drawingAnnotation = annotation as {
    boundingBox?: { x: number; y: number; width: number; height: number };
    drawingSvg?: string;
    drawingImage?: string;
    extractedText?: string;
    gridConfig?: { color: string; size: number; labels: boolean };
    viewport?: ViewportInfo;
    projectStyles?: ProjectStyleContext;
    nearbyElements?: NearbyElement[];
    comment?: string;
  };

  const bbox = drawingAnnotation.boundingBox;
  const nearbyElements = drawingAnnotation.nearbyElements || [];
  const extractedText = drawingAnnotation.extractedText;
  const comment = drawingAnnotation.comment || 'Create a component based on this drawing';
  const hasImage = !!drawingAnnotation.drawingImage;
  const gridSize = drawingAnnotation.gridConfig?.size || 100;

  // Build grid cell reference for positioning
  let gridCellRef = '';
  if (bbox) {
    gridCellRef = getGridCellReference(bbox.x, bbox.y, gridSize);
  }

  // Build position context - focus on relative positioning, not absolute values
  let positionContext = '';
  if (bbox && drawingAnnotation.viewport) {
    const vp = drawingAnnotation.viewport;
    const relX = ((bbox.x / vp.width) * 100).toFixed(1);
    const relY = ((bbox.y / vp.height) * 100).toFixed(1);
    positionContext = `**Drawing Location:** Approximately ${relX}% from left, ${relY}% from top of viewport`;
    if (gridCellRef) {
      positionContext += ` (grid cell ${gridCellRef})`;
    }
  } else if (bbox) {
    positionContext = `**Drawing Area:** ${Math.round(bbox.width)}×${Math.round(bbox.height)}px`;
  }

  // Build nearby elements context with style info
  let nearbyContext = '';
  if (nearbyElements.length > 0) {
    const elementList = nearbyElements
      .slice(0, 5)
      .map(el => {
        let desc = `- <${el.tagName.toLowerCase()}>`;
        if (el.text) desc += `: "${el.text.slice(0, 50)}"`;
        if (el.className) desc += ` (class: ${el.className.slice(0, 50)})`;
        desc += ` (${el.selector})`;
        return desc;
      })
      .join('\n');
    nearbyContext = `\n**Nearby DOM Elements (for placement reference):**\n${elementList}`;
  }

  // Build text extraction context
  let textContext = '';
  if (extractedText && extractedText.trim()) {
    textContext = `\n**Text found in drawing (use as reference if hard to read):**\n${extractedText}`;
  }

  // Image reference note
  let imageNote = hasImage
    ? '\n**[Drawing image provided as base64 PNG with labeled grid overlay]**'
    : '';

  if (visionDescription) {
    imageNote += `\n\n## Visual Analysis of Drawing\n${visionDescription}`;
  }

  // Construct the comprehensive prompt - Principal Front-End Engineer persona
  // IMPORTANT: Do NOT focus on pixel coordinates or absolute positioning
  const prompt = `You are a Principal Front-End Engineer with expertise in React and modern web development. Your task is to interpret a user's sketch/wireframe and create a polished, production-ready React component.

## User's Request
"${comment}"

## Drawing Context
${positionContext}${textContext}${nearbyContext}${imageNote}

## Your Process
1. **Analyze the Sketch:** Understand the visual intent—what UI component does the user want?
2. **Interpret, Don't Transcribe:** Elevate the low-fidelity drawing into a high-fidelity component. Choose appropriate spacing, colors, and typography that match modern design standards.
3. **Infer Missing Details:** If something is underspecified, use your expertise to make the best choice. An informed decision is better than an incomplete component.

## Implementation Guidelines
- Create a React component with inline styles or Tailwind CSS classes
- Do NOT use hardcoded pixel positions or absolute coordinates - integrate naturally with existing page flow
- Use flexbox, grid, or relative positioning to place the component appropriately
- If the sketch shows:
  - **Rectangle/box:** Card, container, button, or input field depending on context
  - **Text elements:** Headings, paragraphs, or labels with appropriate hierarchy
  - **Form layout:** Input fields with labels, proper spacing
  - **Icons/shapes:** Use appropriate icons from lucide-react or inline SVGs
  - **Navigation:** Nav links, menus, or breadcrumbs
  - **Lists:** Ordered/unordered lists or grid layouts
- Make the component fit naturally with the existing page design
- Use semantic HTML and ARIA attributes where appropriate
- The component should integrate well with the existing codebase structure

## Annotations
- Any **red marks** in the drawing are instructions—follow them but don't render them
- Text annotations describe intent or constraints

Make the changes directly. Insert the component at the appropriate location in the page. No explanation needed.`;

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
 * Analyze an image using the Google Generative AI SDK (Gemini Vision)
 */
async function analyzeImageWithGemini(apiKey: string, base64Image: string, modelName: string = 'gemini-2.5-flash'): Promise<string> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    // Clean base64 string if needed (remove data URI prefix)
    const imageParts = [
      {
        inlineData: {
          data: base64Image.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: 'image/png',
        },
      },
    ];

    const result = await model.generateContent([
      "Analyze this UI wireframe sketch in extreme detail for a front-end developer. Describe every element, layout, spacing, icons, and text you see. Mention relative positions and hierarchy. Be distinct about what is drawn vs what might be background. Do NOT focus on exact pixel coordinates or absolute positions - describe layouts in terms of relative positioning (left/right/top/bottom, centered, evenly spaced, etc.).",
      ...imageParts,
    ]);

    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error('Failed to analyze image with Gemini Vision:', error);
    return `[Extension Error] Failed to analyze drawing: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Create a streaming response for use in API routes (Next.js, Express, etc.)
 */
export function createGeminiCLIStream(
  annotation: Partial<Annotation> & { comment?: string },
  projectContext?: ProjectContext,
  options?: GeminiCLIOptions
): ReadableStream<Uint8Array> {
  // We need to handle the prompt building inside logic because it might be async now
  // But ReadableStream start controller can be async
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const apiKey = options?.apiKey || process.env.GEMINI_API_KEY;
      let visionDescription = '';

      // Perform Image Analysis if needed for drawing annotations with images
      if (annotation.type === 'drawing' && (annotation as { drawingImage?: string }).drawingImage && apiKey) {
        // Send a "progress" event to the client
        const progressEvent: GeminiCLIEvent = {
          type: 'message',
          role: 'assistant',
          content: '🎨 Analyzing drawing image with Gemini Vision...',
          timestamp: new Date().toISOString()
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressEvent)}\n\n`));

        visionDescription = await analyzeImageWithGemini(
          apiKey,
          (annotation as { drawingImage: string }).drawingImage,
          options?.model || 'gemini-2.5-flash'
        );

        // Log the analysis result
        const analysisEvent: GeminiCLIEvent = {
          type: 'message',
          role: 'assistant',
          content: `👁️ Visual Analysis:\n${visionDescription}`,
          timestamp: new Date().toISOString()
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(analysisEvent)}\n\n`));
      }

      const prompt = buildPromptFromAnnotation(
        annotation,
        projectContext,
        {
          fastMode: options?.fastMode ?? false,
          visionDescription
        }
      );

      // Send the prompt as a debug event so it shows up in browser console
      const promptEvent: GeminiCLIEvent = {
        type: 'debug',
        content: prompt,
        label: 'GEMINI CLI PROMPT',
        timestamp: new Date().toISOString()
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(promptEvent)}\n\n`));

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
  const apiKey = options?.apiKey || process.env.GEMINI_API_KEY;
  let visionDescription = '';

  // Perform Image Analysis if needed for drawing annotations with images
  if (annotation.type === 'drawing' && (annotation as { drawingImage?: string }).drawingImage && apiKey) {
    visionDescription = await analyzeImageWithGemini(
      apiKey,
      (annotation as { drawingImage: string }).drawingImage,
      options?.model || 'gemini-2.5-flash'
    );
  }

  const prompt = buildPromptFromAnnotation(
    annotation,
    projectContext,
    {
      fastMode: options?.fastMode ?? false,
      visionDescription
    }
  );

  // Note: For runGeminiCLI (non-streaming), logs are not sent to browser
  // Use createGeminiCLIStream for browser console logging
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

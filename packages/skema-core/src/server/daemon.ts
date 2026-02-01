import { WebSocketServer, WebSocket } from 'ws';
import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  type AIProvider,
  type AIProviderConfig,
  spawnAICLI,
  isProviderAvailable,
  getAvailableProviders,
} from './ai-provider';
import { buildPromptFromAnnotation, type ProjectContext } from './gemini-cli';
import { analyzeImage, isVisionAvailable } from './vision';
import type { Annotation } from '../types';

// =============================================================================
// Types
// =============================================================================

export interface DaemonConfig {
  /** Port for WebSocket server (default: 9999) */
  port?: number;
  /** Working directory for file operations and AI commands */
  cwd?: string;
  /** Default AI provider */
  defaultProvider?: AIProvider;
}

export interface IncomingMessage {
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface OutgoingMessage {
  id?: string;
  type: string;
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

// =============================================================================
// Daemon State
// =============================================================================

let currentProvider: AIProvider = 'gemini';
let workingDirectory: string = process.cwd();

// Store annotation snapshots for undo (same as gemini-cli.ts)
const annotationSnapshots = new Map<string, string>();

// =============================================================================
// Git Snapshot Functions (for undo support)
// =============================================================================

function createSnapshot(annotationId: string): string | null {
  try {
    const stashRef = execSync('git stash create', { cwd: workingDirectory, encoding: 'utf-8' }).trim();
    if (stashRef) {
      annotationSnapshots.set(annotationId, stashRef);
      console.log(`[Daemon] Created snapshot ${stashRef.slice(0, 7)} for ${annotationId}`);
      return stashRef;
    }
    const headRef = execSync('git rev-parse HEAD', { cwd: workingDirectory, encoding: 'utf-8' }).trim();
    annotationSnapshots.set(annotationId, headRef);
    return headRef;
  } catch (error) {
    console.error('[Daemon] Failed to create snapshot:', error);
    return null;
  }
}

function revertSnapshot(annotationId: string): { success: boolean; message: string } {
  const snapshotRef = annotationSnapshots.get(annotationId);
  if (!snapshotRef) {
    return { success: false, message: `No snapshot found for ${annotationId}` };
  }

  try {
    const changedFiles = execSync(`git diff --name-only ${snapshotRef}`, {
      cwd: workingDirectory,
      encoding: 'utf-8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);

    if (changedFiles.length === 0) {
      annotationSnapshots.delete(annotationId);
      return { success: true, message: 'No changes to revert' };
    }

    for (const file of changedFiles) {
      try {
        execSync(`git checkout ${snapshotRef} -- "${file}"`, { cwd: workingDirectory });
      } catch {
        // File might be new, try removing it
      }
    }

    annotationSnapshots.delete(annotationId);
    return { success: true, message: `Reverted ${changedFiles.length} file(s)` };
  } catch (error) {
    return { success: false, message: String(error) };
  }
}

// =============================================================================
// Message Handlers
// =============================================================================

type MessageHandler = (
  msg: IncomingMessage,
  ws: WebSocket
) => Promise<OutgoingMessage | void>;

const handlers: Record<string, MessageHandler> = {
  // -------------------------------------------------------------------------
  // Provider Management
  // -------------------------------------------------------------------------
  'get-provider': async (msg) => {
    return {
      id: msg.id,
      type: 'provider',
      provider: currentProvider,
      available: getAvailableProviders(),
    };
  },

  'set-provider': async (msg) => {
    const newProvider = msg.provider as AIProvider;
    if (!['gemini', 'claude'].includes(newProvider)) {
      return { id: msg.id, type: 'error', error: `Invalid provider: ${newProvider}` };
    }
    if (!isProviderAvailable(newProvider)) {
      return {
        id: msg.id,
        type: 'error',
        error: `Provider "${newProvider}" is not installed. Run: ${newProvider === 'gemini' ? 'npm install -g @anthropic-ai/gemini-cli' : 'npm install -g @anthropic-ai/claude-code'}`,
      };
    }
    currentProvider = newProvider;
    console.log(`[Daemon] Switched to provider: ${currentProvider}`);
    return { id: msg.id, type: 'provider-changed', provider: currentProvider };
  },

  // -------------------------------------------------------------------------
  // AI Generation (streaming)
  // -------------------------------------------------------------------------
  generate: async (msg, ws) => {
    const annotation = msg.annotation as Partial<Annotation> & { comment?: string };
    const projectContext = msg.projectContext as ProjectContext | undefined;
    const annotationId = (annotation as { id?: string }).id || `temp-${Date.now()}`;

    // Create snapshot for undo
    createSnapshot(annotationId);

    // Check if this is a drawing annotation with an image
    let visionDescription = '';
    const drawingAnnotation = annotation as { drawingImage?: string };

    if (annotation.type === 'drawing' && drawingAnnotation.drawingImage) {
      // Always use Gemini for vision analysis (Claude Code CLI doesn't need API key,
      // but Claude SDK for vision would need ANTHROPIC_API_KEY - simpler to just use Gemini)
      if (isVisionAvailable('gemini')) {
        sendMessage(ws, {
          id: msg.id,
          type: 'ai-event',
          event: {
            type: 'text',
            content: `[Analyzing drawing with Gemini vision...]`,
            timestamp: new Date().toISOString(),
            provider: currentProvider,
          },
        });

        const visionResult = await analyzeImage(drawingAnnotation.drawingImage, {
          provider: 'gemini',
        });

        if (visionResult.success) {
          visionDescription = visionResult.description;
          sendMessage(ws, {
            id: msg.id,
            type: 'ai-event',
            event: {
              type: 'text',
              content: `[Vision analysis complete]\n${visionDescription}`,
              timestamp: new Date().toISOString(),
              provider: currentProvider,
            },
          });
        } else {
          sendMessage(ws, {
            id: msg.id,
            type: 'ai-event',
            event: {
              type: 'error',
              content: `Vision analysis failed: ${visionResult.error}`,
              timestamp: new Date().toISOString(),
              provider: currentProvider,
            },
          });
        }
      } else {
        sendMessage(ws, {
          id: msg.id,
          type: 'ai-event',
          event: {
            type: 'text',
            content: `[Vision not available - set GEMINI_API_KEY for image analysis]`,
            timestamp: new Date().toISOString(),
            provider: currentProvider,
          },
        });
      }
    }

    // Build prompt using existing logic (with vision description if available)
    const prompt = buildPromptFromAnnotation(annotation, projectContext, {
      fastMode: msg.fastMode !== false,
      visionDescription,
    });

    // Send prompt as debug event
    sendMessage(ws, {
      id: msg.id,
      type: 'ai-event',
      event: {
        type: 'debug',
        content: prompt,
        timestamp: new Date().toISOString(),
        provider: currentProvider,
      },
    });

    const config: AIProviderConfig = {
      provider: currentProvider,
      cwd: workingDirectory,
      model: msg.model as string | undefined,
    };

    const { process: aiProcess, events } = spawnAICLI(prompt, config);

    // Stream events back
    for await (const event of events) {
      sendMessage(ws, {
        id: msg.id,
        type: 'ai-event',
        event,
        annotationId,
      });

      if (event.type === 'done') {
        sendMessage(ws, {
          id: msg.id,
          type: 'generate-complete',
          success: true,
          annotationId,
          provider: currentProvider,
        });
        break;
      }
    }
  },

  // -------------------------------------------------------------------------
  // Undo/Revert
  // -------------------------------------------------------------------------
  revert: async (msg) => {
    const annotationId = msg.annotationId as string;
    if (!annotationId) {
      return { id: msg.id, type: 'error', error: 'Missing annotationId' };
    }
    const result = revertSnapshot(annotationId);
    return { id: msg.id, type: 'revert-result', ...result };
  },

  // -------------------------------------------------------------------------
  // File Operations
  // -------------------------------------------------------------------------
  'read-file': async (msg) => {
    const filePath = msg.path as string;
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(workingDirectory, filePath);

    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      return { id: msg.id, type: 'file-content', path: filePath, content };
    } catch (error) {
      return { id: msg.id, type: 'error', error: `Failed to read file: ${error}` };
    }
  },

  'write-file': async (msg) => {
    const filePath = msg.path as string;
    const content = msg.content as string;
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(workingDirectory, filePath);

    try {
      // Ensure directory exists
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, content, 'utf-8');
      console.log(`[Daemon] Wrote file: ${filePath}`);
      return { id: msg.id, type: 'write-success', path: filePath };
    } catch (error) {
      return { id: msg.id, type: 'error', error: `Failed to write file: ${error}` };
    }
  },

  'list-files': async (msg) => {
    const dirPath = (msg.path as string) || '.';
    const absolutePath = path.isAbsolute(dirPath)
      ? dirPath
      : path.join(workingDirectory, dirPath);

    try {
      const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
      const files = entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
      }));
      return { id: msg.id, type: 'file-list', path: dirPath, files };
    } catch (error) {
      return { id: msg.id, type: 'error', error: `Failed to list files: ${error}` };
    }
  },

  // -------------------------------------------------------------------------
  // Command Execution
  // -------------------------------------------------------------------------
  'run-command': async (msg, ws) => {
    const command = msg.command as string;
    if (!command) {
      return { id: msg.id, type: 'error', error: 'Missing command' };
    }

    console.log(`[Daemon] Running command: ${command}`);

    return new Promise((resolve) => {
      exec(command, { cwd: workingDirectory }, (error, stdout, stderr) => {
        resolve({
          id: msg.id,
          type: 'command-result',
          stdout,
          stderr,
          exitCode: error ? error.code : 0,
        });
      });
    });
  },

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------
  ping: async (msg) => {
    return {
      id: msg.id,
      type: 'pong',
      provider: currentProvider,
      cwd: workingDirectory,
      availableProviders: getAvailableProviders(),
    };
  },
};

// =============================================================================
// WebSocket Helpers
// =============================================================================

function sendMessage(ws: WebSocket, message: OutgoingMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function handleConnection(ws: WebSocket) {
  console.log('[Daemon] Client connected');

  // Send initial state
  sendMessage(ws, {
    type: 'connected',
    provider: currentProvider,
    cwd: workingDirectory,
    availableProviders: getAvailableProviders(),
  });

  ws.on('message', async (data) => {
    let msg: IncomingMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      sendMessage(ws, { type: 'error', error: 'Invalid JSON' });
      return;
    }

    const handler = handlers[msg.type];
    if (!handler) {
      sendMessage(ws, { id: msg.id, type: 'error', error: `Unknown message type: ${msg.type}` });
      return;
    }

    try {
      const response = await handler(msg, ws);
      if (response) {
        sendMessage(ws, response);
      }
    } catch (error) {
      sendMessage(ws, {
        id: msg.id,
        type: 'error',
        error: `Handler error: ${error}`,
      });
    }
  });

  ws.on('close', () => {
    console.log('[Daemon] Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('[Daemon] WebSocket error:', error);
  });
}

// =============================================================================
// Main Daemon Function
// =============================================================================

export interface DaemonInstance {
  port: number;
  close: () => void;
}

/**
 * Start the Skema daemon (WebSocket server)
 */
export function startDaemon(config: DaemonConfig = {}): DaemonInstance {
  const port = config.port ?? 9999;
  workingDirectory = config.cwd ?? process.cwd();
  currentProvider = config.defaultProvider ?? 'gemini';

  // Check if default provider is available, fall back if not
  if (!isProviderAvailable(currentProvider)) {
    const available = getAvailableProviders();
    if (available.length > 0) {
      console.log(`[Daemon] ${currentProvider} not found, falling back to ${available[0]}`);
      currentProvider = available[0];
    } else {
      console.warn('[Daemon] Warning: No AI providers found. Install gemini or claude CLI.');
    }
  }

  const wss = new WebSocketServer({ port });

  wss.on('connection', handleConnection);

  wss.on('listening', () => {
    console.log('');
    console.log('  ┌─────────────────────────────────────────────────┐');
    console.log('  │                                                 │');
    console.log(`  │   🎨 Skema Daemon running on ws://localhost:${port}  │`);
    console.log('  │                                                 │');
    console.log(`  │   Provider: ${currentProvider.padEnd(35)}│`);
    console.log(`  │   Directory: ${workingDirectory.slice(-33).padEnd(34)}│`);
    console.log('  │                                                 │');
    console.log('  │   Waiting for browser connections...           │');
    console.log('  │                                                 │');
    console.log('  └─────────────────────────────────────────────────┘');
    console.log('');
  });

  wss.on('error', (error) => {
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      console.error(`[Daemon] Port ${port} is already in use. Is another Skema daemon running?`);
    } else {
      console.error('[Daemon] Server error:', error);
    }
  });

  return {
    port,
    close: () => {
      wss.close();
      console.log('[Daemon] Server stopped');
    },
  };
}

// =============================================================================
// Exports for Programmatic Use
// =============================================================================

export {
  currentProvider,
  workingDirectory,
  handlers,
};

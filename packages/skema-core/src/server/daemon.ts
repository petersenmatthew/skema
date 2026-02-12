import { WebSocketServer, WebSocket } from 'ws';
import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  type AIProvider as CLIProvider,
  type AIProviderConfig,
  spawnAICLI,
  isProviderAvailable,
  getAvailableProviders as getCLIProviders,
} from './ai-provider';
import { buildPromptFromAnnotation, type ProjectContext } from './gemini-cli';
import { analyzeImage, isVisionAvailable } from './vision';
import { type ProviderName, type ExecutionMode } from './providers';
import type { Annotation } from '../types';
import {
  queueAnnotation,
  getPendingAnnotations,
  getAllAnnotations,
  getAnnotation as getStoredAnnotation,
  acknowledgeAnnotation,
  resolveAnnotation,
  dismissAnnotation,
  removeAnnotation,
  clearAnnotations,
  getPendingCount,
  onStoreEvent,
  type StoredAnnotation,
} from './annotation-store';

// =============================================================================
// Types
// =============================================================================

export interface DaemonConfig {
  /** Port for WebSocket server (default: 9999) */
  port?: number;
  /** Working directory for file operations and AI commands */
  cwd?: string;
  /** Default AI provider */
  defaultProvider?: ProviderName;
  /** Default execution mode */
  defaultMode?: ExecutionMode;
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

let currentProvider: ProviderName = 'gemini';
let workingDirectory: string = process.cwd();
let currentMode: ExecutionMode = 'direct-cli';

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
      available: getCLIProviders(),
    };
  },

  'set-provider': async (msg) => {
    const newProvider = msg.provider as ProviderName;
    if (!['gemini', 'claude'].includes(newProvider)) {
      return { id: msg.id, type: 'error', error: `Invalid provider: ${newProvider}` };
    }
    
    // Check CLI availability in CLI mode
    if (currentMode === 'direct-cli' && !isProviderAvailable(newProvider as CLIProvider)) {
      return {
        id: msg.id,
        type: 'error',
        error: `Provider "${newProvider}" CLI is not installed.`,
      };
    }
    
    currentProvider = newProvider;
    console.log(`[Daemon] Switched to provider: ${currentProvider}`);
    return { id: msg.id, type: 'provider-changed', provider: currentProvider };
  },

  // -------------------------------------------------------------------------
  // Mode Management
  // -------------------------------------------------------------------------
  'get-mode': async (msg) => {
    return {
      id: msg.id,
      type: 'mode',
      mode: currentMode,
      availableModes: ['direct-cli', 'mcp'] as ExecutionMode[],
    };
  },

  'set-mode': async (msg) => {
    const newMode = msg.mode as ExecutionMode;
    if (!['direct-cli', 'mcp'].includes(newMode)) {
      return { id: msg.id, type: 'error', error: `Invalid mode: ${newMode}` };
    }
    currentMode = newMode;
    console.log(`[Daemon] Switched to mode: ${currentMode}`);
    return { id: msg.id, type: 'mode-changed', mode: currentMode };
  },

  // -------------------------------------------------------------------------
  // AI Generation (streaming)
  // -------------------------------------------------------------------------
  generate: async (msg, ws) => {
    const annotation = msg.annotation as Partial<Annotation> & { comment?: string };
    const projectContext = msg.projectContext as ProjectContext | undefined;
    const annotationId = (annotation as { id?: string }).id || `temp-${Date.now()}`;
    
    const requestMode = (msg.mode as ExecutionMode) || currentMode;
    const requestProvider = (msg.provider as ProviderName) || currentProvider;

    // MCP mode: queue annotation instead of processing immediately
    if (requestMode === 'mcp') {
      const comment = annotation.comment || '';
      const stored = queueAnnotation(annotation as Annotation, comment);
      
      sendMessage(ws, {
        id: msg.id,
        type: 'annotation-queued',
        success: true,
        annotationId: stored.annotation.id,
        pendingCount: getPendingCount(),
      });
      return;
    }

    // Create snapshot for undo
    createSnapshot(annotationId);

    // Check if this is a drawing annotation with an image
    let visionDescription = '';
    const drawingAnnotation = annotation as { drawingImage?: string };

    if (annotation.type === 'drawing' && drawingAnnotation.drawingImage) {
      sendMessage(ws, {
        id: msg.id,
        type: 'ai-event',
        event: {
          type: 'text',
          content: `[Analyzing drawing with vision...]`,
          timestamp: new Date().toISOString(),
          provider: requestProvider,
        },
      });

      // Use Gemini vision if available
      if (isVisionAvailable('gemini')) {
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
              provider: requestProvider,
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
              provider: requestProvider,
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
            provider: requestProvider,
          },
        });
      }
    }

    // Build prompt using existing logic (with vision description if available)
    const prompt = buildPromptFromAnnotation(annotation, projectContext, {
      fastMode: msg.fastMode === true,
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
        provider: requestProvider,
      },
    });

    // CLI mode - spawn CLI tools
    const cliProvider = requestProvider as CLIProvider;
    if (!isProviderAvailable(cliProvider)) {
      sendMessage(ws, {
        id: msg.id,
        type: 'ai-event',
        event: {
          type: 'error',
          content: `${requestProvider} CLI is not installed. Run: npm install -g @google/gemini-cli`,
          timestamp: new Date().toISOString(),
          provider: requestProvider,
        },
      });
      return;
    }

    const config: AIProviderConfig = {
      provider: cliProvider,
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
          provider: requestProvider,
          mode: requestMode,
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
  // MCP Annotation Queue Management
  // -------------------------------------------------------------------------
  'get-pending-annotations': async (msg) => {
    const pending = getPendingAnnotations();
    return {
      id: msg.id,
      type: 'pending-annotations',
      count: pending.length,
      annotations: pending.map(serializeStoredAnnotation),
    };
  },

  'get-all-annotations': async (msg) => {
    const all = getAllAnnotations();
    return {
      id: msg.id,
      type: 'all-annotations',
      count: all.length,
      annotations: all.map(serializeStoredAnnotation),
    };
  },

  'get-annotation': async (msg) => {
    const id = msg.annotationId as string;
    const stored = getStoredAnnotation(id);
    if (!stored) {
      return { id: msg.id, type: 'error', error: `Annotation not found: ${id}` };
    }
    return {
      id: msg.id,
      type: 'annotation',
      annotation: serializeStoredAnnotation(stored),
    };
  },

  'acknowledge-annotation': async (msg) => {
    const id = msg.annotationId as string;
    const stored = acknowledgeAnnotation(id);
    if (!stored) {
      return { id: msg.id, type: 'error', error: `Annotation not found: ${id}` };
    }
    // Notify browser clients
    broadcastToClients({
      type: 'annotation-status-changed',
      annotationId: id,
      status: 'acknowledged',
    });
    return {
      id: msg.id,
      type: 'annotation-acknowledged',
      annotationId: id,
    };
  },

  'resolve-annotation': async (msg) => {
    const id = msg.annotationId as string;
    const summary = msg.summary as string | undefined;
    const stored = resolveAnnotation(id, summary);
    if (!stored) {
      return { id: msg.id, type: 'error', error: `Annotation not found: ${id}` };
    }
    // Notify browser clients
    broadcastToClients({
      type: 'annotation-status-changed',
      annotationId: id,
      status: 'resolved',
      summary,
    });
    return {
      id: msg.id,
      type: 'annotation-resolved',
      annotationId: id,
      summary,
    };
  },

  'dismiss-annotation': async (msg) => {
    const id = msg.annotationId as string;
    const reason = msg.reason as string;
    const stored = dismissAnnotation(id, reason);
    if (!stored) {
      return { id: msg.id, type: 'error', error: `Annotation not found: ${id}` };
    }
    // Notify browser clients
    broadcastToClients({
      type: 'annotation-status-changed',
      annotationId: id,
      status: 'dismissed',
      reason,
    });
    return {
      id: msg.id,
      type: 'annotation-dismissed',
      annotationId: id,
      reason,
    };
  },

  'clear-queued-annotations': async (msg) => {
    clearAnnotations();
    return {
      id: msg.id,
      type: 'annotations-cleared',
    };
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
      mode: currentMode,
      cwd: workingDirectory,
      availableProviders: getCLIProviders(),
      availableModes: ['direct-cli', 'mcp'] as ExecutionMode[],
    };
  },
};

// =============================================================================
// WebSocket Helpers
// =============================================================================

// Track connected browser clients for broadcasting
const connectedClients = new Set<WebSocket>();

function broadcastToClients(message: OutgoingMessage) {
  for (const client of connectedClients) {
    sendMessage(client, message);
  }
}

function serializeStoredAnnotation(stored: StoredAnnotation) {
  return {
    id: stored.annotation.id,
    type: stored.annotation.type,
    comment: stored.comment,
    status: stored.status,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    resolvedBy: stored.resolvedBy,
    resolutionSummary: stored.resolutionSummary,
    dismissalReason: stored.dismissalReason,
    // Include key annotation data the agent needs
    annotation: {
      type: stored.annotation.type,
      selector: (stored.annotation as any).selector,
      tagName: (stored.annotation as any).tagName,
      text: (stored.annotation as any).text,
      elementPath: (stored.annotation as any).elementPath,
      boundingBox: stored.annotation.boundingBox,
      drawingSvg: (stored.annotation as any).drawingSvg,
      drawingImage: (stored.annotation as any).drawingImage,
      extractedText: (stored.annotation as any).extractedText,
      nearbyElements: (stored.annotation as any).nearbyElements,
      viewport: (stored.annotation as any).viewport,
      projectStyles: (stored.annotation as any).projectStyles,
      isMultiSelect: (stored.annotation as any).isMultiSelect,
      elements: (stored.annotation as any).elements,
    },
  };
}

function sendMessage(ws: WebSocket, message: OutgoingMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function handleConnection(ws: WebSocket) {
  console.log('[Daemon] Client connected');
  connectedClients.add(ws);

  // Send initial state
  sendMessage(ws, {
    type: 'connected',
    provider: currentProvider,
    mode: currentMode,
    cwd: workingDirectory,
    availableProviders: getCLIProviders(),
    availableModes: ['direct-cli', 'mcp'] as ExecutionMode[],
    pendingAnnotations: currentMode === 'mcp' ? getPendingCount() : 0,
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
    connectedClients.delete(ws);
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
  currentMode = config.defaultMode ?? 'direct-cli';

  // Check CLI provider availability
  if (currentMode === 'direct-cli') {
    if (!isProviderAvailable(currentProvider as CLIProvider)) {
      const available = getCLIProviders();
      if (available.length > 0) {
        console.log(`[Daemon] ${currentProvider} CLI not found, falling back to ${available[0]}`);
        currentProvider = available[0];
      } else {
        console.warn('[Daemon] Warning: No CLI providers found. Install gemini or claude CLI.');
      }
    }
  }

  const wss = new WebSocketServer({ port });

  wss.on('connection', handleConnection);

  wss.on('listening', () => {
    const cliProviders = getCLIProviders();
    
    console.log('');
    console.log('  ┌─────────────────────────────────────────────────┐');
    console.log('  │                                                 │');
    console.log(`  │   Skema Daemon running on ws://localhost:${port}    │`);
    console.log('  │                                                 │');
    console.log(`  │   Mode: ${currentMode.padEnd(39)}│`);
    console.log(`  │   Provider: ${currentProvider.padEnd(35)}│`);
    console.log(`  │   Directory: ${workingDirectory.slice(-33).padEnd(34)}│`);
    console.log(`  │   CLI Providers: ${(cliProviders.join(', ') || 'none').padEnd(29)}│`);
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
  currentMode,
  workingDirectory,
  handlers,
};

export type { ExecutionMode, ProviderName } from './providers';

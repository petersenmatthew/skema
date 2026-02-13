// =============================================================================
// Skema MCP Server Implementation
// =============================================================================
//
// The MCP server connects to the Skema daemon via WebSocket to read and manage
// queued annotations. When the user is in MCP mode, annotations are queued in
// the daemon instead of being processed immediately. The AI agent connected
// via MCP retrieves them, makes the code changes itself, and marks them resolved.
//
// Architecture:
//   Browser → (WS) → Daemon → [annotation store] ← (WS) ← MCP Server ← Agent
//

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type ReadResourceRequest,
} from '@modelcontextprotocol/sdk/types.js';
import WebSocket from 'ws';

// =============================================================================
// Configuration
// =============================================================================

const DAEMON_PORT = parseInt(process.env.SKEMA_PORT || '9999', 10);
const DAEMON_URL = `ws://localhost:${DAEMON_PORT}`;

// =============================================================================
// Daemon WebSocket Client
// =============================================================================

let daemonWs: WebSocket | null = null;
let daemonConnected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const RECONNECT_INTERVAL = 3000;
let messageIdCounter = 0;
const pendingRequests = new Map<string, {
  resolve: (data: any) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}>();

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    console.error('[Skema MCP] Attempting to reconnect to daemon...');
    try {
      await connectToDaemon();
    } catch {
      // connectToDaemon's close/error handlers will schedule the next retry
    }
  }, RECONNECT_INTERVAL);
}

function connectToDaemon(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (daemonWs && daemonConnected) {
      resolve();
      return;
    }

    // Clean up any stale socket before creating a new one
    if (daemonWs) {
      daemonWs.removeAllListeners();
      daemonWs = null;
    }

    daemonWs = new WebSocket(DAEMON_URL);

    daemonWs.on('open', () => {
      daemonConnected = true;
      console.error('[Skema MCP] Connected to daemon at', DAEMON_URL);
      // Identify ourselves as the MCP server
      daemonWs!.send(JSON.stringify({
        id: `mcp-identify-${Date.now()}`,
        type: 'identify',
        client: 'mcp-server',
      }));
      resolve();
    });

    daemonWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Handle responses to our requests
        if (msg.id && pendingRequests.has(msg.id)) {
          const pending = pendingRequests.get(msg.id)!;
          pendingRequests.delete(msg.id);
          clearTimeout(pending.timeout);

          if (msg.type === 'error') {
            pending.reject(new Error(msg.error));
          } else {
            pending.resolve(msg);
          }
        }
      } catch (e) {
        console.error('[Skema MCP] Failed to parse daemon message:', e);
      }
    });

    daemonWs.on('close', () => {
      daemonConnected = false;
      daemonWs = null;
      console.error('[Skema MCP] Disconnected from daemon');
      scheduleReconnect();
    });

    daemonWs.on('error', (err) => {
      daemonConnected = false;
      console.error('[Skema MCP] Daemon connection error:', err.message);
      reject(err);
    });
  });
}

function sendToDaemon(type: string, payload: Record<string, any> = {}): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      if (!daemonConnected) {
        await connectToDaemon();
      }

      if (!daemonWs || !daemonConnected) {
        reject(new Error('Not connected to Skema daemon. Is it running?'));
        return;
      }

      const id = `mcp-${++messageIdCounter}`;
      const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`Daemon request timed out: ${type}`));
      }, 30000);

      pendingRequests.set(id, { resolve, reject, timeout });

      daemonWs.send(JSON.stringify({ id, type, ...payload }));
    } catch (err) {
      reject(err);
    }
  });
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS = [
  {
    name: 'skema_get_pending',
    description:
      'Get all pending annotations from the Skema browser overlay. These are visual annotations ' +
      '(DOM selections, drawings, multi-selects) that the user has made on their web page and wants ' +
      'you to implement as code changes. Each annotation includes the user\'s comment describing what ' +
      'they want, plus element selectors, CSS paths, bounding boxes, and other context to help you ' +
      'find the right code to modify.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'skema_get_all_annotations',
    description:
      'Get all annotations (pending, acknowledged, resolved, dismissed). Useful for reviewing ' +
      'the full history of annotation requests and their current status.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'skema_get_annotation',
    description: 'Get details of a specific annotation by ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        annotationId: {
          type: 'string',
          description: 'The annotation ID to look up',
        },
      },
      required: ['annotationId'],
    },
  },
  {
    name: 'skema_acknowledge',
    description:
      'Mark an annotation as acknowledged. Use this to tell the user you\'ve seen their ' +
      'annotation and are working on it. The browser overlay will update to show the status change.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        annotationId: {
          type: 'string',
          description: 'The annotation ID to acknowledge',
        },
      },
      required: ['annotationId'],
    },
  },
  {
    name: 'skema_resolve',
    description:
      'Mark an annotation as resolved after you\'ve implemented the requested change. ' +
      'Include a summary of what you did so the user can see it in the browser overlay.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        annotationId: {
          type: 'string',
          description: 'The annotation ID to resolve',
        },
        summary: {
          type: 'string',
          description: 'Summary of what was done to resolve this annotation',
        },
      },
      required: ['annotationId'],
    },
  },
  {
    name: 'skema_dismiss',
    description:
      'Dismiss an annotation if you decide not to implement it. Include a reason so the user ' +
      'understands why.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        annotationId: {
          type: 'string',
          description: 'The annotation ID to dismiss',
        },
        reason: {
          type: 'string',
          description: 'Reason for dismissing this annotation',
        },
      },
      required: ['annotationId', 'reason'],
    },
  },
  {
    name: 'skema_watch',
    description:
      'Wait for new annotations to appear. This blocks until the user creates new annotations ' +
      'in the browser overlay, then returns them as a batch. Use this in a loop for hands-free ' +
      'processing: call skema_watch, process the returned annotations, resolve them, then call ' +
      'skema_watch again.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        timeoutSeconds: {
          type: 'number',
          description: 'Max seconds to wait for annotations (default: 120, max: 300)',
        },
      },
      required: [],
    },
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

function success(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function error(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

async function handleTool(name: string, args: any): Promise<ToolResult> {
  switch (name) {
    case 'skema_get_pending': {
      try {
        const response = await sendToDaemon('get-pending-annotations');
        return success({
          count: response.count,
          annotations: response.annotations,
        });
      } catch (err) {
        return error(`Failed to get pending annotations: ${(err as Error).message}`);
      }
    }

    case 'skema_get_all_annotations': {
      try {
        const response = await sendToDaemon('get-all-annotations');
        return success({
          count: response.count,
          annotations: response.annotations,
        });
      } catch (err) {
        return error(`Failed to get annotations: ${(err as Error).message}`);
      }
    }

    case 'skema_get_annotation': {
      try {
        const response = await sendToDaemon('get-annotation', {
          annotationId: args.annotationId,
        });
        return success(response.annotation);
      } catch (err) {
        return error(`Failed to get annotation: ${(err as Error).message}`);
      }
    }

    case 'skema_acknowledge': {
      try {
        await sendToDaemon('acknowledge-annotation', {
          annotationId: args.annotationId,
        });
        return success({ acknowledged: true, annotationId: args.annotationId });
      } catch (err) {
        return error(`Failed to acknowledge: ${(err as Error).message}`);
      }
    }

    case 'skema_resolve': {
      try {
        await sendToDaemon('resolve-annotation', {
          annotationId: args.annotationId,
          summary: args.summary,
        });
        return success({
          resolved: true,
          annotationId: args.annotationId,
          summary: args.summary,
        });
      } catch (err) {
        return error(`Failed to resolve: ${(err as Error).message}`);
      }
    }

    case 'skema_dismiss': {
      try {
        await sendToDaemon('dismiss-annotation', {
          annotationId: args.annotationId,
          reason: args.reason,
        });
        return success({
          dismissed: true,
          annotationId: args.annotationId,
          reason: args.reason,
        });
      } catch (err) {
        return error(`Failed to dismiss: ${(err as Error).message}`);
      }
    }

    case 'skema_watch': {
      const timeoutSeconds = Math.min(300, Math.max(1, args?.timeoutSeconds ?? 120));
      const pollInterval = 2000; // 2 seconds
      const maxPolls = Math.ceil((timeoutSeconds * 1000) / pollInterval);

      // Poll for pending annotations until some appear or timeout
      for (let i = 0; i < maxPolls; i++) {
        try {
          const response = await sendToDaemon('get-pending-annotations');
          if (response.count > 0) {
            return success({
              timeout: false,
              count: response.count,
              annotations: response.annotations,
            });
          }
        } catch (err) {
          return error(`Lost connection to daemon: ${(err as Error).message}`);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      return success({
        timeout: true,
        message: `No new annotations within ${timeoutSeconds} seconds`,
      });
    }

    default:
      return error(`Unknown tool: ${name}`);
  }
}

// =============================================================================
// MCP Server Setup
// =============================================================================

export async function startMcpServer(): Promise<void> {
  // Try to connect to daemon on startup, auto-reconnect if unavailable
  try {
    await connectToDaemon();
  } catch {
    console.error('[Skema MCP] Warning: Could not connect to daemon. Will auto-retry...');
    scheduleReconnect();
  }

  const server = new Server(
    {
      name: 'skema',
      version: '0.3.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // ==========================================================================
  // Tool Definitions
  // ==========================================================================

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // ==========================================================================
  // Tool Call Handler
  // ==========================================================================

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;

    try {
      return await handleTool(name, args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(message);
    }
  });

  // ==========================================================================
  // Resource Definitions
  // ==========================================================================

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'skema://status',
          name: 'Skema Status',
          description: 'Current Skema daemon connection status and pending annotation count',
          mimeType: 'application/json',
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
    const { uri } = request.params;

    switch (uri) {
      case 'skema://status': {
        let pendingCount = 0;
        let connected = false;
        try {
          const response = await sendToDaemon('get-pending-annotations');
          pendingCount = response.count;
          connected = true;
        } catch {
          connected = false;
        }

        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              daemonConnected: connected,
              daemonUrl: DAEMON_URL,
              pendingAnnotations: pendingCount,
            }, null, 2),
          }],
        };
      }
      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  });

  // ==========================================================================
  // Start Server
  // ==========================================================================

  // After the MCP client completes initialization, forward its identity to the daemon
  server.oninitialized = () => {
    const clientInfo = server.getClientVersion();
    const clientName = clientInfo?.name || 'unknown';
    console.error('[Skema MCP] Connected client:', clientName, clientInfo?.version || '');
    // Send client name to daemon so it can show in the browser UI
    if (daemonWs && daemonConnected) {
      daemonWs.send(JSON.stringify({
        id: `mcp-client-info-${Date.now()}`,
        type: 'mcp-client-info',
        clientName,
        clientVersion: clientInfo?.version,
      }));
    }
  };

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[Skema MCP] Server started');
  console.error('[Skema MCP] Daemon URL:', DAEMON_URL);
  console.error('[Skema MCP] Tools: skema_get_pending, skema_acknowledge, skema_resolve, skema_dismiss, skema_watch');
}

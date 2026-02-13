import { useState, useEffect, useRef, useCallback } from 'react';
import type { Annotation } from '../types';

// =============================================================================
// Types
// =============================================================================

export type ProviderName = 'gemini' | 'claude';
export type ExecutionMode = 'direct-cli' | 'mcp';

export interface ProviderStatus {
  installed: boolean;
  authorized: boolean;
  message: string;
}

export interface AnnotationCounts {
  pending: number;
  acknowledged: number;
  resolved: number;
  dismissed: number;
}

export interface DaemonState {
  connected: boolean;
  provider: ProviderName;
  mode: ExecutionMode;
  availableProviders: ProviderName[];
  availableModes: ExecutionMode[];
  providerStatus: Record<ProviderName, ProviderStatus>;
  cwd: string;
  mcpServerConnected: boolean;
  annotationCounts: AnnotationCounts;
}

export interface AIStreamEvent {
  type: 'init' | 'text' | 'tool_use' | 'tool_result' | 'error' | 'done' | 'debug';
  content?: string;
  timestamp: string;
  provider: ProviderName;
  raw?: unknown;
}

export interface GenerateOptions {
  /** Override execution mode for this request */
  mode?: ExecutionMode;
  /** Override provider for this request */
  provider?: ProviderName;
}

export interface UseDaemonOptions {
  /** WebSocket URL (default: ws://localhost:9999) */
  url?: string;
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect delay in ms (default: 2000) */
  reconnectDelay?: number;
}

export interface UseDaemonReturn {
  /** Current daemon state */
  state: DaemonState;
  /** Whether currently generating */
  isGenerating: boolean;
  /** Last error message */
  error: string | null;
  /** Connect to daemon */
  connect: () => void;
  /** Disconnect from daemon */
  disconnect: () => void;
  /** Switch AI provider */
  setProvider: (provider: ProviderName) => Promise<boolean>;
  /** Switch execution mode */
  setMode: (mode: ExecutionMode) => Promise<boolean>;
  /** Refresh provider status from daemon */
  refreshProviderStatus: () => Promise<void>;
  /** Generate code from annotation (streaming) */
  generate: (
    annotation: Partial<Annotation> & { comment?: string },
    onEvent?: (event: AIStreamEvent) => void,
    options?: GenerateOptions
  ) => Promise<{ success: boolean; annotationId: string }>;
  /** Revert changes for an annotation */
  revert: (annotationId: string) => Promise<{ success: boolean; message: string }>;
  /** Read a file */
  readFile: (path: string) => Promise<string>;
  /** Write a file */
  writeFile: (path: string, content: string) => Promise<boolean>;
  /** Run a command */
  runCommand: (command: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useDaemon(options: UseDaemonOptions = {}): UseDaemonReturn {
  const {
    url = 'ws://localhost:9999',
    autoConnect = true,
    autoReconnect = true,
    reconnectDelay = 2000,
  } = options;

  const defaultProviderStatus: Record<ProviderName, ProviderStatus> = {
    gemini: { installed: false, authorized: false, message: 'Checking...' },
    claude: { installed: false, authorized: false, message: 'Checking...' },
  };

  const [state, setState] = useState<DaemonState>({
    connected: false,
    provider: 'gemini',
    mode: 'direct-cli',
    availableProviders: [],
    availableModes: ['direct-cli', 'mcp'],
    providerStatus: defaultProviderStatus,
    cwd: '',
    mcpServerConnected: false,
    annotationCounts: { pending: 0, acknowledged: 0, resolved: 0, dismissed: 0 },
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingRequests = useRef<Map<string, { resolve: (value: any) => void; reject: (error: any) => void }>>(new Map());
  const eventCallbacks = useRef<Map<string, (event: AIStreamEvent) => void>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageIdRef = useRef(0);

  // Generate unique message ID
  const nextId = useCallback(() => {
    messageIdRef.current += 1;
    return `msg-${messageIdRef.current}-${Date.now()}`;
  }, []);

  // Send message and wait for response
  const sendRequest = useCallback(<T>(type: string, payload: Record<string, unknown> = {}): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to daemon'));
        return;
      }

      const id = nextId();
      pendingRequests.current.set(id, { resolve, reject });

      wsRef.current.send(JSON.stringify({ id, type, ...payload }));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (pendingRequests.current.has(id)) {
          pendingRequests.current.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }, [nextId]);

  // Handle incoming messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);

      // Handle initial connection state
      if (msg.type === 'connected') {
        setState((prev) => ({
          ...prev,
          connected: true,
          provider: msg.provider || prev.provider,
          mode: msg.mode || prev.mode,
          availableProviders: msg.availableProviders || prev.availableProviders,
          availableModes: msg.availableModes || prev.availableModes,
          providerStatus: msg.providerStatus || prev.providerStatus,
          cwd: msg.cwd || prev.cwd,
          mcpServerConnected: msg.mcpServerConnected ?? prev.mcpServerConnected,
        }));
        setError(null);
        return;
      }

      // Handle provider status update
      if (msg.type === 'provider-statuses') {
        setState((prev) => ({
          ...prev,
          providerStatus: msg.providerStatus || prev.providerStatus,
        }));
        return;
      }

      // Handle streaming AI events
      if (msg.type === 'ai-event' && msg.id) {
        const callback = eventCallbacks.current.get(msg.id);
        if (callback) {
          callback(msg.event);
        }
        return;
      }

      // Handle generate complete
      if (msg.type === 'generate-complete' && msg.id) {
        const pending = pendingRequests.current.get(msg.id);
        if (pending) {
          pendingRequests.current.delete(msg.id);
          eventCallbacks.current.delete(msg.id);
          pending.resolve({ success: msg.success, annotationId: msg.annotationId });
        }
        setIsGenerating(false);
        return;
      }

      // Handle MCP mode: annotation queued (not processed immediately)
      if (msg.type === 'annotation-queued' && msg.id) {
        const pending = pendingRequests.current.get(msg.id);
        if (pending) {
          pendingRequests.current.delete(msg.id);
          eventCallbacks.current.delete(msg.id);
          pending.resolve({ success: true, annotationId: msg.annotationId, queued: true });
        }
        setIsGenerating(false);
        return;
      }

      // Handle MCP annotation status changes (broadcast from daemon)
      if (msg.type === 'annotation-status-changed') {
        // This is a broadcast - no pending request to resolve
        // Components can listen for this via state updates
        return;
      }

      // Handle MCP server connection status
      if (msg.type === 'mcp-server-status') {
        setState((prev) => ({
          ...prev,
          mcpServerConnected: msg.connected,
        }));
        return;
      }

      // Handle MCP annotation count updates
      if (msg.type === 'mcp-annotation-counts') {
        setState((prev) => ({
          ...prev,
          annotationCounts: msg.counts,
        }));
        return;
      }

      // Handle provider change
      if (msg.type === 'provider-changed') {
        setState((prev) => ({ ...prev, provider: msg.provider }));
      }

      // Handle mode change
      if (msg.type === 'mode-changed') {
        setState((prev) => ({ ...prev, mode: msg.mode }));
      }

      // Handle errors
      if (msg.type === 'error' && msg.id) {
        const pending = pendingRequests.current.get(msg.id);
        if (pending) {
          pendingRequests.current.delete(msg.id);
          eventCallbacks.current.delete(msg.id);
          pending.reject(new Error(msg.error));
        }
        setIsGenerating(false);
        return;
      }

      // Handle other responses with ID
      if (msg.id) {
        const pending = pendingRequests.current.get(msg.id);
        if (pending) {
          pendingRequests.current.delete(msg.id);
          pending.resolve(msg);
        }
      }
    } catch (e) {
      console.error('[useDaemon] Failed to parse message:', e);
    }
  }, []);

  // Connect to daemon
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('[useDaemon] Connected to daemon');
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        console.log('[useDaemon] Disconnected from daemon');
        setState((prev) => ({ ...prev, connected: false }));
        wsRef.current = null;

        // Auto-reconnect
        if (autoReconnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[useDaemon] Attempting to reconnect...');
            connect();
          }, reconnectDelay);
        }
      };

      ws.onerror = (e) => {
        console.error('[useDaemon] WebSocket error:', e);
        setError('Failed to connect to Skema daemon. Is it running?');
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('[useDaemon] Failed to create WebSocket:', e);
      setError('Failed to connect to Skema daemon');
    }
  }, [url, autoReconnect, reconnectDelay, handleMessage]);

  // Disconnect from daemon
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState((prev) => ({ ...prev, connected: false }));
  }, []);

  // Switch AI provider
  const setProvider = useCallback(async (provider: ProviderName): Promise<boolean> => {
    try {
      const response = await sendRequest<{ type: string; provider: ProviderName }>('set-provider', { provider });
      return response.type === 'provider-changed';
    } catch (e) {
      console.error('[useDaemon] Failed to set provider:', e);
      return false;
    }
  }, [sendRequest]);

  // Switch execution mode
  const setMode = useCallback(async (mode: ExecutionMode): Promise<boolean> => {
    try {
      const response = await sendRequest<{ type: string; mode: ExecutionMode }>('set-mode', { mode });
      return response.type === 'mode-changed';
    } catch (e) {
      console.error('[useDaemon] Failed to set mode:', e);
      return false;
    }
  }, [sendRequest]);

  // Refresh provider status from daemon
  const refreshProviderStatus = useCallback(async () => {
    try {
      await sendRequest('check-providers', {});
    } catch (e) {
      console.error('[useDaemon] Failed to refresh provider status:', e);
    }
  }, [sendRequest]);

  // Generate code from annotation
  const generate = useCallback(async (
    annotation: Partial<Annotation> & { comment?: string },
    onEvent?: (event: AIStreamEvent) => void,
    options?: GenerateOptions
  ): Promise<{ success: boolean; annotationId: string }> => {
    const id = nextId();

    if (onEvent) {
      eventCallbacks.current.set(id, onEvent);
    }

    setIsGenerating(true);

    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setIsGenerating(false);
        reject(new Error('Not connected to daemon'));
        return;
      }

      pendingRequests.current.set(id, { resolve, reject });

      wsRef.current.send(JSON.stringify({
        id,
        type: 'generate',
        annotation,
        // Include optional overrides
        ...(options?.mode && { mode: options.mode }),
        ...(options?.provider && { provider: options.provider }),
      }));
    });
  }, [nextId]);

  // Revert changes
  const revert = useCallback(async (annotationId: string): Promise<{ success: boolean; message: string }> => {
    const response = await sendRequest<{ success: boolean; message: string }>('revert', { annotationId });
    return { success: response.success, message: response.message || '' };
  }, [sendRequest]);

  // Read file
  const readFile = useCallback(async (path: string): Promise<string> => {
    const response = await sendRequest<{ content: string }>('read-file', { path });
    return response.content;
  }, [sendRequest]);

  // Write file
  const writeFile = useCallback(async (path: string, content: string): Promise<boolean> => {
    const response = await sendRequest<{ type: string }>('write-file', { path, content });
    return response.type === 'write-success';
  }, [sendRequest]);

  // Run command
  const runCommand = useCallback(async (command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    const response = await sendRequest<{ stdout: string; stderr: string; exitCode: number }>('run-command', { command });
    return {
      stdout: response.stdout || '',
      stderr: response.stderr || '',
      exitCode: response.exitCode ?? 0,
    };
  }, [sendRequest]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    state,
    isGenerating,
    error,
    connect,
    disconnect,
    setProvider,
    setMode,
    refreshProviderStatus,
    generate,
    revert,
    readFile,
    writeFile,
    runCommand,
  };
}

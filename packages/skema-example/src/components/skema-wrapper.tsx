"use client";

import { Skema, useDaemon, type Annotation, type AIStreamEvent } from "skema-core";
import { useCallback, useRef, useState, useEffect } from "react";

// #region agent log
fetch('http://127.0.0.1:7245/ingest/ff72e104-b926-41a9-9d2e-c16c34ebe4bb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'skema-wrapper.tsx:module',message:'skema-wrapper module loaded',data:{useDaemonType:typeof useDaemon,SkemaType:typeof Skema},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
// #endregion

export function SkemaWrapper() {
  // Track annotation IDs to their change IDs for reverting
  const annotationChangesRef = useRef<Map<string, string>>(new Map());
  // Track when an annotation is being processed
  const [isProcessing, setIsProcessing] = useState(false);
  // Track if Skema overlay is visible (synced with Cmd+Shift+E)
  const [isSkemaVisible, setIsSkemaVisible] = useState(true);

  // Listen for Cmd+Shift+E to sync status indicator visibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        setIsSkemaVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Connect to the Skema daemon
  const {
    state: daemonState,
    isGenerating,
    error: daemonError,
    setProvider,
    generate,
    revert,
  } = useDaemon({
    url: 'ws://localhost:9999',
    autoConnect: true,
    autoReconnect: true,
  });

  // Log daemon connection status
  if (daemonError) {
    console.warn('[Skema] Daemon error:', daemonError);
  }

  const handleAnnotationSubmit = useCallback(async (annotation: Annotation, comment: string) => {
    console.log('[Skema] Annotation submitted:', { annotation, comment });

    if (!daemonState.connected) {
      console.error('[Skema] Not connected to daemon. Run: npx skema-serve');
      return;
    }

    setIsProcessing(true);

    try {
      const result = await generate(
        { ...annotation, comment },
        (event: AIStreamEvent) => {
          // Log events to browser console based on type
          switch (event.type) {
            case 'debug':
              console.groupCollapsed(`%c[Skema] Debug`, 'color: #6366f1; font-weight: bold');
              console.log(event.content);
              console.groupEnd();
              break;
            case 'text':
              console.log(`%c[Skema ${daemonState.provider}]`, 'color: #10b981', event.content);
              break;
            case 'tool_use':
              console.log('%c[Skema Tool]', 'color: #f59e0b', event.content, event.raw);
              break;
            case 'error':
              console.error('[Skema Error]', event.content);
              break;
            case 'done':
              console.log('%c[Skema] Done', 'color: #10b981; font-weight: bold', event);
              break;
          }
        }
      );

      // Track annotation ID for revert
      if (result.annotationId) {
        annotationChangesRef.current.set(annotation.id, result.annotationId);
      }

      console.log('[Skema] Generation complete:', result);
    } catch (error) {
      console.error('[Skema] Failed to submit annotation:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [daemonState.connected, daemonState.provider, generate]);

  // Cancel in-progress annotation processing
  const handleProcessingCancel = useCallback(() => {
    console.log('[Skema] Cancelling in-progress request');
    // TODO: Add cancel support to useDaemon
    setIsProcessing(false);
  }, []);

  const handleAnnotationDelete = useCallback(async (annotationId: string) => {
    const trackedId = annotationChangesRef.current.get(annotationId);
    if (!trackedId) {
      console.log('[Skema] No changes to revert for annotation:', annotationId);
      return;
    }

    console.log('[Skema] Reverting changes for annotation:', annotationId);

    try {
      const result = await revert(trackedId);
      console.log('[Skema] Revert result:', result);

      // Clean up tracked changes
      annotationChangesRef.current.delete(annotationId);
    } catch (error) {
      console.error('[Skema] Failed to revert changes:', error);
    }
  }, [revert]);

  return (
    <>
      {/* Daemon status indicator - z-index higher than Skema overlay, hidden when Skema is hidden */}
      {isSkemaVisible && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: 16,
            padding: '8px 12px',
            backgroundColor: daemonState.connected ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
            color: 'white',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'system-ui, sans-serif',
            zIndex: 1000000,
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}
        >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: daemonState.connected ? '#34d399' : '#f87171',
            boxShadow: daemonState.connected ? '0 0 6px #34d399' : 'none',
          }}
        />
        {daemonState.connected ? (
          <>
            <span style={{ opacity: 0.8 }}>CLI:</span>
            <select
              value={daemonState.provider}
              onChange={(e) => setProvider(e.target.value as 'gemini' | 'claude')}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: 'white',
                fontSize: '12px',
                borderRadius: '4px',
                padding: '2px 4px',
                cursor: 'pointer',
              }}
            >
              {daemonState.availableProviders.map((p) => (
                <option key={p} value={p} style={{ color: 'black' }}>
                  {p}
                </option>
              ))}
            </select>
          </>
        ) : (
          <span>Daemon offline - run: npx skema</span>
        )}
        </div>
      )}

      <Skema
        enabled={true}
        onAnnotationSubmit={handleAnnotationSubmit}
        onAnnotationDelete={handleAnnotationDelete}
        onProcessingCancel={handleProcessingCancel}
        isProcessing={isProcessing || isGenerating}
      />
    </>
  );
}

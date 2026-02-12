"use client";

import { Skema, useDaemon, type Annotation, type AIStreamEvent } from "skema-core";
import { useCallback, useRef, useState } from "react";

// #region agent log
fetch('http://127.0.0.1:7245/ingest/ff72e104-b926-41a9-9d2e-c16c34ebe4bb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'skema-wrapper.tsx:module',message:'skema-wrapper module loaded',data:{useDaemonType:typeof useDaemon,SkemaType:typeof Skema},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
// #endregion

export function SkemaWrapper() {
  // Track annotation IDs to their change IDs for reverting
  const annotationChangesRef = useRef<Map<string, string>>(new Map());
  // Track when an annotation is being processed
  const [isProcessing, setIsProcessing] = useState(false);
  // Connect to the Skema daemon
  const {
    state: daemonState,
    isGenerating,
    error: daemonError,
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

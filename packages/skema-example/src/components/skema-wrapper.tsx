"use client";

import { Skema, type Annotation } from "skema-core";
import { useCallback, useRef } from "react";

// Event type from skema-core/server
interface GeminiCLIEvent {
  type: 'init' | 'message' | 'tool_use' | 'tool_result' | 'error' | 'result' | 'done' | 'debug';
  timestamp?: string;
  content?: string;
  label?: string;
  role?: 'user' | 'assistant';
  tool_name?: string;
  [key: string]: unknown;
}

export function SkemaWrapper() {
  // Track annotation IDs to their change IDs for reverting
  const annotationChangesRef = useRef<Map<string, string[]>>(new Map());

  const handleAnnotationSubmit = useCallback(async (annotation: Annotation, comment: string) => {
    console.log('[Skema] Annotation submitted:', { annotation, comment });

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annotation,
          comment,
          projectContext: {
            pathname: window.location.pathname,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      // Handle SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: GeminiCLIEvent = JSON.parse(line.slice(6));
              
              // Log events to browser console based on type
              switch (event.type) {
                case 'debug':
                  if (event.label) {
                    console.groupCollapsed(`%c[Skema] ${event.label}`, 'color: #6366f1; font-weight: bold');
                    console.log(event.content);
                    console.groupEnd();
                  } else {
                    console.log('%c[Skema Debug]', 'color: #6366f1', event.content);
                  }
                  break;
                case 'message':
                  if (event.role === 'assistant') {
                    console.log('%c[Skema AI]', 'color: #10b981', event.content);
                  }
                  break;
                case 'tool_use':
                  console.log('%c[Skema Tool]', 'color: #f59e0b', event.tool_name, event);
                  break;
                case 'error':
                  console.error('[Skema Error]', event.content);
                  break;
                case 'done':
                  console.log('%c[Skema] Done', 'color: #10b981; font-weight: bold', event);
                  break;
              }
            } catch {
              // Ignore parse errors for incomplete lines
            }
          }
        }
      }

      // Get annotation ID from response header for revert tracking
      const annotationId = response.headers.get('X-Annotation-Id');
      if (annotationId) {
        annotationChangesRef.current.set(annotation.id, [annotationId]);
      }
    } catch (error) {
      console.error('[Skema] Failed to submit annotation:', error);
    }
  }, []);

  const handleAnnotationDelete = useCallback(async (annotationId: string) => {
    const changeIds = annotationChangesRef.current.get(annotationId);
    if (!changeIds || changeIds.length === 0) {
      console.log('[Skema] No changes to revert for annotation:', annotationId);
      return;
    }

    console.log('[Skema] Reverting changes for annotation:', annotationId, changeIds);

    try {
      const response = await fetch('/api/gemini', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeIds }),
      });

      if (!response.ok) {
        throw new Error(`Revert API error: ${response.status}`);
      }

      const result = await response.json();
      console.log('[Skema] Revert result:', result);

      // Clean up tracked changes
      annotationChangesRef.current.delete(annotationId);
    } catch (error) {
      console.error('[Skema] Failed to revert changes:', error);
    }
  }, []);

  return (
    <Skema
      enabled={true}
      onAnnotationSubmit={handleAnnotationSubmit}
      onAnnotationDelete={handleAnnotationDelete}
    />
  );
}

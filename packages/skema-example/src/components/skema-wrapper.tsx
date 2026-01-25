"use client";

import { Skema, type Annotation } from "skema-core";
import { useCallback, useRef } from "react";

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

      const result = await response.json();
      console.log('[Skema] Gemini CLI result:', result);

      // Store change IDs for potential revert
      if (result.changeIds && result.changeIds.length > 0) {
        annotationChangesRef.current.set(annotation.id, result.changeIds);
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

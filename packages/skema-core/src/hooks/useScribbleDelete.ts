// =============================================================================
// useScribbleDelete - Real-time scribble gesture detection for deleting shapes
// =============================================================================

import { useEffect, useRef, Dispatch, SetStateAction } from 'react';
import type { Editor, TLShapeId } from 'tldraw';
import {
    isRealtimeScribble,
    findOverlappingShapesFromBounds,
    getPointsBounds,
    type Point as GesturePoint
} from '../utils/gesture-recognizer';
import type { Annotation } from '../types';

interface UseScribbleDeleteOptions {
    isActive: boolean;
    editorRef: React.RefObject<Editor | null>;
    setAnnotations: Dispatch<SetStateAction<Annotation[]>>;
    setScribbleToast: Dispatch<SetStateAction<string | null>>;
}

/**
 * Hook to detect real-time scribble gestures and delete overlapping shapes
 * 
 * While the draw tool is active, tracks pointer movements to detect
 * scribble-like patterns. When detected over existing shapes, cancels
 * the current drawing and deletes the shapes underneath.
 */
export function useScribbleDelete({
    isActive,
    editorRef,
    setAnnotations,
    setScribbleToast,
}: UseScribbleDeleteOptions) {
    // Scribble detection refs - for real-time tracking during drawing
    const scribblePointsRef = useRef<GesturePoint[]>([]);
    const isDrawingRef = useRef<boolean>(false);
    const scribbleDetectedRef = useRef<boolean>(false);

    useEffect(() => {
        if (!isActive) return;

        const handleScribbleDelete = (overlappingIds: TLShapeId[]) => {
            const editor = editorRef.current;
            if (!editor || overlappingIds.length === 0) return;

            // Cancel the current drawing operation
            editor.cancel();

            // Delete overlapping shapes
            editor.deleteShapes(overlappingIds);

            // Remove any annotations associated with deleted shapes
            setAnnotations((prev) => prev.filter((annotation) => {
                if (annotation.type === 'drawing') {
                    const drawingShapes = annotation.shapes as TLShapeId[];
                    return !drawingShapes.some((shapeId) =>
                        overlappingIds.includes(shapeId)
                    );
                }
                return true;
            }));

            // Show toast notification
            const message = overlappingIds.length === 1
                ? 'Deleted 1 shape'
                : `Deleted ${overlappingIds.length} shapes`;
            setScribbleToast(message);
            setTimeout(() => setScribbleToast(null), 2000);

            console.log(`[Skema] Scribble-delete: removed ${overlappingIds.length} shape(s)`);
        };

        const handlePointerDown = (e: PointerEvent) => {
            const editor = editorRef.current;
            if (!editor) return;

            // Only track if draw tool is active
            const currentTool = editor.getCurrentToolId();
            if (currentTool !== 'draw') return;

            // Start tracking
            isDrawingRef.current = true;
            scribbleDetectedRef.current = false;
            scribblePointsRef.current = [{
                x: e.clientX + window.scrollX,
                y: e.clientY + window.scrollY
            }];
        };

        const handlePointerMove = (e: PointerEvent) => {
            const editor = editorRef.current;
            if (!editor || !isDrawingRef.current || scribbleDetectedRef.current) return;

            // Only track if draw tool is still active and pointer is down
            const currentTool = editor.getCurrentToolId();
            if (currentTool !== 'draw') {
                isDrawingRef.current = false;
                return;
            }

            // Add point (in page coordinates)
            const newPoint = {
                x: e.clientX + window.scrollX,
                y: e.clientY + window.scrollY
            };

            const points = scribblePointsRef.current;
            const lastPoint = points[points.length - 1];

            // Only add if moved enough (avoid duplicate points)
            if (lastPoint) {
                const dx = newPoint.x - lastPoint.x;
                const dy = newPoint.y - lastPoint.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 3) return;
            }

            points.push(newPoint);
            scribblePointsRef.current = points;

            // Check for scribble gesture periodically (every 5 points after initial batch)
            if (points.length >= 20 && points.length % 5 === 0) {
                const gestureResult = isRealtimeScribble(points);

                if (gestureResult.isScribble) {
                    // Get bounds of the scribble path
                    const bounds = getPointsBounds(points);

                    if (bounds) {
                        // Find shapes underneath the scribble
                        const overlappingIds = findOverlappingShapesFromBounds(editor, bounds, []);

                        if (overlappingIds.length > 0) {
                            // Mark as detected to prevent re-triggering
                            scribbleDetectedRef.current = true;
                            isDrawingRef.current = false;

                            // Trigger deletion
                            handleScribbleDelete(overlappingIds);
                        }
                    }
                }
            }
        };

        const handlePointerUp = () => {
            // Reset tracking state
            isDrawingRef.current = false;
            scribblePointsRef.current = [];
            scribbleDetectedRef.current = false;
        };

        // Add listeners with capture to track before tldraw
        document.addEventListener('pointerdown', handlePointerDown, { capture: true });
        document.addEventListener('pointermove', handlePointerMove, { capture: true });
        document.addEventListener('pointerup', handlePointerUp, { capture: true });
        document.addEventListener('pointercancel', handlePointerUp, { capture: true });

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
            document.removeEventListener('pointermove', handlePointerMove, { capture: true });
            document.removeEventListener('pointerup', handlePointerUp, { capture: true });
            document.removeEventListener('pointercancel', handlePointerUp, { capture: true });
        };
    }, [isActive, editorRef, setAnnotations, setScribbleToast]);
}

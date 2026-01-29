// =============================================================================
// useShapePersistence - Hide/restore shapes when toggling Skema on/off
// =============================================================================

import { useEffect, useRef, RefObject } from 'react';
import type { Editor } from 'tldraw';

/**
 * Hook to persist drawing shapes when toggling Skema overlay off/on
 * 
 * When user presses Cmd+Shift+E to hide Skema:
 * - Saves all drawing shapes to memory
 * - Removes them from canvas (so they don't show when overlay is hidden)
 * 
 * When Skema is shown again:
 * - Restores shapes from memory back to canvas
 */
export function useShapePersistence(
    isActive: boolean,
    editorRef: RefObject<Editor | null>
) {
    // Saved shapes for hide/restore when toggling Skema off/on
    const savedShapesRef = useRef<Record<string, any> | null>(null);
    const wasActiveRef = useRef<boolean>(isActive);

    // Hide shapes when Skema becomes inactive
    useEffect(() => {
        const editor = editorRef.current;

        // Detect transition from active to inactive (hiding Skema)
        if (wasActiveRef.current && !isActive && editor) {
            // Get all drawing shapes on the canvas
            const allShapes = editor.getCurrentPageShapes();
            const drawingShapes = allShapes.filter(shape =>
                ['draw', 'line', 'arrow', 'geo', 'text', 'note', 'frame'].includes(shape.type)
            );

            if (drawingShapes.length > 0) {
                // Save the current store snapshot (only shapes we care about)
                const shapeRecords: Record<string, any> = {};
                for (const shape of drawingShapes) {
                    shapeRecords[shape.id] = shape;
                }
                savedShapesRef.current = shapeRecords;

                // Delete the shapes from canvas (they're now hidden)
                const shapeIds = drawingShapes.map(s => s.id);
                editor.deleteShapes(shapeIds);

                console.log(`[Skema] Hiding: saved ${drawingShapes.length} shape(s) to memory`);
            }
        }

        // Update the ref for next comparison
        wasActiveRef.current = isActive;
    }, [isActive, editorRef]);

    // Restore shapes when Skema becomes active again
    useEffect(() => {
        if (!isActive) return;

        const editor = editorRef.current;
        if (!editor || !savedShapesRef.current) return;

        // Small delay to ensure editor is fully ready after mount
        const timeoutId = setTimeout(() => {
            const savedShapes = savedShapesRef.current;
            const currentEditor = editorRef.current;
            if (!savedShapes || !currentEditor) return;

            const shapesToRestore = Object.values(savedShapes);

            if (shapesToRestore.length > 0) {
                // Restore shapes to the canvas
                currentEditor.createShapes(shapesToRestore);
                console.log(`[Skema] Restoring: loaded ${shapesToRestore.length} shape(s) from memory`);

                // Clear saved shapes after restore
                savedShapesRef.current = null;
            }
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [isActive, editorRef]);
}

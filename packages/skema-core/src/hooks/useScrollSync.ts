// =============================================================================
// useScrollSync - Sync scroll position with tldraw camera
// =============================================================================

import { useEffect, useState, RefObject } from 'react';
import type { Editor } from 'tldraw';

interface ScrollOffset {
    x: number;
    y: number;
}

/**
 * Hook to sync page scroll position with tldraw camera
 * Returns the current scroll offset for use in coordinate calculations
 */
export function useScrollSync(
    isActive: boolean,
    editorRef: RefObject<Editor | null>
): ScrollOffset {
    const [scrollOffset, setScrollOffset] = useState<ScrollOffset>({ x: 0, y: 0 });

    // Sync scroll position with tldraw camera
    useEffect(() => {
        if (!isActive) return;

        const syncScroll = () => {
            const newOffset = { x: window.scrollX, y: window.scrollY };
            setScrollOffset(newOffset);

            // Update tldraw camera to match scroll position
            if (editorRef.current) {
                editorRef.current.setCamera({ x: -newOffset.x, y: -newOffset.y, z: 1 });
            }
        };

        // Initial sync
        syncScroll();

        // Listen for scroll and resize events
        window.addEventListener('scroll', syncScroll, { passive: true });
        window.addEventListener('resize', syncScroll);

        return () => {
            window.removeEventListener('scroll', syncScroll);
            window.removeEventListener('resize', syncScroll);
        };
    }, [isActive, editorRef]);

    return scrollOffset;
}

/**
 * Hook to intercept wheel events and scroll the page instead of panning tldraw
 */
export function useWheelIntercept(isActive: boolean) {
    useEffect(() => {
        if (!isActive) return;

        const handleWheel = (e: WheelEvent) => {
            // Check if the event target is within tldraw's canvas area
            const target = e.target as HTMLElement;
            if (target.closest('.tl-container') || target.closest('[data-skema="container"]')) {
                // Stop tldraw from handling it
                e.stopPropagation();

                // Manually scroll the page
                window.scrollBy({
                    top: e.deltaY,
                    left: e.deltaX,
                    behavior: 'auto',
                });
            }
        };

        // Capture phase to intercept before tldraw
        document.addEventListener('wheel', handleWheel, { capture: true, passive: false });

        return () => {
            document.removeEventListener('wheel', handleWheel, { capture: true });
        };
    }, [isActive]);
}

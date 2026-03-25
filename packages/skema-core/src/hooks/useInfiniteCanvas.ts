// =============================================================================
// useInfiniteCanvas - Infinite canvas mode for Skema overlay
// =============================================================================

import { useEffect, useRef, useState, RefObject } from 'react';
import type { Editor } from 'tldraw';

interface InfiniteCanvasResult {
    portalContainer: HTMLDivElement | null;
    scrollOffset: { x: number; y: number };
}

/**
 * Hook that transforms the webpage into an infinite canvas when the overlay is active.
 *
 * - Renders Skema via a portal outside <body> so it's unaffected by body transforms
 * - Drives page position via CSS transform on <body> based on tldraw camera
 * - Shows a dot-grid background on <html>
 * - Returns scrollOffset derived from camera for overlay coordinate calculations
 */
export function useInfiniteCanvas(
    isActive: boolean,
    editorRef: RefObject<Editor | null>,
    zIndex: number = 99999
): InfiniteCanvasResult {
    const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
    const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 });

    // Store original styles for restoration
    const originalsRef = useRef<{
        htmlOverflow: string;
        htmlBackground: string;
        htmlBackgroundColor: string;
        htmlBackgroundImage: string;
        htmlBackgroundSize: string;
        htmlBackgroundPosition: string;
        bodyTransform: string;
        bodyTransformOrigin: string;
        bodyBoxShadow: string;
        bodyBackground: string;
        bodyPosition: string;
        bodyWidth: string;
        bodyMinHeight: string;
    } | null>(null);

    // Track the camera change handler cleanup
    const cleanupCameraRef = useRef<(() => void) | null>(null);

    // Create portal container on mount (always available)
    useEffect(() => {
        const container = document.createElement('div');
        container.id = 'skema-portal';
        container.style.position = 'fixed';
        container.style.inset = '0';
        container.style.zIndex = String(zIndex);
        container.style.pointerEvents = 'none';
        document.documentElement.appendChild(container);
        setPortalContainer(container);

        return () => {
            container.remove();
            setPortalContainer(null);
        };
    }, [zIndex]);

    // Manage infinite canvas mode activation/deactivation
    useEffect(() => {
        if (!isActive) {
            // Deactivating: restore original styles
            if (originalsRef.current) {
                const originals = originalsRef.current;
                const html = document.documentElement;
                const body = document.body;

                // Get camera position before restoring (for scroll restoration)
                const editor = editorRef.current;
                let restoreScrollX = 0;
                let restoreScrollY = 0;
                if (editor) {
                    const cam = editor.getCamera();
                    restoreScrollX = -cam.x;
                    restoreScrollY = -cam.y;
                }

                // Restore html styles
                html.style.overflow = originals.htmlOverflow;
                html.style.background = originals.htmlBackground;
                html.style.backgroundColor = originals.htmlBackgroundColor;
                html.style.backgroundImage = originals.htmlBackgroundImage;
                html.style.backgroundSize = originals.htmlBackgroundSize;
                html.style.backgroundPosition = originals.htmlBackgroundPosition;

                // Restore body styles
                body.style.transform = originals.bodyTransform;
                body.style.transformOrigin = originals.bodyTransformOrigin;
                body.style.boxShadow = originals.bodyBoxShadow;
                body.style.background = originals.bodyBackground;
                body.style.position = originals.bodyPosition;
                body.style.width = originals.bodyWidth;
                body.style.minHeight = originals.bodyMinHeight;

                originalsRef.current = null;

                // Restore scroll position
                window.scrollTo(restoreScrollX, restoreScrollY);
            }

            // Clean up camera handler
            if (cleanupCameraRef.current) {
                cleanupCameraRef.current();
                cleanupCameraRef.current = null;
            }

            setScrollOffset({ x: 0, y: 0 });
            return;
        }

        // Activating: save originals and apply infinite canvas styles
        const html = document.documentElement;
        const body = document.body;
        const editor = editorRef.current;

        // Save original styles
        originalsRef.current = {
            htmlOverflow: html.style.overflow,
            htmlBackground: html.style.background,
            htmlBackgroundColor: html.style.backgroundColor,
            htmlBackgroundImage: html.style.backgroundImage,
            htmlBackgroundSize: html.style.backgroundSize,
            htmlBackgroundPosition: html.style.backgroundPosition,
            bodyTransform: body.style.transform,
            bodyTransformOrigin: body.style.transformOrigin,
            bodyBoxShadow: body.style.boxShadow,
            bodyBackground: body.style.background,
            bodyPosition: body.style.position,
            bodyWidth: body.style.width,
            bodyMinHeight: body.style.minHeight,
        };

        // Capture current scroll position for initial camera
        const initialScrollX = window.scrollX;
        const initialScrollY = window.scrollY;

        // Lock scroll
        html.style.overflow = 'hidden';

        // Measure page content dimensions BEFORE resetting scroll
        const contentWidth = Math.max(body.scrollWidth, window.innerWidth);
        const contentHeight = Math.max(body.scrollHeight, window.innerHeight);

        // Apply initial body transform to compensate for scroll reset,
        // then reset scroll to (0,0) so the transform formula stays clean:
        // body.transform = translate(camX, camY) with viewport at (0,0)
        body.style.transformOrigin = '0 0';
        body.style.transform = `translate(${-initialScrollX}px, ${-initialScrollY}px)`;
        window.scrollTo(0, 0);

        // Apply dot grid to html
        html.style.backgroundColor = '#f5f5f5';
        html.style.backgroundImage = 'radial-gradient(circle, #d0d0d0 1px, transparent 1px)';
        html.style.backgroundSize = '20px 20px';
        html.style.backgroundPosition = `${-initialScrollX}px ${-initialScrollY}px`;

        // Style body as an artboard
        body.style.position = 'relative';
        body.style.width = `${contentWidth}px`;
        body.style.minHeight = `${contentHeight}px`;
        body.style.boxShadow = '0 4px 40px rgba(0,0,0,0.08)';
        // Ensure body has a non-transparent background
        const computedBg = window.getComputedStyle(body).backgroundColor;
        if (!computedBg || computedBg === 'rgba(0, 0, 0, 0)' || computedBg === 'transparent') {
            body.style.background = 'white';
        }

        // Set initial camera to match the former scroll position
        if (editor) {
            editor.setCamera({ x: -initialScrollX, y: -initialScrollY, z: 1 });
            setScrollOffset({ x: initialScrollX, y: initialScrollY });
        }

        // Subscribe to camera changes to sync body transform
        if (editor) {
            const cleanup = editor.sideEffects.registerAfterChangeHandler('camera', () => {
                const cam = editor.getCamera();
                body.style.transform = `translate(${cam.x}px, ${cam.y}px)`;
                html.style.backgroundPosition = `${cam.x}px ${cam.y}px`;
                setScrollOffset({ x: -cam.x, y: -cam.y });
            });
            cleanupCameraRef.current = cleanup;
        }

        // Intercept all wheel events and convert to camera pan
        // (tldraw's default wheel behavior is zoom, not pan;
        //  native scroll is locked, so all wheel should pan the canvas)
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (editor) {
                const cam = editor.getCamera();
                editor.setCamera({
                    x: cam.x - e.deltaX,
                    y: cam.y - e.deltaY,
                    z: 1,
                });
            }
        };

        document.addEventListener('wheel', handleWheel, { capture: true, passive: false });

        return () => {
            document.removeEventListener('wheel', handleWheel, { capture: true });
        };
    }, [isActive, editorRef]);

    return { portalContainer, scrollOffset };
}

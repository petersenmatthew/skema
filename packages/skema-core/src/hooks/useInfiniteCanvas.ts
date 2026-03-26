// =============================================================================
// useInfiniteCanvas - Infinite canvas mode for Skema overlay
// =============================================================================

import { useEffect, useRef, useState, RefObject } from 'react';
import type { Editor } from 'tldraw';

interface InfiniteCanvasResult {
    portalContainer: HTMLDivElement | null;
    scrollOffset: { x: number; y: number; zoom: number };
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
    const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0, zoom: 1 });

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
        bodyMargin: string;
        marginLeft: number;
        marginTop: number;
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
                    // Compensate for the margin we removed during activation
                    restoreScrollX = originals.marginLeft - cam.x;
                    restoreScrollY = originals.marginTop - cam.y;
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
                body.style.margin = originals.bodyMargin;

                originalsRef.current = null;

                // Restore scroll position
                window.scrollTo(restoreScrollX, restoreScrollY);
            }

            // Clean up camera handler
            if (cleanupCameraRef.current) {
                cleanupCameraRef.current();
                cleanupCameraRef.current = null;
            }

            setScrollOffset({ x: 0, y: 0, zoom: 1 });
            return;
        }

        // Activating: save originals and apply infinite canvas styles
        const html = document.documentElement;
        const body = document.body;
        const editor = editorRef.current;

        // Compute body margin before saving (needed for coordinate alignment)
        const computedStyle = window.getComputedStyle(body);
        const marginLeft = parseFloat(computedStyle.marginLeft) || 0;
        const marginTop = parseFloat(computedStyle.marginTop) || 0;

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
            bodyMargin: body.style.margin,
            marginLeft,
            marginTop,
        };

        // Capture current scroll position for initial camera
        const initialScrollX = window.scrollX;
        const initialScrollY = window.scrollY;

        // Zero body margin so tldraw shapes and body content share the same
        // coordinate origin. The margin sits outside CSS transforms, so at
        // different zoom levels it would create a diverging offset between
        // tldraw shapes (which don't know about margin) and DOM elements.
        body.style.margin = '0';

        // Lock scroll
        html.style.overflow = 'hidden';

        // Measure page content dimensions AFTER removing margin
        const contentWidth = Math.max(body.scrollWidth, window.innerWidth);
        const contentHeight = Math.max(body.scrollHeight, window.innerHeight);

        // Initial camera compensates for both the removed margin and scroll.
        // Before activation: viewport = bodyRel + margin - scroll
        // After (margin=0, scroll=0): viewport = bodyRel * scale + cam
        // So cam = margin - scroll to preserve the visual position.
        const initialCamX = marginLeft - initialScrollX;
        const initialCamY = marginTop - initialScrollY;

        // Apply initial body transform, then reset scroll to (0,0)
        body.style.transformOrigin = '0 0';
        body.style.transform = `scale(1) translate(${initialCamX}px, ${initialCamY}px)`;
        window.scrollTo(0, 0);

        // Apply dot grid to html
        html.style.backgroundColor = '#f5f5f5';
        html.style.backgroundImage = 'radial-gradient(circle, #d0d0d0 1px, transparent 1px)';
        html.style.backgroundSize = '20px 20px';
        html.style.backgroundPosition = `${initialCamX}px ${initialCamY}px`;

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

        // Set initial camera to match the former scroll position (with margin compensation)
        if (editor) {
            editor.setCamera({ x: initialCamX, y: initialCamY, z: 1 });
            setScrollOffset({ x: -initialCamX, y: -initialCamY, zoom: 1 });
        }

        // Subscribe to camera changes to sync body transform + scale
        if (editor) {
            const cleanup = editor.sideEffects.registerAfterChangeHandler('camera', () => {
                const cam = editor.getCamera();
                body.style.transform = `scale(${cam.z}) translate(${cam.x}px, ${cam.y}px)`;
                html.style.backgroundPosition = `${cam.x * cam.z}px ${cam.y * cam.z}px`;
                html.style.backgroundSize = `${20 * cam.z}px ${20 * cam.z}px`;
                setScrollOffset({ x: -cam.x * cam.z, y: -cam.y * cam.z, zoom: cam.z });
            });
            cleanupCameraRef.current = cleanup;
        }

        // Intercept all wheel events:
        // - Regular scroll → pan
        // - Ctrl+scroll / pinch → zoom (like Figma)
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (!editor) return;

            const cam = editor.getCamera();

            if (e.ctrlKey || e.metaKey) {
                // Zoom: Ctrl+wheel or trackpad pinch (browsers send ctrlKey for pinch)
                const zoomFactor = 1 - e.deltaY * 0.005;
                const newZ = Math.min(Math.max(cam.z * zoomFactor, 0.1), 8);

                // Zoom toward cursor position
                const cx = e.clientX;
                const cy = e.clientY;
                // World point under cursor: screen = (world + cam) * zoom → world = screen/zoom - cam
                const wx = cx / cam.z - cam.x;
                const wy = cy / cam.z - cam.y;
                // Keep same world point under cursor: cam = screen/zoom - world
                const newX = cx / newZ - wx;
                const newY = cy / newZ - wy;

                editor.setCamera({ x: newX, y: newY, z: newZ });
            } else {
                // Pan: divide by zoom so scrolling moves content 1:1 in screen pixels
                editor.setCamera({
                    x: cam.x - e.deltaX / cam.z,
                    y: cam.y - e.deltaY / cam.z,
                    z: cam.z,
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

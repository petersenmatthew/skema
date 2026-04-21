// =============================================================================
// useInfiniteCanvas - Infinite canvas mode for Skema overlay
// =============================================================================

import { useEffect, useRef, useState, RefObject } from 'react';
import { animate, type AnimationPlaybackControls } from 'framer-motion';
import type { Editor } from 'tldraw';

interface InfiniteCanvasResult {
    portalContainer: HTMLDivElement | null;
    scrollOffset: { x: number; y: number; zoom: number };
}

// Base duration for fade-in / fade-out of the canvas chrome (grid + artboard
// shadow). The deactivation duration is scaled up by the magnitude of the
// camera change (see deactivationDurationMs) so big zoom-outs and big pans
// both get more time to play out instead of finishing in a frantic burst.
const CHROME_TRANSITION_MS = 320;
const CHROME_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
const ARTBOARD_SHADOW = '0 4px 40px rgba(0,0,0,0.08)';

// Duration for the deactivation zoom + pan back to the natural page position.
// Combines two magnitudes:
//   • Zoom magnitude — log2 octaves of zoom we need to undo.
//   • Pan magnitude — distance from the current camera to the original one,
//     normalized to viewport diagonal.
// Both are capped so the animation never feels sluggish even for extremes.
function deactivationDurationMs(args: {
    camZ: number;
    camX: number;
    camY: number;
    initialCamX: number;
    initialCamY: number;
    viewportW: number;
    viewportH: number;
}): number {
    const { camZ, camX, camY, initialCamX, initialCamY, viewportW, viewportH } = args;
    const zoomOctaves = Math.log2(Math.max(camZ, 1 / camZ));
    const dx = camX - initialCamX;
    const dy = camY - initialCamY;
    const diag = Math.hypot(viewportW, viewportH) || 1;
    const panNorm = Math.hypot(dx, dy) / diag;
    const total = CHROME_TRANSITION_MS + 180 * zoomOctaves + 220 * panNorm;
    return Math.max(CHROME_TRANSITION_MS, Math.min(900, total));
}

interface SavedOriginals {
    htmlOverflow: string;
    bodyTransform: string;
    bodyTransformOrigin: string;
    bodyTransition: string;
    bodyBoxShadow: string;
    bodyBackground: string;
    bodyPosition: string;
    bodyWidth: string;
    bodyMinHeight: string;
    bodyMargin: string;
    marginLeft: number;
    marginTop: number;
    // Camera/scroll state at the moment of activation. Deactivation animates
    // back to these values so the page lands at a real, valid scroll position
    // (no scrollTo clamping → no snap at the end of the zoom-back).
    initialCamX: number;
    initialCamY: number;
    initialScrollX: number;
    initialScrollY: number;
}

/**
 * Hook that transforms the webpage into an infinite canvas when the overlay is active.
 *
 * - Renders Skema via a portal outside <body> so it's unaffected by body transforms
 * - Drives page position via CSS transform on <body> based on tldraw camera
 * - Shows a dot-grid background on a fade-able overlay element
 * - Returns scrollOffset derived from camera for overlay coordinate calculations
 *
 * Activation/deactivation of the canvas chrome (grid + artboard shadow) is animated
 * via CSS transitions so collapsing the toolbar doesn't snap the page back instantly.
 */
export function useInfiniteCanvas(
    isActive: boolean,
    editorRef: RefObject<Editor | null>,
    zIndex: number = 99999
): InfiniteCanvasResult {
    const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
    const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0, zoom: 1 });

    const originalsRef = useRef<SavedOriginals | null>(null);
    const cleanupCameraRef = useRef<(() => void) | null>(null);
    const gridOverlayRef = useRef<HTMLDivElement | null>(null);
    // Active framer-motion transform animation. We tween a parameter t from 0
    // → 1 and map it to (scale, tx, ty) inside onUpdate so the deactivation
    // un-zooms AND un-pans on the same eased timeline.
    const transformAnimRef = useRef<AnimationPlaybackControls | null>(null);
    // Sentinel: non-null while a deactivation tween is in flight, so a
    // re-activation can detect it and reverse back into canvas mode instead
    // of running the full activation setup again.
    const pendingDeactivationRef = useRef<number | null>(null);

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
        const html = document.documentElement;
        const body = document.body;

        // -------------------------------------------------------------------
        // Helpers
        // -------------------------------------------------------------------

        const finalizeDeactivation = () => {
            const originals = originalsRef.current;
            if (!originals) return;

            if (gridOverlayRef.current) {
                gridOverlayRef.current.remove();
                gridOverlayRef.current = null;
            }

            // Restore body styles. Clear transition first so restore is instant
            // and doesn't re-trigger an animation back to the canvas-mode value.
            body.style.transition = originals.bodyTransition;
            body.style.transform = originals.bodyTransform;
            body.style.transformOrigin = originals.bodyTransformOrigin;
            body.style.boxShadow = originals.bodyBoxShadow;
            body.style.background = originals.bodyBackground;
            body.style.position = originals.bodyPosition;
            body.style.width = originals.bodyWidth;
            body.style.minHeight = originals.bodyMinHeight;
            body.style.margin = originals.bodyMargin;
            html.style.overflow = originals.htmlOverflow;

            originalsRef.current = null;

            // Land on the original scroll position. This is by construction a
            // valid scroll (we read it from window.scrollX/Y at activation),
            // so there's no scrollTo clamping → no snap. The deactivation
            // tween's last frame had body transform scale(1) translate(initialCam),
            // and post-restore visual = (margin - scroll) + P = initialCam + P
            // because initialCam = margin - initialScroll. ✓ continuous.
            window.scrollTo(originals.initialScrollX, originals.initialScrollY);
            setScrollOffset({ x: 0, y: 0, zoom: 1 });
        };

        // -------------------------------------------------------------------
        // Deactivation
        // -------------------------------------------------------------------

        if (!isActive) {
            if (!originalsRef.current) return;

            const originals = originalsRef.current;

            // Stop syncing body to camera so we own the transform during the fade.
            if (cleanupCameraRef.current) {
                cleanupCameraRef.current();
                cleanupCameraRef.current = null;
            }

            // Cancel any in-flight transform animation (e.g., a reverse tween
            // from a recent re-activation that hadn't completed).
            if (transformAnimRef.current) {
                transformAnimRef.current.stop();
                transformAnimRef.current = null;
            }

            const editor = editorRef.current;
            const cam = editor ? editor.getCamera() : { x: 0, y: 0, z: 1 };
            const camZ = cam.z || 1;
            const camX = cam.x;
            const camY = cam.y;
            const W = window.innerWidth;
            const H = window.innerHeight;

            // End state: scale 1 with translate equal to the camera state we
            // captured at activation, which corresponds to the user's original
            // scroll position. This is by construction a valid scroll position
            // (no scrollTo clamping at finalize), so the deactivation can also
            // un-pan whatever the user did in canvas mode without snapping.
            const endZ = 1;
            const endX = originals.initialCamX;
            const endY = originals.initialCamY;

            // Interpolate the body's SCREEN-SPACE origin V = s·(tx,ty), not
            // (tx,ty) directly. CSS body transform is `scale(s) translate(tx,
            // ty)`, so a body-local point P appears on screen at
            //   visual(t, P) = s(t)·P + V(t).
            // If we make BOTH s(t) and V(t) linear in t, then visual(t, P) is
            // linear in t for every P → every body point travels a straight
            // diagonal line in screen space (no U-shape, no "left then right"
            // overshoot). We derive (tx, ty) from V and s each frame.
            const v0x = camZ * camX;
            const v0y = camZ * camY;
            const v1x = endZ * endX;
            const v1y = endZ * endY;

            const durationMs = deactivationDurationMs({
                camZ, camX, camY,
                initialCamX: endX, initialCamY: endY,
                viewportW: W, viewportH: H,
            });

            // Chrome (artboard shadow + dot grid) fades on the same timeline.
            body.style.transition = `box-shadow ${durationMs}ms ${CHROME_EASING}`;
            if (gridOverlayRef.current) {
                gridOverlayRef.current.style.transition = `opacity ${durationMs}ms ${CHROME_EASING}`;
                gridOverlayRef.current.style.opacity = '0';
            }
            body.style.boxShadow = originals.bodyBoxShadow || 'none';

            // Mark deactivation as pending so a re-activation can reverse
            // mid-flight rather than re-running setup.
            pendingDeactivationRef.current = 1;

            transformAnimRef.current = animate(0, 1, {
                duration: durationMs / 1000,
                ease: 'easeInOut',
                onUpdate: (t) => {
                    const s = camZ + t * (endZ - camZ);
                    const vx = v0x + t * (v1x - v0x);
                    const vy = v0y + t * (v1y - v0y);
                    const tx = vx / s;
                    const ty = vy / s;
                    body.style.transform = `scale(${s}) translate(${tx}px, ${ty}px)`;
                },
                onComplete: () => {
                    transformAnimRef.current = null;
                    pendingDeactivationRef.current = null;
                    finalizeDeactivation();
                },
            });

            return () => {
                // Tearing down before the fade finishes — cancel the tween and
                // finalize immediately so we don't leak DOM mutations or run
                // after unmount.
                if (transformAnimRef.current) {
                    transformAnimRef.current.stop();
                    transformAnimRef.current = null;
                }
                if (pendingDeactivationRef.current !== null) {
                    pendingDeactivationRef.current = null;
                    finalizeDeactivation();
                }
            };
        }

        // -------------------------------------------------------------------
        // Activation
        // -------------------------------------------------------------------

        // If a deactivation fade is mid-flight, cancel it and reverse back in.
        // The structural canvas-mode styles are still applied, so we only need
        // to re-animate the visuals.
        if (pendingDeactivationRef.current !== null && originalsRef.current) {
            if (transformAnimRef.current) {
                transformAnimRef.current.stop();
                transformAnimRef.current = null;
            }
            pendingDeactivationRef.current = null;

            if (gridOverlayRef.current) {
                gridOverlayRef.current.style.opacity = '1';
            }
            body.style.boxShadow = ARTBOARD_SHADOW;

            const editor = editorRef.current;
            const cam = editor ? editor.getCamera() : { x: 0, y: 0, z: 1 };
            const endZ = cam.z || 1;
            const endX = cam.x;
            const endY = cam.y;

            // Read the current scale + translate from the live body transform
            // so the reverse picks up exactly where the forward tween left off
            // — no jump, no rubber-banding.
            const currentTransform = body.style.transform;
            const scaleMatch = /scale\(([-0-9.]+)\)/.exec(currentTransform);
            const translateMatch = /translate\(([-0-9.]+)px,\s*([-0-9.]+)px\)/.exec(currentTransform);
            const startScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
            const startX = translateMatch ? parseFloat(translateMatch[1]) : endX;
            const startY = translateMatch ? parseFloat(translateMatch[2]) : endY;

            const W = window.innerWidth;
            const H = window.innerHeight;
            const reverseDurationMs = deactivationDurationMs({
                camZ: endZ, camX: endX, camY: endY,
                initialCamX: startX, initialCamY: startY,
                viewportW: W, viewportH: H,
            });

            // Same screen-space interpolation as the forward tween — see the
            // deactivation comment above for the derivation.
            const v0x = startScale * startX;
            const v0y = startScale * startY;
            const v1x = endZ * endX;
            const v1y = endZ * endY;

            transformAnimRef.current = animate(0, 1, {
                duration: reverseDurationMs / 1000,
                ease: 'easeInOut',
                onUpdate: (t) => {
                    const s = startScale + t * (endZ - startScale);
                    const vx = v0x + t * (v1x - v0x);
                    const vy = v0y + t * (v1y - v0y);
                    const tx = vx / s;
                    const ty = vy / s;
                    body.style.transform = `scale(${s}) translate(${tx}px, ${ty}px)`;
                },
                onComplete: () => {
                    transformAnimRef.current = null;
                    if (!isActive) return;
                    body.style.transition = `box-shadow ${CHROME_TRANSITION_MS}ms ${CHROME_EASING}`;
                    if (editor && cleanupCameraRef.current === null) {
                        cleanupCameraRef.current = editor.sideEffects.registerAfterChangeHandler('camera', () => {
                            const c = editor.getCamera();
                            body.style.transform = `scale(${c.z}) translate(${c.x}px, ${c.y}px)`;
                            if (gridOverlayRef.current) {
                                gridOverlayRef.current.style.backgroundPosition = `${c.x * c.z}px ${c.y * c.z}px`;
                                gridOverlayRef.current.style.backgroundSize = `${20 * c.z}px ${20 * c.z}px`;
                            }
                            setScrollOffset({ x: -c.x * c.z, y: -c.y * c.z, zoom: c.z });
                        });
                    }
                },
            });

            // Wheel intercept needs to be re-registered too.
            const handleWheel = makeWheelHandler(editorRef);
            document.addEventListener('wheel', handleWheel, { capture: true, passive: false });
            return () => {
                if (transformAnimRef.current) {
                    transformAnimRef.current.stop();
                    transformAnimRef.current = null;
                }
                document.removeEventListener('wheel', handleWheel, { capture: true });
            };
        }

        const editor = editorRef.current;

        // Compute body margin before zeroing it (needed for coordinate alignment).
        const computedStyle = window.getComputedStyle(body);
        const marginLeft = parseFloat(computedStyle.marginLeft) || 0;
        const marginTop = parseFloat(computedStyle.marginTop) || 0;

        // Capture current scroll position for initial camera.
        const initialScrollX = window.scrollX;
        const initialScrollY = window.scrollY;

        // Initial camera compensates for both the removed margin and scroll.
        // Before activation: viewport = bodyRel + margin - scroll
        // After (margin=0, scroll=0): viewport = bodyRel * scale + cam
        // So cam = margin - scroll to preserve the visual position.
        const initialCamX = marginLeft - initialScrollX;
        const initialCamY = marginTop - initialScrollY;

        // Save original styles + camera/scroll so we can restore + animate
        // back to them later.
        originalsRef.current = {
            htmlOverflow: html.style.overflow,
            bodyTransform: body.style.transform,
            bodyTransformOrigin: body.style.transformOrigin,
            bodyTransition: body.style.transition,
            bodyBoxShadow: body.style.boxShadow,
            bodyBackground: body.style.background,
            bodyPosition: body.style.position,
            bodyWidth: body.style.width,
            bodyMinHeight: body.style.minHeight,
            bodyMargin: body.style.margin,
            marginLeft,
            marginTop,
            initialCamX,
            initialCamY,
            initialScrollX,
            initialScrollY,
        };

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

        // Apply initial body transform, then reset scroll to (0,0)
        body.style.transformOrigin = '0 0';
        body.style.transform = `scale(1) translate(${initialCamX}px, ${initialCamY}px)`;
        window.scrollTo(0, 0);

        // Style body as an artboard. Add a CSS transition for box-shadow so
        // the artboard shadow fades in here and fades out on deactivation.
        body.style.transition = `box-shadow ${CHROME_TRANSITION_MS}ms ${CHROME_EASING}`;
        body.style.position = 'relative';
        body.style.width = `${contentWidth}px`;
        body.style.minHeight = `${contentHeight}px`;
        body.style.boxShadow = ARTBOARD_SHADOW;
        // Ensure body has a non-transparent background
        const computedBg = window.getComputedStyle(body).backgroundColor;
        if (!computedBg || computedBg === 'rgba(0, 0, 0, 0)' || computedBg === 'transparent') {
            body.style.background = 'white';
        }

        // Create the dot-grid overlay as a fade-able element behind the body.
        // body has position:relative + opaque background, so the grid only
        // shows around the artboard, exactly like the original html-bg approach.
        const gridOverlay = document.createElement('div');
        gridOverlay.id = 'skema-canvas-grid';
        gridOverlay.style.position = 'fixed';
        gridOverlay.style.inset = '0';
        gridOverlay.style.zIndex = '-1';
        gridOverlay.style.pointerEvents = 'none';
        gridOverlay.style.backgroundColor = '#f5f5f5';
        gridOverlay.style.backgroundImage = 'radial-gradient(circle, #d0d0d0 1px, transparent 1px)';
        gridOverlay.style.backgroundSize = '20px 20px';
        gridOverlay.style.backgroundPosition = `${initialCamX}px ${initialCamY}px`;
        gridOverlay.style.opacity = '0';
        gridOverlay.style.transition = `opacity ${CHROME_TRANSITION_MS}ms ${CHROME_EASING}`;
        document.documentElement.appendChild(gridOverlay);
        gridOverlayRef.current = gridOverlay;

        // Force a reflow so the browser registers opacity:0 as the starting
        // value before we flip it to 1 (otherwise the transition is skipped).
        void gridOverlay.offsetHeight;
        gridOverlay.style.opacity = '1';

        // Set initial camera to match the former scroll position.
        if (editor) {
            editor.setCamera({ x: initialCamX, y: initialCamY, z: 1 });
            setScrollOffset({ x: -initialCamX, y: -initialCamY, zoom: 1 });
        }

        // Subscribe to camera changes to sync body transform + grid background.
        if (editor) {
            const cleanup = editor.sideEffects.registerAfterChangeHandler('camera', () => {
                const cam = editor.getCamera();
                body.style.transform = `scale(${cam.z}) translate(${cam.x}px, ${cam.y}px)`;
                if (gridOverlayRef.current) {
                    gridOverlayRef.current.style.backgroundPosition = `${cam.x * cam.z}px ${cam.y * cam.z}px`;
                    gridOverlayRef.current.style.backgroundSize = `${20 * cam.z}px ${20 * cam.z}px`;
                }
                setScrollOffset({ x: -cam.x * cam.z, y: -cam.y * cam.z, zoom: cam.z });
            });
            cleanupCameraRef.current = cleanup;
        }

        // Intercept all wheel events:
        // - Regular scroll → pan
        // - Ctrl+scroll / pinch → zoom (like Figma)
        const handleWheel = makeWheelHandler(editorRef);
        document.addEventListener('wheel', handleWheel, { capture: true, passive: false });

        return () => {
            document.removeEventListener('wheel', handleWheel, { capture: true });
        };
    }, [isActive, editorRef]);

    return { portalContainer, scrollOffset };
}

// =============================================================================
// Helpers
// =============================================================================

function makeWheelHandler(editorRef: RefObject<Editor | null>): (e: WheelEvent) => void {
    return (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const editor = editorRef.current;
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
}

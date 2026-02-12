// =============================================================================
// Skema - Main Drawing Overlay Component
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Tldraw,
  Editor,
  TLShapeId,
  StateNode,
  TLClickEventInfo,
  ArrowShapeKindStyle,
} from 'tldraw';
import 'tldraw/tldraw.css';

// Tools
import { LassoSelectTool } from '../tools/LassoSelectTool';

// Types
import type { Annotation, DOMSelection, SkemaProps, BoundingBox, PendingAnnotation } from '../types';

// Hooks
import { useDaemon } from '../hooks/useDaemon';

// Utils
import { getViewportInfo, bboxIntersects } from '../utils/coordinates';
import {
  createDOMSelection,
  shouldIgnoreElement,
  findNearbyElementsWithStyles,
  extractProjectStyleContext,
  getBoundingBox,
} from '../utils/element-identification';
import { blobToBase64, addGridToSvg, extractTextFromShapes } from '../lib/utils';

// Extracted Components
import { SkemaToolbar } from './toolbar/SkemaToolbar';
import { AnnotationMarkersLayer } from './annotations/AnnotationMarker';
import { AnnotationsSidebar } from './annotations/AnnotationsSidebar';
import { SelectionOverlay } from './overlays/SelectionOverlay';
import { ProcessingOverlay } from './overlays/ProcessingOverlay';
import { AnnotationPopup, AnnotationPopupHandle } from './AnnotationPopup';
import { SettingsPanel } from './settings/SettingsPanel';

// Extracted Hooks
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useScrollSync, useWheelIntercept } from '../hooks/useScrollSync';
import { useShapePersistence } from '../hooks/useShapePersistence';
import { useScribbleDelete } from '../hooks/useScribbleDelete';

// Extracted Config
import { skemaComponents, skemaOverrides, skemaHiddenUiStyles, skemaToastStyles } from '../lib/tldrawConfig';

/**
 * Main Skema component - renders tldraw as a transparent overlay
 */
export const Skema: React.FC<SkemaProps> = ({
  enabled = true,
  daemonUrl = 'ws://localhost:9999',
  onAnnotationsChange,
  onAnnotationSubmit: externalOnAnnotationSubmit,
  onAnnotationDelete: externalOnAnnotationDelete,
  onProcessingCancel: externalOnProcessingCancel,
  toggleShortcut = 'mod+shift+e',
  initialAnnotations = [],
  zIndex = 99999,
  isProcessing: externalIsProcessing,
}) => {
  // =============================================================================
  // State
  // =============================================================================
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [domSelections, setDomSelections] = useState<DOMSelection[]>([]);
  const [pendingAnnotation, setPendingAnnotation] = useState<PendingAnnotation | null>(null);
  const [pendingExiting, setPendingExiting] = useState(false);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [processingBoundingBox, setProcessingBoundingBox] = useState<BoundingBox | null>(null);
  const [scribbleToast, setScribbleToast] = useState<string | null>(null);
  const [internalIsProcessing, setInternalIsProcessing] = useState(false);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
  const [isStylePanelOpen, setIsStylePanelOpen] = useState(false);

  // Track annotation IDs to their change IDs for reverting
  const annotationChangesRef = useRef<Map<string, string>>(new Map());

  // =============================================================================
  // Daemon Connection (auto-connect when daemonUrl is provided)
  // =============================================================================
  const {
    state: daemonState,
    isGenerating,
    generate,
    revert,
    setMode,
    setProvider,
    setApiKey,
  } = useDaemon({
    url: daemonUrl || 'ws://localhost:9999',
    autoConnect: daemonUrl !== null,
    autoReconnect: daemonUrl !== null,
  });

  // Use external isProcessing if provided, otherwise use internal state
  const isProcessing = externalIsProcessing !== undefined ? externalIsProcessing : (internalIsProcessing || isGenerating);

  // =============================================================================
  // Internal Handlers (used when external callbacks not provided)
  // =============================================================================
  const internalOnAnnotationSubmit = useCallback(async (annotation: Annotation, comment: string) => {
    if (!daemonState.connected) {
      console.warn('[Skema] Not connected to daemon. Run: npx skema-serve');
      return;
    }

    setInternalIsProcessing(true);

    try {
      const result = await generate(
        { ...annotation, comment },
        (event) => {
          // Log events to browser console
          if (event.type === 'text') {
            console.log(`%c[Skema ${daemonState.provider}]`, 'color: #10b981', event.content);
          } else if (event.type === 'error') {
            console.error('[Skema Error]', event.content);
          }
        }
      );

      // Track annotation ID for revert
      if (result.annotationId) {
        annotationChangesRef.current.set(annotation.id, result.annotationId);
      }
    } catch (error) {
      console.error('[Skema] Failed to generate:', error);
    } finally {
      setInternalIsProcessing(false);
    }
  }, [daemonState.connected, daemonState.provider, generate]);

  const internalOnAnnotationDelete = useCallback(async (annotationId: string) => {
    const trackedId = annotationChangesRef.current.get(annotationId);
    if (!trackedId) {
      return;
    }

    try {
      await revert(trackedId);
      annotationChangesRef.current.delete(annotationId);
    } catch (error) {
      console.error('[Skema] Failed to revert:', error);
    }
  }, [revert]);

  const internalOnProcessingCancel = useCallback(() => {
    setInternalIsProcessing(false);
  }, []);

  // Use external callbacks if provided, otherwise use internal ones
  const onAnnotationSubmit = externalOnAnnotationSubmit || (daemonUrl !== null ? internalOnAnnotationSubmit : undefined);
  const onAnnotationDelete = externalOnAnnotationDelete || (daemonUrl !== null ? internalOnAnnotationDelete : undefined);
  const onProcessingCancel = externalOnProcessingCancel || internalOnProcessingCancel;

  // =============================================================================
  // Refs
  // =============================================================================
  const editorRef = useRef<Editor | null>(null);
  const popupRef = useRef<AnnotationPopupHandle>(null);
  const lastDoubleClickRef = useRef<number>(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  // =============================================================================
  // Custom Hooks
  // =============================================================================

  // Keyboard shortcut to toggle toolbar expansion
  useKeyboardShortcuts({
    onToggle: useCallback(() => setIsToolbarExpanded(prev => !prev), []),
    shortcut: toggleShortcut,
  });

  // Scroll sync between page and tldraw camera
  const scrollOffset = useScrollSync(isToolbarExpanded, editorRef);

  // Intercept wheel events to scroll page instead of panning tldraw
  useWheelIntercept(isToolbarExpanded);

  // Persist shapes when toggling overlay off/on
  useShapePersistence(isToolbarExpanded, editorRef);

  // Scribble gesture detection for delete
  useScribbleDelete({
    isActive: isToolbarExpanded,
    editorRef,
    setAnnotations,
    setScribbleToast,
  });

  // =============================================================================
  // Effects
  // =============================================================================

  // Notify parent of annotation changes
  useEffect(() => {
    onAnnotationsChange?.(annotations);
  }, [annotations, onAnnotationsChange]);

  // Clear processing bounding box when processing completes
  useEffect(() => {
    if (!isProcessing) {
      setProcessingBoundingBox(null);
    }
  }, [isProcessing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  // Recalculate bounding boxes on window resize
  useEffect(() => {
    if (!isToolbarExpanded) return;

    const handleResize = () => {
      // Update domSelections bounding boxes
      setDomSelections((prevSelections) => {
        if (prevSelections.length === 0) return prevSelections;

        return prevSelections.map((selection) => {
          // Handle multi-select with individual elements
          if (selection.isMultiSelect && selection.elements) {
            const updatedElements = selection.elements.map((el) => {
              const domElement = document.querySelector(el.selector) as HTMLElement | null;
              if (domElement) {
                return { ...el, boundingBox: getBoundingBox(domElement) };
              }
              return el;
            });

            // Recalculate combined bounding box
            const validElements = updatedElements.filter((el) => {
              const domEl = document.querySelector(el.selector);
              return domEl !== null;
            });

            if (validElements.length > 0) {
              const minX = Math.min(...updatedElements.map((e) => e.boundingBox.x));
              const minY = Math.min(...updatedElements.map((e) => e.boundingBox.y));
              const maxX = Math.max(...updatedElements.map((e) => e.boundingBox.x + e.boundingBox.width));
              const maxY = Math.max(...updatedElements.map((e) => e.boundingBox.y + e.boundingBox.height));

              return {
                ...selection,
                elements: updatedElements,
                boundingBox: {
                  x: minX,
                  y: minY,
                  width: maxX - minX,
                  height: maxY - minY,
                },
              };
            }
            return selection;
          }

          // Single element selection
          const domElement = document.querySelector(selection.selector) as HTMLElement | null;
          if (domElement) {
            return { ...selection, boundingBox: getBoundingBox(domElement) };
          }
          return selection;
        });
      });

      // Update annotations bounding boxes for dom_selection types
      setAnnotations((prevAnnotations) => {
        if (prevAnnotations.length === 0) return prevAnnotations;

        return prevAnnotations.map((annotation) => {
          if (annotation.type !== 'dom_selection') return annotation;

          // Handle multi-select with individual elements
          if (annotation.isMultiSelect && annotation.elements) {
            const updatedElements = annotation.elements.map((el) => {
              const domElement = document.querySelector(el.selector) as HTMLElement | null;
              if (domElement) {
                return { ...el, boundingBox: getBoundingBox(domElement) };
              }
              return el;
            });

            const validElements = updatedElements.filter((el) => {
              const domEl = document.querySelector(el.selector);
              return domEl !== null;
            });

            if (validElements.length > 0) {
              const minX = Math.min(...updatedElements.map((e) => e.boundingBox.x));
              const minY = Math.min(...updatedElements.map((e) => e.boundingBox.y));
              const maxX = Math.max(...updatedElements.map((e) => e.boundingBox.x + e.boundingBox.width));
              const maxY = Math.max(...updatedElements.map((e) => e.boundingBox.y + e.boundingBox.height));

              return {
                ...annotation,
                elements: updatedElements,
                boundingBox: {
                  x: minX,
                  y: minY,
                  width: maxX - minX,
                  height: maxY - minY,
                },
              };
            }
            return annotation;
          }

          // Single element selection
          const domElement = document.querySelector(annotation.selector) as HTMLElement | null;
          if (domElement) {
            return { ...annotation, boundingBox: getBoundingBox(domElement) };
          }
          return annotation;
        });
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isToolbarExpanded]);

  // =============================================================================
  // Helper Functions
  // =============================================================================

  // Get selected drawing shapes from tldraw
  const getSelectedDrawings = useCallback(() => {
    if (!editorRef.current) return [];
    const editor = editorRef.current;
    const selectedIds = editor.getSelectedShapeIds();
    const shapes = selectedIds.map(id => editor.getShape(id)).filter(Boolean);
    return shapes.filter(shape =>
      shape && ['draw', 'line', 'arrow', 'geo', 'text', 'note'].includes(shape.type)
    );
  }, []);

  // Find DOM elements that intersect with a bounding box
  const findDOMElementsInBounds = useCallback((bounds: BoundingBox): HTMLElement[] => {
    const elements: HTMLElement[] = [];
    const allElements = document.querySelectorAll('*');

    allElements.forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      if (shouldIgnoreElement(el)) return;

      const rect = el.getBoundingClientRect();
      const elBounds: BoundingBox = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };

      // Skip tiny elements
      if (elBounds.width < 10 || elBounds.height < 10) return;

      if (bboxIntersects(bounds, elBounds)) {
        const isParent = elements.some((existing) => el.contains(existing));
        if (!isParent) {
          const filtered = elements.filter((existing) => !existing.contains(el) && !el.contains(existing));
          filtered.push(el);
          elements.length = 0;
          elements.push(...filtered);
        }
      }
    });

    return elements;
  }, []);

  // =============================================================================
  // DOM Selection Handlers
  // =============================================================================

  const handleDOMSelect = useCallback((selection: DOMSelection) => {
    const selectedDrawings = getSelectedDrawings();
    const hasDrawings = selectedDrawings.length > 0;
    const rect = selection.boundingBox;
    const x = ((rect.x + rect.width / 2) / window.innerWidth) * 100;
    const clientY = rect.y - window.scrollY + rect.height / 2;

    let elementDesc = selection.tagName;
    if (hasDrawings) {
      elementDesc = `Drawing + ${selection.tagName}`;
    }

    setPendingAnnotation({
      x,
      y: rect.y + rect.height / 2,
      clientY,
      element: elementDesc,
      elementPath: selection.elementPath,
      selectedText: selection.text?.slice(0, 100),
      boundingBox: rect,
      isMultiSelect: hasDrawings,
      selections: [selection],
      annotationType: hasDrawings ? 'drawing' : 'dom_selection',
      shapeIds: hasDrawings ? editorRef.current?.getSelectedShapeIds() as string[] : undefined,
    });
  }, [getSelectedDrawings]);

  const handleMultiDOMSelect = useCallback((selections: DOMSelection[]) => {
    if (selections.length === 0) return;

    const selectedDrawings = getSelectedDrawings();
    const hasDrawings = selectedDrawings.length > 0;

    const minX = Math.min(...selections.map(s => s.boundingBox.x));
    const minY = Math.min(...selections.map(s => s.boundingBox.y));
    const maxX = Math.max(...selections.map(s => s.boundingBox.x + s.boundingBox.width));
    const maxY = Math.max(...selections.map(s => s.boundingBox.y + s.boundingBox.height));

    const combinedBounds: BoundingBox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };

    const centerX = minX + (maxX - minX) / 2;
    const centerY = minY + (maxY - minY) / 2;
    const x = (centerX / window.innerWidth) * 100;
    const clientY = centerY - window.scrollY;

    const elementNames = selections.slice(0, 3).map(s => s.tagName).join(', ');
    const suffix = selections.length > 3 ? ` +${selections.length - 3} more` : '';
    let element = `${selections.length} elements: ${elementNames}${suffix}`;

    if (hasDrawings) {
      const drawingCount = selectedDrawings.length;
      element = `Drawing (${drawingCount}) + ${element}`;
    }

    setPendingAnnotation({
      x,
      y: centerY,
      clientY,
      element,
      elementPath: 'multi-select',
      boundingBox: combinedBounds,
      isMultiSelect: true,
      selections,
      annotationType: hasDrawings ? 'drawing' : 'dom_selection',
      shapeIds: hasDrawings ? editorRef.current?.getSelectedShapeIds() as string[] : undefined,
    });
  }, [getSelectedDrawings]);

  // =============================================================================
  // Drawing Annotation Handler
  // =============================================================================

  const handleDrawingAnnotation = useCallback((selectedIds: TLShapeId[], skipDomElements = false) => {
    if (!editorRef.current || selectedIds.length === 0) return;
    if (pendingAnnotation) return;

    const editor = editorRef.current;
    const selectedShapes = selectedIds.map((id) => editor.getShape(id)).filter(Boolean);
    if (selectedShapes.length === 0) return;

    // Calculate bounds from shapes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const shape of selectedShapes) {
      if (!shape) continue;
      const bounds = editor.getShapePageBounds(shape.id);
      if (bounds) {
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width);
        maxY = Math.max(maxY, bounds.y + bounds.height);
      }
    }
    if (minX === Infinity) return;

    const selectionBounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

    const drawingShapes = selectedShapes.filter(shape =>
      shape && ['draw', 'line', 'arrow', 'geo', 'text', 'note'].includes(shape.type)
    );
    if (drawingShapes.length === 0) return;

    // Find DOM elements in bounds (unless skipped)
    let domElements: HTMLElement[] = [];
    if (!skipDomElements) {
      const viewportBounds: BoundingBox = {
        x: selectionBounds.x - window.scrollX,
        y: selectionBounds.y - window.scrollY,
        width: selectionBounds.width,
        height: selectionBounds.height,
      };
      domElements = findDOMElementsInBounds(viewportBounds);
    }

    const centerX = selectionBounds.x + selectionBounds.width / 2;
    const centerY = selectionBounds.y + selectionBounds.height / 2;
    const x = ((centerX - window.scrollX) / window.innerWidth) * 100;
    const clientY = centerY - window.scrollY;

    let elementDesc = `Drawing (${drawingShapes.length} shape${drawingShapes.length > 1 ? 's' : ''})`;
    if (domElements.length > 0) {
      const domNames = domElements.slice(0, 2).map(el => el.tagName.toLowerCase()).join(', ');
      const domSuffix = domElements.length > 2 ? ` +${domElements.length - 2} more` : '';
      elementDesc += ` + ${domNames}${domSuffix}`;
    }

    const newDomSelections = domElements.map(el => createDOMSelection(el));

    setPendingAnnotation({
      x,
      y: centerY,
      clientY,
      element: elementDesc,
      elementPath: 'drawing',
      boundingBox: selectionBounds,
      isMultiSelect: drawingShapes.length > 1 || domElements.length > 0,
      annotationType: 'drawing',
      shapeIds: selectedIds as string[],
      selections: newDomSelections.length > 0 ? newDomSelections : undefined,
    });
  }, [pendingAnnotation, findDOMElementsInBounds]);

  // =============================================================================
  // Annotation Submit/Cancel/Delete Handlers
  // =============================================================================

  const handleAnnotationSubmit = useCallback(async (comment: string) => {
    if (!pendingAnnotation) return;

    // Generate IDs once to ensure consistency between state and callback
    const now = Date.now();
    let submittedAnnotation: Annotation | undefined;

    if (pendingAnnotation.annotationType === 'dom_selection' && pendingAnnotation.selections) {
      const selections = pendingAnnotation.selections;

      if (selections.length === 1) {
        const selection = { ...selections[0], comment };
        setDomSelections((prev) => [...prev, selection]);
        setAnnotations((prev) => [...prev, { type: 'dom_selection' as const, ...selection }]);
        submittedAnnotation = { type: 'dom_selection' as const, ...selections[0], comment };
      } else {
        const groupedSelection: DOMSelection = {
          id: `group-${now}`,
          selector: selections.map(s => s.selector).join(', '),
          tagName: pendingAnnotation.element,
          elementPath: selections[0].elementPath,
          text: selections.map(s => s.text).filter(Boolean).join(' | ').slice(0, 200),
          boundingBox: pendingAnnotation.boundingBox!,
          timestamp: now,
          pathname: selections[0].pathname,
          comment,
          isMultiSelect: true,
          elements: selections.map(s => ({
            selector: s.selector,
            tagName: s.tagName,
            elementPath: s.elementPath,
            text: s.text,
            boundingBox: s.boundingBox,
            cssClasses: s.cssClasses,
            attributes: s.attributes,
          })),
        };
        setDomSelections((prev) => [...prev, groupedSelection]);
        setAnnotations((prev) => [...prev, { type: 'dom_selection' as const, ...groupedSelection }]);
        submittedAnnotation = { type: 'dom_selection' as const, ...groupedSelection };
      }
    } else if (pendingAnnotation.annotationType === 'drawing' && pendingAnnotation.shapeIds) {
      // Drawing annotation - extract SVG, PNG image
      const editor = editorRef.current;
      let drawingSvg: string | undefined;
      let drawingImage: string | undefined;
      let extractedText: string | undefined;
      const gridConfig = { color: '#0066FF', size: 100, labels: true };

      if (editor && pendingAnnotation.shapeIds && pendingAnnotation.shapeIds.length > 0) {
        const shapeIds = pendingAnnotation.shapeIds as TLShapeId[];

        try {
          const svgResult = await editor.getSvgString(shapeIds, { padding: 20, background: false });
          if (svgResult?.svg) {
            drawingSvg = addGridToSvg(svgResult.svg, gridConfig);
          }
        } catch (e) {
          console.warn('[Skema] Failed to export drawing SVG:', e);
        }

        try {
          const imageResult = await editor.toImage(shapeIds, { format: 'png', padding: 20, background: true });
          if (imageResult?.blob) {
            drawingImage = await blobToBase64(imageResult.blob);
          }
        } catch (e) {
          console.warn('[Skema] Failed to export drawing image:', e);
        }

        try {
          const shapes = shapeIds.map(id => editor.getShape(id)).filter(Boolean);
          extractedText = extractTextFromShapes(shapes);
        } catch (e) {
          console.warn('[Skema] Failed to extract text from shapes:', e);
        }
      }

      const nearbyElements = pendingAnnotation.boundingBox
        ? findNearbyElementsWithStyles(pendingAnnotation.boundingBox, 5)
        : [];
      const projectStyles = extractProjectStyleContext();
      const viewport = getViewportInfo();

      // Create the drawing annotation once with consistent ID
      const drawingAnnotation: Annotation = {
        id: `drawing-${now}`,
        type: 'drawing',
        tool: 'draw',
        shapes: pendingAnnotation.shapeIds,
        boundingBox: pendingAnnotation.boundingBox!,
        timestamp: now,
        comment,
        drawingSvg,
        drawingImage,
        extractedText: extractedText || undefined,
        gridConfig,
        nearbyElements,
        viewport,
        projectStyles,
      };
      setAnnotations((prev) => [...prev, drawingAnnotation]);
      submittedAnnotation = drawingAnnotation;
    }

    // Call onAnnotationSubmit callback with the same annotation object
    if (onAnnotationSubmit && submittedAnnotation) {
      if (pendingAnnotation.boundingBox) {
        setProcessingBoundingBox(pendingAnnotation.boundingBox);
      }
      onAnnotationSubmit(submittedAnnotation, comment);
    }

    // Animate out and clear
    setPendingExiting(true);
    setTimeout(() => {
      setPendingAnnotation(null);
      setPendingExiting(false);
    }, 150);
  }, [pendingAnnotation, onAnnotationSubmit]);

  const handleAnnotationCancel = useCallback(() => {
    setPendingExiting(true);
    if (isProcessing) {
      onProcessingCancel?.();
    }
    setProcessingBoundingBox(null);
    if (editorRef.current) {
      editorRef.current.setSelectedShapes([]);
    }
    setTimeout(() => {
      setPendingAnnotation(null);
      setPendingExiting(false);
    }, 150);
  }, [isProcessing, onProcessingCancel]);

  const handleDeleteAnnotation = useCallback((annotation: Annotation) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== annotation.id));
    if (annotation.type === 'dom_selection') {
      setDomSelections((prev) => prev.filter((s) => s.id !== annotation.id));
    }
    setHoveredMarkerId(null);

    if (isProcessing) {
      onProcessingCancel?.();
      setProcessingBoundingBox(null);
    }
    onAnnotationDelete?.(annotation.id);
  }, [onAnnotationDelete, isProcessing, onProcessingCancel]);

  const handleClear = useCallback(() => {
    setAnnotations([]);
    setDomSelections([]);
    if (editorRef.current) {
      editorRef.current.selectAll();
      editorRef.current.deleteShapes(editorRef.current.getSelectedShapeIds());
    }
  }, []);

  const handleExport = useCallback(() => {
    const exportData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      viewport: getViewportInfo(),
      pathname: window.location.pathname,
      annotations,
    };
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    console.log('[Skema] Exported annotations:', exportData);
    alert('Annotations copied to clipboard!');
  }, [annotations]);

  // =============================================================================
  // Brush/Lasso Selection Handlers
  // =============================================================================

  const handleBrushSelection = useCallback((brushBounds: BoundingBox) => {
    if (editorRef.current) {
      const selectedShapeIds = editorRef.current.getSelectedShapeIds();
      if (selectedShapeIds.length > 0) {
        handleDrawingAnnotation(selectedShapeIds, true);
        return;
      }
    }

    const viewportBounds: BoundingBox = {
      x: brushBounds.x - window.scrollX,
      y: brushBounds.y - window.scrollY,
      width: brushBounds.width,
      height: brushBounds.height,
    };

    const foundElements = findDOMElementsInBounds(viewportBounds);
    const newElements = foundElements.filter((el) => {
      const rect = el.getBoundingClientRect();
      return !domSelections.some(
        (s) => Math.abs(s.boundingBox.x - (rect.left + window.scrollX)) < 5 &&
          Math.abs(s.boundingBox.y - (rect.top + window.scrollY)) < 5
      );
    });

    if (newElements.length === 0) return;

    const selections = newElements.map(el => createDOMSelection(el));
    if (selections.length === 1) {
      handleDOMSelect(selections[0]);
    } else {
      handleMultiDOMSelect(selections);
    }
  }, [findDOMElementsInBounds, domSelections, handleDOMSelect, handleMultiDOMSelect, handleDrawingAnnotation]);

  const handleLassoSelection = useCallback((lassoPoints: { x: number; y: number }[]) => {
    if (lassoPoints.length < 3) return;

    if (editorRef.current) {
      const selectedShapeIds = editorRef.current.getSelectedShapeIds();
      if (selectedShapeIds.length > 0) {
        handleDrawingAnnotation(selectedShapeIds, true);
        return;
      }
    }

    const viewportPoints = lassoPoints.map(p => ({
      x: p.x - window.scrollX,
      y: p.y - window.scrollY,
    }));

    let lassoMinX = Infinity, lassoMinY = Infinity;
    let lassoMaxX = -Infinity, lassoMaxY = -Infinity;
    for (const p of viewportPoints) {
      lassoMinX = Math.min(lassoMinX, p.x);
      lassoMinY = Math.min(lassoMinY, p.y);
      lassoMaxX = Math.max(lassoMaxX, p.x);
      lassoMaxY = Math.max(lassoMaxY, p.y);
    }

    const allElements = document.querySelectorAll('*');
    const foundElements: HTMLElement[] = [];

    allElements.forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      if (shouldIgnoreElement(el)) return;

      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;

      const boundsOverlap = !(
        rect.left > lassoMaxX ||
        rect.right < lassoMinX ||
        rect.top > lassoMaxY ||
        rect.bottom < lassoMinY
      );

      if (boundsOverlap) {
        const isParent = foundElements.some((existing) => el.contains(existing));
        if (!isParent) {
          const filtered = foundElements.filter((existing) => !existing.contains(el) && !el.contains(existing));
          filtered.push(el);
          foundElements.length = 0;
          foundElements.push(...filtered);
        }
      }
    });

    const newElements = foundElements.filter((el) => {
      const rect = el.getBoundingClientRect();
      return !domSelections.some(
        (s) => Math.abs(s.boundingBox.x - (rect.left + window.scrollX)) < 5 &&
          Math.abs(s.boundingBox.y - (rect.top + window.scrollY)) < 5
      );
    });

    if (newElements.length === 0) return;

    const selections = newElements.map(el => createDOMSelection(el));
    if (selections.length === 1) {
      handleDOMSelect(selections[0]);
    } else {
      handleMultiDOMSelect(selections);
    }
  }, [domSelections, handleDOMSelect, handleMultiDOMSelect, handleDrawingAnnotation]);

  // =============================================================================
  // Editor Mount Handler
  // =============================================================================

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Set default arrow style to arc (curved)
    editor.setStyleForNextShapes(ArrowShapeKindStyle, 'arc');

    // Override double click behavior
    try {
      type IdleStateNode = StateNode & {
        handleDoubleClickOnCanvas(info: TLClickEventInfo): void;
        handleDoubleClickOnShape?(info: TLClickEventInfo, shape: any): void;
      };
      const selectIdleState = editor.getStateDescendant<IdleStateNode>('select.idle');
      if (selectIdleState) {
        selectIdleState.handleDoubleClickOnCanvas = (_info) => {
          lastDoubleClickRef.current = Date.now();
          const point = editor.inputs.currentScreenPoint;
          const elements = document.elementsFromPoint(point.x, point.y);

          const target = elements.find(el =>
            el instanceof HTMLElement && !shouldIgnoreElement(el as HTMLElement)
          ) as HTMLElement | undefined;

          if (target) {
            const selection = createDOMSelection(target);
            const rect = selection.boundingBox;
            const x = ((rect.x + rect.width / 2) / window.innerWidth) * 100;
            const clientY = rect.y - window.scrollY + rect.height / 2;

            setPendingAnnotation({
              x,
              y: rect.y + rect.height / 2,
              clientY,
              element: selection.tagName,
              elementPath: selection.elementPath,
              selectedText: selection.text?.slice(0, 100),
              boundingBox: rect,
              isMultiSelect: false,
              selections: [selection],
              annotationType: 'dom_selection',
            });
          }
        };

        selectIdleState.handleDoubleClickOnShape = (_info, shape) => {
          lastDoubleClickRef.current = Date.now();
          if (shape && ['draw', 'line', 'arrow', 'geo', 'text', 'note'].includes(shape.type)) {
            const selectedIds = editor.getSelectedShapeIds();
            const shapeIds = selectedIds.length > 0 ? selectedIds : [shape.id];
            handleDrawingAnnotation(shapeIds, true);
          }
        };
      }
    } catch (e) {
      console.warn('Failed to override double click behavior', e);
    }

    // Set initial camera to match scroll position
    editor.setCamera({ x: -window.scrollX, y: -window.scrollY, z: 1 });

    // Prevent zoom changes
    editor.sideEffects.registerAfterChangeHandler('camera', () => {
      const camera = editor.getCamera();
      if (camera.z !== 1) {
        editor.setCamera({ x: camera.x, y: camera.y, z: 1 });
      }
    });

    // Set up lasso tool callbacks
    const lassoSelectTool = editor.root.children?.['lasso-select'] as any;
    if (lassoSelectTool && 'setOnLassoComplete' in lassoSelectTool) {
      lassoSelectTool.setOnLassoComplete((points: { x: number; y: number }[]) => {
        handleLassoSelection(points);
      });
    }

    // Track brush selection
    let lastBrush: { x: number; y: number; w: number; h: number } | null = null;
    editor.sideEffects.registerAfterChangeHandler('instance', (prev, next) => {
      if (prev.brush && !next.brush && lastBrush) {
        const brushBounds: BoundingBox = {
          x: lastBrush.x,
          y: lastBrush.y,
          width: lastBrush.w,
          height: lastBrush.h,
        };
        handleBrushSelection(brushBounds);
        lastBrush = null;
      } else if (next.brush) {
        lastBrush = next.brush;
      }
    });
  }, [handleDOMSelect, handleBrushSelection, handleLassoSelection, handleMultiDOMSelect, handleDrawingAnnotation]);

  // =============================================================================
  // Click Handler (for canceling pending annotation)
  // =============================================================================

  useEffect(() => {
    if (!isToolbarExpanded) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;

      if (target.closest('[data-skema="annotation-popup"]')) return;

      if (pendingAnnotation) {
        e.preventDefault();
        e.stopPropagation();
        handleAnnotationCancel();
        return;
      }

      if (e.shiftKey) return;
      if (!target.closest('.tl-canvas')) return;
    };

    document.addEventListener('pointerdown', handlePointerDown, { capture: true });
    return () => document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
  }, [isToolbarExpanded, pendingAnnotation, handleAnnotationCancel]);

  // =============================================================================
  // Render
  // =============================================================================

  if (!enabled) {
    return null;
  }

  return (
    <div
      data-skema="container"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        pointerEvents: 'none',
      }}
    >
      {/* Hide tldraw UI elements */}
      <style>{skemaHiddenUiStyles}</style>
      
      {/* Style panel - only visible when toolbar is expanded, positioned in top right corner */}
      <style>{`
        .tlui-style-panel__wrapper {
          position: fixed !important;
          top: 16px !important;
          right: 16px !important;
          bottom: auto !important;
          left: auto !important;
          ${isToolbarExpanded ? '' : 'display: none !important;'}
        }
      `}</style>

      {/* Floating Settings Button - Bottom Right */}
      {isToolbarExpanded && (
        <button
          onClick={() => setIsStylePanelOpen(prev => !prev)}
          title={isStylePanelOpen ? "Hide style settings" : "Show style settings"}
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isStylePanelOpen ? '#FF6800' : 'white',
            border: 'none',
            borderRadius: 12,
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            pointerEvents: 'auto',
            zIndex: zIndex + 5,
            transition: 'all 0.2s ease',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
              stroke={isStylePanelOpen ? "white" : "#6B7280"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z"
              stroke={isStylePanelOpen ? "white" : "#6B7280"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isStylePanelOpen}
        onClose={() => setIsStylePanelOpen(false)}
        zIndex={zIndex}
        connected={daemonState.connected}
        mode={daemonState.mode}
        provider={daemonState.provider}
        availableProviders={daemonState.availableProviders}
        onModeChange={setMode}
        onProviderChange={setProvider}
        onApiKeyChange={setApiKey}
      />

      {/* tldraw overlay - only intercept events when toolbar is expanded */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: isToolbarExpanded ? 'auto' : 'none',
        }}
      >
        <Tldraw
          tools={[LassoSelectTool]}
          components={skemaComponents}
          overrides={skemaOverrides}
          onMount={handleMount}
          hideUi={false}
          inferDarkMode={false}
          options={{ maxPages: 1 }}
        >
          <SkemaToolbar
            isExpanded={isToolbarExpanded}
            onExpandedChange={setIsToolbarExpanded}
            onStylePanelChange={setIsStylePanelOpen}
          />
        </Tldraw>
      </div>

      {/* DOM selection highlights */}
      <SelectionOverlay selections={domSelections} />

      {/* Processing loading overlay */}
      {isProcessing && processingBoundingBox && (
        <ProcessingOverlay
          boundingBox={processingBoundingBox}
          scrollOffset={scrollOffset}
        />
      )}

      {/* Annotation markers */}
      <AnnotationMarkersLayer
        annotations={annotations}
        scrollOffset={scrollOffset}
        hoveredMarkerId={hoveredMarkerId}
        onHover={setHoveredMarkerId}
        onDelete={handleDeleteAnnotation}
      />

      {/* Pending annotation highlight and popup */}
      {pendingAnnotation && pendingAnnotation.boundingBox && (
        <>
          <div
            data-skema="pending-highlight"
            style={{
              position: 'fixed',
              left: pendingAnnotation.boundingBox.x - scrollOffset.x,
              top: pendingAnnotation.boundingBox.y - scrollOffset.y,
              width: pendingAnnotation.boundingBox.width,
              height: pendingAnnotation.boundingBox.height,
              border: `2px solid ${pendingAnnotation.isMultiSelect ? '#34C759' : '#3b82f6'}`,
              backgroundColor: pendingAnnotation.isMultiSelect
                ? 'rgba(52, 199, 89, 0.1)'
                : 'rgba(59, 130, 246, 0.1)',
              borderRadius: 4,
              pointerEvents: 'none',
              zIndex: zIndex + 2,
              transition: 'opacity 0.15s ease',
              opacity: pendingExiting ? 0 : 1,
            }}
          />

          <AnnotationPopup
            ref={popupRef}
            element={pendingAnnotation.element}
            selectedText={pendingAnnotation.selectedText}
            placeholder={
              pendingAnnotation.annotationType === 'drawing'
                ? 'What does this drawing mean?'
                : pendingAnnotation.isMultiSelect
                  ? 'What should change about these elements?'
                  : 'Write your changes'
            }
            onSubmit={handleAnnotationSubmit}
            onCancel={handleAnnotationCancel}
            isExiting={pendingExiting}
            isMultiSelect={pendingAnnotation.isMultiSelect}
            accentColor={pendingAnnotation.isMultiSelect ? '#34C759' : '#3b82f6'}
            style={{
              left: Math.max(160, Math.min(window.innerWidth - 160, (pendingAnnotation.x / 100) * window.innerWidth)),
              ...(pendingAnnotation.clientY > window.innerHeight - 250
                ? { bottom: window.innerHeight - pendingAnnotation.clientY + 30 }
                : { top: pendingAnnotation.clientY + 30 }),
              zIndex: zIndex + 3,
              pointerEvents: 'auto',
            }}
          />
        </>
      )}

      {/* Annotations sidebar */}
      <AnnotationsSidebar
        annotations={annotations}
        onClear={handleClear}
        onExport={handleExport}
      />

      {/* Scribble-delete toast notification */}
      {scribbleToast && (
        <div
          data-skema="scribble-toast"
          style={{
            position: 'fixed',
            bottom: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 20px',
            backgroundColor: 'rgba(239, 68, 68, 0.95)',
            color: 'white',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            pointerEvents: 'none',
            zIndex: zIndex + 10,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            animation: 'skema-toast-fade 0.2s ease-out',
          }}
        >
          {scribbleToast}
        </div>
      )}

      {/* Toast animation styles */}
      <style>{skemaToastStyles}</style>
    </div>
  );
};

export default Skema;

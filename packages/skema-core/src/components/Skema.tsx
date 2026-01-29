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

// Utils
import { getViewportInfo, bboxIntersects } from '../utils/coordinates';
import {
  createDOMSelection,
  shouldIgnoreElement,
  findNearbyElementsWithStyles,
  extractProjectStyleContext,
} from '../utils/element-identification';
import { blobToBase64, addGridToSvg, extractTextFromShapes } from '../lib/utils';

// Extracted Components
import { SkemaToolbar } from './toolbar/SkemaToolbar';
import { AnnotationMarkersLayer } from './annotations/AnnotationMarker';
import { AnnotationsSidebar } from './annotations/AnnotationsSidebar';
import { SelectionOverlay } from './overlays/SelectionOverlay';
import { ProcessingOverlay } from './overlays/ProcessingOverlay';
import { AnnotationPopup, AnnotationPopupHandle } from './AnnotationPopup';

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
  onAnnotationsChange,
  onAnnotationSubmit,
  onAnnotationDelete,
  onProcessingCancel,
  toggleShortcut = 'mod+shift+e',
  initialAnnotations = [],
  zIndex = 99999,
  isProcessing = false,
}) => {
  // =============================================================================
  // State
  // =============================================================================
  const [isActive, setIsActive] = useState(enabled);
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [domSelections, setDomSelections] = useState<DOMSelection[]>([]);
  const [pendingAnnotation, setPendingAnnotation] = useState<PendingAnnotation | null>(null);
  const [pendingExiting, setPendingExiting] = useState(false);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [processingBoundingBox, setProcessingBoundingBox] = useState<BoundingBox | null>(null);
  const [scribbleToast, setScribbleToast] = useState<string | null>(null);

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

  // Keyboard shortcut to toggle overlay
  useKeyboardShortcuts({
    onToggle: useCallback(() => setIsActive(prev => !prev), []),
    shortcut: toggleShortcut,
  });

  // Scroll sync between page and tldraw camera
  const scrollOffset = useScrollSync(isActive, editorRef);

  // Intercept wheel events to scroll page instead of panning tldraw
  useWheelIntercept(isActive);

  // Persist shapes when toggling overlay off/on
  useShapePersistence(isActive, editorRef);

  // Scribble gesture detection for delete
  useScribbleDelete({
    isActive,
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

    if (pendingAnnotation.annotationType === 'dom_selection' && pendingAnnotation.selections) {
      const selections = pendingAnnotation.selections;

      if (selections.length === 1) {
        const selection = { ...selections[0], comment };
        setDomSelections((prev) => [...prev, selection]);
        setAnnotations((prev) => [...prev, { type: 'dom_selection' as const, ...selection }]);
      } else {
        const groupedSelection: DOMSelection = {
          id: `group-${Date.now()}`,
          selector: selections.map(s => s.selector).join(', '),
          tagName: pendingAnnotation.element,
          elementPath: selections[0].elementPath,
          text: selections.map(s => s.text).filter(Boolean).join(' | ').slice(0, 200),
          boundingBox: pendingAnnotation.boundingBox!,
          timestamp: Date.now(),
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
      }
    } else if (pendingAnnotation.annotationType === 'drawing' && pendingAnnotation.shapeIds) {
      const bbox = pendingAnnotation.boundingBox!;
      const nearbyElements = pendingAnnotation.selections?.map(s => ({
        selector: s.selector,
        tagName: s.tagName,
        text: s.text?.slice(0, 100),
      })) || [];

      const drawingAnnotation: Annotation = {
        id: `drawing-${Date.now()}`,
        type: 'drawing',
        tool: 'draw',
        shapes: pendingAnnotation.shapeIds,
        boundingBox: bbox,
        timestamp: Date.now(),
        comment,
        nearbyElements,
      };
      setAnnotations((prev) => [...prev, drawingAnnotation]);
    }

    // Call onAnnotationSubmit callback
    if (onAnnotationSubmit) {
      let submittedAnnotation: Annotation;

      if (pendingAnnotation.annotationType === 'dom_selection' && pendingAnnotation.selections) {
        const selections = pendingAnnotation.selections;
        if (selections.length === 1) {
          submittedAnnotation = { type: 'dom_selection' as const, ...selections[0], comment };
        } else {
          submittedAnnotation = {
            type: 'dom_selection' as const,
            id: `group-${Date.now()}`,
            selector: selections.map(s => s.selector).join(', '),
            tagName: pendingAnnotation.element,
            elementPath: selections[0].elementPath,
            text: selections.map(s => s.text).filter(Boolean).join(' | ').slice(0, 200),
            boundingBox: pendingAnnotation.boundingBox!,
            timestamp: Date.now(),
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
        }
      } else {
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

        submittedAnnotation = {
          id: `drawing-${Date.now()}`,
          type: 'drawing',
          tool: 'draw',
          shapes: pendingAnnotation.shapeIds || [],
          boundingBox: pendingAnnotation.boundingBox!,
          timestamp: Date.now(),
          comment,
          drawingSvg,
          drawingImage,
          extractedText: extractedText || undefined,
          gridConfig,
          nearbyElements,
          viewport,
          projectStyles,
        };
      }

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
    if (!isActive) return;

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
  }, [isActive, pendingAnnotation, handleAnnotationCancel]);

  // =============================================================================
  // Render
  // =============================================================================

  if (!isActive) {
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

      {/* tldraw overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'auto',
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
          <SkemaToolbar />
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
                  : 'What should change?'
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

      {/* Toggle indicator */}
      <div
        data-skema="toggle-hint"
        style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          padding: '8px 12px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          borderRadius: '6px',
          fontSize: '12px',
          pointerEvents: 'none',
          zIndex: zIndex + 1,
        }}
      >
        Press <kbd style={{
          backgroundColor: 'rgba(255,255,255,0.2)',
          padding: '2px 6px',
          borderRadius: '3px',
          marginLeft: '4px',
          marginRight: '4px',
        }}>⌘⇧E</kbd> to toggle Skema
      </div>

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

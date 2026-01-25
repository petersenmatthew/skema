// =============================================================================
// Skema - Main Drawing Overlay Component
// =============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Tldraw,
  TLComponents,
  TLUiOverrides,
  DefaultToolbar,
  DefaultToolbarContent,
  TldrawUiMenuItem,
  TldrawOverlays,
  useTools,
  useIsToolSelected,
  useEditor,
  useValue,
  Editor,
  TLUiActionsContextType,
  TLShapeId,
  StateNode,
  TLClickEventInfo,
  ArrowShapeKindStyle,
} from 'tldraw';
import 'tldraw/tldraw.css';

import { LassoSelectTool, LassoingState } from '../tools/LassoSelectTool';
import type { Annotation, DOMSelection, SkemaProps, BoundingBox, PendingAnnotation } from '../types';
import { getViewportInfo, bboxIntersects } from '../utils/coordinates';
import { createDOMSelection, shouldIgnoreElement } from '../utils/element-identification';
import { AnnotationPopup, AnnotationPopupHandle } from './AnnotationPopup';

// =============================================================================
// Annotation Marker Component - Shows numbered markers for each annotation
// =============================================================================

interface AnnotationMarkerProps {
  annotation: Annotation;
  index: number;
  scrollOffset: { x: number; y: number };
  onHover: (id: string | null) => void;
  onClick: (annotation: Annotation) => void;
  isHovered: boolean;
  accentColor?: string;
}

const AnnotationMarker: React.FC<AnnotationMarkerProps> = ({
  annotation,
  index,
  scrollOffset,
  onHover,
  onClick,
  isHovered,
  accentColor = '#3b82f6',
}) => {
  // Get position based on annotation type
  let markerX: number;
  let markerY: number;

  if (annotation.type === 'dom_selection') {
    const sel = annotation as DOMSelection;
    markerX = sel.boundingBox.x + sel.boundingBox.width / 2;
    markerY = sel.boundingBox.y;
  } else if (annotation.type === 'drawing') {
    markerX = annotation.boundingBox.x + annotation.boundingBox.width / 2;
    markerY = annotation.boundingBox.y;
  } else {
    markerX = annotation.boundingBox.x + annotation.boundingBox.width / 2;
    markerY = annotation.boundingBox.y;
  }

  // Convert to viewport coordinates
  const viewportX = markerX - scrollOffset.x;
  const viewportY = markerY - scrollOffset.y - 12; // Position above the element

  const isDrawing = annotation.type === 'drawing';
  const markerColor = isDrawing ? '#8B5CF6' : accentColor; // Purple for drawings

  // Get comment for tooltip
  const comment = annotation.type === 'dom_selection'
    ? (annotation as DOMSelection).comment
    : undefined;
  const elementName = annotation.type === 'dom_selection'
    ? (annotation as DOMSelection).tagName
    : 'Drawing';

  return (
    <div
      data-skema="annotation-marker"
      style={{
        position: 'fixed',
        left: viewportX,
        top: viewportY,
        transform: 'translate(-50%, -100%)',
        zIndex: 999998,
        pointerEvents: 'auto',
      }}
    >
      {/* Marker circle */}
      <div
        style={{
          width: isHovered ? 26 : 22,
          height: isHovered ? 26 : 22,
          borderRadius: '50%',
          backgroundColor: isHovered ? '#ef4444' : markerColor,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          transition: 'all 0.15s ease',
          userSelect: 'none',
        }}
        onMouseEnter={() => onHover(annotation.id)}
        onMouseLeave={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          onClick(annotation);
        }}
      >
        {isHovered ? '×' : index + 1}
      </div>

      {/* Tooltip on hover */}
      {isHovered && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '100%',
            transform: 'translateX(-50%)',
            marginBottom: 8,
            padding: '8px 12px',
            backgroundColor: '#1a1a1a',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap',
            maxWidth: 200,
            zIndex: 999999,
          }}
        >
          <div style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.6)',
            marginBottom: comment ? 4 : 0,
          }}>
            {elementName}
          </div>
          {comment && (
            <div style={{
              fontSize: 12,
              color: 'white',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
            }}>
              {comment.length > 50 ? comment.slice(0, 50) + '...' : comment}
            </div>
          )}
          <div style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.4)',
            marginTop: 4,
          }}>
            Click to delete
          </div>
        </div>
      )}
    </div>
  );
};

// Annotation markers layer
const AnnotationMarkersLayer: React.FC<{
  annotations: Annotation[];
  scrollOffset: { x: number; y: number };
  hoveredMarkerId: string | null;
  onHover: (id: string | null) => void;
  onDelete: (annotation: Annotation) => void;
}> = ({ annotations, scrollOffset, hoveredMarkerId, onHover, onDelete }) => {
  return (
    <>
      {annotations.map((annotation, index) => (
        <AnnotationMarker
          key={annotation.id}
          annotation={annotation}
          index={index}
          scrollOffset={scrollOffset}
          onHover={onHover}
          onClick={onDelete}
          isHovered={hoveredMarkerId === annotation.id}
        />
      ))}
    </>
  );
};

// Custom toolbar with DOM picker and lasso select
const SkemaToolbar: React.FC = (props) => {
  const tools = useTools();

  const isLassoSelected = useIsToolSelected(tools['lasso-select']);

  return (
    <DefaultToolbar {...props}>

      <TldrawUiMenuItem
        {...tools['lasso-select']}
        isSelected={isLassoSelected}
      />
      <DefaultToolbarContent />
    </DefaultToolbar>
  );
};

// Lasso overlay component - renders the lasso path while drawing
const LassoOverlay: React.FC = () => {
  const editor = useEditor();

  // Reactively get lasso points from the tool state
  const lassoPoints = useValue(
    'lasso points',
    () => {
      if (!editor.isIn('lasso-select.lassoing')) return [];
      // Use getStateDescendant to get the lassoing state (as per tldraw docs)
      const lassoing = editor.getStateDescendant('lasso-select.lassoing') as LassoingState | undefined;
      return lassoing?.points?.get() ?? [];
    },
    [editor]
  );

  // Convert points to SVG path
  const svgPath = useMemo(() => {
    if (lassoPoints.length < 2) return '';

    // Build SVG path from points
    let path = `M ${lassoPoints[0].x} ${lassoPoints[0].y}`;
    for (let i = 1; i < lassoPoints.length; i++) {
      path += ` L ${lassoPoints[i].x} ${lassoPoints[i].y}`;
    }
    // Close the path
    path += ' Z';
    return path;
  }, [lassoPoints]);

  if (lassoPoints.length === 0) return null;

  return (
    <svg className="tl-overlays__item" aria-hidden="true">
      <path
        d={svgPath}
        fill="none"
        stroke="rgba(59, 130, 246, 1)"
        strokeWidth="calc(2px / var(--tl-zoom))"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="4 4"
      />
    </svg>
  );
};

// Custom overlays including lasso
const SkemaOverlays: React.FC = () => {
  return (
    <>
      <TldrawOverlays />
      <LassoOverlay />
    </>
  );
};

// Selection highlight overlay component
// Selections are stored in document coordinates and rendered relative to page content
const SelectionOverlay: React.FC<{ selections: DOMSelection[] }> = ({ selections }) => {
  // Track scroll position to trigger re-renders
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleScroll = () => {
      setScrollPos({ x: window.scrollX, y: window.scrollY });
    };
    // Initial position
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {selections.map((selection) => {
        // boundingBox is stored in document coordinates
        // Convert to viewport coordinates by subtracting current scroll
        const viewportX = selection.boundingBox.x - scrollPos.x;
        const viewportY = selection.boundingBox.y - scrollPos.y;

        return (
          <div
            key={selection.id}
            data-skema="selection"
            style={{
              position: 'fixed',
              left: viewportX,
              top: viewportY,
              width: selection.boundingBox.width,
              height: selection.boundingBox.height,
              border: '2px solid #10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              pointerEvents: 'none',
              zIndex: 999997,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: -20,
                left: 0,
                backgroundColor: '#10b981',
                color: 'white',
                padding: '2px 6px',
                fontSize: '11px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
              }}
            >
              {selection.tagName}
            </span>
          </div>
        );
      })}
    </>
  );
};

// Annotations sidebar
const AnnotationsSidebar: React.FC<{
  annotations: Annotation[];
  onClear: () => void;
  onExport: () => void;
}> = ({ annotations, onClear, onExport }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      data-skema="sidebar"
      style={{
        position: 'fixed',
        right: isOpen ? 0 : -280,
        top: 60,
        width: 280,
        maxHeight: 'calc(100vh - 120px)',
        backgroundColor: 'white',
        borderRadius: '8px 0 0 8px',
        boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
        transition: 'right 0.2s ease-out',
        zIndex: 999996,
        overflow: 'hidden',
      }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'absolute',
          left: -32,
          top: 10,
          width: 32,
          height: 32,
          backgroundColor: '#3b82f6',
          border: 'none',
          borderRadius: '8px 0 0 8px',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isOpen ? '→' : '←'}
      </button>

      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '14px' }}>
          Annotations ({annotations.length})
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onExport}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Export
          </button>
          <button
            onClick={onClear}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Annotations list */}
      <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
        {annotations.length === 0 ? (
          <div style={{ padding: '16px', color: '#6b7280', fontSize: '13px' }}>
            No annotations yet. Use the DOM picker or drawing tools to annotate.
          </div>
        ) : (
          annotations.map((annotation) => (
            <div
              key={annotation.id}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f3f4f6',
                fontSize: '13px',
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                {annotation.type === 'dom_selection' && `🎯 ${(annotation as DOMSelection).tagName}`}
                {annotation.type === 'drawing' && `✏️ Drawing`}
                {annotation.type === 'gesture' && `👆 ${annotation.gesture}`}
              </div>
              {annotation.type === 'dom_selection' && (
                <>
                  {(annotation as DOMSelection).comment && (
                    <div style={{ color: '#374151', fontSize: '12px', marginBottom: '4px' }}>
                      {(annotation as DOMSelection).comment}
                    </div>
                  )}
                  <div style={{ color: '#6b7280', fontSize: '11px' }}>
                    {(annotation as DOMSelection).selector.slice(0, 50)}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/**
 * Main Skema component - renders tldraw as a transparent overlay
 */
export const Skema: React.FC<SkemaProps> = ({
  enabled = true,
  onAnnotationsChange,
  onAnnotationSubmit,
  onAnnotationDelete,
  toggleShortcut = 'mod+shift+e',
  initialAnnotations = [],
  zIndex = 99999,
}) => {
  const [isActive, setIsActive] = useState(enabled);
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [domSelections, setDomSelections] = useState<DOMSelection[]>([]);
  const [pendingAnnotation, setPendingAnnotation] = useState<PendingAnnotation | null>(null);
  const [pendingExiting, setPendingExiting] = useState(false);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const popupRef = useRef<AnnotationPopupHandle>(null);
  const lastDoubleClickRef = useRef<number>(0);
  const justFinishedDrawingRef = useRef<boolean>(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Handle keyboard shortcut to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setIsActive((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Track scroll position to sync tldraw camera with page
  const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 });

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

    // Listen for scroll events
    window.addEventListener('scroll', syncScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', syncScroll);
    };
  }, [isActive]);

  // Intercept wheel events and scroll the page instead of panning tldraw
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

  // Notify parent of annotation changes
  useEffect(() => {
    onAnnotationsChange?.(annotations);
  }, [annotations, onAnnotationsChange]);

  // Helper to check if there are drawings in the current tldraw selection
  const getSelectedDrawings = useCallback(() => {
    if (!editorRef.current) return [];
    const editor = editorRef.current;
    const selectedIds = editor.getSelectedShapeIds();
    const shapes = selectedIds.map(id => editor.getShape(id)).filter(Boolean);
    return shapes.filter(shape =>
      shape && ['draw', 'line', 'arrow', 'geo', 'text', 'note'].includes(shape.type)
    );
  }, []);

  // Handle DOM selection from picker - shows annotation popup
  const handleDOMSelect = useCallback((selection: DOMSelection) => {
    // Check if there are also drawings selected
    const selectedDrawings = getSelectedDrawings();
    const hasDrawings = selectedDrawings.length > 0;

    // Calculate popup position
    const rect = selection.boundingBox;
    const x = ((rect.x + rect.width / 2) / window.innerWidth) * 100;
    const clientY = rect.y - window.scrollY + rect.height / 2;

    // Build element description
    let elementDesc = selection.tagName;
    if (hasDrawings) {
      elementDesc = `Drawing + ${selection.tagName}`;
    }

    // Set pending annotation to show popup
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
      annotationType: 'dom_selection',
      shapeIds: hasDrawings ? editorRef.current?.getSelectedShapeIds() as string[] : undefined,
    });
  }, [getSelectedDrawings]);

  // Handle multi-element selection (from lasso/brush) - shows popup for all selected
  const handleMultiDOMSelect = useCallback((selections: DOMSelection[]) => {
    if (selections.length === 0) return;

    // Check if there are also drawings selected
    const selectedDrawings = getSelectedDrawings();
    const hasDrawings = selectedDrawings.length > 0;

    // Calculate combined bounding box
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

    // Build element description
    const elementNames = selections.slice(0, 3).map(s => s.tagName).join(', ');
    const suffix = selections.length > 3 ? ` +${selections.length - 3} more` : '';
    let element = `${selections.length} elements: ${elementNames}${suffix}`;

    // Add drawing info if present
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
      annotationType: 'dom_selection',
      shapeIds: hasDrawings ? editorRef.current?.getSelectedShapeIds() as string[] : undefined,
    });
  }, [getSelectedDrawings]);

  // Submit annotation from popup
  const handleAnnotationSubmit = useCallback(async (comment: string) => {
    if (!pendingAnnotation) return;

    if (pendingAnnotation.annotationType === 'dom_selection' && pendingAnnotation.selections) {
      const selections = pendingAnnotation.selections;

      if (selections.length === 1) {
        // Single element - create simple annotation
        const selection = { ...selections[0], comment };
        setDomSelections((prev) => [...prev, selection]);
        setAnnotations((prev) => [...prev, { type: 'dom_selection' as const, ...selection }]);
      } else {
        // Multiple elements - create a single grouped annotation
        const groupedSelection: DOMSelection = {
          id: `group-${Date.now()}`,
          selector: selections.map(s => s.selector).join(', '),
          tagName: pendingAnnotation.element, // Already formatted as "3 elements: div, span, p"
          elementPath: selections[0].elementPath, // Use first element's path as reference
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
      // Handle drawing annotation - extract SVG and nearby elements
      const bbox = pendingAnnotation.boundingBox!;
      
      // Get nearby DOM elements for context
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

      // FORENSIC LOGGING - Drawing annotation
      const drawingLog = `
### ${annotations.length + 1}. Drawing (${pendingAnnotation.shapeIds?.length || 0} shapes)
**Position:** x:${Math.round(bbox.x)}, y:${Math.round(bbox.y)} (${Math.round(bbox.width)}×${Math.round(bbox.height)}px)
**Annotation at:** ${((bbox.x + bbox.width / 2) / window.innerWidth * 100).toFixed(1)}% from left, ${Math.round(bbox.y + bbox.height / 2)}px from top
**Shape IDs:** ${pendingAnnotation.shapeIds?.join(', ') || 'none'}
**Nearby Elements:** ${nearbyElements.map(e => e.tagName).join(', ') || 'none'}
**Feedback:** ${comment}
`;
      console.log(drawingLog);
    }

    // Log DOM selection annotations
    if (pendingAnnotation.annotationType === 'dom_selection' && pendingAnnotation.selections) {
      const selections = pendingAnnotation.selections;
      const annotationIndex = annotations.length + 1;

      // Build element descriptions
      const elementDescs = selections.map(s => {
        const textPreview = s.text?.slice(0, 50) || '';
        return `${s.tagName.toLowerCase()}${textPreview ? `: "${textPreview}..."` : ''}`;
      }).join(', ');

      // Get first element for detailed forensic data
      const firstSelection = selections[0];
      const firstElement = document.querySelector(firstSelection.selector) as HTMLElement | null;

      let computedStylesStr = 'N/A';
      let nearbyElements = 'N/A';

      if (firstElement) {
        // Get computed styles
        const styles = window.getComputedStyle(firstElement);
        computedStylesStr = [
          `color: ${styles.color}`,
          `border-color: ${styles.borderColor}`,
          `font-size: ${styles.fontSize}`,
          `font-weight: ${styles.fontWeight}`,
          `font-family: ${styles.fontFamily}`,
          `line-height: ${styles.lineHeight}`,
          `letter-spacing: ${styles.letterSpacing}`,
          `text-align: ${styles.textAlign}`,
          `width: ${styles.width}`,
          `height: ${styles.height}`,
          `border: ${styles.border}`,
          `display: ${styles.display}`,
          `flex-direction: ${styles.flexDirection}`,
          `opacity: ${styles.opacity}`,
        ].join('; ');

        // Get nearby elements (siblings)
        const parent = firstElement.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children)
            .filter(el => el !== firstElement)
            .slice(0, 3)
            .map(el => el.tagName.toLowerCase());
          nearbyElements = siblings.length > 0 ? siblings.join(', ') : 'none';
        }
      }

      const bbox = pendingAnnotation.boundingBox!;
      const forensicLog = `
### ${annotationIndex}. ${selections.length > 1 ? `${selections.length} elements: ` : ''}${elementDescs}
${selections.length > 1 ? '*Forensic data shown for first element of selection*\n' : ''}**Full DOM Path:** ${firstSelection.elementPath}
**Position:** x:${Math.round(bbox.x)}, y:${Math.round(bbox.y)} (${Math.round(bbox.width)}×${Math.round(bbox.height)}px)
**Annotation at:** ${((bbox.x + bbox.width / 2) / window.innerWidth * 100).toFixed(1)}% from left, ${Math.round(bbox.y + bbox.height / 2)}px from top
**Computed Styles:** ${computedStylesStr}
**Nearby Elements:** ${nearbyElements}
**Feedback:** ${comment}
`;
      console.log(forensicLog);
    }

    // Call onAnnotationSubmit callback for real-time integrations (e.g., Gemini)
    if (onAnnotationSubmit) {
      // Construct the annotation that was just created
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
        // Drawing annotation - extract SVG from shapes
        const editor = editorRef.current;
        let drawingSvg: string | undefined;
        
        if (editor && pendingAnnotation.shapeIds && pendingAnnotation.shapeIds.length > 0) {
          try {
            // Get SVG export of the drawing shapes
            const svgResult = await editor.getSvgString(pendingAnnotation.shapeIds as TLShapeId[], {
              padding: 10,
              background: false,
            });
            if (svgResult?.svg) {
              drawingSvg = svgResult.svg;
            }
          } catch (e) {
            console.warn('[Skema] Failed to export drawing SVG:', e);
          }
        }

        // Get nearby DOM elements for context
        const nearbyElements = pendingAnnotation.selections?.map(s => ({
          selector: s.selector,
          tagName: s.tagName,
          text: s.text?.slice(0, 100),
        })) || [];

        submittedAnnotation = {
          id: `drawing-${Date.now()}`,
          type: 'drawing',
          tool: 'draw',
          shapes: pendingAnnotation.shapeIds || [],
          boundingBox: pendingAnnotation.boundingBox!,
          timestamp: Date.now(),
          comment,
          drawingSvg,
          nearbyElements,
        };
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

  // Cancel annotation popup
  const handleAnnotationCancel = useCallback(() => {
    setPendingExiting(true);
    setTimeout(() => {
      setPendingAnnotation(null);
      setPendingExiting(false);
    }, 150);
  }, []);

  // Delete an annotation (when clicking on marker)
  const handleDeleteAnnotation = useCallback((annotation: Annotation) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== annotation.id));
    if (annotation.type === 'dom_selection') {
      setDomSelections((prev) => prev.filter((s) => s.id !== annotation.id));
    }
    setHoveredMarkerId(null);
    // Call the delete callback (for reverting Gemini changes)
    onAnnotationDelete?.(annotation.id);
  }, [onAnnotationDelete]);

  // Clear all annotations
  const handleClear = useCallback(() => {
    setAnnotations([]);
    setDomSelections([]);
    if (editorRef.current) {
      editorRef.current.selectAll();
      editorRef.current.deleteShapes(editorRef.current.getSelectedShapeIds());
    }
  }, []);

  // Export annotations
  const handleExport = useCallback(() => {
    const exportData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      viewport: getViewportInfo(),
      pathname: window.location.pathname,
      annotations,
    };

    // Copy to clipboard
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));

    // Also log to console for development
    console.log('[Skema] Exported annotations:', exportData);

    alert('Annotations copied to clipboard!');
  }, [annotations]);

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
        // Check if this element is not a parent of already added elements
        const isParent = elements.some((existing) => el.contains(existing));
        if (!isParent) {
          // Remove any children of this element that were already added
          const filtered = elements.filter((existing) => !existing.contains(el) && !el.contains(existing));
          filtered.push(el);
          elements.length = 0;
          elements.push(...filtered);
        }
      }
    });

    return elements;
  }, []);

  // Handle drawing annotation (triggered when drawings are selected)
  const handleDrawingAnnotation = useCallback((selectedIds: TLShapeId[]) => {
    if (!editorRef.current || selectedIds.length === 0) return;
    // Don't trigger if there's already a pending annotation
    if (pendingAnnotation) return;

    const editor = editorRef.current;
    const selectedShapes = selectedIds.map((id) => editor.getShape(id)).filter(Boolean);

    if (selectedShapes.length === 0) return;

    // Calculate bounds from shapes directly (more reliable than selection bounds)
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

    const selectionBounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };

    // Check if these are drawing shapes
    const drawingShapes = selectedShapes.filter(shape =>
      shape && ['draw', 'line', 'arrow', 'geo', 'text', 'note'].includes(shape.type)
    );

    if (drawingShapes.length === 0) return;

    // Check for DOM elements in the selection bounds
    const viewportBounds: BoundingBox = {
      x: selectionBounds.x - window.scrollX,
      y: selectionBounds.y - window.scrollY,
      width: selectionBounds.width,
      height: selectionBounds.height,
    };
    const domElements = findDOMElementsInBounds(viewportBounds);

    // Show annotation popup for drawings (and any DOM elements in bounds)
    const centerX = selectionBounds.x + selectionBounds.width / 2;
    const centerY = selectionBounds.y + selectionBounds.height / 2;
    const x = ((centerX - window.scrollX) / window.innerWidth) * 100;
    const clientY = centerY - window.scrollY;

    // Build element description
    let elementDesc = `Drawing (${drawingShapes.length} shape${drawingShapes.length > 1 ? 's' : ''})`;
    if (domElements.length > 0) {
      const domNames = domElements.slice(0, 2).map(el => el.tagName.toLowerCase()).join(', ');
      const domSuffix = domElements.length > 2 ? ` +${domElements.length - 2} more` : '';
      elementDesc += ` + ${domNames}${domSuffix}`;
    }

    // Create DOM selections if there are DOM elements
    const newDomSelections = domElements.map(el => createDOMSelection(el));

    setPendingAnnotation({
      x,
      y: centerY,
      clientY,
      element: elementDesc,
      elementPath: 'drawing',
      boundingBox: {
        x: selectionBounds.x,
        y: selectionBounds.y,
        width: selectionBounds.width,
        height: selectionBounds.height,
      },
      isMultiSelect: drawingShapes.length > 1 || domElements.length > 0,
      annotationType: 'drawing',
      shapeIds: selectedIds as string[],
      selections: newDomSelections.length > 0 ? newDomSelections : undefined,
    });
  }, [pendingAnnotation, findDOMElementsInBounds]);

  // Handle brush/drag selection to select DOM elements
  const handleBrushSelection = useCallback((brushBounds: BoundingBox) => {
    // Convert brush bounds (in document coordinates due to camera sync) to viewport coordinates
    const viewportBounds: BoundingBox = {
      x: brushBounds.x - window.scrollX,
      y: brushBounds.y - window.scrollY,
      width: brushBounds.width,
      height: brushBounds.height,
    };

    // Find DOM elements in bounds
    const foundElements = findDOMElementsInBounds(viewportBounds);

    // Filter out already selected elements
    const newElements = foundElements.filter((el) => {
      const rect = el.getBoundingClientRect();
      return !domSelections.some(
        (s) => Math.abs(s.boundingBox.x - (rect.left + window.scrollX)) < 5 &&
          Math.abs(s.boundingBox.y - (rect.top + window.scrollY)) < 5
      );
    });

    if (newElements.length === 0) return;

    // Create selections and show popup
    const selections = newElements.map(el => createDOMSelection(el));

    if (selections.length === 1) {
      handleDOMSelect(selections[0]);
    } else {
      handleMultiDOMSelect(selections);
    }
  }, [findDOMElementsInBounds, domSelections, handleDOMSelect, handleMultiDOMSelect]);

  // Check if a point is inside a polygon (ray casting algorithm)
  const isPointInPolygon = useCallback((point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean => {
    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersect =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }, []);

  // Handle lasso selection to select DOM elements that touch the lasso area
  const handleLassoSelection = useCallback((lassoPoints: { x: number; y: number }[]) => {
    if (lassoPoints.length < 3) return;

    // Convert lasso points from page coordinates to viewport coordinates
    const viewportPoints = lassoPoints.map(p => ({
      x: p.x - window.scrollX,
      y: p.y - window.scrollY,
    }));

    // Get lasso bounding box for quick intersection check
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

      // Skip tiny elements
      if (rect.width < 10 || rect.height < 10) return;

      // Check if element bounding box overlaps with lasso bounding box (any touch = selected)
      const boundsOverlap = !(
        rect.left > lassoMaxX ||
        rect.right < lassoMinX ||
        rect.top > lassoMaxY ||
        rect.bottom < lassoMinY
      );

      if (boundsOverlap) {
        // Check if this element is not a parent of already added elements
        const isParent = foundElements.some((existing) => el.contains(existing));
        if (!isParent) {
          // Remove any children of this element that were already added
          const filtered = foundElements.filter((existing) => !existing.contains(el) && !el.contains(existing));
          filtered.push(el);
          foundElements.length = 0;
          foundElements.push(...filtered);
        }
      }
    });

    // Filter out already selected elements
    const newElements = foundElements.filter((el) => {
      const rect = el.getBoundingClientRect();
      return !domSelections.some(
        (s) => Math.abs(s.boundingBox.x - (rect.left + window.scrollX)) < 5 &&
          Math.abs(s.boundingBox.y - (rect.top + window.scrollY)) < 5
      );
    });

    if (newElements.length === 0) return;

    // Create selections and show popup
    const selections = newElements.map(el => createDOMSelection(el));

    if (selections.length === 1) {
      handleDOMSelect(selections[0]);
    } else {
      handleMultiDOMSelect(selections);
    }
  }, [isPointInPolygon, domSelections, handleDOMSelect, handleMultiDOMSelect]);

  // Editor mount handler
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Set default arrow style to arc (curved)
    editor.setStyleForNextShapes(ArrowShapeKindStyle, 'arc');

    // Override double click behavior to disable text creation and select DOM elements
    // See: https://tldraw.dev/examples/custom-double-click-behavior
    try {
      type IdleStateNode = StateNode & {
        handleDoubleClickOnCanvas(info: TLClickEventInfo): void;
        handleDoubleClickOnShape?(info: TLClickEventInfo, shape: any): void;
      };
      const selectIdleState = editor.getStateDescendant<IdleStateNode>('select.idle');
      if (selectIdleState) {
        // Handle double-click on canvas (for DOM elements)
        selectIdleState.handleDoubleClickOnCanvas = (info) => {
          // Record double click time to prevent immediate clearing by pointerdown handler
          lastDoubleClickRef.current = Date.now();

          // Find DOM element at the clicked position
          const point = editor.pageToViewport(info.point);
          const elements = document.elementsFromPoint(point.x, point.y);

          // Find the first valid DOM element (ignoring overlay/UI)
          const target = elements.find(el =>
            el instanceof HTMLElement && !shouldIgnoreElement(el as HTMLElement)
          ) as HTMLElement | undefined;

          if (target) {
            // NOTE: We no longer clear existing annotations on double-click.
            // Annotations persist until explicitly deleted by the user.

            // Create selection and show popup
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

      }
    } catch (e) {
      console.warn('Failed to override double click behavior', e);
    }

    // Set initial camera to match current scroll position
    editor.setCamera({ x: -window.scrollX, y: -window.scrollY, z: 1 });

    // Prevent zoom changes (only allow position changes for scroll sync)
    editor.sideEffects.registerAfterChangeHandler('camera', () => {
      const camera = editor.getCamera();
      // Only reset if zoom changed, allow position changes for scroll sync
      if (camera.z !== 1) {
        editor.setCamera({ x: camera.x, y: camera.y, z: 1 });
      }
    });



    // Get the lasso select tool instance and set callbacks
    const lassoSelectTool = editor.root.children?.['lasso-select'] as LassoSelectTool | undefined;
    if (lassoSelectTool) {
      // NOTE: We no longer clear annotations on single click.
      // Annotations persist until explicitly deleted by the user.

      // Set lasso complete callback (for selecting DOM elements)
      if ('setOnLassoComplete' in lassoSelectTool) {
        lassoSelectTool.setOnLassoComplete((points) => {
          handleLassoSelection(points);
        });
      }
    }

    // Track brush selection for drag-selecting DOM elements
    let lastBrush: { x: number; y: number; w: number; h: number } | null = null;

    editor.sideEffects.registerAfterChangeHandler('instance', (prev, next) => {
      // Check if brush selection just ended
      if (prev.brush && !next.brush && lastBrush) {
        // Brush selection completed - find DOM elements in the brush area
        const brushBounds: BoundingBox = {
          x: lastBrush.x,
          y: lastBrush.y,
          width: lastBrush.w,
          height: lastBrush.h,
        };
        handleBrushSelection(brushBounds);
        lastBrush = null;
      } else if (next.brush) {
        // Store the current brush bounds
        lastBrush = next.brush;
      }
      return;
    });

    // Track when drawing is complete to show annotation popup
    // We track shapes created during a drawing session and show popup when drawing ends
    let shapesCreatedThisSession: TLShapeId[] = [];
    let isDrawing = false;
    let drawingCheckTimeout: ReturnType<typeof setTimeout> | null = null;

    // Listen for new shape creation
    editor.sideEffects.registerAfterCreateHandler('shape', (shape) => {
      // Check if this is a drawing shape
      if (['draw', 'line', 'arrow', 'geo', 'text', 'note'].includes(shape.type)) {
        shapesCreatedThisSession.push(shape.id);
        isDrawing = true;
      }
    });

    // Handle pointer up on the canvas to detect drawing completion
    const handlePointerUp = (e: PointerEvent) => {
      // Only process if we were drawing
      if (!isDrawing || shapesCreatedThisSession.length === 0) return;

      // Clear any pending check
      if (drawingCheckTimeout) {
        clearTimeout(drawingCheckTimeout);
      }

      // Wait a moment to ensure the drawing is fully complete
      drawingCheckTimeout = setTimeout(() => {
        if (shapesCreatedThisSession.length > 0) {
          const shapeIds = [...shapesCreatedThisSession];
          shapesCreatedThisSession = [];
          isDrawing = false;

          // Verify shapes exist and show popup
          const validIds = shapeIds.filter(id => editor.getShape(id));
          if (validIds.length > 0) {
            handleDrawingAnnotation(validIds as TLShapeId[]);
          }
        }
      }, 200);
    };

    document.addEventListener('pointerup', handlePointerUp);

    // Store cleanup function in ref for component unmount
    cleanupRef.current = () => {
      document.removeEventListener('pointerup', handlePointerUp);
      if (drawingCheckTimeout) {
        clearTimeout(drawingCheckTimeout);
      }
    };
  }, [handleDOMSelect, handleBrushSelection, handleLassoSelection, handleMultiDOMSelect, handleDrawingAnnotation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  // Handle single click to clear DOM selections or shake popup
  useEffect(() => {
    if (!isActive) return;

    const handlePointerDown = (e: PointerEvent) => {
      // Only handle left clicks
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;

      // If clicking on the popup, don't do anything
      if (target.closest('[data-skema="annotation-popup"]')) return;

      // If there's a pending annotation and clicking elsewhere, cancel it
      if (pendingAnnotation) {
        e.preventDefault();
        e.stopPropagation();
        handleAnnotationCancel();
        return;
      }

      // If shift key is pressed, don't clear selections (preserve multi-select intent)
      if (e.shiftKey) return;

      // Check if clicking on tldraw canvas (not on UI elements)
      if (!target.closest('.tl-canvas')) return;

      // NOTE: We intentionally do NOT clear annotations on click.
      // Annotations persist until explicitly deleted by the user (via marker click).
      // This ensures that once a user submits an annotation, it stays visible.
    };

    document.addEventListener('pointerdown', handlePointerDown, { capture: true });
    return () => document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
  }, [isActive, pendingAnnotation, handleAnnotationCancel]);

  // Custom components
  // Reference: https://tldraw.dev/examples/ui-components-hidden
  const components: TLComponents = {
    Toolbar: SkemaToolbar,
    Overlays: SkemaOverlays,
    // Hide background to make canvas transparent (so website shows through)
    Background: null,
    // Hide UI elements we don't need
    SharePanel: null,
    MenuPanel: null,
    TopPanel: null,
    PageMenu: null,
    NavigationPanel: null,
    HelpMenu: null,
    Minimap: null,
    // Hide "Back to Content" button (HelperButtons contains this)
    HelperButtons: null,
    QuickActions: null,
    ZoomMenu: null,
    ActionsMenu: null,
    DebugPanel: null,
    DebugMenu: null,
    // Hide canvas overlays
    OnTheCanvas: null,
    InFrontOfTheCanvas: null,
  };

  // UI overrides to add DOM picker and lasso select tools
  const overrides: TLUiOverrides = {
    tools(editor, tools) {
      return {
        ...tools,

        'lasso-select': {
          id: 'lasso-select',
          label: 'Lasso Select',
          icon: 'blob',
          kbd: 'l',
          onSelect: () => {
            editor.setCurrentTool('lasso-select');
          },
        },
      };
    },
  };

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
      {/* Hide tldraw's "Back to Content" button */}
      <style>{`
        .tlui-button[data-testid="back-to-content"],
        .tlui-offscreen-indicator,
        [class*="back-to-content"],
        .tl-offscreen-indicator {
          display: none !important;
        }
      `}</style>

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
          components={components}
          overrides={overrides}
          onMount={handleMount}
          hideUi={false}
          inferDarkMode={false}
          options={{
            // Disable camera constraints that would interfere with overlay mode
            maxPages: 1,
          }}
        />
      </div>

      {/* DOM selection highlights */}
      <SelectionOverlay selections={domSelections} />

      {/* Annotation markers (numbered indicators) */}
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
          {/* Highlight outline for pending selection */}
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

          {/* Annotation popup */}
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
              // Position popup centered horizontally
              left: Math.max(
                160,
                Math.min(
                  window.innerWidth - 160,
                  (pendingAnnotation.x / 100) * window.innerWidth
                )
              ),
              // Position above or below based on viewport space
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
    </div>
  );
};

export default Skema;

// =============================================================================
// Skema - Main Drawing Overlay Component
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Tldraw,
  TLComponents,
  TLUiOverrides,
  DefaultToolbar,
  DefaultToolbarContent,
  TldrawUiMenuItem,
  useTools,
  useIsToolSelected,
  useEditor,
  Editor,
  TLUiActionsContextType,
  TLShapeId,
  StateNode,
  TLClickEventInfo,
} from 'tldraw';
import 'tldraw/tldraw.css';
import { DOMPickerTool } from '../tools/DOMPickerTool';
import type { Annotation, DOMSelection, SkemaProps, BoundingBox } from '../types';
import { getViewportInfo, bboxIntersects } from '../utils/coordinates';
import { createDOMSelection, shouldIgnoreElement } from '../utils/element-identification';

// Custom toolbar with DOM picker
const SkemaToolbar: React.FC = (props) => {
  const tools = useTools();
  const isDomPickerSelected = useIsToolSelected(tools['dom-picker']);

  return (
    <DefaultToolbar {...props}>
      <TldrawUiMenuItem
        {...tools['dom-picker']}
        isSelected={isDomPickerSelected}
      />
      <DefaultToolbarContent />
    </DefaultToolbar>
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
                <div style={{ color: '#6b7280', fontSize: '11px' }}>
                  {(annotation as DOMSelection).selector.slice(0, 50)}
                </div>
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
  toggleShortcut = 'mod+shift+e',
  initialAnnotations = [],
  zIndex = 99999,
}) => {
  const [isActive, setIsActive] = useState(enabled);
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [domSelections, setDomSelections] = useState<DOMSelection[]>([]);
  const editorRef = useRef<Editor | null>(null);
  const lastDoubleClickRef = useRef<number>(0);

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

  // Handle DOM selection from picker
  const handleDOMSelect = useCallback((selection: DOMSelection) => {
    setDomSelections((prev) => [...prev, selection]);
    setAnnotations((prev) => [
      ...prev,
      { type: 'dom_selection', ...selection } as Annotation,
    ]);
  }, []);

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

  // Handle selection changes from tldraw
  const handleSelectionChange = useCallback((selectedIds: TLShapeId[]) => {
    if (!editorRef.current || selectedIds.length === 0) return;

    const editor = editorRef.current;
    const selectedShapes = selectedIds.map((id) => editor.getShape(id)).filter(Boolean);

    if (selectedShapes.length === 0) return;

    // Get the combined bounds of all selected shapes
    const selectionBounds = editor.getSelectionPageBounds();
    if (!selectionBounds) return;

    // Tldraw shapes are now in document coordinates (camera synced with scroll)
    // Convert to viewport coordinates for DOM element matching
    const viewportBounds: BoundingBox = {
      x: selectionBounds.x - window.scrollX,
      y: selectionBounds.y - window.scrollY,
      width: selectionBounds.width,
      height: selectionBounds.height,
    };

    // Find DOM elements in bounds
    const foundElements = findDOMElementsInBounds(viewportBounds);

    // Create selections for found elements (avoid duplicates)
    foundElements.forEach((el) => {
      const selector = el.tagName.toLowerCase() +
        (el.id ? `#${el.id}` : '') +
        (el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : '');

      // Check if already selected
      const alreadySelected = domSelections.some(
        (s) => s.selector === selector ||
          (Math.abs(s.boundingBox.x - el.getBoundingClientRect().left) < 5 &&
            Math.abs(s.boundingBox.y - el.getBoundingClientRect().top) < 5)
      );

      if (!alreadySelected) {
        const selection = createDOMSelection(el);
        handleDOMSelect(selection);
      }
    });
  }, [findDOMElementsInBounds, domSelections, handleDOMSelect]);

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

    // Create selections for found elements (avoid duplicates)
    foundElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      // Check if already selected by comparing position
      const alreadySelected = domSelections.some(
        (s) => Math.abs(s.boundingBox.x - (rect.left + window.scrollX)) < 5 &&
          Math.abs(s.boundingBox.y - (rect.top + window.scrollY)) < 5
      );

      if (!alreadySelected) {
        const selection = createDOMSelection(el);
        handleDOMSelect(selection);
      }
    });
  }, [findDOMElementsInBounds, domSelections, handleDOMSelect]);

  // Editor mount handler
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Override double click behavior to disable text creation
    // See: https://tldraw.dev/examples/custom-double-click-behavior
    try {
      type IdleStateNode = StateNode & { handleDoubleClickOnCanvas(info: TLClickEventInfo): void };
      const selectIdleState = editor.getStateDescendant<IdleStateNode>('select.idle');
      if (selectIdleState) {
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
            // If shift is not held, replace the selection (clear others first)
            // If shift IS held, we just append (which handleDOMSelect does)
            if (!info.shiftKey) {
              setDomSelections([]);
              setAnnotations((prev) => prev.filter((a) => a.type !== 'dom_selection'));
            }

            const selection = createDOMSelection(target);
            handleDOMSelect(selection);
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

    // Get the DOM picker tool instance and set callback
    const domPickerTool = editor.root.children?.['dom-picker'] as DOMPickerTool | undefined;
    if (domPickerTool && 'setOnSelect' in domPickerTool) {
      domPickerTool.setOnSelect(handleDOMSelect);
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

    // Listen for selection changes using sideEffects
    editor.sideEffects.registerAfterChangeHandler('instance_page_state', (prev, next) => {
      if (prev.selectedShapeIds !== next.selectedShapeIds) {
        const selectedIds = next.selectedShapeIds;
        if (selectedIds.length > 0) {
          // Debounce to avoid too many calls
          setTimeout(() => {
            handleSelectionChange([...selectedIds] as TLShapeId[]);
          }, 100);
        }
      }
      return;
    });
  }, [handleDOMSelect, handleSelectionChange, handleBrushSelection]);

  // Handle single click to clear DOM selections
  useEffect(() => {
    if (!isActive) return;

    const handlePointerDown = (e: PointerEvent) => {
      // Only handle left clicks
      if (e.button !== 0) return;

      // Check if clicking on tldraw canvas (not on UI elements)
      const target = e.target as HTMLElement;
      if (!target.closest('.tl-canvas')) return;

      // Clear DOM selections when clicking on empty canvas
      // Use a small delay to allow brush selection to start first
      setTimeout(() => {
        if (!editorRef.current) return;

        // If no brush is active and no shapes are selected, clear DOM selections
        // Also check if we just double clicked (within last 300ms) - if so, don't clear
        const instance = editorRef.current.getInstanceState();
        const hasShapesSelected = editorRef.current.getSelectedShapeIds().length > 0;
        const isRecentDoubleClick = Date.now() - lastDoubleClickRef.current < 300;

        if (!instance.brush && !hasShapesSelected && !isRecentDoubleClick) {
          setDomSelections([]);
          setAnnotations((prev) => prev.filter((a) => a.type !== 'dom_selection'));
        }
      }, 150);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isActive]);

  // Custom components
  const components: TLComponents = {
    Toolbar: SkemaToolbar,
    // Hide background to make canvas transparent (so website shows through)
    Background: null,
    // Hide some UI elements we don't need
    SharePanel: null,
    MenuPanel: null,
    TopPanel: null,
    PageMenu: null,
  };

  // UI overrides to add DOM picker tool
  const overrides: TLUiOverrides = {
    tools(editor, tools) {
      return {
        ...tools,
        'dom-picker': {
          id: 'dom-picker',
          label: 'DOM Picker',
          icon: 'external-link',
          kbd: 'p',
          onSelect: () => {
            editor.setCurrentTool('dom-picker');
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
      {/* tldraw overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'auto',
        }}
      >
        <Tldraw
          tools={[DOMPickerTool]}
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

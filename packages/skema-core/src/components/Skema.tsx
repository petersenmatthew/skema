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
} from 'tldraw';
import 'tldraw/tldraw.css';
import { DOMPickerTool } from '../tools/DOMPickerTool';
import type { Annotation, DOMSelection, SkemaProps } from '../types';
import { getViewportInfo } from '../utils/coordinates';

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
const SelectionOverlay: React.FC<{ selections: DOMSelection[] }> = ({ selections }) => {
  return (
    <>
      {selections.map((selection) => (
        <div
          key={selection.id}
          data-skema="selection"
          style={{
            position: 'fixed',
            left: selection.boundingBox.x,
            top: selection.boundingBox.y,
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
      ))}
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

  // Editor mount handler
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Get the DOM picker tool instance and set callback
    const domPickerTool = editor.root.children?.['dom-picker'] as DOMPickerTool | undefined;
    if (domPickerTool && 'setOnSelect' in domPickerTool) {
      domPickerTool.setOnSelect(handleDOMSelect);
    }
  }, [handleDOMSelect]);

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

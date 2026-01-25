// =============================================================================
// Skema - Main Drawing Overlay Component
// =============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Tldraw,
  TLComponents,
  TLUiOverrides,
  TldrawOverlays,
  useTools,
  useIsToolSelected,
  useEditor,
  useValue,
  Editor,
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
import { blobToBase64, addGridToSvg, extractTextFromShapes } from '../lib/utils';

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

// =============================================================================
// Custom Icon Components for Toolbar
// =============================================================================

const SelectIcon: React.FC<{ isSelected?: boolean }> = ({ isSelected }) => (
  <svg width="42" height="42" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Red/Orange triangle background */}
    <path 
      d="M11.268 3C12.0378 1.6667 13.9623 1.6667 14.7321 3L25.1244 21C25.8942 22.3333 24.9319 24 23.3923 24H2.6077C1.0681 24 0.1058 22.3333 0.8756 21L11.268 3Z" 
      fill="#F24E1E"
      opacity={isSelected ? 1 : 0.7}
    />
    {/* Cursor/pointer icon */}
    <path 
      d="M9 10L9 18.5L11.5 16L14 20L15.5 19L13 15L16 14.5L9 10Z" 
      fill="white"
    />
  </svg>
);

const DrawIcon: React.FC<{ isSelected?: boolean }> = ({ isSelected }) => (
  <svg width="42" height="42" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="25" height="25" rx="2" fill={isSelected ? '#00C851' : '#00C851'} opacity={isSelected ? 1 : 0.7} />
    <g transform="translate(12.5, 12.5) scale(1.4) translate(-12.5, -12.5)">
      <path 
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M13.6919 10.2852L14.2593 9.6908L14.8282 10.2864L14.2605 10.8808L13.6919 10.2852ZM9.5682 15.7944L8.9992 15.1988L13.1233 10.8808L13.6919 11.476L9.5682 15.7944ZM14.3284 8.5L8 15.1988V16.5H9.5682L16 10.0436L14.3284 8.5Z" 
        fill="white"
      />
    </g>
  </svg>
);

const LassoIcon: React.FC<{ isSelected?: boolean }> = ({ isSelected }) => (
  <svg width="42" height="42" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="25" height="25" rx="12.5" fill={isSelected ? '#2C7FFF' : '#2C7FFF'} opacity={isSelected ? 1 : 0.7} />
    <g transform="translate(12.5, 12.5) scale(1.4) translate(-12.5, -12.5)">
      <path 
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M9.219 11.3C9.219 10.8021 9.504 10.3117 10.043 9.9297C10.582 9.5484 11.347 9.3 12.211 9.3C13.074 9.3 13.839 9.5484 14.378 9.9297C14.918 10.3117 15.202 10.8021 15.202 11.3C15.202 11.7979 14.918 12.2882 14.378 12.6702C13.839 13.0515 13.074 13.2999 12.211 13.2999C12.005 13.2999 11.805 13.2859 11.612 13.2591C11.586 12.5417 10.887 12.0999 10.216 12.0999C9.988 12.0999 9.768 12.147 9.572 12.234C9.339 11.9444 9.219 11.625 9.219 11.3ZM12.211 14.0999C11.908 14.0999 11.614 14.074 11.331 14.0249C11.298 14.0629 11.262 14.0988 11.224 14.1325C11.226 14.154 11.228 14.1774 11.229 14.2026C11.232 14.3182 11.216 14.4769 11.137 14.6456C10.97 15.0066 10.586 15.2824 9.919 15.3874C9.091 15.5175 8.878 15.7607 8.827 15.8497C8.8 15.8961 8.797 15.9328 8.798 15.9542C8.798 15.9629 8.799 15.9695 8.8 15.973C8.805 15.9901 8.81 16.0079 8.813 16.026C8.833 16.1321 8.809 16.2395 8.751 16.3254C8.718 16.3733 8.675 16.4145 8.623 16.445C8.584 16.4681 8.54 16.4847 8.494 16.4932C8.447 16.502 8.4 16.5021 8.355 16.4944C8.296 16.4846 8.242 16.4619 8.195 16.4294C8.148 16.3972 8.108 16.3549 8.078 16.304C8.063 16.278 8.05 16.2501 8.041 16.2208C8.04 16.217 8.038 16.2128 8.037 16.2083C8.032 16.1931 8.027 16.1741 8.022 16.1517C8.012 16.1071 8.002 16.0477 8 15.977C7.996 15.8338 8.023 15.6452 8.136 15.4492C8.365 15.0533 8.87 14.7426 9.795 14.5971C9.958 14.5714 10.079 14.5362 10.167 14.4992C9.499 14.478 8.82 14.0237 8.82 13.2999C8.82 13.0999 8.876 12.9166 8.969 12.758C8.629 12.344 8.421 11.8466 8.421 11.3C8.421 10.4724 8.896 9.7627 9.583 9.2761C10.272 8.7888 11.202 8.5 12.211 8.5C13.219 8.5 14.15 8.7888 14.838 9.2761C15.526 9.7627 16 10.4724 16 11.3C16 12.1275 15.526 12.8372 14.838 13.3238C14.15 13.8111 13.219 14.0999 12.211 14.0999ZM9.754 13.0514C9.859 12.9649 10.021 12.8999 10.216 12.8999C10.634 12.8999 10.815 13.1577 10.815 13.2999C10.815 13.3371 10.806 13.3739 10.789 13.4108C10.757 13.4794 10.69 13.5552 10.58 13.6136C10.482 13.666 10.357 13.6999 10.216 13.6999C9.798 13.6999 9.618 13.4422 9.618 13.2999C9.618 13.2236 9.655 13.1338 9.754 13.0514Z" 
        fill="white"
      />
    </g>
  </svg>
);

const EraseIcon: React.FC<{ isSelected?: boolean }> = ({ isSelected }) => (
  <svg width="50" height="42" viewBox="0 0 30 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Yellow parallelogram background */}
    <path 
      d="M0.308 1.2407C0.151 0.61 0.628 0 1.278 0H23.664C24.118 0 24.516 0.3065 24.631 0.746L30.671 23.746C30.837 24.38 30.359 25 29.704 25H6.982C6.523 25 6.122 24.6868 6.012 24.2407L0.308 1.2407Z" 
      fill="#FFBA00"
      opacity={isSelected ? 1 : 0.7}
    />
    {/* Eraser icon - proper diagonal orientation (down-left to up-right) */}
    <g transform="translate(15, 12.5)">
      <g transform="rotate(-45)">
        <rect x="-6" y="-3" width="12" height="6" rx="1" fill="none" stroke="white" strokeWidth="1.5"/>
        <line x1="-2" y1="-3" x2="-2" y2="3" stroke="white" strokeWidth="1.5"/>
      </g>
    </g>
  </svg>
);

const StarIcon: React.FC<{ isSelected?: boolean }> = ({ isSelected }) => (
  <svg width="42" height="42" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Orange star */}
    <path 
      d="M12.253 0.8403C12.65 0.393 13.35 0.393 13.747 0.8403L16.628 4.0796C16.805 4.2791 17.055 4.3993 17.321 4.4136L21.65 4.6461C22.248 4.6782 22.684 5.2247 22.582 5.8146L21.845 10.0863C21.8 10.3493 21.862 10.6196 22.017 10.8369L24.534 14.366C24.881 14.8533 24.726 15.5348 24.201 15.8231L20.402 17.9105C20.168 18.0391 19.995 18.2558 19.922 18.5125L18.732 22.6808C18.568 23.2564 17.938 23.5596 17.386 23.3292L13.385 21.6606C13.139 21.5578 12.861 21.5578 12.615 21.6606L8.614 23.3292C8.062 23.5596 7.432 23.2564 7.268 22.6808L6.078 18.5125C6.005 18.2558 5.832 18.0391 5.598 17.9105L1.799 15.8231C1.274 15.5348 1.119 14.8533 1.466 14.366L3.983 10.8369C4.138 10.6196 4.2 10.3493 4.155 10.0863L3.418 5.8146C3.316 5.2247 3.752 4.6782 4.35 4.6461L8.679 4.4136C8.945 4.3993 9.195 4.2791 9.372 4.0796L12.253 0.8403Z" 
      fill="#FF6800"
      opacity={isSelected ? 1 : 0.7}
    />
    {/* Git icon (white) */}
    <g transform="translate(6.5, 6) scale(0.5)">
      <path 
        d="M23.546 10.93L13.067 0.452c-0.604-0.603-1.582-0.603-2.188 0L8.708 2.627l2.76 2.76c0.645-0.215 1.379-0.07 1.889 0.441 0.516 0.516 0.658 1.258 0.438 1.9l2.658 2.66c0.645-0.223 1.387-0.078 1.9 0.435 0.721 0.72 0.721 1.884 0 2.604-0.719 0.719-1.881 0.719-2.6 0-0.539-0.541-0.674-1.337-0.404-1.996L12.86 8.955v6.525c0.176 0.086 0.342 0.203 0.488 0.348 0.713 0.721 0.713 1.883 0 2.6-0.719 0.721-1.889 0.721-2.609 0-0.719-0.719-0.719-1.879 0-2.598 0.182-0.18 0.387-0.316 0.605-0.406V8.835c-0.217-0.091-0.424-0.222-0.6-0.401-0.545-0.545-0.676-1.342-0.396-2.009L7.636 3.7 0.45 10.881c-0.6 0.605-0.6 1.584 0 2.189l10.48 10.477c0.604 0.604 1.582 0.604 2.186 0l10.43-10.43c0.605-0.603 0.605-1.582 0-2.187"
        fill="white"
      />
    </g>
  </svg>
);

// =============================================================================
// Custom Toolbar Button Component
// =============================================================================

interface ToolbarButtonProps {
  onClick: () => void;
  isSelected: boolean;
  icon: React.ReactNode;
  label: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ onClick, isSelected, icon, label }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      title={label}
      type="button"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 56,
        height: 56,
        border: 'none',
        borderRadius: 11,
        backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent',
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
        pointerEvents: 'auto',
      }}
    >
      {icon}
    </button>
  );
};

// =============================================================================
// Custom Skema Toolbar
// =============================================================================

const SkemaToolbar: React.FC = () => {
  const editor = useEditor();
  const tools = useTools();
  
  const isSelectSelected = useIsToolSelected(tools['select']);
  const isDrawSelected = useIsToolSelected(tools['draw']);
  const isLassoSelected = useIsToolSelected(tools['lasso-select']);
  const isEraseSelected = useIsToolSelected(tools['eraser']);

  // Placeholder state (not connected to any tool)
  const [isStarSelected] = useState(false);

  return (
    <div
      data-skema="toolbar"
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '11px 17px',
        backgroundColor: 'white',
        borderRadius: 36,
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
        pointerEvents: 'auto',
        zIndex: 99999,
      }}
    >
      <ToolbarButton
        onClick={() => editor.setCurrentTool('select')}
        isSelected={isSelectSelected}
        icon={<SelectIcon isSelected={isSelectSelected} />}
        label="Select (V)"
      />
      <ToolbarButton
        onClick={() => editor.setCurrentTool('lasso-select')}
        isSelected={isLassoSelected}
        icon={<LassoIcon isSelected={isLassoSelected} />}
        label="Lasso Select (L)"
      />
      <ToolbarButton
        onClick={() => editor.setCurrentTool('draw')}
        isSelected={isDrawSelected}
        icon={<DrawIcon isSelected={isDrawSelected} />}
        label="Draw (D)"
      />
      <ToolbarButton
        onClick={() => editor.setCurrentTool('eraser')}
        isSelected={isEraseSelected}
        icon={<EraseIcon isSelected={isEraseSelected} />}
        label="Eraser (E)"
      />
      {/* Separator */}
      <div
        style={{
          width: 3,
          height: 36,
          backgroundColor: '#C4C2C2',
          borderRadius: 1.5,
          margin: '0 6px',
        }}
      />
      {/* Placeholder button - to be implemented later */}
      <ToolbarButton
        onClick={() => {
          // Placeholder - no action yet
          console.log('Star button clicked - placeholder for future feature');
        }}
        isSelected={isStarSelected}
        icon={<StarIcon isSelected={isStarSelected} />}
        label="Special (Coming Soon)"
      />
    </div>
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
      annotationType: hasDrawings ? 'drawing' : 'dom_selection',
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
      annotationType: hasDrawings ? 'drawing' : 'dom_selection',
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
        // Drawing annotation - extract SVG, PNG image, and text from shapes
        const editor = editorRef.current;
        let drawingSvg: string | undefined;
        let drawingImage: string | undefined;
        let extractedText: string | undefined;
        const gridConfig = { color: '#0066FF', size: 100, labels: true };

        if (editor && pendingAnnotation.shapeIds && pendingAnnotation.shapeIds.length > 0) {
          const shapeIds = pendingAnnotation.shapeIds as TLShapeId[];

          try {
            // Get SVG export of the drawing shapes
            const svgResult = await editor.getSvgString(shapeIds, {
              padding: 20,
              background: false,
            });
            if (svgResult?.svg) {
              // Add grid overlay to SVG for positioning reference
              drawingSvg = addGridToSvg(svgResult.svg, gridConfig);
            }
          } catch (e) {
            console.warn('[Skema] Failed to export drawing SVG:', e);
          }

          try {
            // Get PNG image export for vision AI
            const imageResult = await editor.toImage(shapeIds, {
              format: 'png',
              padding: 20,
              background: true,
            });
            if (imageResult?.blob) {
              drawingImage = await blobToBase64(imageResult.blob);
            }
          } catch (e) {
            console.warn('[Skema] Failed to export drawing image:', e);
          }

          // Extract text from text/note shapes
          try {
            const shapes = shapeIds.map(id => editor.getShape(id)).filter(Boolean);
            extractedText = extractTextFromShapes(shapes);
          } catch (e) {
            console.warn('[Skema] Failed to extract text from shapes:', e);
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
          drawingImage,
          extractedText: extractedText || undefined,
          gridConfig,
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

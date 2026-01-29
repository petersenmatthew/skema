// =============================================================================
// Annotation Marker Component - Shows numbered markers for each annotation
// =============================================================================

import React from 'react';
import type { Annotation, DOMSelection } from '../../types';

// =============================================================================
// Single Annotation Marker
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
                    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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

// =============================================================================
// Annotation Markers Layer - Container for all markers
// =============================================================================

interface AnnotationMarkersLayerProps {
    annotations: Annotation[];
    scrollOffset: { x: number; y: number };
    hoveredMarkerId: string | null;
    onHover: (id: string | null) => void;
    onDelete: (annotation: Annotation) => void;
}

export const AnnotationMarkersLayer: React.FC<AnnotationMarkersLayerProps> = ({
    annotations,
    scrollOffset,
    hoveredMarkerId,
    onHover,
    onDelete,
}) => {
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

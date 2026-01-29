// =============================================================================
// Annotations Sidebar - Collapsible panel showing annotation list
// =============================================================================

import React, { useState } from 'react';
import type { Annotation, DOMSelection, DrawingAnnotation } from '../../types';

interface AnnotationsSidebarProps {
    annotations: Annotation[];
    onClear: () => void;
    onExport: () => void;
}

export const AnnotationsSidebar: React.FC<AnnotationsSidebarProps> = ({
    annotations,
    onClear,
    onExport,
}) => {
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
                                {annotation.type === 'dom_selection' && `[DOM] ${(annotation as DOMSelection).tagName}`}
                                {annotation.type === 'drawing' && `[Draw] ${(annotation as DrawingAnnotation).comment || 'Drawing'}`}
                                {annotation.type === 'gesture' && `[Gesture] ${annotation.gesture}`}
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

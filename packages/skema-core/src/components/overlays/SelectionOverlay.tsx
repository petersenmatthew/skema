// =============================================================================
// Selection Overlay - Highlights selected DOM elements
// =============================================================================

import React, { useEffect, useState } from 'react';
import type { DOMSelection } from '../../types';

interface SelectionOverlayProps {
    selections: DOMSelection[];
    scrollOffset?: { x: number; y: number };
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({ selections, scrollOffset: externalOffset }) => {
    // Track scroll position as fallback when no external offset provided
    const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        // Skip internal tracking when external offset is provided
        if (externalOffset) return;

        const handleScrollOrResize = () => {
            setScrollPos({ x: window.scrollX, y: window.scrollY });
        };
        handleScrollOrResize();
        window.addEventListener('scroll', handleScrollOrResize, { passive: true });
        window.addEventListener('resize', handleScrollOrResize);
        return () => {
            window.removeEventListener('scroll', handleScrollOrResize);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [externalOffset]);

    const offset = externalOffset ?? scrollPos;

    return (
        <>
            {selections.map((selection) => {
                // boundingBox is stored in document coordinates
                // Convert to viewport coordinates by subtracting current scroll offset
                const viewportX = selection.boundingBox.x - offset.x;
                const viewportY = selection.boundingBox.y - offset.y;

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

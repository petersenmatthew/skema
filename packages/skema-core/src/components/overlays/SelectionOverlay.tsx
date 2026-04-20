// =============================================================================
// Selection Overlay - Highlights selected DOM elements
// =============================================================================

import React, { useEffect, useState } from 'react';
import type { DOMSelection } from '../../types';

interface SelectionOverlayProps {
    selections: DOMSelection[];
    scrollOffset?: { x: number; y: number; zoom: number };
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({ selections, scrollOffset: externalOffset }) => {
    // Track scroll position as fallback when no external offset provided
    const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });

    useEffect(() => {
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

    const zoom = externalOffset?.zoom ?? 1;
    const offsetX = externalOffset?.x ?? scrollPos.x;
    const offsetY = externalOffset?.y ?? scrollPos.y;

    return (
        <>
            {selections.map((selection) => {
                const viewportX = selection.boundingBox.x * zoom - offsetX;
                const viewportY = selection.boundingBox.y * zoom - offsetY;

                return (
                    <div
                        key={selection.id}
                        data-skema="selection"
                        style={{
                            position: 'fixed',
                            left: viewportX,
                            top: viewportY,
                            width: selection.boundingBox.width * zoom,
                            height: selection.boundingBox.height * zoom,
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

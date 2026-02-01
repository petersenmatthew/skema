// =============================================================================
// Selection Overlay - Highlights selected DOM elements
// =============================================================================

import React, { useEffect, useState } from 'react';
import type { DOMSelection } from '../../types';

interface SelectionOverlayProps {
    selections: DOMSelection[];
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({ selections }) => {
    // Track scroll position to trigger re-renders
    const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleScrollOrResize = () => {
            setScrollPos({ x: window.scrollX, y: window.scrollY });
        };
        // Initial position
        handleScrollOrResize();
        window.addEventListener('scroll', handleScrollOrResize, { passive: true });
        window.addEventListener('resize', handleScrollOrResize);
        return () => {
            window.removeEventListener('scroll', handleScrollOrResize);
            window.removeEventListener('resize', handleScrollOrResize);
        };
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

// =============================================================================
// Lasso Overlay - Renders the lasso path while drawing
// =============================================================================

import React, { useMemo } from 'react';
import { TldrawOverlays, useEditor, useValue } from 'tldraw';
import type { LassoingState } from '../../tools/LassoSelectTool';

// =============================================================================
// Lasso Overlay Component
// =============================================================================

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

// =============================================================================
// Combined Skema Overlays
// =============================================================================

export const SkemaOverlays: React.FC = () => {
    return (
        <>
            <TldrawOverlays />
            <LassoOverlay />
        </>
    );
};

// =============================================================================
// Processing Overlay - Shows animation when changes are being made
// =============================================================================

import React from 'react';
import type { BoundingBox } from '../../types';

// =============================================================================
// Animated Shape Loader - Cycles through colorful shapes
// =============================================================================

const ShapeLoader: React.FC = () => {
    return (
        <div
            style={{
                position: 'relative',
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {/* Orange Star */}
            <svg
                className="skema-shape skema-shape-1"
                viewBox="0 0 24 24"
                style={{
                    position: 'absolute',
                    width: 24,
                    height: 24,
                }}
            >
                <polygon
                    points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9"
                    fill="#F97316"
                />
            </svg>
            {/* Yellow Parallelogram */}
            <svg
                className="skema-shape skema-shape-2"
                viewBox="0 0 24 24"
                style={{
                    position: 'absolute',
                    width: 24,
                    height: 24,
                }}
            >
                <polygon
                    points="6,4 22,4 18,20 2,20"
                    fill="#FACC15"
                />
            </svg>
            {/* Red Triangle */}
            <svg
                className="skema-shape skema-shape-3"
                viewBox="0 0 24 24"
                style={{
                    position: 'absolute',
                    width: 24,
                    height: 24,
                }}
            >
                <polygon
                    points="12,3 22,21 2,21"
                    fill="#EF4444"
                />
            </svg>
            {/* Blue Circle */}
            <svg
                className="skema-shape skema-shape-4"
                viewBox="0 0 24 24"
                style={{
                    position: 'absolute',
                    width: 24,
                    height: 24,
                }}
            >
                <circle cx="12" cy="12" r="10" fill="#3B82F6" />
            </svg>
            {/* Green Square */}
            <svg
                className="skema-shape skema-shape-5"
                viewBox="0 0 24 24"
                style={{
                    position: 'absolute',
                    width: 24,
                    height: 24,
                }}
            >
                <rect x="3" y="3" width="18" height="18" fill="#22C55E" />
            </svg>
        </div>
    );
};

// =============================================================================
// Processing Overlay Styles (CSS Keyframes)
// =============================================================================

export const ProcessingOverlayStyles = `
  @keyframes skema-processing-pulse {
    0%, 100% {
      opacity: 0.7;
      transform: scale(1);
    }
    50% {
      opacity: 0.95;
      transform: scale(1.02);
    }
  }
  @keyframes skema-processing-shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
  @keyframes skema-processing-border {
    0%, 100% {
      border-color: rgba(139, 92, 246, 0.85);
    }
    50% {
      border-color: rgba(139, 92, 246, 1);
    }
  }
  
  /* Shape loader animations */
  .skema-shape {
    opacity: 0;
    transform: scale(0.5) rotate(-180deg);
    animation: skema-shape-cycle 2.5s ease-in-out infinite;
  }
  .skema-shape-1 { animation-delay: 0s; }
  .skema-shape-2 { animation-delay: 0.5s; }
  .skema-shape-3 { animation-delay: 1s; }
  .skema-shape-4 { animation-delay: 1.5s; }
  .skema-shape-5 { animation-delay: 2s; }
  
  @keyframes skema-shape-cycle {
    0%, 100% {
      opacity: 0;
      transform: scale(0.5) rotate(-180deg);
    }
    10%, 30% {
      opacity: 1;
      transform: scale(1) rotate(0deg);
    }
    40% {
      opacity: 0;
      transform: scale(0.5) rotate(180deg);
    }
  }
`;

// =============================================================================
// Main Processing Overlay Component
// =============================================================================

interface ProcessingOverlayProps {
    boundingBox: BoundingBox;
    scrollOffset: { x: number; y: number };
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ boundingBox, scrollOffset }) => {
    // Convert to viewport coordinates
    const viewportX = boundingBox.x - scrollOffset.x;
    const viewportY = boundingBox.y - scrollOffset.y;

    return (
        <>
            <style>{ProcessingOverlayStyles}</style>
            <div
                data-skema="processing-overlay"
                style={{
                    position: 'fixed',
                    left: viewportX,
                    top: viewportY,
                    width: boundingBox.width,
                    height: boundingBox.height,
                    border: '3px solid rgba(139, 92, 246, 0.95)',
                    borderRadius: 4,
                    pointerEvents: 'none',
                    zIndex: 999998,
                    animation: 'skema-processing-pulse 1.5s ease-in-out infinite, skema-processing-border 1.5s ease-in-out infinite',
                    background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.35) 50%, rgba(139, 92, 246, 0.15) 100%)',
                    backgroundSize: '200% 100%',
                }}
            >
                {/* Shimmer effect */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.25) 50%, transparent 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'skema-processing-shimmer 2s linear infinite',
                        borderRadius: 2,
                    }}
                />
                {/* Loading indicator badge with animated shapes */}
                <div
                    style={{
                        position: 'absolute',
                        top: -18,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px 14px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 20,
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.08)',
                    }}
                >
                    <ShapeLoader />
                </div>
            </div>
        </>
    );
};

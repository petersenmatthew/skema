// =============================================================================
// Shape Picker Popup Component
// =============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useEditor, GeoShapeGeoStyle } from 'tldraw';

// All available geo shapes in tldraw
const GEO_SHAPES = [
    'rectangle',
    'ellipse',
    'triangle',
    'diamond',
    'pentagon',
    'hexagon',
    'octagon',
    'star',
    'rhombus',
    'rhombus-2',
    'oval',
    'trapezoid',
    'arrow-right',
    'arrow-left',
    'arrow-up',
    'arrow-down',
    'x-box',
    'check-box',
    'cloud',
    'heart',
] as const;

type GeoShape = (typeof GEO_SHAPES)[number];

// SVG icons for each shape
const ShapeIcon: React.FC<{ shape: GeoShape; size?: number }> = ({ shape, size = 20 }) => {
    const stroke = 'currentColor';
    const strokeWidth = 1.5;
    const fill = 'none';

    switch (shape) {
        case 'rectangle':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <rect x="3" y="5" width="18" height="14" rx="1" />
                </svg>
            );
        case 'ellipse':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <ellipse cx="12" cy="12" rx="9" ry="7" />
                </svg>
            );
        case 'triangle':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <path d="M12 4L21 20H3L12 4Z" />
                </svg>
            );
        case 'diamond':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <path d="M12 2L22 12L12 22L2 12L12 2Z" />
                </svg>
            );
        case 'pentagon':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <path d="M12 2L22 9L18 21H6L2 9L12 2Z" />
                </svg>
            );
        case 'hexagon':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" />
                </svg>
            );
        case 'octagon':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <path d="M8 2H16L22 8V16L16 22H8L2 16V8L8 2Z" />
                </svg>
            );
        case 'star':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <path d="M12 2L14.5 9H22L16 13.5L18.5 21L12 16.5L5.5 21L8 13.5L2 9H9.5L12 2Z" />
                </svg>
            );
        case 'rhombus':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <path d="M12 3L20 12L12 21L4 12L12 3Z" />
                </svg>
            );
        case 'rhombus-2':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <path d="M2 12L12 4L22 12L12 20L2 12Z" />
                </svg>
            );
        case 'oval':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <ellipse cx="12" cy="12" rx="6" ry="9" />
                </svg>
            );
        case 'trapezoid':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <path d="M6 6H18L21 18H3L6 6Z" />
                </svg>
            );
        case 'arrow-right':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <path d="M4 8V16H12V20L20 12L12 4V8H4Z" />
                </svg>
            );
        case 'arrow-left':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <path d="M20 8V16H12V20L4 12L12 4V8H20Z" />
                </svg>
            );
        case 'arrow-up':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <path d="M8 22V10L4 10L12 2L20 10H16V22H8Z" />
                </svg>
            );
        case 'arrow-down':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <path d="M8 2V14L4 14L12 22L20 14H16V2H8Z" />
                </svg>
            );
        case 'x-box':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <rect x="3" y="3" width="18" height="18" rx="1" />
                    <path d="M8 8L16 16M16 8L8 16" />
                </svg>
            );
        case 'check-box':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <rect x="3" y="3" width="18" height="18" rx="1" />
                    <path d="M7 12L10 15L17 8" />
                </svg>
            );
        case 'cloud':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <path d="M6.5 19C4 19 2 17 2 14.5C2 12.5 3.5 10.5 5.5 10C5.5 7 8 4 12 4C15.5 4 18 6.5 18.5 9.5C20.5 10 22 11.5 22 14C22 16.5 20 19 17.5 19H6.5Z" />
                </svg>
            );
        case 'heart':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <path d="M12 21C12 21 3 15 3 9C3 6 5.5 3 8.5 3C10.5 3 12 4.5 12 4.5C12 4.5 13.5 3 15.5 3C18.5 3 21 6 21 9C21 15 12 21 12 21Z" />
                </svg>
            );
        default:
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
                    <rect x="3" y="3" width="18" height="18" rx="1" />
                </svg>
            );
    }
};

interface ShapePickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectShape: (shape: GeoShape) => void;
    anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export const ShapePicker: React.FC<ShapePickerProps> = ({ isOpen, onClose, onSelectShape, anchorRef }) => {
    const editor = useEditor();
    const pickerRef = useRef<HTMLDivElement>(null);
    const [selectedShape, setSelectedShape] = useState<GeoShape>('rectangle');

    // Get the current geo style from the editor
    useEffect(() => {
        const currentGeo = editor.getStyleForNextShape(GeoShapeGeoStyle);
        if (currentGeo && GEO_SHAPES.includes(currentGeo as GeoShape)) {
            setSelectedShape(currentGeo as GeoShape);
        }
    }, [editor, isOpen]);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                pickerRef.current &&
                !pickerRef.current.contains(e.target as Node) &&
                anchorRef.current &&
                !anchorRef.current.contains(e.target as Node)
            ) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, anchorRef]);

    // Close on escape
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleShapeClick = (e: React.MouseEvent, shape: GeoShape) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedShape(shape);
        onSelectShape(shape);
    };

    // Prevent all pointer events from reaching tldraw
    const stopAllEvents = (e: React.SyntheticEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // Calculate position above the anchor button
    const anchorRect = anchorRef.current?.getBoundingClientRect();
    const pickerStyle: React.CSSProperties = anchorRect
        ? {
              position: 'fixed',
              bottom: window.innerHeight - anchorRect.top + 8,
              left: anchorRect.left + anchorRect.width / 2,
              transform: 'translateX(-50%)',
          }
        : {};

    return (
        <div
            ref={pickerRef}
            style={{
                ...pickerStyle,
                backgroundColor: 'white',
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                padding: 8,
                zIndex: 100000,
                pointerEvents: 'auto',
            }}
            onClick={stopAllEvents}
            onPointerDown={stopAllEvents}
            onMouseDown={stopAllEvents}
        >
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 2,
                }}
            >
                {GEO_SHAPES.map((shape) => (
                    <button
                        key={shape}
                        onClick={(e) => handleShapeClick(e, shape)}
                        onPointerDown={stopAllEvents}
                        onMouseDown={stopAllEvents}
                        title={shape.replace(/-/g, ' ')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            border: 'none',
                            borderRadius: 4,
                            backgroundColor: selectedShape === shape ? '#e8f4ff' : 'transparent',
                            color: selectedShape === shape ? '#2c7fff' : '#333',
                            cursor: 'pointer',
                            transition: 'background-color 0.1s',
                        }}
                        onMouseEnter={(e) => {
                            if (selectedShape !== shape) {
                                e.currentTarget.style.backgroundColor = '#f5f5f5';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (selectedShape !== shape) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }
                        }}
                    >
                        <ShapeIcon shape={shape} size={18} />
                    </button>
                ))}
            </div>
        </div>
    );
};

export { GEO_SHAPES, type GeoShape };

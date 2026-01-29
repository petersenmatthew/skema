// =============================================================================
// Skema Toolbar Component
// =============================================================================

import React from 'react';
import { useEditor, useTools, useIsToolSelected } from 'tldraw';
import { SelectIcon, DrawIcon, LassoIcon, EraseIcon, ShapesIcon } from './ToolbarIcons';

// =============================================================================
// Toolbar Button Component
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
// Main Skema Toolbar
// =============================================================================

export const SkemaToolbar: React.FC = () => {
    const editor = useEditor();
    const tools = useTools();

    const isSelectSelected = useIsToolSelected(tools['select']);
    const isDrawSelected = useIsToolSelected(tools['draw']);
    const isLassoSelected = useIsToolSelected(tools['lasso-select']);
    const isEraseSelected = useIsToolSelected(tools['eraser']);
    const isGeoSelected = useIsToolSelected(tools['geo']);

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
                label="Select (S)"
            />
            <ToolbarButton
                onClick={() => editor.setCurrentTool('draw')}
                isSelected={isDrawSelected}
                icon={<DrawIcon isSelected={isDrawSelected} />}
                label="Draw (D)"
            />
            <ToolbarButton
                onClick={() => editor.setCurrentTool('lasso-select')}
                isSelected={isLassoSelected}
                icon={<LassoIcon isSelected={isLassoSelected} />}
                label="Lasso Select (L)"
            />
            <ToolbarButton
                onClick={() => editor.setCurrentTool('eraser')}
                isSelected={isEraseSelected}
                icon={<EraseIcon isSelected={isEraseSelected} />}
                label="Eraser (E)"
            />
            {/* Shapes tool - for drawing geometric shapes */}
            <ToolbarButton
                onClick={() => editor.setCurrentTool('geo')}
                isSelected={isGeoSelected}
                icon={<ShapesIcon isSelected={isGeoSelected} />}
                label="Shapes (G)"
            />
        </div>
    );
};

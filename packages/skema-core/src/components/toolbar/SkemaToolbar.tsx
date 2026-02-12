// =============================================================================
// Skema Toolbar Component - Collapsible with Framer Motion Animations
// =============================================================================

import React, { useState, useRef } from 'react';
import { useEditor, useTools, useIsToolSelected, GeoShapeGeoStyle } from 'tldraw';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectIcon, DrawIcon, LassoIcon, EraseIcon, ShapesIcon } from './ToolbarIcons';
import { SLogoIcon, ChevronLeftIcon, ChevronRightIcon, SettingsIcon } from './ToolbarIcons';
import { ShapePicker, type GeoShape } from './ShapePicker';

// =============================================================================
// Animation Variants
// =============================================================================

// Total number of tools (for reverse stagger calculation)
const TOOL_COUNT = 4;

// Smooth exit duration for coordinated collapse
const EXIT_DURATION = 0.12;
const EXIT_STAGGER = 0.01;

// Cubic bezier easing for smooth deceleration
const smoothEasing: [number, number, number, number] = [0.4, 0, 0.2, 1];

const toolVariants = {
    hidden: {
        opacity: 0,
        scale: 0.8,
        width: 0,
        marginRight: -6,
    },
    visible: (i: number) => ({
        opacity: 1,
        scale: 1,
        width: 40,
        marginRight: 0,
        transition: {
            opacity: { duration: 0.15, delay: i * 0.04 },
            scale: { type: 'spring' as const, stiffness: 400, damping: 25, delay: i * 0.04 },
            width: { type: 'spring' as const, stiffness: 400, damping: 30, delay: i * 0.03 },
            marginRight: { duration: 0.1, delay: i * 0.03 },
        },
    }),
    exit: (i: number) => ({
        opacity: 0,
        scale: 0.8,
        width: 0,
        marginRight: -6,
        transition: {
            opacity: { duration: 0.06, ease: 'easeOut' as const },
            scale: { duration: EXIT_DURATION, ease: smoothEasing },
            width: { duration: EXIT_DURATION, ease: smoothEasing, delay: EXIT_STAGGER * (TOOL_COUNT - 1 - i) },
            marginRight: { duration: EXIT_DURATION, ease: smoothEasing, delay: EXIT_STAGGER * (TOOL_COUNT - 1 - i) },
        },
    }),
};

const chevronVariants = {
    hidden: { 
        opacity: 0, 
        scale: 0.8,
        width: 0,
    },
    visible: {
        opacity: 0.6,
        scale: 1,
        width: 28,
        transition: { 
            opacity: { delay: 0.1, duration: 0.1 },
            scale: { delay: 0.1, type: 'spring' as const, stiffness: 500, damping: 30 },
            width: { delay: 0.08, duration: 0.12, ease: 'easeOut' as const },
        },
    },
    exit: { 
        opacity: 0, 
        scale: 0.8,
        width: 0,
        transition: { 
            opacity: { duration: 0.06 },
            scale: { duration: 0.08 },
            width: { duration: 0.1, ease: smoothEasing },
        } 
    },
};

// =============================================================================
// Toolbar Button Component (original style)
// =============================================================================

interface ToolbarButtonProps {
    onClick: () => void;
    isSelected: boolean;
    icon: React.ReactNode;
    label: string;
    buttonRef?: React.RefObject<HTMLButtonElement | null>;
    index?: number;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ 
    onClick, 
    isSelected, 
    icon, 
    label, 
    buttonRef,
    index = 0,
}) => {
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
    };

    return (
        <motion.button
            ref={buttonRef}
            custom={index}
            variants={toolVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={handleClick}
            title={label}
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 40,
                minWidth: 0,
                border: 'none',
                borderRadius: 8,
                backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent',
                cursor: 'pointer',
                pointerEvents: 'auto',
                overflow: 'hidden',
                flexShrink: 0,
            }}
        >
            <motion.span
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.12 }}
            >
                {icon}
            </motion.span>
        </motion.button>
    );
};

// =============================================================================
// Logo/Shapes Button Component (S logo when collapsed, ShapesIcon when expanded)
// =============================================================================

interface LogoShapesButtonProps {
    isExpanded: boolean;
    isHovered: boolean;
    isSelected: boolean;
    onClick: () => void;
    onShapesClick: () => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    buttonRef?: React.RefObject<HTMLButtonElement | null>;
}

const LogoShapesButton: React.FC<LogoShapesButtonProps> = ({
    isExpanded,
    isHovered,
    isSelected,
    onClick,
    onShapesClick,
    onMouseEnter,
    onMouseLeave,
    buttonRef,
}) => {
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isExpanded) {
            onShapesClick();
        } else {
            onClick();
        }
    };

    return (
        <motion.button
            ref={buttonRef}
            onClick={handleClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            title={isExpanded ? "Shapes (G)" : "Expand toolbar"}
            type="button"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                border: 'none',
                borderRadius: 8,
                backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent',
                cursor: 'pointer',
                pointerEvents: 'auto',
                position: 'relative',
            }}
        >
            <AnimatePresence mode="popLayout">
                {isExpanded ? (
                    <motion.div
                        key="shapes"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={{ 
                            type: 'spring',
                            stiffness: 500,
                            damping: 30,
                            opacity: { duration: 0.08 }
                        }}
                    >
                        <ShapesIcon isSelected={isSelected} />
                    </motion.div>
                ) : isHovered ? (
                    <motion.div
                        key="chevron"
                        initial={{ opacity: 0, x: -3 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 3 }}
                        transition={{ duration: 0.08, ease: 'easeOut' }}
                    >
                        <ChevronRightIcon size={20} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="s"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={{ 
                            type: 'spring',
                            stiffness: 500,
                            damping: 30,
                            opacity: { duration: 0.06 }
                        }}
                    >
                        <SLogoIcon size={32} />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.button>
    );
};

// =============================================================================
// Collapse Button Component
// =============================================================================

const CollapseButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    return (
        <motion.button
            variants={chevronVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick();
            }}
            title="Collapse toolbar"
            type="button"
            whileHover={{ opacity: 1, scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 40,
                minWidth: 0,
                border: 'none',
                borderRadius: 6,
                backgroundColor: 'transparent',
                cursor: 'pointer',
                pointerEvents: 'auto',
                marginLeft: 2,
                overflow: 'hidden',
                flexShrink: 0,
            }}
        >
            <motion.span
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
            >
                <ChevronLeftIcon size={20} />
            </motion.span>
        </motion.button>
    );
};

// =============================================================================
// Settings Button Component
// =============================================================================

interface SettingsButtonProps {
    isActive: boolean;
    onClick: () => void;
    index: number;
}

const SettingsButton: React.FC<SettingsButtonProps> = ({ isActive, onClick, index }) => {
    return (
        <motion.button
            custom={index}
            variants={toolVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick();
            }}
            title="Style settings"
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 40,
                border: 'none',
                borderRadius: 8,
                backgroundColor: isActive ? 'rgba(255, 104, 0, 0.1)' : 'transparent',
                cursor: 'pointer',
                pointerEvents: 'auto',
            }}
        >
            <SettingsIcon size={20} isActive={isActive} />
        </motion.button>
    );
};

// =============================================================================
// Main Skema Toolbar
// =============================================================================

export interface SkemaToolbarProps {
    isExpanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    onStylePanelChange?: (open: boolean) => void;
}

export const SkemaToolbar: React.FC<SkemaToolbarProps> = ({ isExpanded: controlledExpanded, onExpandedChange, onStylePanelChange }) => {
    const editor = useEditor();
    const tools = useTools();
    const shapesButtonRef = useRef<HTMLButtonElement>(null);

    // Collapse/expand state (use controlled prop if provided)
    const [internalExpanded, setInternalExpanded] = useState(false);
    const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
    const [isLogoHovered, setIsLogoHovered] = useState(false);
    const [isShapePickerOpen, setIsShapePickerOpen] = useState(false);
    const [isStylePanelOpen, setIsStylePanelOpen] = useState(false);

    // Tool selection states
    const isSelectSelected = useIsToolSelected(tools['select']);
    const isDrawSelected = useIsToolSelected(tools['draw']);
    const isLassoSelected = useIsToolSelected(tools['lasso-select']);
    const isEraseSelected = useIsToolSelected(tools['eraser']);
    const isGeoSelected = useIsToolSelected(tools['geo']);

    const handleExpand = (expanded: boolean) => {
        setInternalExpanded(expanded);
        onExpandedChange?.(expanded);
        // Close style panel when collapsing
        if (!expanded) {
            setIsStylePanelOpen(false);
            onStylePanelChange?.(false);
        }
    };

    const handleStylePanelToggle = () => {
        const newState = !isStylePanelOpen;
        setIsStylePanelOpen(newState);
        onStylePanelChange?.(newState);
    };

    const handleLogoClick = () => {
        handleExpand(true);
    };

    const handleCollapse = () => {
        handleExpand(false);
        setIsShapePickerOpen(false);
    };

    const handleShapesClick = () => {
        setIsShapePickerOpen((prev) => !prev);
    };

    const handleSelectShape = (shape: GeoShape) => {
        editor.setStyleForNextShapes(GeoShapeGeoStyle, shape);
        editor.setCurrentTool('geo');
        setIsShapePickerOpen(false);
    };

    return (
        <>
            {/* Centering wrapper */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 16,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    zIndex: 99999,
                }}
            >
                <motion.div
                    data-skema="toolbar"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        backgroundColor: 'white',
                        borderRadius: 28,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                        pointerEvents: 'auto',
                    }}
                >
                {/* Logo/Shapes button - always first, transforms from S to Shapes when expanded */}
                <LogoShapesButton
                    isExpanded={isExpanded}
                    isHovered={isLogoHovered}
                    isSelected={isGeoSelected || isShapePickerOpen}
                    onClick={handleLogoClick}
                    onShapesClick={handleShapesClick}
                    onMouseEnter={() => setIsLogoHovered(true)}
                    onMouseLeave={() => setIsLogoHovered(false)}
                    buttonRef={shapesButtonRef}
                />

                {/* Other toolbar buttons - show when expanded */}
                <AnimatePresence mode="popLayout">
                    {isExpanded && (
                        <>
                            <ToolbarButton
                                key="select"
                                onClick={() => editor.setCurrentTool('select')}
                                isSelected={isSelectSelected}
                                icon={<SelectIcon isSelected={isSelectSelected} />}
                                label="Select (S)"
                                index={0}
                            />
                            <ToolbarButton
                                key="draw"
                                onClick={() => editor.setCurrentTool('draw')}
                                isSelected={isDrawSelected}
                                icon={<DrawIcon isSelected={isDrawSelected} />}
                                label="Draw (D)"
                                index={1}
                            />
                            <ToolbarButton
                                key="lasso"
                                onClick={() => editor.setCurrentTool('lasso-select')}
                                isSelected={isLassoSelected}
                                icon={<LassoIcon isSelected={isLassoSelected} />}
                                label="Lasso Select (L)"
                                index={2}
                            />
                            <ToolbarButton
                                key="erase"
                                onClick={() => editor.setCurrentTool('eraser')}
                                isSelected={isEraseSelected}
                                icon={<EraseIcon isSelected={isEraseSelected} />}
                                label="Eraser (E)"
                                index={3}
                            />

                            {/* Collapse Chevron */}
                            <CollapseButton
                                key="collapse"
                                onClick={handleCollapse}
                            />
                        </>
                    )}
                </AnimatePresence>
                </motion.div>
            </div>

            {/* Shape Picker (for geo tool sub-shapes) */}
            <ShapePicker
                isOpen={isShapePickerOpen}
                onClose={() => setIsShapePickerOpen(false)}
                onSelectShape={handleSelectShape}
                anchorRef={shapesButtonRef}
            />
        </>
    );
};

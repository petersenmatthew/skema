// =============================================================================
// Skema Types
// =============================================================================

/**
 * Represents a DOM element selection
 */
export interface DOMSelection {
  id: string;
  selector: string;
  tagName: string;
  elementPath: string;
  text: string;
  boundingBox: BoundingBox;
  timestamp: number;
  pathname: string;
  cssClasses?: string;
  attributes?: Record<string, string>;
}

/**
 * Bounding box for element positioning
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Viewport information for coordinate calculations
 */
export interface ViewportInfo {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

/**
 * Drawing annotation from tldraw
 */
export interface DrawingAnnotation {
  id: string;
  type: 'drawing';
  tool: string;
  shapes: unknown[]; // tldraw shape data
  boundingBox: BoundingBox;
  relatedTo?: string; // DOM selector if linked to element
  timestamp: number;
}

/**
 * Gesture action annotation
 */
export interface GestureAnnotation {
  id: string;
  type: 'gesture';
  gesture: 'scribble_delete' | 'circle' | 'rectangle' | 'arrow';
  target?: string; // DOM selector of target element
  boundingBox: BoundingBox;
  timestamp: number;
}

/**
 * Union type for all annotation types
 */
export type Annotation =
  | { type: 'dom_selection' } & DOMSelection
  | DrawingAnnotation
  | GestureAnnotation;

/**
 * Complete export format for annotations
 */
export interface AnnotationExport {
  version: string;
  timestamp: string;
  viewport: ViewportInfo;
  pathname: string;
  annotations: Annotation[];
}

/**
 * Skema component props
 */
export interface SkemaProps {
  /** Whether Skema overlay is enabled */
  enabled?: boolean;
  /** Callback when annotations change */
  onAnnotationsChange?: (annotations: Annotation[]) => void;
  /** Keyboard shortcut to toggle Skema (default: Cmd/Ctrl + Shift + E) */
  toggleShortcut?: string;
  /** Initial annotations to load */
  initialAnnotations?: Annotation[];
  /** Z-index for the overlay (default: 99999) */
  zIndex?: number;
}

/**
 * Skema mode - determines what tools are available
 */
export type SkemaMode = 'select' | 'draw';



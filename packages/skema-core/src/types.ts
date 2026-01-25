// =============================================================================
// Skema Types
// =============================================================================

/**
 * Represents a single DOM element in a selection
 */
export interface DOMElement {
  selector: string;
  tagName: string;
  elementPath: string;
  text: string;
  boundingBox: BoundingBox;
  cssClasses?: string;
  attributes?: Record<string, string>;
}

/**
 * Represents a DOM element selection (can contain one or more elements)
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
  /** User annotation comment */
  comment?: string;
  /** Whether this is a multi-element selection */
  isMultiSelect?: boolean;
  /** Individual elements when this is a grouped selection */
  elements?: DOMElement[];
}

/**
 * Pending annotation state for the popup
 */
export interface PendingAnnotation {
  /** Screen X position (percentage of viewport width) */
  x: number;
  /** Screen Y position (pixels from top of document) */
  y: number;
  /** Y position relative to viewport (for popup positioning) */
  clientY: number;
  /** Element identifier string */
  element: string;
  /** CSS selector path */
  elementPath: string;
  /** Selected text content if any */
  selectedText?: string;
  /** Bounding box of selected element(s) */
  boundingBox?: BoundingBox;
  /** Whether this is a multi-element selection */
  isMultiSelect?: boolean;
  /** The DOM selection(s) being annotated */
  selections?: DOMSelection[];
  /** Type of annotation */
  annotationType: 'dom_selection' | 'drawing';
  /** Drawing shape IDs if annotating drawings */
  shapeIds?: string[];
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
 * Computed styles for an element
 */
export interface ElementStyles {
  // Typography
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: string;
  color?: string;
  // Spacing
  padding?: string;
  margin?: string;
  gap?: string;
  // Layout
  display?: string;
  flexDirection?: string;
  alignItems?: string;
  justifyContent?: string;
  // Visual
  backgroundColor?: string;
  borderRadius?: string;
  border?: string;
  boxShadow?: string;
  // Sizing
  width?: string;
  height?: string;
  maxWidth?: string;
}

/**
 * Nearby element with style context for AI
 */
export interface NearbyElement {
  selector: string;
  tagName: string;
  text?: string;
  className?: string;
  styles?: ElementStyles;
  tailwindClasses?: string[];
}

/**
 * Project-level style context
 */
export interface ProjectStyleContext {
  cssFramework?: 'tailwind' | 'bootstrap' | 'material-ui' | 'chakra' | 'vanilla' | 'css-modules' | 'styled-components' | 'unknown';
  cssVariables?: Record<string, string>;
  colorPalette?: string[];
  baseFontFamily?: string;
  baseFontSize?: string;
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
  /** User annotation comment describing what to build */
  comment?: string;
  /** SVG representation of the drawing for AI processing */
  drawingSvg?: string;
  /** Base64 PNG image of the drawing for vision AI */
  drawingImage?: string;
  /** Extracted text content from text shapes in the drawing */
  extractedText?: string;
  /** Grid configuration used for positioning reference */
  gridConfig?: {
    color: string;
    size: number;
    labels: boolean;
  };
  /** Viewport info for relative sizing context */
  viewport?: ViewportInfo;
  /** Project-level style context */
  projectStyles?: ProjectStyleContext;
  /** Nearby DOM elements that the drawing may relate to */
  nearbyElements?: NearbyElement[];
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
  /** Callback when a single annotation is submitted - for real-time integrations like Gemini */
  onAnnotationSubmit?: (annotation: Annotation, comment: string) => void;
  /** Callback when an annotation is deleted - for reverting changes */
  onAnnotationDelete?: (annotationId: string) => void;
  /** Keyboard shortcut to toggle Skema (default: Cmd/Ctrl + Shift + E) */
  toggleShortcut?: string;
  /** Initial annotations to load */
  initialAnnotations?: Annotation[];
  /** Z-index for the overlay (default: 99999) */
  zIndex?: number;
  /** Whether an annotation is currently being processed (shows loading animation) */
  isProcessing?: boolean;
  /** Callback when user cancels an in-progress annotation (clicks X during processing) */
  onProcessingCancel?: () => void;
}

/**
 * Skema mode - determines what tools are available
 */
export type SkemaMode = 'select' | 'draw';



// =============================================================================
// Skema - Drawing-Based Website Development Tool
// =============================================================================
//
// A React component that provides a tldraw-powered drawing overlay for
// annotating and manipulating DOM elements visually.
//
// Usage:
//   import { Skema } from 'skema-core';
//   <Skema />
//
// =============================================================================

// Main component
export { Skema, default } from './components';

// Tools


// Utilities
export {
  generateSelector,
  getElementPath,
  identifyElement,
  getBoundingBox,
  getElementClasses,
  createDOMSelection,
  shouldIgnoreElement,
} from './utils/element-identification';

export {
  getViewportInfo,
  viewportToDocument,
  documentToViewport,
  bboxViewportToDocument,
  bboxDocumentToViewport,
  bboxIntersects,
  pointInBbox,
  bboxCenter,
  expandBbox,
  bboxFromPoints,
} from './utils/coordinates';

// Types
export type {
  Annotation,
  AnnotationExport,
  BoundingBox,
  DOMSelection,
  DrawingAnnotation,
  GestureAnnotation,
  SkemaMode,
  SkemaProps,
  ViewportInfo,

} from './types';

// =============================================================================
// Coordinate System Utilities
// =============================================================================

import type { BoundingBox, ViewportInfo } from '../types';

/**
 * Gets current viewport information
 */
export function getViewportInfo(): ViewportInfo {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, scrollX: 0, scrollY: 0 };
  }
  
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  };
}

/**
 * Converts viewport-relative coordinates to document coordinates
 */
export function viewportToDocument(
  x: number,
  y: number,
  viewport: ViewportInfo = getViewportInfo()
): { x: number; y: number } {
  return {
    x: x + viewport.scrollX,
    y: y + viewport.scrollY,
  };
}

/**
 * Converts document coordinates to viewport-relative coordinates
 */
export function documentToViewport(
  x: number,
  y: number,
  viewport: ViewportInfo = getViewportInfo()
): { x: number; y: number } {
  return {
    x: x - viewport.scrollX,
    y: y - viewport.scrollY,
  };
}

/**
 * Converts a bounding box from viewport to document coordinates
 */
export function bboxViewportToDocument(
  bbox: BoundingBox,
  viewport: ViewportInfo = getViewportInfo()
): BoundingBox {
  const { x, y } = viewportToDocument(bbox.x, bbox.y, viewport);
  return {
    x,
    y,
    width: bbox.width,
    height: bbox.height,
  };
}

/**
 * Converts a bounding box from document to viewport coordinates
 */
export function bboxDocumentToViewport(
  bbox: BoundingBox,
  viewport: ViewportInfo = getViewportInfo()
): BoundingBox {
  const { x, y } = documentToViewport(bbox.x, bbox.y, viewport);
  return {
    x,
    y,
    width: bbox.width,
    height: bbox.height,
  };
}

/**
 * Checks if two bounding boxes intersect
 */
export function bboxIntersects(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * Checks if point is inside bounding box
 */
export function pointInBbox(x: number, y: number, bbox: BoundingBox): boolean {
  return (
    x >= bbox.x &&
    x <= bbox.x + bbox.width &&
    y >= bbox.y &&
    y <= bbox.y + bbox.height
  );
}

/**
 * Gets the center point of a bounding box
 */
export function bboxCenter(bbox: BoundingBox): { x: number; y: number } {
  return {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2,
  };
}

/**
 * Expands a bounding box by a padding amount
 */
export function expandBbox(bbox: BoundingBox, padding: number): BoundingBox {
  return {
    x: bbox.x - padding,
    y: bbox.y - padding,
    width: bbox.width + padding * 2,
    height: bbox.height + padding * 2,
  };
}

/**
 * Creates a bounding box from two points
 */
export function bboxFromPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): BoundingBox {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

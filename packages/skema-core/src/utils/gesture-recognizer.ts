/**
 * Gesture Recognition Utility
 * 
 * Detects scribble gestures for the scribble-to-delete feature.
 * Based on heuristics optimized for detecting rapid back-and-forth scribbling.
 * Supports real-time detection during drawing (before pen release).
 */

import type { TLDrawShape, Editor, TLShapeId, Box } from 'tldraw';

export interface Point {
  x: number;
  y: number;
}

export interface GestureResult {
  isScribble: boolean;
  confidence: number;
  directionChanges: number;
  compactness: number;
}

export interface ScribbleBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Calculate the angle between two vectors in radians
 */
function angleBetweenVectors(v1: Point, v2: Point): number {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  
  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cosAngle);
}

/**
 * Calculate the total path length of a series of points
 */
function calculatePathLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

/**
 * Calculate the bounding box of a series of points
 */
function calculateBoundingBox(points: Point[]): { width: number; height: number; diagonal: number } {
  if (points.length === 0) {
    return { width: 0, height: 0, diagonal: 0 };
  }
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  
  const width = maxX - minX;
  const height = maxY - minY;
  const diagonal = Math.sqrt(width * width + height * height);
  
  return { width, height, diagonal };
}

/**
 * Calculate full bounding box with coordinates from points
 */
export function getPointsBounds(points: Point[]): ScribbleBounds | null {
  if (points.length === 0) {
    return null;
  }
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Count significant direction changes in a path
 * A direction change is when the angle between consecutive segments exceeds the threshold
 */
function countDirectionChanges(points: Point[], angleThreshold: number = Math.PI / 2): number {
  if (points.length < 3) return 0;
  
  let changes = 0;
  
  // Sample points to avoid noise - take every Nth point
  const sampleRate = Math.max(1, Math.floor(points.length / 50));
  const sampledPoints: Point[] = [];
  
  for (let i = 0; i < points.length; i += sampleRate) {
    sampledPoints.push(points[i]);
  }
  // Always include the last point
  if (sampledPoints[sampledPoints.length - 1] !== points[points.length - 1]) {
    sampledPoints.push(points[points.length - 1]);
  }
  
  for (let i = 1; i < sampledPoints.length - 1; i++) {
    const v1: Point = {
      x: sampledPoints[i].x - sampledPoints[i - 1].x,
      y: sampledPoints[i].y - sampledPoints[i - 1].y,
    };
    const v2: Point = {
      x: sampledPoints[i + 1].x - sampledPoints[i].x,
      y: sampledPoints[i + 1].y - sampledPoints[i].y,
    };
    
    const angle = angleBetweenVectors(v1, v2);
    
    // Count as direction change if angle is greater than threshold (default 90 degrees)
    if (angle > angleThreshold) {
      changes++;
    }
  }
  
  return changes;
}

/**
 * Extract points from a tldraw draw shape
 */
export function extractPointsFromDrawShape(shape: TLDrawShape): Point[] {
  const points: Point[] = [];
  
  // TLDrawShape has segments containing points
  if (shape.props.segments) {
    for (const segment of shape.props.segments) {
      if (segment.points) {
        for (const point of segment.points) {
          points.push({ x: point.x + shape.x, y: point.y + shape.y });
        }
      }
    }
  }
  
  return points;
}

/**
 * Analyze a path and determine if it's a scribble gesture
 */
export function analyzeGesture(points: Point[]): GestureResult {
  if (points.length < 10) {
    return {
      isScribble: false,
      confidence: 0,
      directionChanges: 0,
      compactness: 0,
    };
  }
  
  const directionChanges = countDirectionChanges(points);
  const pathLength = calculatePathLength(points);
  const { diagonal } = calculateBoundingBox(points);
  
  // Compactness: how much the path "folds back" on itself
  // Higher values mean more back-and-forth motion
  const compactness = diagonal > 0 ? pathLength / diagonal : 0;
  
  // Scribble criteria:
  // - At least 4 significant direction changes (zig-zag pattern)
  // - Compactness ratio > 2.0 (path is much longer than direct distance)
  // - Minimum path length to avoid detecting small wiggles
  const minDirectionChanges = 4;
  const minCompactness = 2.0;
  const minPathLength = 100; // pixels
  
  const meetsDirectionCriteria = directionChanges >= minDirectionChanges;
  const meetsCompactnessCriteria = compactness >= minCompactness;
  const meetsLengthCriteria = pathLength >= minPathLength;
  
  const isScribble = meetsDirectionCriteria && meetsCompactnessCriteria && meetsLengthCriteria;
  
  // Calculate confidence based on how much the values exceed thresholds
  let confidence = 0;
  if (isScribble) {
    const directionScore = Math.min(1, (directionChanges - minDirectionChanges) / 6);
    const compactnessScore = Math.min(1, (compactness - minCompactness) / 3);
    confidence = (directionScore + compactnessScore) / 2;
  }
  
  return {
    isScribble,
    confidence,
    directionChanges,
    compactness,
  };
}

/**
 * Check if a tldraw draw shape is a scribble gesture
 */
export function isScribbleGesture(shape: TLDrawShape): GestureResult {
  const points = extractPointsFromDrawShape(shape);
  return analyzeGesture(points);
}

/**
 * Real-time scribble detection for use during drawing (before pen release)
 * Uses more aggressive thresholds since we want to detect early
 */
export function isRealtimeScribble(points: Point[]): GestureResult {
  // Need enough points to analyze
  if (points.length < 15) {
    return {
      isScribble: false,
      confidence: 0,
      directionChanges: 0,
      compactness: 0,
    };
  }
  
  const directionChanges = countDirectionChanges(points, Math.PI / 3); // 60 degrees - more sensitive
  const pathLength = calculatePathLength(points);
  const { diagonal } = calculateBoundingBox(points);
  
  const compactness = diagonal > 0 ? pathLength / diagonal : 0;
  
  // Real-time criteria (more sensitive for early detection):
  // - At least 3 significant direction changes
  // - Compactness ratio > 1.8 (path is longer than direct distance)
  // - Minimum path length to avoid tiny wiggles
  const minDirectionChanges = 5;
  const minCompactness = 1.8;
  const minPathLength = 80; // pixels
  
  const meetsDirectionCriteria = directionChanges >= minDirectionChanges;
  const meetsCompactnessCriteria = compactness >= minCompactness;
  const meetsLengthCriteria = pathLength >= minPathLength;
  
  const isScribble = meetsDirectionCriteria && meetsCompactnessCriteria && meetsLengthCriteria;
  
  let confidence = 0;
  if (isScribble) {
    const directionScore = Math.min(1, (directionChanges - minDirectionChanges) / 4);
    const compactnessScore = Math.min(1, (compactness - minCompactness) / 2);
    confidence = (directionScore + compactnessScore) / 2;
  }
  
  return {
    isScribble,
    confidence,
    directionChanges,
    compactness,
  };
}

/**
 * Check if two bounding boxes intersect
 */
export function boxesIntersect(box1: Box, box2: Box): boolean {
  return !(
    box1.x + box1.w < box2.x ||
    box2.x + box2.w < box1.x ||
    box1.y + box1.h < box2.y ||
    box2.y + box2.h < box1.y
  );
}

/**
 * Find all shapes that overlap with the given bounds
 */
export function findOverlappingShapes(
  editor: Editor,
  bounds: Box,
  excludeIds: TLShapeId[] = []
): TLShapeId[] {
  const allShapes = editor.getCurrentPageShapes();
  const overlapping: TLShapeId[] = [];
  
  for (const shape of allShapes) {
    // Skip excluded shapes (like the scribble itself)
    if (excludeIds.includes(shape.id)) continue;
    
    // Only consider drawable shapes (not UI elements)
    if (!['draw', 'line', 'arrow', 'geo', 'text', 'note', 'frame'].includes(shape.type)) {
      continue;
    }
    
    const shapeBounds = editor.getShapePageBounds(shape.id);
    if (shapeBounds && boxesIntersect(bounds, shapeBounds)) {
      overlapping.push(shape.id);
    }
  }
  
  return overlapping;
}

/**
 * Find all shapes that overlap with raw bounds (for real-time detection)
 */
export function findOverlappingShapesFromBounds(
  editor: Editor,
  bounds: ScribbleBounds,
  excludeIds: TLShapeId[] = []
): TLShapeId[] {
  const allShapes = editor.getCurrentPageShapes();
  const overlapping: TLShapeId[] = [];
  
  for (const shape of allShapes) {
    // Skip excluded shapes
    if (excludeIds.includes(shape.id)) continue;
    
    // Only consider drawable shapes (not UI elements)
    if (!['draw', 'line', 'arrow', 'geo', 'text', 'note', 'frame'].includes(shape.type)) {
      continue;
    }
    
    const shapeBounds = editor.getShapePageBounds(shape.id);
    if (shapeBounds) {
      // Check intersection using raw coordinates
      const intersects = !(
        bounds.maxX < shapeBounds.x ||
        bounds.minX > shapeBounds.x + shapeBounds.w ||
        bounds.maxY < shapeBounds.y ||
        bounds.minY > shapeBounds.y + shapeBounds.h
      );
      
      if (intersects) {
        overlapping.push(shape.id);
      }
    }
  }
  
  return overlapping;
}

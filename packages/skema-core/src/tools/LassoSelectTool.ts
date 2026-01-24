// =============================================================================
// Lasso Select Tool - Freehand selection for DOM elements
// Based on https://tldraw.dev/examples/lasso-select-tool
// =============================================================================

import {
  StateNode,
  TLEventHandlers,
  TLPointerEventInfo,
  TLShapeId,
  atom,
  Atom,
  VecModel,
  Box,
} from 'tldraw';

/**
 * Idle state - waiting for user to start drawing lasso
 */
class IdleState extends StateNode {
  static override id = 'idle';

  override onPointerDown: TLEventHandlers['onPointerDown'] = (info) => {
    this.parent.transition('lassoing', info);
  };

  override onCancel: TLEventHandlers['onCancel'] = () => {
    this.editor.setCurrentTool('select');
  };
}

// Callback types
type OnClearSelectionsCallback = () => void;
type OnLassoCompleteCallback = (points: VecModel[]) => void;

/**
 * Lassoing state - user is actively drawing the lasso
 */
export class LassoingState extends StateNode {
  static override id = 'lassoing';

  // Reactive atom to store lasso points for rendering
  points: Atom<VecModel[]> = atom('lasso points', []);
  
  // Track starting point to detect clicks vs drags
  startPoint: VecModel | null = null;

  override onEnter = (info: TLPointerEventInfo) => {
    const { currentPagePoint } = this.editor.inputs;
    this.startPoint = { x: currentPagePoint.x, y: currentPagePoint.y };
    this.points.set([{ x: currentPagePoint.x, y: currentPagePoint.y }]);
  };

  override onPointerMove: TLEventHandlers['onPointerMove'] = () => {
    const { currentPagePoint } = this.editor.inputs;
    const currentPoints = this.points.get();
    
    // Add point if it's far enough from the last point
    const lastPoint = currentPoints[currentPoints.length - 1];
    if (lastPoint) {
      const dx = currentPagePoint.x - lastPoint.x;
      const dy = currentPagePoint.y - lastPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Only add point if moved at least 3 pixels
      if (dist > 3) {
        this.points.set([...currentPoints, { x: currentPagePoint.x, y: currentPagePoint.y }]);
      }
    }
  };

  override onPointerUp: TLEventHandlers['onPointerUp'] = () => {
    this.complete();
  };

  override onCancel: TLEventHandlers['onCancel'] = () => {
    this.cancel();
  };

  override onComplete: TLEventHandlers['onComplete'] = () => {
    this.complete();
  };

  private complete() {
    const points = this.points.get();
    const { currentPagePoint } = this.editor.inputs;
    
    // Check if this was a click (minimal movement from start)
    if (this.startPoint) {
      const dx = currentPagePoint.x - this.startPoint.x;
      const dy = currentPagePoint.y - this.startPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // If moved less than 10 pixels, treat as a click to deselect
      if (dist < 10 || points.length < 3) {
        // Clear tldraw selections
        this.editor.setSelectedShapes([]);
        // Signal to clear DOM selections via the tool's callback
        const tool = this.parent as LassoSelectTool;
        tool.onClearSelections?.();
        
        this.points.set([]);
        this.startPoint = null;
        this.parent.transition('idle');
        return;
      }
    }
    
    if (points.length > 2) {
      // Find shapes that intersect with the lasso
      this.selectShapesInLasso(points);
      
      // Signal to select DOM elements via the tool's callback
      const tool = this.parent as LassoSelectTool;
      tool.onLassoComplete?.(points);
    }
    
    this.points.set([]);
    this.startPoint = null;
    this.parent.transition('idle');
  }

  private cancel() {
    this.points.set([]);
    this.startPoint = null;
    this.parent.transition('idle');
  }

  /**
   * Select shapes that intersect with the lasso area (any overlap counts)
   */
  private selectShapesInLasso(points: VecModel[]) {
    // Get all shapes on the page
    const allShapes = this.editor.getCurrentPageShapes();
    
    if (allShapes.length === 0) {
      return;
    }

    // Get the bounding box of the lasso
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    const selectedIds: TLShapeId[] = [];

    for (const shape of allShapes) {
      const shapeBounds = this.editor.getShapePageBounds(shape.id);
      if (!shapeBounds) continue;
      
      // Select if bounding boxes overlap at all (any intersection)
      const boundsOverlap = !(
        shapeBounds.x > maxX ||
        shapeBounds.x + shapeBounds.width < minX ||
        shapeBounds.y > maxY ||
        shapeBounds.y + shapeBounds.height < minY
      );
      
      if (boundsOverlap) {
        selectedIds.push(shape.id);
      }
    }
    
    if (selectedIds.length > 0) {
      this.editor.setSelectedShapes(selectedIds);
    }
  }

  /**
   * Ray casting algorithm to check if a point is inside a polygon
   */
  private isPointInPolygon(point: VecModel, polygon: VecModel[]): boolean {
    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersect =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Get the bounding box of the lasso in page coordinates
   */
  getLassoBounds(): Box | null {
    const points = this.points.get();
    if (points.length < 2) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return new Box(minX, minY, maxX - minX, maxY - minY);
  }
}

/**
 * Lasso Select Tool - allows freehand drawing to select shapes
 */
export class LassoSelectTool extends StateNode {
  static override id = 'lasso-select';
  static override initial = 'idle';
  static override children = () => [IdleState, LassoingState];
  
  // Callback to clear DOM selections (set by Skema component)
  onClearSelections: OnClearSelectionsCallback | null = null;
  
  // Callback when lasso selection completes (set by Skema component)
  onLassoComplete: OnLassoCompleteCallback | null = null;
  
  /**
   * Set callback for clearing DOM selections
   */
  setOnClearSelections(callback: OnClearSelectionsCallback) {
    this.onClearSelections = callback;
  }
  
  /**
   * Set callback for when lasso selection completes
   */
  setOnLassoComplete(callback: OnLassoCompleteCallback) {
    this.onLassoComplete = callback;
  }
}

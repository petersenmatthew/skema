// =============================================================================
// Annotation Store - In-memory store for MCP-mode queued annotations
// =============================================================================
//
// When Skema is in MCP mode, annotations are queued here instead of being
// processed immediately. The MCP server reads from this store to let AI agents
// retrieve and act on annotations.
//

import type { Annotation } from '../types';

// =============================================================================
// Types
// =============================================================================

export type AnnotationStatus = 'pending' | 'acknowledged' | 'resolved' | 'dismissed';

export interface StoredAnnotation {
  /** The original Skema annotation data */
  annotation: Annotation;
  /** User comment describing the desired change */
  comment: string;
  /** Current status in the MCP workflow */
  status: AnnotationStatus;
  /** When it was queued */
  createdAt: string;
  /** When status last changed */
  updatedAt: string;
  /** If resolved/dismissed, who did it */
  resolvedBy?: 'human' | 'agent';
  /** Resolution summary (from agent) */
  resolutionSummary?: string;
  /** Dismissal reason (from agent) */
  dismissalReason?: string;
  /** Vision analysis description for drawing annotations */
  visionDescription?: string;
}

// =============================================================================
// Store Implementation
// =============================================================================

const storedAnnotations = new Map<string, StoredAnnotation>();

// Event listeners for real-time notifications
type StoreListener = (event: string, annotation: StoredAnnotation) => void;
const listeners = new Set<StoreListener>();

function notify(event: string, annotation: StoredAnnotation) {
  for (const listener of listeners) {
    try {
      listener(event, annotation);
    } catch (e) {
      console.error('[AnnotationStore] Listener error:', e);
    }
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Queue an annotation (called when user submits in MCP mode)
 */
export function queueAnnotation(
  annotation: Annotation,
  comment: string,
  visionDescription?: string
): StoredAnnotation {
  const id = annotation.id || `ann-${Date.now()}`;
  const now = new Date().toISOString();

  const stored: StoredAnnotation = {
    annotation: { ...annotation, id },
    comment,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    visionDescription,
  };

  storedAnnotations.set(id, stored);
  console.log(`[AnnotationStore] Queued annotation ${id}: "${comment.slice(0, 50)}..."`);
  notify('annotation.created', stored);
  return stored;
}

/**
 * Get all pending annotations
 */
export function getPendingAnnotations(): StoredAnnotation[] {
  return Array.from(storedAnnotations.values()).filter(a => a.status === 'pending');
}

/**
 * Get all annotations (any status)
 */
export function getAllAnnotations(): StoredAnnotation[] {
  return Array.from(storedAnnotations.values());
}

/**
 * Get a specific annotation by ID
 */
export function getAnnotation(id: string): StoredAnnotation | undefined {
  return storedAnnotations.get(id);
}

/**
 * Mark an annotation as acknowledged (agent has seen it)
 */
export function acknowledgeAnnotation(id: string): StoredAnnotation | undefined {
  const stored = storedAnnotations.get(id);
  if (!stored) return undefined;

  stored.status = 'acknowledged';
  stored.updatedAt = new Date().toISOString();
  notify('annotation.updated', stored);
  return stored;
}

/**
 * Mark an annotation as resolved (agent has implemented the change)
 */
export function resolveAnnotation(id: string, summary?: string): StoredAnnotation | undefined {
  const stored = storedAnnotations.get(id);
  if (!stored) return undefined;

  stored.status = 'resolved';
  stored.resolvedBy = 'agent';
  stored.resolutionSummary = summary;
  stored.updatedAt = new Date().toISOString();
  notify('annotation.updated', stored);
  return stored;
}

/**
 * Dismiss an annotation (agent decided not to address it)
 */
export function dismissAnnotation(id: string, reason: string): StoredAnnotation | undefined {
  const stored = storedAnnotations.get(id);
  if (!stored) return undefined;

  stored.status = 'dismissed';
  stored.resolvedBy = 'agent';
  stored.dismissalReason = reason;
  stored.updatedAt = new Date().toISOString();
  notify('annotation.updated', stored);
  return stored;
}

/**
 * Remove an annotation from the store
 */
export function removeAnnotation(id: string): StoredAnnotation | undefined {
  const stored = storedAnnotations.get(id);
  if (!stored) return undefined;

  storedAnnotations.delete(id);
  notify('annotation.deleted', stored);
  return stored;
}

/**
 * Clear all annotations
 */
export function clearAnnotations(): void {
  storedAnnotations.clear();
}

/**
 * Subscribe to store events
 */
export function onStoreEvent(listener: StoreListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Get count of pending annotations
 */
export function getPendingCount(): number {
  let count = 0;
  for (const a of storedAnnotations.values()) {
    if (a.status === 'pending') count++;
  }
  return count;
}

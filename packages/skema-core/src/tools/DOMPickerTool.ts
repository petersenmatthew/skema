// =============================================================================
// DOM Picker Tool for tldraw
// =============================================================================

import { StateNode } from 'tldraw';
import { createDOMSelection, shouldIgnoreElement, identifyElement } from '../utils/element-identification';
import type { DOMSelection } from '../types';

/**
 * Custom tldraw tool for picking DOM elements
 * Inspired by Agentation's element selection UX
 */
export class DOMPickerTool extends StateNode {
  static override id = 'dom-picker';

  private highlightOverlay: HTMLDivElement | null = null;
  private hoverTooltip: HTMLDivElement | null = null;
  private hoveredElement: HTMLElement | null = null;
  private onSelect?: (selection: DOMSelection) => void;
  private mousePosition = { x: 0, y: 0 };

  override onEnter = () => {
    // Set cursor to crosshair
    this.editor.setCursor({ type: 'cross', rotation: 0 });

    // Create highlight overlay and tooltip
    this.createHighlightOverlay();
    this.createHoverTooltip();

    // Inject styles to allow clicking through tldraw canvas (but not the toolbar)
    this.injectPickerStyles();

    // Add event listeners
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown);
  };

  override onExit = () => {
    // Reset cursor
    this.editor.setCursor({ type: 'default', rotation: 0 });

    // Remove overlays
    this.removeHighlightOverlay();
    this.removeHoverTooltip();

    // Remove picker styles
    this.removePickerStyles();

    // Remove event listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown);

    this.hoveredElement = null;
  };

  private injectPickerStyles() {
    // Create style element that makes tldraw canvas transparent to clicks
    // but keeps the toolbar interactive
    const style = document.createElement('style');
    style.id = 'skema-dom-picker-styles';
    style.textContent = `
      .tl-canvas {
        pointer-events: none !important;
      }
      .tl-shapes, .tl-overlays {
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  private removePickerStyles() {
    const style = document.getElementById('skema-dom-picker-styles');
    if (style) {
      style.remove();
    }
  }

  /**
   * Set callback for when an element is selected
   */
  setOnSelect(callback: (selection: DOMSelection) => void) {
    this.onSelect = callback;
  }

  private createHighlightOverlay() {
    if (this.highlightOverlay) return;

    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.setAttribute('data-skema', 'highlight');
    this.highlightOverlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 999998;
      border: 2px solid #3b82f6;
      background-color: rgba(59, 130, 246, 0.1);
      transition: all 0.08s ease-out;
      display: none;
      border-radius: 4px;
    `;
    document.body.appendChild(this.highlightOverlay);
  }

  private removeHighlightOverlay() {
    if (this.highlightOverlay) {
      this.highlightOverlay.remove();
      this.highlightOverlay = null;
    }
  }

  private createHoverTooltip() {
    if (this.hoverTooltip) return;

    this.hoverTooltip = document.createElement('div');
    this.hoverTooltip.setAttribute('data-skema', 'tooltip');
    this.hoverTooltip.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 999999;
      background-color: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 500;
      white-space: nowrap;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transform: translateX(-50%);
    `;
    document.body.appendChild(this.hoverTooltip);
  }

  private removeHoverTooltip() {
    if (this.hoverTooltip) {
      this.hoverTooltip.remove();
      this.hoverTooltip = null;
    }
  }

  private handleMouseMove = (e: MouseEvent) => {
    this.mousePosition = { x: e.clientX, y: e.clientY };

    // Get all elements at this point and find the first non-ignored one
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    let target: HTMLElement | null = null;

    for (const el of elements) {
      if (el instanceof HTMLElement && !shouldIgnoreElement(el)) {
        target = el;
        break;
      }
    }

    if (!target) {
      this.hideHighlight();
      this.hideTooltip();
      this.hoveredElement = null;
      return;
    }

    // Find the most appropriate element to highlight
    const element = this.findBestElement(target);

    if (element !== this.hoveredElement) {
      this.hoveredElement = element;
      this.updateHighlight(element);
      this.updateTooltip(element);
    } else {
      // Update tooltip position even if element hasn't changed
      this.updateTooltipPosition();
    }
  };

  private handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Allow clicks on tldraw UI (toolbar, buttons, etc.) to pass through
    if (target.closest('.tl-ui') || target.closest('[data-testid]') || target.closest('button')) {
      return;
    }

    // Allow clicks on Skema UI elements
    if (target.closest('[data-skema]')) {
      return;
    }

    if (!this.hoveredElement) return;

    // Prevent default click behavior for DOM selection
    e.preventDefault();
    e.stopPropagation();

    // Create selection
    const selection = createDOMSelection(this.hoveredElement);

    // Call callback if set
    if (this.onSelect) {
      this.onSelect(selection);
    }
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    // Press Escape to exit DOM picker and return to select tool
    if (e.key === 'Escape') {
      e.preventDefault();
      this.editor.setCurrentTool('select');
    }
  };

  private findBestElement(target: HTMLElement): HTMLElement {
    // Walk up to find a semantic element if the target is too small or generic
    let current: HTMLElement | null = target;
    const minSize = 20;

    while (current && current !== document.body) {
      const rect = current.getBoundingClientRect();
      const tag = current.tagName.toLowerCase();

      // Stop at semantic elements
      if (['button', 'a', 'input', 'select', 'textarea', 'img', 'video',
           'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'article',
           'section', 'nav', 'header', 'footer', 'main', 'aside',
           'form', 'table', 'ul', 'ol', 'figure', 'figcaption'].includes(tag)) {
        return current;
      }

      // Stop if element is reasonably sized
      if (rect.width >= minSize && rect.height >= minSize) {
        // Check if it has meaningful content or styling
        if (current.id || (current.className && typeof current.className === 'string' && current.className.length > 0)) {
          return current;
        }
      }

      current = current.parentElement;
    }

    return target;
  }

  private updateHighlight(element: HTMLElement) {
    if (!this.highlightOverlay) return;

    const rect = element.getBoundingClientRect();

    this.highlightOverlay.style.display = 'block';
    this.highlightOverlay.style.left = `${rect.left - 2}px`;
    this.highlightOverlay.style.top = `${rect.top - 2}px`;
    this.highlightOverlay.style.width = `${rect.width + 4}px`;
    this.highlightOverlay.style.height = `${rect.height + 4}px`;
  }

  private updateTooltip(element: HTMLElement) {
    if (!this.hoverTooltip) return;

    // Get element identification
    const name = identifyElement(element);
    this.hoverTooltip.textContent = name;
    this.hoverTooltip.style.display = 'block';
    this.updateTooltipPosition();
  }

  private updateTooltipPosition() {
    if (!this.hoverTooltip) return;

    const { x, y } = this.mousePosition;
    const tooltipHeight = 30;
    const offset = 12;

    // Position tooltip above cursor, centered horizontally
    let tooltipX = x;
    let tooltipY = y - tooltipHeight - offset;

    // Keep tooltip in viewport
    if (tooltipY < 8) {
      tooltipY = y + offset + 8; // Show below cursor if not enough space above
    }

    // Clamp horizontal position to keep tooltip in viewport
    const tooltipWidth = this.hoverTooltip.offsetWidth || 100;
    tooltipX = Math.max(tooltipWidth / 2 + 8, Math.min(window.innerWidth - tooltipWidth / 2 - 8, tooltipX));

    this.hoverTooltip.style.left = `${tooltipX}px`;
    this.hoverTooltip.style.top = `${tooltipY}px`;
  }

  private hideHighlight() {
    if (this.highlightOverlay) {
      this.highlightOverlay.style.display = 'none';
    }
  }

  private hideTooltip() {
    if (this.hoverTooltip) {
      this.hoverTooltip.style.display = 'none';
    }
  }
}

// Type augmentation for tldraw to recognize our custom tool
declare module 'tldraw' {
  interface TLStateNodeConstructor {
    id: string;
  }
}

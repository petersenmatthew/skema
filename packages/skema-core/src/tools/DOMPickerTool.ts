// =============================================================================
// DOM Picker Tool for tldraw
// =============================================================================

import { StateNode, TLEventHandlers } from 'tldraw';
import { createDOMSelection, shouldIgnoreElement } from '../utils/element-identification';
import type { DOMSelection } from '../types';

/**
 * Custom tldraw tool for picking DOM elements
 */
export class DOMPickerTool extends StateNode {
  static override id = 'dom-picker';
  
  private highlightOverlay: HTMLDivElement | null = null;
  private hoveredElement: HTMLElement | null = null;
  private onSelect?: (selection: DOMSelection) => void;

  override onEnter = () => {
    // Set cursor to crosshair
    this.editor.setCursor({ type: 'cross', rotation: 0 });
    
    // Create highlight overlay
    this.createHighlightOverlay();
    
    // Add event listeners
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick, true);
  };

  override onExit = () => {
    // Reset cursor
    this.editor.setCursor({ type: 'default', rotation: 0 });
    
    // Remove highlight overlay
    this.removeHighlightOverlay();
    
    // Remove event listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick, true);
    
    this.hoveredElement = null;
  };

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
      transition: all 0.1s ease-out;
      display: none;
    `;
    document.body.appendChild(this.highlightOverlay);
  }

  private removeHighlightOverlay() {
    if (this.highlightOverlay) {
      this.highlightOverlay.remove();
      this.highlightOverlay = null;
    }
  }

  private handleMouseMove = (e: MouseEvent) => {
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    
    if (!target || shouldIgnoreElement(target)) {
      this.hideHighlight();
      this.hoveredElement = null;
      return;
    }

    // Find the most appropriate element to highlight
    const element = this.findBestElement(target);
    
    if (element !== this.hoveredElement) {
      this.hoveredElement = element;
      this.updateHighlight(element);
    }
  };

  private handleClick = (e: MouseEvent) => {
    if (!this.hoveredElement) return;
    
    // Prevent default click behavior
    e.preventDefault();
    e.stopPropagation();
    
    // Create selection
    const selection = createDOMSelection(this.hoveredElement);
    
    // Call callback if set
    if (this.onSelect) {
      this.onSelect(selection);
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
           'section', 'nav', 'header', 'footer', 'main', 'aside'].includes(tag)) {
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
    this.highlightOverlay.style.left = `${rect.left}px`;
    this.highlightOverlay.style.top = `${rect.top}px`;
    this.highlightOverlay.style.width = `${rect.width}px`;
    this.highlightOverlay.style.height = `${rect.height}px`;
  }

  private hideHighlight() {
    if (this.highlightOverlay) {
      this.highlightOverlay.style.display = 'none';
    }
  }
}

// Type augmentation for tldraw to recognize our custom tool
declare module 'tldraw' {
  interface TLStateNodeConstructor {
    id: string;
  }
}

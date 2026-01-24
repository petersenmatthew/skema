// =============================================================================
// Element Identification Utilities
// Adapted from Agentation with modifications for Skema
// =============================================================================

import type { BoundingBox, DOMSelection } from '../types';

/**
 * Generates a unique CSS selector for an element
 */
export function generateSelector(element: HTMLElement): string {
  // If element has an ID, use it
  if (element.id) {
    return `#${element.id}`;
  }

  // Build selector path
  const path: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    // Add ID if present
    if (current.id) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    }

    // Add meaningful class names (filter out CSS module hashes)
    if (current.className && typeof current.className === 'string') {
      const meaningfulClasses = current.className
        .split(/\s+/)
        .filter(c => c.length > 2 && !c.match(/^[a-z]{1,2}$/) && !c.match(/[A-Z0-9]{5,}/))
        .slice(0, 2);
      
      if (meaningfulClasses.length > 0) {
        selector += '.' + meaningfulClasses.join('.');
      }
    }

    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

/**
 * Gets a readable path for an element (e.g., "article > section > p")
 */
export function getElementPath(target: HTMLElement, maxDepth = 4): string {
  const parts: string[] = [];
  let current: HTMLElement | null = target;
  let depth = 0;

  while (current && depth < maxDepth) {
    const tag = current.tagName.toLowerCase();

    // Skip generic wrappers
    if (tag === 'html' || tag === 'body') break;

    // Get identifier
    let identifier = tag;
    if (current.id) {
      identifier = `#${current.id}`;
    } else if (current.className && typeof current.className === 'string') {
      const meaningfulClass = current.className
        .split(/\s+/)
        .find(c => c.length > 2 && !c.match(/^[a-z]{1,2}$/) && !c.match(/[A-Z0-9]{5,}/));
      if (meaningfulClass) {
        identifier = `.${meaningfulClass.split('_')[0]}`;
      }
    }

    parts.unshift(identifier);
    current = current.parentElement;
    depth++;
  }

  return parts.join(' > ');
}

/**
 * Identifies an element and returns a human-readable name
 */
export function identifyElement(target: HTMLElement): string {
  const tag = target.tagName.toLowerCase();

  // Interactive elements
  if (tag === 'button') {
    const text = target.textContent?.trim();
    const ariaLabel = target.getAttribute('aria-label');
    if (ariaLabel) return `button [${ariaLabel}]`;
    return text ? `button "${text.slice(0, 25)}"` : 'button';
  }
  
  if (tag === 'a') {
    const text = target.textContent?.trim();
    const href = target.getAttribute('href');
    if (text) return `link "${text.slice(0, 25)}"`;
    if (href) return `link to ${href.slice(0, 30)}`;
    return 'link';
  }
  
  if (tag === 'input') {
    const type = target.getAttribute('type') || 'text';
    const placeholder = target.getAttribute('placeholder');
    const name = target.getAttribute('name');
    if (placeholder) return `input "${placeholder}"`;
    if (name) return `input [${name}]`;
    return `${type} input`;
  }

  // Headings
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    const text = target.textContent?.trim();
    return text ? `${tag} "${text.slice(0, 35)}"` : tag;
  }

  // Text elements
  if (tag === 'p') {
    const text = target.textContent?.trim();
    if (text) return `paragraph: "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`;
    return 'paragraph';
  }

  // Media
  if (tag === 'img') {
    const alt = target.getAttribute('alt');
    return alt ? `image "${alt.slice(0, 30)}"` : 'image';
  }

  // Containers
  if (['div', 'section', 'article', 'nav', 'header', 'footer', 'aside', 'main'].includes(tag)) {
    const className = target.className;
    const role = target.getAttribute('role');
    const ariaLabel = target.getAttribute('aria-label');

    if (ariaLabel) return `${tag} [${ariaLabel}]`;
    if (role) return role;

    if (typeof className === 'string' && className) {
      const words = className
        .split(/[\s_-]+/)
        .map(c => c.replace(/[A-Z0-9]{5,}.*$/, ''))
        .filter(c => c.length > 2 && !/^[a-z]{1,2}$/.test(c))
        .slice(0, 2);
      if (words.length > 0) return words.join(' ');
    }

    return tag === 'div' ? 'container' : tag;
  }

  return tag;
}

/**
 * Gets bounding box for an element relative to viewport
 */
export function getBoundingBox(element: HTMLElement): BoundingBox {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Gets CSS class names from an element (cleaned of module hashes)
 */
export function getElementClasses(target: HTMLElement): string {
  const className = target.className;
  if (typeof className !== 'string' || !className) return '';

  const classes = className
    .split(/\s+/)
    .filter(c => c.length > 0)
    .map(c => {
      const match = c.match(/^([a-zA-Z][a-zA-Z0-9_-]*?)(?:_[a-zA-Z0-9]{5,})?$/);
      return match ? match[1] : c;
    })
    .filter((c, i, arr) => arr.indexOf(c) === i);

  return classes.join(', ');
}

/**
 * Creates a DOMSelection from an element
 */
export function createDOMSelection(element: HTMLElement): DOMSelection {
  return {
    id: `dom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    selector: generateSelector(element),
    tagName: element.tagName.toLowerCase(),
    elementPath: getElementPath(element),
    text: element.textContent?.trim().slice(0, 100) || '',
    boundingBox: getBoundingBox(element),
    timestamp: Date.now(),
    pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    cssClasses: getElementClasses(element) || undefined,
    attributes: getElementAttributes(element),
  };
}

/**
 * Gets relevant attributes from an element
 */
function getElementAttributes(element: HTMLElement): Record<string, string> | undefined {
  const attrs: Record<string, string> = {};
  const relevantAttrs = ['id', 'href', 'src', 'alt', 'type', 'name', 'placeholder', 'role', 'aria-label'];
  
  for (const attr of relevantAttrs) {
    const value = element.getAttribute(attr);
    if (value) {
      attrs[attr] = value;
    }
  }
  
  return Object.keys(attrs).length > 0 ? attrs : undefined;
}

/**
 * Checks if an element should be ignored for DOM picking
 */
export function shouldIgnoreElement(element: HTMLElement): boolean {
  // Ignore Skema's own elements
  if (element.closest('[data-skema]')) return true;

  // Ignore tldraw elements (canvas, UI, overlays)
  if (element.closest('.tl-container')) return true;
  if (element.closest('.tl-canvas')) return true;
  if (element.closest('.tl-ui')) return true;
  if (element.classList.contains('tl-container')) return true;
  if (element.classList.contains('tl-canvas')) return true;

  // Ignore script and style tags
  const tag = element.tagName.toLowerCase();
  if (['script', 'style', 'noscript', 'meta', 'link'].includes(tag)) return true;

  return false;
}

/**
 * Skema AI Prompts
 *
 * This file contains all AI prompts used by Skema for generating code changes.
 *
 * Prompts:
 * - FAST_DOM_SELECTION_PROMPT: Quick, minimal prompt for DOM element changes
 * - DETAILED_DOM_SELECTION_PROMPT: Full context prompt for complex DOM changes
 * - DRAWING_TO_CODE_PROMPT: Converts wireframe sketches to React components
 * - IMAGE_ANALYSIS_PROMPT: Gemini Vision prompt to analyze drawing images
 */

import type { ViewportInfo, NearbyElement, ProjectStyleContext } from '../types';
import { getGridCellReference } from '../lib/utils';

// =============================================================================
// System Prompt for Code Generation
// =============================================================================

/**
 * Base system prompt for AI code generation.
 * Used by direct API providers to set context for code generation tasks.
 */
export const CODE_GENERATION_PROMPT = `You are Skema, an AI assistant specialized in frontend web development. You help users modify their React/Next.js applications based on visual annotations and instructions.

Your capabilities:
- Edit existing code files to implement UI changes
- Convert wireframe sketches into functional React components
- Apply styling using Tailwind CSS
- Follow existing code patterns and conventions

CRITICAL RULES:
1. Do NOT create new files - only edit existing files
2. Do NOT run shell commands (no npm, git, lint, build commands)
3. Ensure all JSX tags are properly closed
4. Add imports only at the top of files, never in the middle
5. Make minimal, targeted changes
6. Stop immediately after making file changes - do not verify or run tests

When editing code:
- Use Tailwind CSS for styling
- Follow the existing code patterns in the project
- Write semantic HTML with proper accessibility attributes
- Integrate changes naturally with existing page flow`;


// =============================================================================
// Prompt Inputs Types
// =============================================================================

export interface DomSelectionInput {
  comment: string;
  selector?: string;
  text?: string;
  tagName?: string;
}

export interface DetailedDomSelectionInput extends DomSelectionInput {
  elementPath?: string;
  cssClasses?: string;
  attributes?: Record<string, string>;
  elements?: Array<{
    tagName: string;
    selector: string;
    elementPath: string;
    text?: string;
  }>;
}

export interface GestureInput {
  comment: string;
  gesture?: string;
  boundingBox?: { x: number; y: number };
}

export interface DrawingInput {
  comment: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  drawingSvg?: string;
  drawingImage?: string;
  extractedText?: string;
  gridConfig?: { color: string; size: number; labels: boolean };
  viewport?: ViewportInfo;
  projectStyles?: ProjectStyleContext;
  nearbyElements?: NearbyElement[];
  visionDescription?: string;
}

// =============================================================================
// Shared Rules & Guidelines
// =============================================================================

/**
 * Critical rules that apply to ALL prompts to prevent common errors
 */
const CRITICAL_RULES = `CRITICAL RULES:
- Do NOT create new files. Only edit existing files.
- Do NOT modify the import { SkemaWrapper } from "@/components/skema-wrapper" line.
- Ensure all JSX tags are properly closed - every <tag> needs a matching </tag>.
- Do NOT run any shell commands. No npm, no git, no lint, no build commands. Just edit files.
- STOP immediately after making the file changes. Do not verify, do not run tests, do not check status.`;

/**
 * JSX syntax validation reminder
 */
const JSX_VALIDATION_RULE = `JSX SYNTAX: Every opening tag (<div>, <a>, <span>, <button>) MUST have a matching closing tag. Self-closing tags (<img />, <input />, <br />) must end with />.`;

// =============================================================================
// PROMPT 1: Fast DOM Selection
// =============================================================================

/**
 * Fast mode prompt for quick DOM element changes.
 * Used when fastMode is enabled for simple, targeted edits.
 *
 * @example
 * // Result: "Make this button blue (target: "Submit"). Make the change directly..."
 * buildFastDomSelectionPrompt({ comment: "Make this button blue", text: "Submit" })
 */
export function buildFastDomSelectionPrompt(input: DomSelectionInput): string {
  const { comment, selector, text, tagName } = input;

  // Build target description with both selector AND text for better context
  const parts: string[] = [];

  if (tagName) {
    parts.push(`<${tagName.toLowerCase()}>`);
  }
  if (selector) {
    parts.push(`selector: ${selector}`);
  }
  if (text) {
    parts.push(`text: "${text.slice(0, 50)}"`);
  }

  const target = parts.length > 0 ? ` (${parts.join(' | ')})` : '';

  return `${comment}${target}. Make the change directly, no explanation needed. ${CRITICAL_RULES} ${JSX_VALIDATION_RULE}`;
}

// =============================================================================
// PROMPT 2: Detailed DOM Selection
// =============================================================================

/**
 * Detailed mode prompt for DOM element changes with full context.
 * Used for complex changes that need more information about the target.
 *
 * @example
 * buildDetailedDomSelectionPrompt({
 *   comment: "Add a hover effect",
 *   tagName: "button",
 *   selector: "#submit-btn",
 *   text: "Submit Form"
 * })
 */
export function buildDetailedDomSelectionPrompt(input: DetailedDomSelectionInput): string {
  const { comment, tagName, selector, text, elementPath, cssClasses, attributes, elements } = input;

  let prompt = `Make this code change: "${comment || 'No specific comment provided'}"

## Target Element
- Tag: <${tagName?.toLowerCase() || 'unknown'}>`;

  if (selector) {
    prompt += `\n- Selector: ${selector}`;
  }

  if (elementPath) {
    prompt += `\n- DOM Path: ${elementPath}`;
  }

  if (cssClasses) {
    prompt += `\n- CSS Classes: ${cssClasses}`;
  }

  if (attributes && Object.keys(attributes).length > 0) {
    const attrStr = Object.entries(attributes)
      .map(([k, v]) => `${k}="${v}"`)
      .join(', ');
    prompt += `\n- Attributes: ${attrStr}`;
  }

  if (text) {
    prompt += `\n- Text Content: "${text.slice(0, 150)}"`;
  }

  if (elements && elements.length > 1) {
    prompt += `\n\n## Multi-Selection (${elements.length} elements)`;
    elements.slice(0, 5).forEach((el, i) => {
      prompt += `\n${i + 1}. <${el.tagName}> ${el.selector}`;
      if (el.text) prompt += ` - "${el.text.slice(0, 50)}"`;
    });
    if (elements.length > 5) {
      prompt += `\n... and ${elements.length - 5} more`;
    }
  }

  prompt += `

Make minimal changes. ${CRITICAL_RULES} ${JSX_VALIDATION_RULE}`;

  return prompt;
}

// =============================================================================
// PROMPT 3: Gesture Annotation
// =============================================================================

/**
 * Prompt for gesture-based annotations (circles, scribbles, etc.)
 */
export function buildGesturePrompt(input: GestureInput): string {
  const { comment, gesture, boundingBox } = input;

  return `Make this code change: "${comment || 'No specific comment provided'}"

Element: gesture: ${gesture || 'unknown'} at (${boundingBox?.x || 0}, ${boundingBox?.y || 0})

Make minimal changes. ${CRITICAL_RULES} ${JSX_VALIDATION_RULE}`;
}

// =============================================================================
// PROMPT 4: Drawing to Code (Main Component Generation)
// =============================================================================

/**
 * Comprehensive prompt for converting wireframe sketches into React components.
 * This is the most complex prompt, used when users draw UI elements.
 *
 * The prompt instructs the AI to:
 * 1. Analyze the sketch to understand the visual intent
 * 2. Interpret (not transcribe) the low-fidelity drawing
 * 3. Generate high-quality inline JSX with Tailwind CSS
 * 4. Integrate naturally with the existing page flow
 */
export function buildDrawingToCodePrompt(input: DrawingInput): string {
  const {
    comment = 'Create a component based on this drawing',
    boundingBox,
    extractedText,
    gridConfig,
    viewport,
    nearbyElements = [],
    visionDescription,
  } = input;

  const gridSize = gridConfig?.size || 100;

  // Build grid cell reference for positioning
  let gridCellRef = '';
  if (boundingBox) {
    gridCellRef = getGridCellReference(boundingBox.x, boundingBox.y, gridSize);
  }

  // Build position context
  const positionContext = buildPositionContext(boundingBox, viewport, gridCellRef);

  // Build nearby elements context
  const nearbyContext = buildNearbyElementsContext(nearbyElements);

  // Build text extraction context
  const textContext = extractedText?.trim()
    ? `\n**Text found in drawing (use as reference if hard to read):**\n${extractedText}`
    : '';

  // Build image/vision analysis note
  const imageNote = buildImageNote(!!input.drawingImage, visionDescription);

  return `Your task is to interpret a user's sketch/wireframe and turn it into code that is integrated in the codebase.

## User's Request
"${comment}"

## Drawing Context
${positionContext}${textContext}${nearbyContext}${imageNote}

## Your Process
1. **Analyze the Sketch:** Understand the visual intent—what UI component does the user want?
2. **Interpret, Don't Transcribe:** Elevate the low-fidelity drawing into a high-fidelity component. Choose appropriate spacing, colors, and typography that match modern design standards.
3. **Infer Missing Details:** If something is underspecified, use your expertise to make the best choice. An informed decision is better than an incomplete component.

## Implementation Guidelines
${DRAWING_IMPLEMENTATION_GUIDELINES}

Make the changes directly. Insert the UI elements inline at the appropriate location in the page. No explanation needed.

## Error Prevention Rules
${DRAWING_ERROR_PREVENTION_RULES}`;
}

/**
 * Implementation guidelines for drawing-to-code conversion
 */
const DRAWING_IMPLEMENTATION_GUIDELINES = `- **CRITICAL: DO NOT CREATE ANY NEW FILES. NEVER CREATE NEW FILES. You must ONLY edit existing files.**
- Add your code directly inline within the existing JSX of the page file - do NOT create separate component files.
- DO NOT run any shell commands (no npm, git, lint, build, or verification commands). Just edit files and STOP.
- After making your file edits, you are DONE. Do not run any follow-up commands or checks.
- Write the UI as inline JSX elements (divs, sections, etc.) directly in the return statement - NOT as a separate component definition
- Use Tailwind CSS classes for styling (the project uses Tailwind)
- Do NOT use hardcoded pixel positions or absolute coordinates - integrate naturally with existing page flow
- Use flexbox, grid, or relative positioning to place the component appropriately
- If the sketch shows:
  - **Rectangle/box:** Card, container, button, or input field depending on context
  - **Text elements:** Headings, paragraphs, or labels with appropriate hierarchy
  - **Form layout:** Input fields with labels, proper spacing
  - **Icons/shapes:** Use appropriate icons from lucide-react or inline SVGs (but DO NOT add new imports mid-file)
  - **Navigation:** Nav links, menus, or breadcrumbs
  - **Lists:** Ordered/unordered lists or grid layouts
- Make the UI fit naturally with the existing page design
- Style it nicely and according to the existing codebase
- Use semantic HTML and ARIA attributes where appropriate
- **NEVER add import statements inside JSX or in the middle of a file - all imports must be at the very top of the file**
- If you need a new import, add it at the TOP of the file with the other imports, then use it in the JSX below`;

/**
 * Error prevention rules for drawing-to-code conversion
 */
const DRAWING_ERROR_PREVENTION_RULES = `1. **NEVER CREATE NEW FILES** - Do NOT create new component files, utility files, or any other files. Write everything inline in the existing file
2. You do not need to update package.json or anything, just add / edit the react component.
3. Do NOT add import statements in the middle of the file or inside JSX - imports go ONLY at the top
4. Do NOT modify the import { SkemaWrapper } from "@/components/skema-wrapper" line or the SkemaWrapper component itself
5. If you need something that requires an import and it's not already imported, either use an alternative that doesn't need an import, or add the import at the very TOP of the file with the other imports
6. DONT MAKE ANY CHANGES THAT WOULD RESULT IN A Build Error
7. **JSX SYNTAX VALIDATION** - ALWAYS ensure every JSX tag is properly closed. Every opening tag like <div>, <a>, <span>, <button> MUST have a matching closing tag </div>, </a>, </span>, </button>. Self-closing tags like <img />, <input />, <br /> must end with />. Before finishing, mentally verify all tag pairs are balanced.`;

// =============================================================================
// PROMPT 5: Image Analysis (Gemini Vision)
// =============================================================================

/**
 * Prompt for Gemini Vision to analyze a wireframe sketch image.
 * This generates a description that is then passed to the main drawing prompt.
 */
export const IMAGE_ANALYSIS_PROMPT = `
Analyze this UI wireframe sketch in some detail (not too long) for a front-end developer.

Describe every element, layout, spacing, icons, and text you see.
Focus on whats apparent, don't overthink it.
Mention relative positions and hierarchy.
Be distinct about what is drawn vs what might be background.

Do NOT focus on exact pixel coordinates or absolute positions - describe layouts
in terms of relative positioning (left/right/top/bottom, centered, evenly spaced, etc.).

It is expected that they will be rough draft's / hand-drawn things. Interpret the drawing and its goals as best as you can.
DO NOT MENTION THAT THINGS HAVE "Hand-sketched" or "Hand-drawn" vibes. Make assumptions of what they were trying to do.
Just FYI, this gets passed onto a generator to generate the actual code of modern UI componenents.
`.trim();

// =============================================================================
// Helper Functions for Building Prompt Sections
// =============================================================================

/**
 * Build position context section for drawing prompt
 */
function buildPositionContext(
  bbox?: { x: number; y: number; width: number; height: number },
  viewport?: ViewportInfo,
  gridCellRef?: string
): string {
  if (!bbox) return '';

  if (viewport) {
    const relX = ((bbox.x / viewport.width) * 100).toFixed(1);
    const relY = ((bbox.y / viewport.height) * 100).toFixed(1);
    let context = `**Drawing Location:** Approximately ${relX}% from left, ${relY}% from top of viewport`;
    if (gridCellRef) {
      context += ` (grid cell ${gridCellRef})`;
    }
    return context;
  }

  return `**Drawing Area:** ${Math.round(bbox.width)}×${Math.round(bbox.height)}px`;
}

/**
 * Build nearby elements context section for drawing prompt
 */
function buildNearbyElementsContext(nearbyElements: NearbyElement[]): string {
  if (nearbyElements.length === 0) return '';

  const elementList = nearbyElements
    .slice(0, 5)
    .map((el) => {
      let desc = `- <${el.tagName.toLowerCase()}>`;
      if (el.text) desc += `: "${el.text.slice(0, 50)}"`;
      if (el.className) desc += ` (class: ${el.className.slice(0, 50)})`;
      desc += ` (${el.selector})`;
      return desc;
    })
    .join('\n');

  return `\n**Nearby DOM Elements (for placement reference):**\n${elementList}`;
}

/**
 * Build image/vision analysis note section for drawing prompt
 */
function buildImageNote(hasImage: boolean, visionDescription?: string): string {
  let note = hasImage
    ? '\n**[Drawing image provided as base64 PNG with labeled grid overlay]**'
    : '';

  if (visionDescription) {
    note += `\n\n## Visual Analysis of Drawing\n${visionDescription}`;
  }

  return note;
}

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Build the core package
pnpm build

# Run example Next.js app (on localhost:3000)
pnpm example

# Development mode: build core with watch + run example
pnpm dev

# Build core with watch mode only
pnpm --filter skema-core watch
```

## Architecture

This is a pnpm monorepo with two packages:

### skema-core (`packages/skema-core/`)
The main React component library that provides a tldraw-powered drawing overlay for websites.

**Key files:**
- `src/components/Skema.tsx` - Main component that wraps tldraw with transparent overlay, DOM selection highlights, and annotations sidebar
- `src/tools/DOMPickerTool.ts` - Custom tldraw StateNode tool for picking DOM elements. Injects styles to make canvas click-through while keeping toolbar interactive
- `src/utils/element-identification.ts` - Utilities for generating CSS selectors and identifying DOM elements
- `src/utils/coordinates.ts` - Viewport/document coordinate conversion utilities
- `src/types.ts` - TypeScript interfaces for annotations, selections, and component props

**Build:** Uses tsup to output CJS, ESM, and type declarations.

### skema-example (`packages/skema-example/`)
Next.js demo application that imports and uses skema-core.

## Key Concepts

**Overlay System:** The Skema component renders as a fixed-position overlay on top of the page. The tldraw canvas syncs its camera with window scroll position so drawings stay anchored to page content.

**DOM Picker:** A custom tldraw tool that makes the canvas click-through (via injected CSS) so users can click elements underneath. Hovering highlights elements with a blue overlay and shows a tooltip with element identification.

**Coordinate Systems:** The codebase distinguishes between viewport coordinates (relative to browser window) and document coordinates (includes scroll offset). Use the utilities in `coordinates.ts` for conversions.

**Z-Index Layers (top to bottom):**
- 999999: Hover tooltip
- 999998: Highlight overlay
- 999997: Selection boxes
- 999996: Annotations sidebar
- 99999: Main tldraw canvas (configurable via props)

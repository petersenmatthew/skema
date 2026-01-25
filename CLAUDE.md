# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Skema is a drawing-based website development tool - a React component that provides a tldraw-powered overlay for annotating and manipulating DOM elements visually. It sits on top of your localhost website as a transparent overlay (NOT a canvas tool).

## Commands

```bash
# Install dependencies
bun install

# Build skema-core package
bun run build

# Run example app only (localhost:3000)
bun run example

# Build core + run example in watch mode (parallel)
bun run dev

# Build core in watch mode only
bun run --filter skema-core watch
```

## Monorepo Structure

This is a Bun workspaces monorepo with two packages:

- **skema-core** - Main React component library (published as `skema-core`)
- **skema-example** - Next.js demo application

### skema-core Build Outputs

The package has three entry points configured in `tsup.config.ts`:
1. **Client** (`index.ts`) - React component + utilities for browser
2. **Server** (`server/index.ts`) - Node.js utilities (Gemini integration)
3. **CLI** (`cli/index.ts`) - Executable script with shebang

## Architecture

### Core Component (`src/components/Skema.tsx`)

The main component (~1800 lines) manages:
- tldraw editor as transparent overlay with scroll-synced camera
- Annotation state (DOM selections, drawings, gestures)
- Custom toolbar with 5 tool buttons (select, draw, lasso, erase, placeholder)
- AnnotationMarker numbered indicators
- SelectionOverlay green highlight on DOM elements
- AnnotationPopup modal for comments
- AnnotationsSidebar with export functionality

Toggle shortcut: **⌘⇧E** (Cmd+Shift+E / Ctrl+Shift+E)

### Custom Tools

**LassoSelectTool** (`src/tools/LassoSelectTool.ts`) - Uses tldraw's StateNode pattern:
- Idle state (waiting) → Lassoing state (drawing)
- Closes loop on completion, triggers DOM element selection via callback

### Type System (`src/types.ts`)

Core types for annotation system:
- `DOMSelection` - Captured DOM element with selector, bbox, text, path
- `DrawingAnnotation` - tldraw shapes with SVG/PNG export
- `GestureAnnotation` - Recognized gestures (circle, scribble-delete)
- `Annotation` - Union of all annotation types
- `AnnotationExport` - Full export format with viewport metadata

### Utilities

- **element-identification.ts** - `generateSelector()`, `getElementPath()`, `createDOMSelection()`
- **coordinates.ts** - Viewport ↔ Document coordinate conversions, bbox intersection
- **lib/utils.ts** - `blobToBase64()`, `addGridToSvg()`, `extractTextFromShapes()`

## Key Dependencies

- **tldraw@3.15.5** - Drawing library (StateNode pattern for custom tools)
- **@google/generative-ai** - Gemini AI integration
- **React 19** - Peer dependency

## Next.js Integration Notes

When using in Next.js:
- Set `reactStrictMode: false` for tldraw compatibility
- Add `transpilePackages: ['skema-core']` to next.config.js
- Only render in development: `{process.env.NODE_ENV === 'development' && <Skema />}`

## DOM Selection Methods

Three ways to select DOM elements:
1. **Double-click** on canvas to select element under cursor
2. **Brush selection** - drag to select area
3. **Lasso selection** - freehand outline with custom LassoSelectTool

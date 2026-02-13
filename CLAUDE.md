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

# Run Skema CLI/daemon
npx skema-core

# Run Skema init
npx skema-core init
```

## Monorepo Structure

This is a Bun workspaces monorepo with two packages:

- **skema-core** - Main package (published as `skema-core`)
- **skema-example** - Next.js demo application

### skema-core Build Outputs

The package has four entry points configured in `tsup.config.ts`:
1. **Client** (`index.ts`) - React component + utilities for browser
2. **Server** (`server/index.ts`) - Node.js utilities (daemon, AI providers, vision)
3. **CLI** (`cli/index.ts`) - Main executable script (`skema-core` command)
4. **MCP** (`mcp/index.ts`) - MCP server executable (`skema-mcp` command)

## Architecture

### Execution Modes

Skema supports two execution modes for AI generation:

#### 1. CLI Mode (default)
Uses CLI tools (`gemini` or `claude`) for AI generation. Requires the CLIs to be installed globally.

```bash
npx skema-core                          # Start in CLI mode
npx skema-core --provider claude        # Use Claude CLI
```

#### 2. MCP Mode (Model Context Protocol)
Annotations are queued for an AI agent (Cursor, Claude Desktop, etc.) to process via MCP.

```bash
npx skema-core --mcp                    # Start MCP server (stdio transport)
npx skema-mcp                           # Alternative: direct MCP binary
```

**Cursor/Claude Desktop config (`~/.cursor/mcp.json` or `~/.config/claude-desktop/config.json`):**
```json
{
  "mcpServers": {
    "skema": {
      "command": "npx",
      "args": ["skema-mcp"]
    }
  }
}
```

### Daemon-based AI Generation

Skema uses a WebSocket daemon for AI code generation:

**Terminal** (runs daemon):
```bash
npx skema-core                   # Start daemon (default port 9999)
npx skema-core --port 8080       # Custom port
```

**Browser** (Skema component):
- Auto-connects to `ws://localhost:9999` via the `useDaemon` hook
- Sends annotations, receives streaming AI responses
- Daemon spawns CLI agent to implement changes

**Flow**:
1. User creates annotation in browser -> Skema component
2. Component sends annotation to daemon via WebSocket
3. Daemon creates git snapshot (for undo), builds prompt
4. Daemon spawns CLI agent (gemini/claude) to implement changes
5. AI streams events -> daemon -> browser
6. User can revert changes per-annotation using git snapshots

### AI Provider System

#### CLI Providers (`src/server/ai-provider.ts`)
- **Gemini CLI** (`gemini -p <prompt> --yolo --output-format stream-json`)
- **Claude Code CLI** (`claude -p <prompt> --dangerously-skip-permissions --output-format stream-json`)

### Vision Analysis (`src/server/vision.ts`)

For drawing annotations, Skema uses the Gemini vision API to analyze the image:
- Uses `GEMINI_API_KEY` environment variable
- Vision description is appended to the prompt before sending to AI CLI

### Core Component (`src/components/Skema.tsx`)

The main component manages:
- tldraw editor as transparent overlay with scroll-synced camera
- Annotation state (DOM selections, drawings, gestures)
- Custom toolbar with tool buttons (select, draw, lasso, erase, shapes)
- AnnotationMarker numbered indicators
- SelectionOverlay green highlight on DOM elements
- AnnotationPopup modal for comments
- AnnotationsSidebar with export functionality
- ProcessingOverlay for AI generation status

Toggle shortcut: **⌘⇧E** (Cmd+Shift+E / Ctrl+Shift+E)

### useDaemon Hook (`src/hooks/useDaemon.ts`)

React hook for daemon communication:
- `state.connected`, `state.provider`, `state.mode`, `state.availableProviders`
- `generate(annotation, onEvent, options)` - streams AI events (options: mode, provider)
- `revert(annotationId)` - undoes changes for specific annotation
- `setProvider(provider)` - switches between gemini/claude
- `setMode(mode)` - switches between direct-cli/mcp
- Auto-reconnects on disconnect

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
- `SkemaProps` - Component props including `daemonUrl`, callbacks
- `AIStreamEvent` - Streaming events from AI CLI

### Utilities

- **element-identification.ts** - `generateSelector()`, `getElementPath()`, `createDOMSelection()`
- **coordinates.ts** - Viewport ↔ Document coordinate conversions, bbox intersection
- **lib/utils.ts** - `blobToBase64()`, `addGridToSvg()`, `extractTextFromShapes()`

## Key Dependencies

- **tldraw@3.15.5** - Drawing library (StateNode pattern for custom tools)
- **@google/generative-ai** - Gemini API (for vision analysis of drawings)
- **@modelcontextprotocol/sdk** - MCP server implementation
- **ws** - WebSocket server for daemon
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

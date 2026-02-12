<p align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="assets/logo-dark.svg">
    <img src="assets/logo-light.svg" alt="Skema" width="400">
  </picture>
</p>

<p align="center">
  A drawing-based website development tool that transforms how you annotate and communicate design changes.
</p>

---

## Overview

Skema is an npm package that provides a tldraw-powered drawing overlay for annotating and manipulating DOM elements visually. It sits on top of your localhost website, allowing developers to annotate, draw, and select DOM elements directly on the live page. Combined with AI, your annotations become code changes.

## Features

- **Drawing Overlay**: Use tldraw's powerful drawing tools directly on your website
- **DOM Picker**: Select any element on the page to capture its selector, bounding box, and context
- **AI Code Generation**: Annotations are sent to AI (Gemini or Claude) which edits your code
- **Undo/Revert**: Git-based snapshots let you revert changes per-annotation
- **Non-Invasive**: Transparent overlay that doesn't interfere with your page when not in use

## Installation

### 1. Install the package

```bash
bun add skema-core
# or
npm install skema-core
```

### 2. Install an AI CLI (for CLI mode)

By default, Skema uses CLI agents that handle their own authentication (no API key needed):

```bash
# Gemini CLI (recommended)
npm install -g @google/gemini-cli

# Or Claude Code CLI
npm install -g @anthropic-ai/claude-code
```

Run the CLI once to complete its login/auth flow before using with Skema.

### 3. Add Skema to your app

#### Next.js App Router (Next.js 13+)

In Next.js App Router, components are Server Components by default. Since Skema uses tldraw (which requires browser APIs), you need a small **Client Component** wrapper:

```tsx
// src/components/skema-overlay.tsx
"use client";

import { Skema } from "skema-core";

export function SkemaOverlay() {
  return <Skema />;
}
```

Then import it in your layout:

```tsx
// src/app/layout.tsx
import { SkemaOverlay } from "@/components/skema-overlay";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SkemaOverlay />
      </body>
    </html>
  );
}
```

That's it. Skema auto-connects to the daemon and handles everything internally. No hooks or callbacks needed for the default flow.

#### Next.js Pages Router / Other React Apps

For Pages Router or other React frameworks, you can use Skema directly:

```tsx
import { Skema } from 'skema-core';

export default function Page() {
  return (
    <>
      {/* Your page content */}
      <main>...</main>

      {/* Skema overlay - only in development */}
      {process.env.NODE_ENV === 'development' && <Skema />}
    </>
  );
}
```

### 4. Start the daemon

In a separate terminal, start the Skema daemon in your project directory:

```bash
npx skema-core
```

The daemon runs a WebSocket server that:
- Connects to your browser (auto-connects to `ws://localhost:9999`)
- Receives annotations from the Skema component
- Calls AI CLI agents (Gemini or Claude) to generate code changes
- Streams results back to the browser
- Creates git snapshots for undo/revert

That's it! Press **⌘⇧E** (Cmd+Shift+E) to toggle the Skema overlay.

## Daemon Options

```bash
npx skema-core                      # Start daemon (default port 9999)
npx skema-core --port 8080          # Custom port
npx skema-core --provider claude    # Use Claude instead of Gemini
npx skema-core --dir /path/to/proj  # Set working directory
npx skema-core --mcp                # Start as MCP server (for Cursor/Claude Desktop)
npx skema-core init                 # Initialize project (creates config files)
npx skema-core help                 # Show help
```

### Execution Modes

Skema supports two execution modes, configurable via the settings panel or CLI:

- **CLI** (default): Annotations are processed instantly using Gemini/Claude CLI agents. No API key needed -- the CLI tools handle their own auth. The CLI agents can autonomously read, write, and modify your files.
- **MCP**: Annotations are **queued** instead of processed immediately. An external AI agent (Cursor, Claude Desktop, etc.) connects via MCP to retrieve and process them. The agent does the code generation -- Skema just provides the annotation context. No API keys needed in Skema.

#### Setting up MCP Mode

1. Toggle to **MCP** in the Skema settings panel
2. Start the daemon: `npx skema-core`
3. Add the MCP server to your agent. For Cursor, add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "skema": {
      "command": "node",
      "args": ["./node_modules/skema-core/dist/mcp.js"]
    }
  }
}
```

4. Annotate in the browser -- annotations are queued
5. Tell your agent: "Process the pending Skema annotations" or the agent will pick them up via `skema_watch`

**MCP Tools:**

| Tool | Description |
|------|-------------|
| `skema_get_pending` | Get all pending annotations awaiting processing |
| `skema_get_all_annotations` | Get all annotations with their status |
| `skema_get_annotation` | Get a specific annotation by ID |
| `skema_acknowledge` | Mark an annotation as seen/in-progress |
| `skema_resolve` | Mark as resolved with a summary of what was done |
| `skema_dismiss` | Dismiss with a reason |
| `skema_watch` | Block until new annotations appear (for hands-free loops) |

> **Note**: After installing `skema-core`, you can also use the `skema` command directly (e.g., `skema init`).

## Keyboard Shortcuts

- **⌘⇧E** (Cmd+Shift+E / Ctrl+Shift+E): Toggle Skema overlay
- **P**: Activate DOM Picker tool

## Development

This is a monorepo managed with Bun workspaces.

### Structure

```
skema/
├── packages/
│   ├── skema-core/     # Main package
│   └── skema-example/  # Next.js demo application
├── package.json
└── tsconfig.base.json
```

### Getting Started

```bash
# Install dependencies
bun install

# Build the core package
bun run build

# Run the example app
bun run example

# Or run both in development mode
bun run dev
```

### Scripts

- `bun run build` - Build the skema-core package
- `bun run dev` - Build core and run example in watch mode
- `bun run example` - Run the example Next.js app
- `bun run skema` - Run the Skema CLI/daemon locally
- `bun run skema:init` - Run Skema init locally

## Architecture

### CLI Mode (default)

```
┌──────────────────┐     WebSocket     ┌─────────────────┐   spawns    ┌──────────────┐
│  Browser         │ ←───────────────→ │  Daemon         │ ──────────→ │  AI CLI Agent │
│  (Skema overlay) │                   │  (skema-core)   │             │  (gemini/     │
└──────────────────┘                   └─────────────────┘             │   claude)     │
                                                                      └──────────────┘
```

1. User creates annotation in browser
2. Skema sends annotation to daemon via WebSocket
3. Daemon creates git snapshot, builds prompt, spawns CLI agent
4. CLI agent autonomously reads/writes files to implement changes
5. User can revert changes using git snapshots

### MCP Mode

```
┌──────────────────┐     WebSocket     ┌─────────────────┐     WebSocket     ┌─────────────────┐
│  Browser         │ ──────────────→   │  Daemon         │  ←──────────────  │  MCP Server     │
│  (Skema overlay) │   annotations     │  (annotation    │   reads/manages   │  (stdio)        │
└──────────────────┘   are queued      │   store)        │   annotations     └────────┬────────┘
                                       └─────────────────┘                            │ MCP
                                                                                      ▼
                                                                             ┌──────────────────┐
                                                                             │  AI Agent        │
                                                                             │  (Cursor, Claude │
                                                                             │   Desktop, etc.) │
                                                                             └──────────────────┘
```

1. User creates annotations in the browser overlay
2. Annotations are queued in the daemon's store (not processed)
3. AI agent calls `skema_get_pending` via MCP to retrieve queued annotations
4. Agent reads the annotation context (selectors, drawings, comments) and makes code changes itself
5. Agent calls `skema_resolve` to mark annotations as done

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Whether Skema overlay is enabled |
| `daemonUrl` | `string \| null` | `'ws://localhost:9999'` | WebSocket URL for daemon. Set to `null` to disable auto-connection |
| `onAnnotationsChange` | `(annotations: Annotation[]) => void` | - | Callback when annotations change |
| `onAnnotationSubmit` | `(annotation: Annotation, comment: string) => void` | - | Custom handler for annotation submission |
| `onAnnotationDelete` | `(annotationId: string) => void` | - | Custom handler for annotation deletion |
| `toggleShortcut` | `string` | `'mod+shift+e'` | Keyboard shortcut to toggle Skema |
| `initialAnnotations` | `Annotation[]` | `[]` | Initial annotations to load |
| `zIndex` | `number` | `99999` | Z-index for the overlay |
| `isProcessing` | `boolean` | - | Shows processing animation |
| `onProcessingCancel` | `() => void` | - | Callback when user cancels processing |

## Next.js Configuration

```js
// next.config.js
module.exports = {
  reactStrictMode: false, // Required for tldraw
  transpilePackages: ['skema-core'],
};
```

## License

MIT

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/petersenmatthew/skema/main/assets/logo-dark.svg">
    <img src="https://raw.githubusercontent.com/petersenmatthew/skema/main/assets/logo-light.svg" alt="Skema" width="400">
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
- **DOM Selection**: Double-click on the canvas to select the element under the cursor (or use brush/lasso selection)
- **AI Code Generation**: Annotations are sent to AI (Gemini or Claude) which edits your code
- **Undo/Revert**: Git-based snapshots let you revert changes per-annotation
- **Non-Invasive**: Transparent overlay that doesn't interfere with your page when not in use

## Installation

### 1. Install the package

```bash
npm install skema-core
# or
bun add skema-core
```

### 2. Install an AI CLI

Skema uses CLI tools for AI code generation. Install at least one:

```bash
# Gemini CLI (recommended)
npm install -g @anthropic-ai/gemini-cli

# Or Claude Code CLI
npm install -g @anthropic-ai/claude-code
```

### 3. Set up your API key

Skema uses vision AI to analyze your drawings. Add your API key to a `.env` file in your project root:

```env
# For Gemini (recommended)
GEMINI_API_KEY=your_api_key

# Or for Claude
ANTHROPIC_API_KEY=your_api_key
```

Get your API key from [Google AI Studio](https://aistudio.google.com/apikey) or [Anthropic Console](https://console.anthropic.com/).

### 4. Add Skema to your app

Add the Skema component to your app (development only):

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

### 5. Start the daemon

In a separate terminal, start the Skema daemon in your project directory:

```bash
npx skema-core
```

The daemon runs a WebSocket server that:
- Connects to your browser (auto-connects to `ws://localhost:9999`)
- Receives annotations from the Skema component
- Spawns AI CLI to generate code changes
- Streams results back to the browser
- Creates git snapshots for undo/revert

That's it! Press **⌘⇧E** (Cmd+Shift+E) to toggle the Skema overlay.

## Daemon Options

```bash
npx skema-core                      # Start daemon (default port 9999)
npx skema-core --port 8080          # Custom port
npx skema-core --provider claude    # Use Claude Code CLI instead of Gemini
npx skema-core --dir /path/to/proj  # Set working directory
npx skema-core init                 # Initialize project (creates config files)
npx skema-core help                 # Show help
```


## Keyboard Shortcuts

- **⌘⇧E** (Cmd+Shift+E / Ctrl+Shift+E): Toggle Skema overlay
- **s**: Select tool
- **d**: Draw tool
- **l**: Lasso select
- **e**: Eraser
- **r**: Rectangle (shapes)
- **o**: Ellipse (shapes)
- **Escape**: Close popup or shape picker

To select a DOM element for annotation, double-click on the canvas over that element.

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

## Architecture

```
┌──────────────────┐     WebSocket     ┌─────────────────┐
│  Browser         │ ←───────────────→ │  Daemon         │
│  (Skema overlay) │                   │  (skema-core)   │
└──────────────────┘                   └────────┬────────┘
                                               │ spawns
                                               ▼
                                      ┌─────────────────┐
                                      │  AI CLI         │
                                      │  (gemini/claude)│
                                      └─────────────────┘
```

1. User creates annotation in browser
2. Skema sends annotation to daemon via WebSocket
3. Daemon creates git snapshot, builds prompt, spawns AI CLI
4. AI CLI modifies files, streams output back
5. User can revert changes using git snapshots

## License

MIT

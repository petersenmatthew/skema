# Skema

A drawing-based website development tool that transforms how you annotate and communicate design changes.

## Overview

Skema is a React component that provides a tldraw-powered drawing overlay for annotating and manipulating DOM elements visually. It sits on top of your localhost website, allowing developers to annotate, draw, and select DOM elements directly on the live page.

## Features

- **Drawing Overlay**: Use tldraw's powerful drawing tools directly on your website
- **DOM Picker**: Select any element on the page to capture its selector, bounding box, and context
- **Annotation Export**: Export all annotations in a structured JSON format optimized for AI agents
- **Non-Invasive**: Transparent overlay that doesn't interfere with your page when not in use

## Installation

### 1. Install the package

```bash
bun add skema-core
# or
npm install skema-core
```

### 2. Create the API route

Run the init command to create the Gemini API route in your Next.js App Router project:

```bash
bunx skema init
# or
npx skema init
```

This creates `app/api/gemini/route.ts` (or `src/app/api/gemini/route.ts`) which handles annotation processing.

### 3. Set up your Gemini API key

Add your [Google AI API key](https://aistudio.google.com/apikey) to your `.env` file:

```env
GEMINI_API_KEY=your_api_key_here
```

### 4. Add Skema to your app

Wrap your app with the Skema component (development only):

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

That's it! Press **⌘⇧E** (Cmd+Shift+E) to toggle the Skema overlay.

## Keyboard Shortcuts

- **⌘⇧E** (Cmd+Shift+E / Ctrl+Shift+E): Toggle Skema overlay
- **P**: Activate DOM Picker tool

## Export Format

When you export annotations, Skema generates a JSON structure like this:

```json
{
  "version": "1.0.0",
  "timestamp": "2024-01-24T12:00:00Z",
  "viewport": {
    "width": 1920,
    "height": 1080,
    "scrollX": 0,
    "scrollY": 150
  },
  "pathname": "/",
  "annotations": [
    {
      "type": "dom_selection",
      "id": "dom-1706097600000-abc123",
      "selector": ".hero-section > button.cta-primary",
      "tagName": "button",
      "elementPath": ".hero-section > button",
      "text": "Get Started",
      "boundingBox": { "x": 100, "y": 200, "width": 150, "height": 40 },
      "timestamp": 1706097600000,
      "pathname": "/"
    }
  ]
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Whether Skema overlay is enabled |
| `onAnnotationsChange` | `(annotations: Annotation[]) => void` | - | Callback when annotations change |
| `toggleShortcut` | `string` | `'mod+shift+e'` | Keyboard shortcut to toggle Skema |
| `initialAnnotations` | `Annotation[]` | `[]` | Initial annotations to load |
| `zIndex` | `number` | `99999` | Z-index for the overlay |

## License

MIT

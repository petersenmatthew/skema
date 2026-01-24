# Skema - Drawing-Based Website Development Tool

## Overview

Skema is a revolutionary development tool that transforms website development into a drawing-based workflow. It provides a modern toolbar overlay that sits on top of your localhost website, allowing developers to annotate, draw, and manipulate DOM elements visually. Using the tldraw library for the drawing interface and integrating with CLI-based coding agents like Claude Code, Skema enables real-time visual feedback and immediate code implementation.

**Key Concept**: Skema is **NOT** a canvas-based tool. It's a toolbar overlay component that lives within the browser window, allowing you to draw directly on top of your live website while maintaining full interactivity with the underlying DOM.

## Implementation Status

### Phase 1: Project Setup & Infrastructure ✅ COMPLETE
- [x] **Task 1.1**: Initialize monorepo structure using pnpm workspaces
- [x] **Task 1.2**: Create packages structure (skema-core, skema-example)
- [x] **Task 1.3**: Configure TypeScript and build tooling (tsup)
- [x] **Task 1.4**: Install and configure tldraw v3.15.5

### Phase 2: Core Skema Component Architecture ✅ COMPLETE
- [x] **Task 2.1**: Create base `<Skema>` React component with fixed position overlay
- [x] **Task 2.2**: Integrate tldraw editor as transparent overlay layer
- [x] **Task 2.3**: Implement coordinate system management utilities

### Phase 3: DOM Picker Tool Implementation ✅ COMPLETE
- [x] **Task 3.1**: Research tldraw custom tool creation (StateNode pattern)
- [x] **Task 3.2**: Create DOM Picker tool with hover highlighting
- [x] **Task 3.3**: Store DOM selection data structure with selector, bbox, text, etc.

### Phase 4: Drawing Tools Integration ✅ COMPLETE
- [x] **Task 4.1**: Configure tldraw's built-in drawing tools
- [x] **Task 4.2**: Implement annotation export as structured JSON

### Phase 5: Gesture Recognition ($P Integration) 🔜 PENDING
- [ ] **Task 5.1**: Integrate $P Recognizer library
- [ ] **Task 5.2**: Implement shape auto-completion
- [ ] **Task 5.3**: Implement scribble-to-delete gesture

### Phase 6: Annotation Management UI 🔜 PENDING
- [ ] **Task 6.1**: Enhance annotation list/timeline sidebar
- [ ] **Task 6.2**: Improve annotation export format

### Phase 7: Example Application ✅ COMPLETE
- [x] **Task 7.1**: Create minimal Next.js demo app with sample content
- [x] **Task 7.2**: Integrate Skema with keyboard toggle (⌘⇧E)

### Phase 8: Testing & Refinement 🔜 PENDING
- [ ] **Task 8.1**: Test drawing functionality across viewports
- [ ] **Task 8.2**: Test DOM picker accuracy
- [ ] **Task 8.3**: Test gesture recognition
- [ ] **Task 8.4**: Performance optimization

### Phase 9: Future Enhancements (Post-MVP) 🔜 PENDING
- [ ] **Task 9.1**: Agent integration foundation
- [ ] **Task 9.2**: Side-by-side preview
- [ ] **Task 9.3**: Advanced features

## Quick Start

```bash
# Install dependencies
pnpm install

# Build the core package
pnpm build

# Run the example app
pnpm example
```

Then open http://localhost:3000 and press **⌘⇧E** (or Ctrl+Shift+E on Windows/Linux) to toggle the Skema overlay.

## Project Structure

```
skema/
├── packages/
│   ├── skema-core/           # Main React component library
│   │   ├── src/
│   │   │   ├── components/   # Skema component
│   │   │   ├── tools/        # Custom tldraw tools (DOM Picker)
│   │   │   ├── utils/        # Coordinate & element identification utilities
│   │   │   ├── types.ts      # TypeScript types
│   │   │   └── index.ts      # Public exports
│   │   ├── package.json
│   │   └── tsup.config.ts
│   └── skema-example/        # Next.js demo application
│       ├── src/app/
│       │   ├── page.tsx      # Demo page with Skema integration
│       │   ├── layout.tsx
│       │   └── globals.css
│       └── package.json
├── package.json              # Root workspace config
├── pnpm-workspace.yaml
└── tsconfig.base.json        # Shared TypeScript config
```

## Features Implemented

1. **Tldraw Drawing Overlay**: Full tldraw editor as a transparent overlay
2. **DOM Picker Tool**: Custom tool to select and capture DOM elements
3. **Element Identification**: Smart selector generation and element naming
4. **Coordinate Utilities**: Viewport/document coordinate transformations
5. **Annotation Export**: JSON export format for AI agent consumption
6. **Keyboard Toggle**: ⌘⇧E to show/hide the overlay
7. **Annotations Sidebar**: View and manage captured annotations

## Usage

```tsx
import { Skema } from 'skema-core';

export default function App() {
  return (
    <>
      <YourApp />
      {process.env.NODE_ENV === 'development' && <Skema />}
    </>
  );
}
```

## References Used

- **Agentation** - DOM selection patterns and element identification
- **Tldraw** - Drawing library and custom tool patterns (StateNode)
- **Tldraw Documentation** - Custom components and UI overrides

---

**End of Implementation Plan**

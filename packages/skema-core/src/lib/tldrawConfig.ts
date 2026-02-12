// =============================================================================
// tldraw Configuration - Components and UI overrides for Skema
// =============================================================================

import type { TLComponents, TLUiOverrides } from 'tldraw';
import { DefaultColorThemePalette } from 'tldraw';
import { SkemaOverlays } from '../components/overlays/LassoOverlay';

/**
 * Override tldraw's dark mode "black" color to stay dark.
 * By default, tldraw inverts "black" to light gray (#f2f2f2) in dark mode
 * for visibility on dark canvases. Since Skema is a transparent overlay,
 * the pencil should remain dark regardless of theme.
 */
DefaultColorThemePalette.darkMode.black =
  DefaultColorThemePalette.lightMode.black;

/**
 * Custom tldraw components configuration for Skema overlay mode
 * Hides most UI elements to create a clean overlay experience
 */
export const skemaComponents: TLComponents = {
    Toolbar: null,
    Overlays: SkemaOverlays,
    // Hide background to make canvas transparent (so website shows through)
    Background: null,
    // Hide UI elements we don't need
    SharePanel: null,
    MenuPanel: null,
    TopPanel: null,
    PageMenu: null,
    NavigationPanel: null,
    HelpMenu: null,
    Minimap: null,
    // Hide "Back to Content" button (HelperButtons contains this)
    HelperButtons: null,
    QuickActions: null,
    ZoomMenu: null,
    ActionsMenu: null,
    DebugPanel: null,
    DebugMenu: null,
    // Hide canvas overlays
    OnTheCanvas: null,
    InFrontOfTheCanvas: null,
};

/**
 * UI overrides to customize tool shortcuts
 */
export const skemaOverrides: TLUiOverrides = {
    tools(editor, tools) {
        return {
            ...tools,
            'select': {
                ...tools['select'],
                kbd: 's',
            },
            'lasso-select': {
                id: 'lasso-select',
                label: 'Lasso Select',
                icon: 'blob',
                kbd: 'l',
                onSelect: () => {
                    editor.setCurrentTool('lasso-select');
                },
            },
        };
    },
};

/**
 * CSS to hide tldraw's UI elements we don't need
 */
export const skemaHiddenUiStyles = `
  .tlui-button[data-testid="back-to-content"],
  .tlui-offscreen-indicator,
  [class*="back-to-content"],
  .tl-offscreen-indicator,
  /* Hide "made with tldraw" watermark */
  .tlui-watermark,
  .tlui-watermark__inner,
  [class*="watermark"] {
    display: none !important;
  }
`;

/**
 * CSS for toast animations
 */
export const skemaToastStyles = `
  @keyframes skema-toast-fade {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
`;

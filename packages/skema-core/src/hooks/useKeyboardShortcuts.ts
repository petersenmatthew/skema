// =============================================================================
// useKeyboardShortcuts - Handle keyboard shortcuts for toggling Skema
// =============================================================================

import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
    onToggle: () => void;
    shortcut?: string; // e.g., 'mod+shift+e'
}

/**
 * Hook to handle keyboard shortcuts for Skema
 * Default shortcut: Cmd/Ctrl + Shift + E to toggle overlay
 */
export function useKeyboardShortcuts({ onToggle, shortcut = 'mod+shift+e' }: UseKeyboardShortcutsOptions) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMod = e.metaKey || e.ctrlKey;

            // Parse shortcut (currently only supports mod+shift+key format)
            if (shortcut === 'mod+shift+e') {
                if (isMod && e.shiftKey && e.key.toLowerCase() === 'e') {
                    e.preventDefault();
                    onToggle();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onToggle, shortcut]);
}

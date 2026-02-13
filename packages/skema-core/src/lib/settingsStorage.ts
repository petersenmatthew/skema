// =============================================================================
// Client-side settings persisted in localStorage (browser only)
// =============================================================================

const GEMINI_API_KEY_STORAGE_KEY = 'skema-gemini-api-key';

export function getStoredGeminiApiKey(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const value = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function setStoredGeminiApiKey(value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const trimmed = value.trim();
    if (trimmed) {
      localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

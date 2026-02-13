// =============================================================================
// Client-side settings persisted in localStorage (browser only)
// =============================================================================

export type VisionProviderName = 'gemini' | 'claude' | 'openai';

const VISION_API_KEY_PREFIX = 'skema-vision-api-key-';
const VISION_PROVIDER_KEY = 'skema-vision-provider';
const VISION_MODEL_KEY = 'skema-vision-model';
const OLD_GEMINI_KEY = 'skema-gemini-api-key';

// --- API Key (per provider) ---

export function getStoredVisionApiKey(provider: VisionProviderName): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    let value = localStorage.getItem(VISION_API_KEY_PREFIX + provider);
    // Migrate old gemini key format
    if (!value && provider === 'gemini') {
      value = localStorage.getItem(OLD_GEMINI_KEY);
      if (value) {
        localStorage.setItem(VISION_API_KEY_PREFIX + 'gemini', value);
        localStorage.removeItem(OLD_GEMINI_KEY);
      }
    }
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function setStoredVisionApiKey(provider: VisionProviderName, value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const trimmed = value.trim();
    if (trimmed) {
      localStorage.setItem(VISION_API_KEY_PREFIX + provider, trimmed);
    } else {
      localStorage.removeItem(VISION_API_KEY_PREFIX + provider);
    }
  } catch {
    // ignore
  }
}

// --- Provider ---

export function getStoredVisionProvider(): VisionProviderName {
  if (typeof window === 'undefined' || !window.localStorage) return 'gemini';
  try {
    const value = localStorage.getItem(VISION_PROVIDER_KEY);
    if (value === 'gemini' || value === 'claude' || value === 'openai') return value;
    return 'gemini';
  } catch {
    return 'gemini';
  }
}

export function setStoredVisionProvider(provider: VisionProviderName): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(VISION_PROVIDER_KEY, provider);
  } catch {
    // ignore
  }
}

// --- Model ---

export function getStoredVisionModel(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return localStorage.getItem(VISION_MODEL_KEY);
  } catch {
    return null;
  }
}

export function setStoredVisionModel(model: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (model) {
      localStorage.setItem(VISION_MODEL_KEY, model);
    } else {
      localStorage.removeItem(VISION_MODEL_KEY);
    }
  } catch {
    // ignore
  }
}

// --- Backward compatibility aliases ---

/** @deprecated Use getStoredVisionApiKey('gemini') instead */
export function getStoredGeminiApiKey(): string | null {
  return getStoredVisionApiKey('gemini');
}

/** @deprecated Use setStoredVisionApiKey('gemini', value) instead */
export function setStoredGeminiApiKey(value: string): void {
  setStoredVisionApiKey('gemini', value);
}

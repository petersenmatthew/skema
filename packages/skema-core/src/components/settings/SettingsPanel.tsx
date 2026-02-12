// =============================================================================
// Settings Panel Component
// =============================================================================

import React, { useState, useEffect } from 'react';
import type { ExecutionMode, ProviderName } from '../../hooks/useDaemon';

// Package version - imported at build time
const SKEMA_VERSION = '0.2.0';

export interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex: number;
  // Daemon state
  connected: boolean;
  mode: ExecutionMode;
  provider: ProviderName | string;
  availableProviders: string[];
  // Actions
  onModeChange: (mode: ExecutionMode) => Promise<boolean>;
  onProviderChange: (provider: ProviderName) => Promise<boolean>;
  onApiKeyChange: (provider: ProviderName, apiKey: string) => Promise<boolean>;
}

// LocalStorage keys
const STORAGE_KEYS = {
  theme: 'skema-theme',
  geminiApiKey: 'skema-gemini-api-key',
  claudeApiKey: 'skema-claude-api-key',
  openaiApiKey: 'skema-openai-api-key',
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  zIndex,
  connected,
  mode,
  provider,
  availableProviders,
  onModeChange,
  onProviderChange,
  onApiKeyChange,
}) => {
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(STORAGE_KEYS.theme) as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  // API key states (loaded from localStorage)
  const [geminiKey, setGeminiKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [showApiKeys, setShowApiKeys] = useState(false);

  // Load API keys from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setGeminiKey(localStorage.getItem(STORAGE_KEYS.geminiApiKey) || '');
      setClaudeKey(localStorage.getItem(STORAGE_KEYS.claudeApiKey) || '');
      setOpenaiKey(localStorage.getItem(STORAGE_KEYS.openaiApiKey) || '');
    }
  }, []);

  // Save theme to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.theme, theme);
    }
  }, [theme]);

  // Handle API key save
  const handleSaveApiKey = async (providerName: ProviderName, key: string) => {
    const storageKey = providerName === 'gemini' 
      ? STORAGE_KEYS.geminiApiKey 
      : providerName === 'claude' 
        ? STORAGE_KEYS.claudeApiKey 
        : STORAGE_KEYS.openaiApiKey;
    
    localStorage.setItem(storageKey, key);
    await onApiKeyChange(providerName, key);
  };

  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#1a1a1a' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#1a1a1a';
  const borderColor = isDark ? '#333333' : '#e5e5e5';
  const mutedColor = isDark ? '#888888' : '#666666';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 70,
        right: 16,
        width: 320,
        backgroundColor: bgColor,
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        zIndex: zIndex + 10,
        pointerEvents: 'auto',
        overflow: 'hidden',
        border: `1px solid ${borderColor}`,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: textColor }}>Skema</div>
          <div style={{ fontSize: 12, color: mutedColor }}>v{SKEMA_VERSION}</div>
        </div>
        <div
          style={{
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 6,
            backgroundColor: connected ? '#10b98120' : '#ef444420',
            color: connected ? '#10b981' : '#ef4444',
          }}
        >
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Settings Content */}
      <div style={{ padding: '16px 20px' }}>
        {/* Theme Toggle */}
        <SettingRow label="Theme" isDark={isDark} textColor={textColor} mutedColor={mutedColor}>
          <ToggleSwitch
            options={['Light', 'Dark']}
            value={theme === 'dark' ? 1 : 0}
            onChange={(idx) => setTheme(idx === 1 ? 'dark' : 'light')}
            isDark={isDark}
          />
        </SettingRow>

        {/* Mode Toggle */}
        <SettingRow label="Mode" isDark={isDark} textColor={textColor} mutedColor={mutedColor}>
          <ToggleSwitch
            options={['CLI', 'API']}
            value={mode === 'direct-api' ? 1 : 0}
            onChange={(idx) => onModeChange(idx === 1 ? 'direct-api' : 'legacy-cli')}
            isDark={isDark}
          />
        </SettingRow>

        {/* CLI Provider Toggle (only show in CLI mode) */}
        {mode === 'legacy-cli' && (
          <SettingRow label="CLI Provider" isDark={isDark} textColor={textColor} mutedColor={mutedColor}>
            <ToggleSwitch
              options={['Gemini', 'Claude']}
              value={provider === 'claude' ? 1 : 0}
              onChange={(idx) => onProviderChange(idx === 1 ? 'claude' : 'gemini')}
              isDark={isDark}
            />
          </SettingRow>
        )}

        {/* API Provider Toggle (only show in API mode) */}
        {mode === 'direct-api' && (
          <SettingRow label="API Provider" isDark={isDark} textColor={textColor} mutedColor={mutedColor}>
            <select
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as ProviderName)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: `1px solid ${borderColor}`,
                backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                color: textColor,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <option value="gemini">Gemini</option>
              <option value="claude">Claude</option>
              <option value="openai">OpenAI</option>
            </select>
          </SettingRow>
        )}

        {/* API Keys Section (only in API mode) */}
        {mode === 'direct-api' && (
          <>
            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: `1px solid ${borderColor}`,
              }}
            >
              <button
                onClick={() => setShowApiKeys(!showApiKeys)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                  border: `1px solid ${borderColor}`,
                  borderRadius: 8,
                  color: textColor,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>API Keys</span>
                <span style={{ transform: showApiKeys ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  ▼
                </span>
              </button>
            </div>

            {showApiKeys && (
              <div style={{ marginTop: 12 }}>
                <ApiKeyInput
                  label="Gemini"
                  value={geminiKey}
                  onChange={setGeminiKey}
                  onSave={() => handleSaveApiKey('gemini', geminiKey)}
                  isDark={isDark}
                  borderColor={borderColor}
                  textColor={textColor}
                />
                <ApiKeyInput
                  label="Claude"
                  value={claudeKey}
                  onChange={setClaudeKey}
                  onSave={() => handleSaveApiKey('claude', claudeKey)}
                  isDark={isDark}
                  borderColor={borderColor}
                  textColor={textColor}
                />
                <ApiKeyInput
                  label="OpenAI"
                  value={openaiKey}
                  onChange={setOpenaiKey}
                  onSave={() => handleSaveApiKey('openai', openaiKey)}
                  isDark={isDark}
                  borderColor={borderColor}
                  textColor={textColor}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Sub-components
// =============================================================================

interface SettingRowProps {
  label: string;
  isDark: boolean;
  textColor: string;
  mutedColor: string;
  children: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, textColor, children }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    }}
  >
    <span style={{ fontSize: 14, color: textColor }}>{label}</span>
    {children}
  </div>
);

interface ToggleSwitchProps {
  options: [string, string];
  value: number;
  onChange: (index: number) => void;
  isDark: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ options, value, onChange, isDark }) => {
  const bgColor = isDark ? '#2a2a2a' : '#f0f0f0';
  const activeColor = '#FF6800';

  return (
    <div
      style={{
        display: 'flex',
        backgroundColor: bgColor,
        borderRadius: 8,
        padding: 2,
      }}
    >
      {options.map((option, idx) => (
        <button
          key={option}
          onClick={() => onChange(idx)}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 500,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            backgroundColor: value === idx ? activeColor : 'transparent',
            color: value === idx ? 'white' : isDark ? '#888' : '#666',
            transition: 'all 0.2s ease',
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
};

interface ApiKeyInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  isDark: boolean;
  borderColor: string;
  textColor: string;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
  label,
  value,
  onChange,
  onSave,
  isDark,
  borderColor,
  textColor,
}) => (
  <div style={{ marginBottom: 10 }}>
    <label style={{ fontSize: 12, color: textColor, display: 'block', marginBottom: 4 }}>
      {label} API Key
    </label>
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${label} API key...`}
        style={{
          flex: 1,
          padding: '8px 10px',
          fontSize: 12,
          borderRadius: 6,
          border: `1px solid ${borderColor}`,
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          color: textColor,
        }}
      />
      <button
        onClick={onSave}
        style={{
          padding: '8px 12px',
          fontSize: 12,
          borderRadius: 6,
          border: 'none',
          backgroundColor: '#FF6800',
          color: 'white',
          cursor: 'pointer',
        }}
      >
        Save
      </button>
    </div>
  </div>
);

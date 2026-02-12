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
  // Theme (controlled by parent)
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

// LocalStorage keys
const STORAGE_KEYS = {
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
  theme,
  onThemeChange,
}) => {

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
        {/* Theme Toggle - Sun/Moon icon */}
        <SettingRow label="Theme" isDark={isDark} textColor={textColor} mutedColor={mutedColor}>
          <ThemeIconToggle isDark={isDark} onToggle={() => onThemeChange(isDark ? 'light' : 'dark')} />
        </SettingRow>

        {/* Mode Toggle: Direct vs MCP */}
        <SettingRow label="Mode" isDark={isDark} textColor={textColor} mutedColor={mutedColor}>
          <ToggleSwitch
            options={['Direct', 'MCP']}
            value={mode === 'mcp' ? 1 : 0}
            onChange={(idx) => onModeChange(idx === 1 ? 'mcp' : 'direct-cli')}
            isDark={isDark}
          />
        </SettingRow>

        {/* Mode description */}
        <div style={{ fontSize: 11, color: mutedColor, marginTop: -6, marginBottom: 12, lineHeight: 1.4 }}>
          {mode === 'mcp'
            ? 'Annotations are queued for your AI agent to process'
            : 'Annotations processed instantly'}
        </div>

        {/* MCP Mode Info */}
        {mode === 'mcp' && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              backgroundColor: isDark ? '#1a2332' : '#f0f7ff',
              border: `1px solid ${isDark ? '#2a3a4a' : '#d0e4ff'}`,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#7bb8ff' : '#2563eb', marginBottom: 6 }}>
              MCP Mode
            </div>
            <div style={{ fontSize: 11, color: isDark ? '#8899aa' : '#555', lineHeight: 1.5 }}>
              Annotations are saved and picked up by your AI agent (Cursor, Claude Desktop, etc.) 
              via the Skema MCP server. No API keys needed — your agent handles the generation.
            </div>
          </div>
        )}

        {/* Engine sub-toggle (only in Direct mode) */}
        {mode !== 'mcp' && (
          <>
            <SettingRow label="Engine" isDark={isDark} textColor={textColor} mutedColor={mutedColor}>
              <ToggleSwitch
                options={['CLI', 'API']}
                value={mode === 'direct-api' ? 1 : 0}
                onChange={(idx) => onModeChange(idx === 1 ? 'direct-api' : 'direct-cli')}
                isDark={isDark}
              />
            </SettingRow>
            <div style={{ fontSize: 11, color: mutedColor, marginTop: -6, marginBottom: 12, lineHeight: 1.4 }}>
              {mode === 'direct-cli'
                ? 'Uses Gemini/Claude CLI agents (no API key needed)'
                : 'Uses AI SDKs directly (requires API key)'}
            </div>
          </>
        )}

        {/* CLI Provider Toggle (only in CLI mode) */}
        {mode === 'direct-cli' && (
          <SettingRow label="Provider" isDark={isDark} textColor={textColor} mutedColor={mutedColor}>
            <ToggleSwitch
              options={['Gemini', 'Claude']}
              value={provider === 'claude' ? 1 : 0}
              onChange={(idx) => onProviderChange(idx === 1 ? 'claude' : 'gemini')}
              isDark={isDark}
            />
          </SettingRow>
        )}

        {/* API Provider Selection (only in API mode) */}
        {mode === 'direct-api' && (
          <SettingRow label="Provider" isDark={isDark} textColor={textColor} mutedColor={mutedColor}>
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

// =============================================================================
// Theme Icon Toggle (Sun / Moon)
// =============================================================================

interface ThemeIconToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

const ThemeIconToggle: React.FC<ThemeIconToggleProps> = ({ isDark, onToggle }) => (
  <button
    onClick={onToggle}
    title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
      border: 'none',
      borderRadius: 10,
      backgroundColor: isDark ? '#333333' : '#f0f0f0',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }}
  >
    {isDark ? (
      // Moon icon
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
          fill="#fbbf24"
          stroke="#fbbf24"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      // Sun icon
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="5" fill="#FF6800" stroke="#FF6800" strokeWidth="2" />
        <line x1="12" y1="1" x2="12" y2="3" stroke="#FF6800" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="21" x2="12" y2="23" stroke="#FF6800" strokeWidth="2" strokeLinecap="round" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="#FF6800" strokeWidth="2" strokeLinecap="round" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="#FF6800" strokeWidth="2" strokeLinecap="round" />
        <line x1="1" y1="12" x2="3" y2="12" stroke="#FF6800" strokeWidth="2" strokeLinecap="round" />
        <line x1="21" y1="12" x2="23" y2="12" stroke="#FF6800" strokeWidth="2" strokeLinecap="round" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="#FF6800" strokeWidth="2" strokeLinecap="round" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="#FF6800" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )}
  </button>
);

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

// =============================================================================
// Settings Panel Component
// =============================================================================

import React from 'react';
import type { ExecutionMode, ProviderName, ProviderStatus, AnnotationCounts } from '../../hooks/useDaemon';
import logoDarkUrl from '../../assets/logo-dark';
import logoLightUrl from '../../assets/logo-light';

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
  providerStatus: Record<ProviderName, ProviderStatus>;
  // MCP state
  mcpServerConnected: boolean;
  annotationCounts: AnnotationCounts;
  // Actions
  onModeChange: (mode: ExecutionMode) => Promise<boolean>;
  onProviderChange: (provider: ProviderName) => Promise<boolean>;
  // Theme (controlled by parent)
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  zIndex,
  connected,
  mode,
  provider,
  availableProviders,
  providerStatus,
  mcpServerConnected,
  annotationCounts,
  onModeChange,
  onProviderChange,
  theme,
  onThemeChange,
}) => {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SkemaWordmark isDark={isDark} height={24} />
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

        {/* Mode Toggle: CLI vs MCP */}
        <SettingRow label="Mode" isDark={isDark} textColor={textColor} mutedColor={mutedColor}>
          <ToggleSwitch
            options={['CLI', 'MCP']}
            value={mode === 'mcp' ? 1 : 0}
            onChange={(idx) => onModeChange(idx === 1 ? 'mcp' : 'direct-cli')}
            isDark={isDark}
          />
        </SettingRow>

        {/* Mode description */}
        <div style={{ fontSize: 11, color: mutedColor, marginTop: -6, marginBottom: 12, lineHeight: 1.4 }}>
          {mode === 'mcp'
            ? 'Annotations are queued for your AI agent to process'
            : 'Annotations processed instantly via CLI agents'}
        </div>

        {/* MCP Status Panel */}
        {mode === 'mcp' && (
          <McpStatusPanel
            mcpServerConnected={mcpServerConnected}
            annotationCounts={annotationCounts}
            isDark={isDark}
            mutedColor={mutedColor}
          />
        )}

        {/* CLI Provider Toggle (only in CLI mode) */}
        {mode === 'direct-cli' && (
          <>
            <SettingRow label="Provider" isDark={isDark} textColor={textColor} mutedColor={mutedColor}>
              <ToggleSwitch
                options={['Gemini', 'Claude']}
                value={provider === 'claude' ? 1 : 0}
                onChange={(idx) => onProviderChange(idx === 1 ? 'claude' : 'gemini')}
                isDark={isDark}
              />
            </SettingRow>
            <ProviderStatusIndicator
              provider={provider as ProviderName}
              status={providerStatus[provider as ProviderName]}
              isDark={isDark}
              mutedColor={mutedColor}
            />
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
// MCP Status Panel
// =============================================================================

interface McpStatusPanelProps {
  mcpServerConnected: boolean;
  annotationCounts: AnnotationCounts;
  isDark: boolean;
  mutedColor: string;
}

const McpStatusPanel: React.FC<McpStatusPanelProps> = ({
  mcpServerConnected,
  annotationCounts,
  isDark,
  mutedColor,
}) => {
  const serverDotColor = mcpServerConnected ? '#10b981' : '#ef4444';
  const serverStatusText = mcpServerConnected ? 'Connected' : 'Not detected';
  const totalActive = annotationCounts.pending + annotationCounts.acknowledged;

  return (
    <div
      style={{
        borderRadius: 10,
        backgroundColor: isDark ? '#1a2332' : '#f0f7ff',
        border: `1px solid ${isDark ? '#2a3a4a' : '#d0e4ff'}`,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      {/* MCP Server Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderBottom: totalActive > 0 ? `1px solid ${isDark ? '#2a3a4a' : '#d0e4ff'}` : 'none',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: serverDotColor,
            flexShrink: 0,
            boxShadow: `0 0 6px ${serverDotColor}60`,
          }}
        />
        <span style={{ fontSize: 12, color: isDark ? '#c8d6e5' : '#333', fontWeight: 500 }}>
          MCP Server
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: serverDotColor,
            fontWeight: 500,
          }}
        >
          {serverStatusText}
        </span>
      </div>

      {/* Annotation Pipeline Counts (only when there are active annotations) */}
      {totalActive > 0 && (
        <div style={{ padding: '8px 14px 10px' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <CountBadge label="Queued" count={annotationCounts.pending} color="#f59e0b" isDark={isDark} />
            <CountBadge label="In Progress" count={annotationCounts.acknowledged} color="#3b82f6" isDark={isDark} />
            <CountBadge label="Done" count={annotationCounts.resolved} color="#10b981" isDark={isDark} />
          </div>
        </div>
      )}

      {/* Hint when no MCP server */}
      {!mcpServerConnected && (
        <div style={{ padding: '0 14px 10px', fontSize: 10, color: mutedColor, lineHeight: 1.4 }}>
          Configure the Skema MCP server in your AI agent (Cursor, Claude Desktop, etc.) to connect.
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Count Badge (for annotation pipeline)
// =============================================================================

interface CountBadgeProps {
  label: string;
  count: number;
  color: string;
  isDark: boolean;
}

const CountBadge: React.FC<CountBadgeProps> = ({ label, count, color, isDark }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
    <span style={{ fontSize: 16, fontWeight: 600, color, lineHeight: 1 }}>{count}</span>
    <span style={{ fontSize: 9, color: isDark ? '#778899' : '#888', marginTop: 2 }}>{label}</span>
  </div>
);

// =============================================================================
// Provider Status Indicator (single selected provider)
// =============================================================================

interface ProviderStatusIndicatorProps {
  provider: ProviderName;
  status: ProviderStatus | undefined;
  isDark: boolean;
  mutedColor: string;
}

const ProviderStatusIndicator: React.FC<ProviderStatusIndicatorProps> = ({ provider, status, isDark, mutedColor }) => {
  let dotColor: string;
  let statusText: string;
  let bgTint: string;

  if (!status || status.message === 'Checking...') {
    dotColor = mutedColor;
    statusText = 'Checking...';
    bgTint = isDark ? '#2a2a2a' : '#f5f5f5';
  } else if (status.installed && status.authorized) {
    dotColor = '#10b981';
    statusText = 'Ready';
    bgTint = isDark ? '#10b98110' : '#10b98110';
  } else if (status.installed && !status.authorized) {
    dotColor = '#f59e0b';
    statusText = 'Not authorized';
    bgTint = isDark ? '#f59e0b10' : '#f59e0b10';
  } else {
    dotColor = '#ef4444';
    statusText = 'Not installed';
    bgTint = isDark ? '#ef444410' : '#ef444410';
  }

  const label = provider === 'gemini' ? 'Gemini CLI' : 'Claude Code';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: mutedColor,
        marginTop: -6,
        marginBottom: 12,
        padding: '6px 10px',
        borderRadius: 8,
        backgroundColor: bgTint,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: dotColor,
          flexShrink: 0,
          boxShadow: `0 0 4px ${dotColor}60`,
        }}
      />
      <span>{label}</span>
      <span style={{ marginLeft: 'auto', fontSize: 10, color: dotColor, fontWeight: 500 }}>{statusText}</span>
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

// =============================================================================
// Skema Wordmark Logo (uses assets/logo-dark.svg and assets/logo-light.svg)
// =============================================================================

interface SkemaWordmarkProps {
  isDark: boolean;
  height?: number;
}

const SkemaWordmark: React.FC<SkemaWordmarkProps> = ({ isDark, height = 24 }) => {
  const src = isDark ? logoLightUrl : logoDarkUrl;
  return (
    <img
      src={src}
      alt="Skema"
      height={height}
      style={{ height, width: 'auto', display: 'block' }}
    />
  );
};

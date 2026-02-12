// =============================================================================
// Settings Panel Component
// =============================================================================

import React from 'react';
import type { ExecutionMode, ProviderName, ProviderStatus } from '../../hooks/useDaemon';

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
              via the Skema MCP server. No CLI tools needed -- your agent handles the generation.
            </div>
          </div>
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
            <ProviderStatusRow
              providerStatus={providerStatus}
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
// Provider Status Row
// =============================================================================

interface ProviderStatusRowProps {
  providerStatus: Record<ProviderName, ProviderStatus>;
  isDark: boolean;
  mutedColor: string;
}

const ProviderStatusRow: React.FC<ProviderStatusRowProps> = ({ providerStatus, isDark, mutedColor }) => {
  const providers: ProviderName[] = ['gemini', 'claude'];

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        marginTop: -6,
        marginBottom: 12,
      }}
    >
      {providers.map((name) => {
        const status = providerStatus[name];
        const label = name === 'gemini' ? 'Gemini' : 'Claude';

        let dotColor: string;
        let statusText: string;

        if (!status || status.message === 'Checking...') {
          dotColor = mutedColor;
          statusText = 'Checking...';
        } else if (status.installed && status.authorized) {
          dotColor = '#10b981'; // green
          statusText = 'Ready';
        } else if (status.installed && !status.authorized) {
          dotColor = '#f59e0b'; // amber
          statusText = 'Not authorized';
        } else {
          dotColor = '#ef4444'; // red
          statusText = 'Not installed';
        }

        return (
          <div
            key={name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              color: mutedColor,
              padding: '4px 8px',
              borderRadius: 6,
              backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
              flex: 1,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: dotColor,
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 500 }}>{label}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.8 }}>{statusText}</span>
          </div>
        );
      })}
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
// Skema Wordmark Logo (Icon + "Skema" text)
// =============================================================================

interface SkemaWordmarkProps {
  isDark: boolean;
  height?: number;
}

const SkemaWordmark: React.FC<SkemaWordmarkProps> = ({ isDark, height = 24 }) => {
  const textColor = isDark ? '#FFFCFC' : '#1a1a1a';
  // Original viewBox spans from x=0 to ~938 and y=0 to ~162 (icon area)
  // Icon is roughly 0-166 wide, text "Skema" is roughly 378-938 wide, 168-300 tall
  // We'll compose them in a single SVG
  return (
    <svg height={height} viewBox="0 0 740 162" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Orange star burst background */}
      <path
        d="M77.0782 5.17419C80.4699 2.21068 85.5301 2.21067 88.9218 5.17419L109.929 23.529C111.161 24.6057 112.663 25.3261 114.274 25.6126L141.769 30.5023C146.225 31.2947 149.399 35.2725 149.183 39.7929L147.86 67.4755C147.782 69.1226 148.157 70.7596 148.945 72.2079L162.203 96.5644C164.372 100.55 163.236 105.527 159.551 108.175L136.957 124.416C135.623 125.375 134.577 126.681 133.932 128.193L123.03 153.753C121.26 157.902 116.692 160.1 112.346 158.894L85.4054 151.422C83.8315 150.985 82.1685 150.985 80.5946 151.422L53.6541 158.894C49.3075 160.1 44.7399 157.902 42.9702 153.753L32.0681 128.193C31.4234 126.681 30.3771 125.375 29.0427 124.416L6.4487 108.175C2.76426 105.527 1.62755 100.55 3.79688 96.5644L17.0547 72.2079C17.8431 70.7596 18.2184 69.1226 18.1397 67.4755L16.8169 39.7929C16.6009 35.2725 19.7752 31.2947 24.2308 30.5023L51.7255 25.6126C53.3366 25.3261 54.8392 24.6057 56.0714 23.529L77.0782 5.17419Z"
        fill="#FF6800"
      />
      {/* White S letter */}
      <path
        d="M65.0888 64.1092C65.0888 68.461 73.1316 69.0511 83.5428 69.7887C102.046 71.1901 128.049 73.1078 128 97.9645C128 126.288 106.289 133 83 133C59.7599 132.926 40.4672 128.722 38.0001 97.9645H65.0888C68.0494 105.635 74.9079 107.627 83 107.627C91.0428 107.627 100.911 105.635 100.911 97.9645C100.911 93.6128 92.8684 92.9489 82.4572 92.2113C63.954 90.8099 37.9507 88.8922 38.0001 64.1092C38.0001 35.7858 59.7106 29 83 29C106.24 29.2213 125.533 33.1305 128 64.1092H100.911C97.9506 56.2908 91.0921 54.4468 83 54.4468C74.9572 54.4468 65.0888 56.217 65.0888 64.1092Z"
        fill="white"
      />
      {/* "S" */}
      <path
        d="M217.117 131.531C188.919 131.531 172.881 115.503 172.881 86.245V85.482H191.915V87.517C191.915 104.054 198.788 109.397 217.117 109.397C234.212 109.397 239.323 104.309 239.323 93.114C239.323 82.684 235.093 79.376 222.58 76.832L198.612 72.253C182.046 69.2 172 59.023 172 37.907C172 15.773 185.923 0 212.887 0C239.675 0 255.889 15.519 255.889 45.54V46.303H237.032V44.776C237.032 29.766 231.745 21.879 212.358 21.879C196.321 21.879 190.681 26.968 190.681 38.925C190.681 48.847 194.206 52.409 207.424 54.953L227.691 59.023C248.487 62.84 258.004 73.016 258.004 93.878C258.004 117.538 241.79 131.531 217.117 131.531Z"
        fill={textColor}
      />
      {/* "k" */}
      <path
        d="M290.771 128.986H271.737L271.737 2.544H290.771L290.771 52.663H315.796L342.056 2.544H364.262L331.305 63.348L364.085 128.986H341.703L315.796 77.341H290.771V128.986Z"
        fill={textColor}
      />
      {/* "e" */}
      <path
        d="M417.684 131.531C388.957 131.531 370.1 108.125 370.1 65.892C370.1 26.459 388.781 0 417.331 0C444.472 0 462.977 21.625 462.977 60.041C462.977 64.62 462.801 68.182 462.272 71.998H387.9C388.605 96.422 396.888 109.397 417.155 109.397C435.484 109.397 443.062 100.747 443.062 85.737V83.701H462.096V85.991C462.096 112.959 443.767 131.531 417.684 131.531ZM416.979 21.625C397.593 21.625 389.133 34.091 388.076 56.734H445.001V56.225C445.001 32.819 435.66 21.625 416.979 21.625Z"
        fill={textColor}
      />
      {/* "m" */}
      <path
        d="M496.267 128.986H477.233V2.544H494.68V40.706H495.738C498.029 19.59 507.546 0 529.399 0C549.314 0 560.065 17.554 562.532 41.723H563.589C565.881 20.098 575.75 0 597.956 0C620.691 0 632.146 22.388 632.146 52.918V128.986H613.289V60.295C613.289 35.363 606.415 24.678 589.496 24.678C570.815 24.678 564.118 38.416 564.118 66.401V128.986H545.261V60.295C545.261 35.363 538.564 24.678 521.645 24.678C502.787 24.678 496.267 38.416 496.267 66.401V128.986Z"
        fill={textColor}
      />
      {/* "a" */}
      <path
        d="M674.899 131.531C656.746 131.531 645.291 119.319 645.291 98.457C645.291 78.867 656.218 68.691 673.489 65.892L713.319 59.787V52.409C713.319 31.547 706.974 24.169 690.232 24.169C674.018 24.169 666.087 31.801 666.087 50.373V51.391H647.23V50.373C647.23 21.625 663.796 0 691.642 0C719.487 0 732 21.879 732 52.154V128.986H714.552V97.439H713.319C708.737 118.81 694.814 131.531 674.899 131.531ZM664.325 96.676C664.325 106.853 669.083 111.687 680.01 111.687C699.925 111.687 713.319 101.001 713.319 76.069L678.952 81.666C669.083 83.447 664.325 86.754 664.325 96.676Z"
        fill={textColor}
      />
    </svg>
  );
};

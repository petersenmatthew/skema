// =============================================================================
// Settings Panel Component
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import type { ExecutionMode, ProviderName, ProviderStatus, AnnotationCounts, VisionModelsResult } from '../../hooks/useDaemon';
import {
  getStoredVisionApiKey,
  setStoredVisionApiKey,
  getStoredVisionProvider,
  setStoredVisionProvider,
  getStoredVisionModel,
  setStoredVisionModel,
  type VisionProviderName,
} from '../../lib/settingsStorage';
import logoDarkUrl from '../../assets/logo-dark';
import logoLightUrl from '../../assets/logo-light';

// Package version - imported at build time
const SKEMA_VERSION = '0.2.0';

// Vision providers, keyed by how their API keys start
const PROVIDER_ORDER: VisionProviderName[] = ['gemini', 'claude', 'openai'];
const PROVIDER_LABELS: Record<VisionProviderName, string> = { gemini: 'Google', claude: 'Anthropic', openai: 'OpenAI' };
const PROVIDER_ENV_VARS: Record<VisionProviderName, string> = { gemini: 'GEMINI_API_KEY', claude: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY' };

function detectKeyProvider(key: string): VisionProviderName | null {
  if (key.startsWith('sk-ant-')) return 'claude';
  if (key.startsWith('AIza')) return 'gemini';
  if (key.startsWith('sk-')) return 'openai';
  return null;
}

function maskKey(key: string): string {
  return key.slice(0, key.startsWith('sk-ant-') ? 7 : 4) + '...' + key.slice(-4);
}

function loadStoredKeys(): Record<VisionProviderName, string | null> {
  return { gemini: getStoredVisionApiKey('gemini'), claude: getStoredVisionApiKey('claude'), openai: getStoredVisionApiKey('openai') };
}

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
  mcpClientName: string | null;
  annotationCounts: AnnotationCounts;
  // Actions
  onModeChange: (mode: ExecutionMode) => Promise<boolean>;
  onProviderChange: (provider: ProviderName) => Promise<boolean>;
  onListVisionModels: (keys: Partial<Record<VisionProviderName, string>>) => Promise<VisionModelsResult | null>;
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
  mcpClientName,
  annotationCounts,
  onModeChange,
  onProviderChange,
  onListVisionModels,
  theme,
  onThemeChange,
}) => {
  const [visionProvider, setVisionProvider] = useState<VisionProviderName>('gemini');
  const [visionModel, setVisionModel] = useState('');
  const [apiKeys, setApiKeys] = useState<Record<VisionProviderName, string | null>>({ gemini: null, claude: null, openai: null });
  const [keyDraft, setKeyDraft] = useState('');
  const [visionModels, setVisionModels] = useState<VisionModelsResult | null>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setVisionProvider(getStoredVisionProvider());
      setVisionModel(getStoredVisionModel() || '');
      setApiKeys(loadStoredKeys());
    }
  }, [isOpen]);

  // Refresh the live model lists whenever the keys change
  useEffect(() => {
    if (!isOpen || !connected) return;
    let cancelled = false;
    const keys = Object.fromEntries(Object.entries(apiKeys).filter(([, k]) => k)) as Partial<Record<VisionProviderName, string>>;
    onListVisionModels(keys).then((result) => {
      if (!cancelled && result) setVisionModels(result);
    });
    return () => { cancelled = true; };
  }, [isOpen, connected, apiKeys, onListVisionModels]);

  const saveKey = (raw: string): boolean => {
    const key = raw.trim();
    const keyProvider = detectKeyProvider(key);
    if (!keyProvider || key.length < 20) return false;
    setStoredVisionApiKey(keyProvider, key);
    setApiKeys((prev) => ({ ...prev, [keyProvider]: key }));
    setKeyDraft('');
    return true;
  };

  const removeKey = (keyProvider: VisionProviderName) => {
    setStoredVisionApiKey(keyProvider, '');
    setApiKeys((prev) => ({ ...prev, [keyProvider]: null }));
  };

  const selectModel = (modelProvider: VisionProviderName, model: string) => {
    setVisionProvider(modelProvider);
    setStoredVisionProvider(modelProvider);
    setVisionModel(model);
    setStoredVisionModel(model);
  };

  const draftProvider = detectKeyProvider(keyDraft.trim());
  const hasAnyKey = PROVIDER_ORDER.some((p) => apiKeys[p] || visionModels?.providers[p]?.keySource === 'env');

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

        {/* API keys (for drawing analysis) */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, color: textColor, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            API keys
            <InfoTooltip
              text="Used to analyze your drawings. Paste a Google, Anthropic, or OpenAI key."
              isDark={isDark}
              mutedColor={mutedColor}
            />
          </div>
          {PROVIDER_ORDER.map((p) => {
            const key = apiKeys[p];
            if (!key && visionModels?.providers[p]?.keySource !== 'env') return null;
            return (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <ProviderBadge label={PROVIDER_LABELS[p]} isDark={isDark} />
                <span style={{ flex: 1, color: mutedColor, fontFamily: 'monospace', fontSize: 11 }}>
                  {key ? maskKey(key) : 'from ' + PROVIDER_ENV_VARS[p]}
                </span>
                {visionModels?.providers[p]?.error && (
                  <span title={visionModels.providers[p].error} style={{ fontSize: 10.5, color: '#ef4444' }}>
                    Rejected
                  </span>
                )}
                {key && (
                  <button
                    type="button"
                    onClick={() => removeKey(p)}
                    title="Remove key"
                    style={{ display: 'flex', padding: 3, border: 'none', borderRadius: 4, background: 'transparent', color: mutedColor, cursor: 'pointer' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="6" y1="6" x2="18" y2="18" />
                      <line x1="18" y1="6" x2="6" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
          <div style={{ position: 'relative', marginTop: 6 }}>
            <input
              ref={keyInputRef}
              type="password"
              placeholder="Paste an API key"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              onPaste={(e) => {
                if (saveKey(e.clipboardData.getData('text'))) e.preventDefault();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveKey(keyDraft);
              }}
              onBlur={() => saveKey(keyDraft)}
              autoComplete="off"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 90px 8px 10px',
                fontSize: 12,
                fontFamily: 'monospace',
                border: '1px solid ' + borderColor,
                borderRadius: 8,
                backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                color: textColor,
                outline: 'none',
              }}
            />
            {keyDraft.trim() && (
              <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}>
                <ProviderBadge label={draftProvider ? PROVIDER_LABELS[draftProvider] : 'Unknown key'} isDark={isDark} warn={!draftProvider} />
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: keyDraft.trim() && !draftProvider ? '#ef4444' : mutedColor, marginTop: 4, lineHeight: 1.3 }}>
            {keyDraft.trim() && !draftProvider ? (
              'Keys start with AIza (Google), sk-ant- (Anthropic), or sk- (OpenAI).'
            ) : (
              <>
                Stored in this browser only.
                {!hasAnyKey && (
                  <>
                    {' '}Get a free key at{' '}
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: isDark ? '#93c5fd' : '#2563eb' }}>
                      Google AI Studio
                    </a>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Vision model (menu opens upward because the panel sits at the bottom of the screen) */}
        <SettingRow label="Vision model" isDark={isDark} textColor={textColor} mutedColor={mutedColor}>
          <ModelMenu
            visionModels={visionModels}
            provider={visionProvider}
            model={visionModel}
            connected={connected}
            onSelect={selectModel}
            onAddKey={() => keyInputRef.current?.focus()}
            isDark={isDark}
          />
        </SettingRow>

        {/* Disconnected Banner */}
        {!connected && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 10,
              backgroundColor: isDark ? '#2a1a1a' : '#fef2f2',
              border: `1px solid ${isDark ? '#3d2020' : '#fecaca'}`,
              marginBottom: 12,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                flexShrink: 0,
                boxShadow: '0 0 6px #ef444460',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: isDark ? '#fca5a5' : '#dc2626' }}>
                Daemon not running
              </div>
              <div style={{ fontSize: 10, color: isDark ? '#888' : '#999', marginTop: 2, lineHeight: 1.3 }}>
                Run <span style={{ fontFamily: 'monospace', fontSize: 10, color: isDark ? '#aaa' : '#666' }}>npx skema-core</span> to start
              </div>
            </div>
          </div>
        )}

        {/* Mode Toggle: CLI vs MCP */}
        <SettingRow label="Mode" isDark={isDark} textColor={textColor} mutedColor={mutedColor} disabled={!connected}>
          <ToggleSwitch
            options={['CLI', 'MCP']}
            value={mode === 'mcp' ? 1 : 0}
            onChange={(idx) => onModeChange(idx === 1 ? 'mcp' : 'direct-cli')}
            isDark={isDark}
            disabled={!connected}
          />
        </SettingRow>

        {/* Mode description */}
        <div style={{ fontSize: 11, color: mutedColor, marginTop: -6, marginBottom: 12, lineHeight: 1.4, opacity: connected ? 1 : 0.4 }}>
          {mode === 'mcp'
            ? 'Annotations are queued for your AI agent to process'
            : 'Annotations processed instantly via CLI agents'}
        </div>

        {/* MCP Status Panel */}
        {mode === 'mcp' && connected && (
          <McpStatusPanel
            mcpServerConnected={mcpServerConnected}
            mcpClientName={mcpClientName}
            annotationCounts={annotationCounts}
            isDark={isDark}
            mutedColor={mutedColor}
          />
        )}

        {/* CLI Provider Toggle (only in CLI mode) */}
        {mode === 'direct-cli' && (
          <>
            <SettingRow label="Provider" isDark={isDark} textColor={textColor} mutedColor={mutedColor} disabled={!connected}>
              <ToggleSwitch
                options={['Gemini', 'Claude']}
                value={provider === 'claude' ? 1 : 0}
                onChange={(idx) => onProviderChange(idx === 1 ? 'claude' : 'gemini')}
                isDark={isDark}
                disabled={!connected}
              />
            </SettingRow>
            {connected && (
              <ProviderStatusIndicator
                provider={provider as ProviderName}
                status={providerStatus[provider as ProviderName]}
                isDark={isDark}
                mutedColor={mutedColor}
              />
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

// =============================================================================
// Provider Badge and Icon
// =============================================================================

const ProviderBadge: React.FC<{ label: string; isDark: boolean; warn?: boolean }> = ({ label, isDark, warn }) => (
  <span
    style={{
      fontSize: 10.5,
      padding: '2px 7px',
      borderRadius: 5,
      flexShrink: 0,
      backgroundColor: warn ? '#ef444420' : isDark ? '#93c5fd1f' : '#2563eb14',
      color: warn ? '#ef4444' : isDark ? '#93c5fd' : '#2563eb',
    }}
  >
    {label}
  </span>
);

const ProviderIcon: React.FC<{ provider: VisionProviderName }> = ({ provider }) => {
  if (provider === 'gemini') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2c.6 5.3 4.7 9.4 10 10-5.3.6-9.4 4.7-10 10-.6-5.3-4.7-9.4-10-10 5.3-.6 9.4-4.7 10-10z" />
      </svg>
    );
  }
  if (provider === 'claude') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
};

// =============================================================================
// Model Menu
// =============================================================================

interface ModelMenuProps {
  visionModels: VisionModelsResult | null;
  provider: VisionProviderName;
  model: string;
  connected: boolean;
  onSelect: (provider: VisionProviderName, model: string) => void;
  onAddKey: () => void;
  isDark: boolean;
}

const ModelMenu: React.FC<ModelMenuProps> = ({ visionModels, provider, model, connected, onSelect, onAddKey, isDark }) => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const currentId = model || visionModels?.defaults[provider] || '';
  const currentName = visionModels?.providers[provider]?.models.find((m) => m.id === currentId)?.name || currentId || 'Default';
  const q = query.trim().toLowerCase();
  const groups = PROVIDER_ORDER.map((p) => ({
    provider: p,
    models: (visionModels?.providers[p]?.models ?? []).filter((m) => !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)),
  })).filter((g) => g.models.length > 0);

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const choose = (p: VisionProviderName, id: string) => {
    onSelect(p, id);
    close();
  };

  const mutedColor = isDark ? '#8b8b8b' : '#777777';
  const divider = <div style={{ height: 1, margin: '5px 6px', backgroundColor: isDark ? '#383838' : '#e5e5e5' }} />;
  const emptyText = !connected ? 'Daemon not running' : visionModels ? 'Add an API key to see models' : 'Loading models...';

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 8px',
          marginRight: -8,
          border: 'none',
          borderRadius: 999,
          backgroundColor: open || hovered ? (isDark ? '#2a2a2a' : '#f0f0f0') : 'transparent',
          color: isDark ? '#d0d0d0' : '#333333',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        <ProviderIcon provider={provider} />
        <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentName}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mutedColor} strokeWidth="2.4">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: -8,
            bottom: 'calc(100% + 6px)',
            width: 240,
            padding: 6,
            borderRadius: 14,
            backgroundColor: isDark ? 'rgba(40,40,40,0.96)' : 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(18px)',
            border: '1px solid ' + (isDark ? '#3a3a3a' : '#e0e0e0'),
            boxShadow: '0 18px 44px rgba(0,0,0,0.35)',
            zIndex: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={mutedColor} strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.5" y2="16.5" />
            </svg>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') close();
                if (e.key === 'Enter') {
                  if (groups[0]) choose(groups[0].provider, groups[0].models[0].id);
                  else if (q) choose(provider, query.trim());
                }
              }}
              placeholder="Search models"
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: isDark ? '#ececec' : '#1a1a1a', fontSize: 13 }}
            />
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {groups.map((g, gi) => (
              <React.Fragment key={g.provider}>
                {gi > 0 && divider}
                {g.models.map((m) => (
                  <MenuItem key={m.id} isDark={isDark} onClick={() => choose(g.provider, m.id)}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                    {g.provider === provider && m.id === currentId && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" style={{ flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </MenuItem>
                ))}
              </React.Fragment>
            ))}
            {groups.length === 0 && q && (
              <MenuItem isDark={isDark} onClick={() => choose(provider, query.trim())}>
                <span>Use "{query.trim()}"</span>
              </MenuItem>
            )}
            {groups.length === 0 && !q && <div style={{ padding: '7px 8px', fontSize: 12, color: mutedColor }}>{emptyText}</div>}
          </div>
          {divider}
          <MenuItem
            isDark={isDark}
            onClick={() => {
              close();
              onAddKey();
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add API key
            </span>
          </MenuItem>
        </div>
      )}
    </div>
  );
};

const MenuItem: React.FC<{ isDark: boolean; onClick: () => void; children: React.ReactNode }> = ({ isDark, onClick, children }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        width: '100%',
        padding: '7px 8px',
        border: 'none',
        borderRadius: 8,
        backgroundColor: hovered ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)') : 'transparent',
        color: isDark ? '#ececec' : '#1a1a1a',
        fontSize: 13,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
};

// =============================================================================
// Info Tooltip
// =============================================================================


interface InfoTooltipProps {
  text: string;
  isDark: boolean;
  mutedColor: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, isDark, mutedColor }) => {
  const [show, setShow] = useState(false);

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        style={{ cursor: 'help', flexShrink: 0 }}
      >
        <circle cx="8" cy="8" r="7" stroke={mutedColor} strokeWidth="1.5" />
        <text
          x="8"
          y="12"
          textAnchor="middle"
          fill={mutedColor}
          fontSize="11"
          fontWeight="600"
          fontStyle="italic"
          fontFamily='Georgia, "Times New Roman", serif'
        >
          i
        </text>
      </svg>
      {show && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 8,
            width: 240,
            padding: '10px 12px',
            borderRadius: 10,
            backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
            border: `1px solid ${isDark ? '#444' : '#e0e0e0'}`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            fontSize: 11,
            lineHeight: 1.5,
            color: isDark ? '#ccc' : '#444',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
};

// =============================================================================
// Setting Row
// =============================================================================

interface SettingRowProps {
  label: string;
  isDark: boolean;
  textColor: string;
  mutedColor: string;
  disabled?: boolean;
  children: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, textColor, disabled, children }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    }}
  >
    <span style={{ fontSize: 14, color: textColor, opacity: disabled ? 0.4 : 1, transition: 'opacity 0.2s ease' }}>{label}</span>
    {children}
  </div>
);

interface ToggleSwitchProps {
  options: [string, string];
  value: number;
  onChange: (index: number) => void;
  isDark: boolean;
  disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ options, value, onChange, isDark, disabled }) => {
  const bgColor = isDark ? '#2a2a2a' : '#f0f0f0';
  const activeColor = disabled ? (isDark ? '#555' : '#aaa') : '#FF6800';

  return (
    <div
      style={{
        display: 'flex',
        backgroundColor: bgColor,
        borderRadius: 8,
        padding: 2,
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      {options.map((option, idx) => (
        <button
          key={option}
          onClick={() => !disabled && onChange(idx)}
          disabled={disabled}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 500,
            border: 'none',
            borderRadius: 6,
            cursor: disabled ? 'not-allowed' : 'pointer',
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
// MCP Client Name Formatting
// =============================================================================

const CLIENT_NAME_MAP: Record<string, string> = {
  'cursor': 'Cursor',
  'claude-desktop': 'Claude Desktop',
  'claude-code': 'Claude Code',
  'windsurf': 'Windsurf',
  'cline': 'Cline',
  'continue': 'Continue',
  'zed': 'Zed',
  'anti-gravity': 'Anti-Gravity',
};

function formatClientName(name: string): string {
  const lower = name.toLowerCase();
  return CLIENT_NAME_MAP[lower] || name.charAt(0).toUpperCase() + name.slice(1);
}

// =============================================================================
// MCP Status Panel
// =============================================================================

interface McpStatusPanelProps {
  mcpServerConnected: boolean;
  mcpClientName: string | null;
  annotationCounts: AnnotationCounts;
  isDark: boolean;
  mutedColor: string;
}

const McpStatusPanel: React.FC<McpStatusPanelProps> = ({
  mcpServerConnected,
  mcpClientName,
  annotationCounts,
  isDark,
  mutedColor,
}) => {
  const serverDotColor = mcpServerConnected ? '#10b981' : '#ef4444';
  const serverStatusText = mcpServerConnected
    ? mcpClientName ? formatClientName(mcpClientName) : 'Connected'
    : 'Not detected';
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

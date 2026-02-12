// =============================================================================
// Annotation Popup Component
// =============================================================================
// A popup that appears when selecting DOM elements or drawings, allowing users
// to add comments to their annotations. Matches Skema's white floating card
// design language with playful geometric accent shapes.

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';

// =============================================================================
// Types
// =============================================================================

export interface AnnotationPopupProps {
  /** Element name/description to display in header */
  element: string;
  /** Optional selected/highlighted text */
  selectedText?: string;
  /** Placeholder text for the textarea */
  placeholder?: string;
  /** Initial value for textarea (for edit mode) */
  initialValue?: string;
  /** Label for submit button (default: "Add") */
  submitLabel?: string;
  /** Called when annotation is submitted with text */
  onSubmit: (text: string) => void;
  /** Called when popup is cancelled/dismissed */
  onCancel: () => void;
  /** Position styles (left, top) */
  style?: React.CSSProperties;
  /** Custom accent color (hex) */
  accentColor?: string;
  /** External exit state (parent controls exit animation) */
  isExiting?: boolean;
  /** Whether this is a multi-select annotation */
  isMultiSelect?: boolean;
}

export interface AnnotationPopupHandle {
  /** Shake the popup (e.g., when user clicks outside) */
  shake: () => void;
}

// =============================================================================
// Geometric Accent Shape
// =============================================================================

/** Small decorative shape that indicates annotation type via color */
const AccentShape: React.FC<{ color: string; isMultiSelect: boolean }> = ({ color, isMultiSelect }) => {
  // Green (#34C759) = multi-select → square
  // Purple (#8B5CF6) = drawing → star
  // Blue (#3b82f6) = single DOM → circle (default)
  const isDrawing = color === '#8B5CF6';

  if (isMultiSelect && !isDrawing) {
    // Green square for multi-select
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
        <rect x="1" y="1" width="8" height="8" rx="1.5" fill={color} />
      </svg>
    );
  }

  if (isDrawing) {
    // Star for drawing annotations
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
        <path
          d="M6 1L7.4 4.2L10.8 4.6L8.2 7L8.9 10.4L6 8.7L3.1 10.4L3.8 7L1.2 4.6L4.6 4.2L6 1Z"
          fill={color}
        />
      </svg>
    );
  }

  // Circle for single DOM selection
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
      <circle cx="5" cy="5" r="4" fill={color} />
    </svg>
  );
};

// =============================================================================
// Styles — White floating card matching Skema toolbar aesthetic
// =============================================================================

const styles = {
  popup: {
    position: 'fixed' as const,
    transform: 'translateX(-50%)',
    width: 280,
    padding: '14px 16px 14px',
    background: '#FFFFFF',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)',
    cursor: 'default',
    zIndex: 100001,
    fontFamily: '"Clash Display", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    opacity: 0,
    transition: 'opacity 0.2s ease, transform 0.2s ease',
  },
  popupEnter: {
    opacity: 1,
    transform: 'translateX(-50%) scale(1) translateY(0)',
  },
  popupExit: {
    opacity: 0,
    transform: 'translateX(-50%) scale(0.96) translateY(4px)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  element: {
    fontSize: 12,
    fontWeight: 500,
    color: '#9CA3AF',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    flex: 1,
    letterSpacing: '0.01em',
  },
  quote: {
    fontSize: 12,
    fontStyle: 'italic' as const,
    color: '#6B7280',
    marginBottom: 8,
    padding: '6px 9px',
    background: '#F9FAFB',
    borderRadius: 6,
    lineHeight: 1.45,
    borderLeft: '2px solid',
  },
  textarea: {
    width: '100%',
    padding: '9px 11px',
    fontSize: 13,
    fontFamily: 'inherit',
    background: '#F9FAFB',
    color: '#1a1a1a',
    border: '1px solid #E5E7EB',
    borderRadius: 10,
    resize: 'none' as const,
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    boxSizing: 'border-box' as const,
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  hint: {
    fontSize: 11,
    color: '#C0C5CE',
    fontWeight: 400,
    letterSpacing: '0.01em',
    userSelect: 'none' as const,
  },
  buttonGroup: {
    display: 'flex',
    gap: 6,
  },
  button: {
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 16,
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease, transform 0.1s ease',
  },
  cancelButton: {
    background: 'transparent',
    color: '#9CA3AF',
  },
  submitButton: {
    color: 'white',
  },
};

// =============================================================================
// Component
// =============================================================================

export const AnnotationPopup = forwardRef<AnnotationPopupHandle, AnnotationPopupProps>(
  function AnnotationPopup(
    {
      element,
      selectedText,
      placeholder = 'Write your changes?',
      initialValue = '',
      submitLabel = 'Add',
      onSubmit,
      onCancel,
      style,
      accentColor = '#3c82f7',
      isExiting = false,
      isMultiSelect = false,
    },
    ref
  ) {
    const [text, setText] = useState(initialValue);
    const [isShaking, setIsShaking] = useState(false);
    const [animState, setAnimState] = useState<'initial' | 'enter' | 'entered' | 'exit'>('initial');
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    // Sync with parent exit state
    useEffect(() => {
      if (isExiting && animState !== 'exit') {
        setAnimState('exit');
      }
    }, [isExiting, animState]);

    // Animate in on mount and focus textarea
    useEffect(() => {
      // Start enter animation
      requestAnimationFrame(() => {
        setAnimState('enter');
      });
      // Transition to entered state after animation completes
      const enterTimer = setTimeout(() => {
        setAnimState('entered');
      }, 200);
      const focusTimer = setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
          textarea.scrollTop = textarea.scrollHeight;
        }
      }, 50);
      return () => {
        clearTimeout(enterTimer);
        clearTimeout(focusTimer);
      };
    }, []);

    // Shake animation
    const shake = useCallback(() => {
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
        textareaRef.current?.focus();
      }, 250);
    }, []);

    // Expose shake to parent via ref
    useImperativeHandle(ref, () => ({
      shake,
    }), [shake]);

    // Handle cancel with exit animation
    const handleCancel = useCallback(() => {
      setAnimState('exit');
      setTimeout(() => {
        onCancel();
      }, 150);
    }, [onCancel]);

    // Handle submit
    const handleSubmit = useCallback(() => {
      if (!text.trim()) return;
      onSubmit(text.trim());
    }, [text, onSubmit]);

    // Handle keyboard
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.nativeEvent as any).isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
        if (e.key === 'Escape') {
          handleCancel();
        }
      },
      [handleSubmit, handleCancel]
    );

    // Compute popup style based on animation state
    const popupStyle: React.CSSProperties = {
      ...styles.popup,
      ...(animState === 'enter' || animState === 'entered' ? styles.popupEnter : {}),
      ...(animState === 'exit' ? styles.popupExit : {}),
      ...(isShaking ? {
        animation: 'skema-shake 0.25s ease-out',
      } : {}),
      ...style,
    };

    // Multi-select uses green accent
    const effectiveAccentColor = isMultiSelect ? '#34C759' : accentColor;

    // Compute textarea style with accent-colored focus ring
    const textareaStyle: React.CSSProperties = {
      ...styles.textarea,
      ...(isFocused ? {
        borderColor: effectiveAccentColor,
        boxShadow: `0 0 0 2px ${effectiveAccentColor}18`,
      } : {}),
    };

    return (
      <>
        {/* Inject keyframe animation */}
        <style>{`
          @keyframes skema-shake {
            0%, 100% { transform: translateX(-50%) scale(1) translateY(0) translateX(0); }
            20% { transform: translateX(-50%) scale(1) translateY(0) translateX(-3px); }
            40% { transform: translateX(-50%) scale(1) translateY(0) translateX(3px); }
            60% { transform: translateX(-50%) scale(1) translateY(0) translateX(-2px); }
            80% { transform: translateX(-50%) scale(1) translateY(0) translateX(2px); }
          }
        `}</style>
        <div
          ref={popupRef}
          data-skema="annotation-popup"
          style={popupStyle}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Header with geometric accent shape */}
          <div style={styles.header}>
            <AccentShape color={effectiveAccentColor} isMultiSelect={isMultiSelect} />
            <span style={styles.element}>{element}</span>
          </div>

          {/* Quoted selected text */}
          {selectedText && (
            <div style={{ ...styles.quote, borderLeftColor: effectiveAccentColor }}>
              &ldquo;{selectedText.slice(0, 80)}
              {selectedText.length > 80 ? '...' : ''}&rdquo;
            </div>
          )}

          {/* Input area */}
          <textarea
            ref={textareaRef}
            style={textareaStyle}
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            rows={2}
            onKeyDown={handleKeyDown}
          />

          {/* Actions row */}
          <div style={styles.actions}>
            <span style={styles.hint}>
              <kbd style={{
                fontFamily: 'inherit',
                fontSize: 10,
                padding: '1px 4px',
                background: '#F3F4F6',
                borderRadius: 3,
                border: '1px solid #E5E7EB',
              }}>↵</kbd> to send
            </span>
            <div style={styles.buttonGroup}>
              <button
                style={{ ...styles.button, ...styles.cancelButton }}
                onClick={handleCancel}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#F3F4F6';
                  e.currentTarget.style.color = '#6B7280';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#9CA3AF';
                }}
              >
                Cancel
              </button>
              <button
                style={{
                  ...styles.button,
                  ...styles.submitButton,
                  backgroundColor: effectiveAccentColor,
                  opacity: text.trim() ? 1 : 0.4,
                }}
                onClick={handleSubmit}
                disabled={!text.trim()}
                onMouseEnter={(e) => {
                  if (text.trim()) {
                    e.currentTarget.style.filter = 'brightness(0.92)';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'none';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {submitLabel}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }
);

export default AnnotationPopup;

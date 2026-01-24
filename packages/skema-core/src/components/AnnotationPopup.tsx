// =============================================================================
// Annotation Popup Component
// =============================================================================
// A popup that appears when selecting DOM elements or drawings, allowing users
// to add comments to their annotations. Inspired by agentation's implementation.

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
// Styles
// =============================================================================

const styles = {
  popup: {
    position: 'fixed' as const,
    transform: 'translateX(-50%)',
    width: 280,
    padding: '12px 16px 14px',
    background: '#1a1a1a',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.08)',
    cursor: 'default',
    zIndex: 100001,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    opacity: 0,
    transition: 'opacity 0.2s ease, transform 0.2s ease',
  },
  popupEnter: {
    opacity: 1,
    transform: 'translateX(-50%) scale(1) translateY(0)',
  },
  popupExit: {
    opacity: 0,
    transform: 'translateX(-50%) scale(0.95) translateY(4px)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  element: {
    fontSize: 12,
    fontWeight: 400,
    color: 'rgba(255, 255, 255, 0.5)',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    flex: 1,
  },
  quote: {
    fontSize: 12,
    fontStyle: 'italic' as const,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
    padding: '6px 8px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    lineHeight: 1.45,
  },
  textarea: {
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
    fontFamily: 'inherit',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#fff',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    resize: 'none' as const,
    outline: 'none',
    transition: 'border-color 0.15s ease',
    boxSizing: 'border-box' as const,
  },
  textareaFocused: {
    borderColor: '#3c82f7',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 8,
  },
  button: {
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 16,
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease',
  },
  cancelButton: {
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.5)',
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
      placeholder = 'What should change?',
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

    // Compute textarea style
    const textareaStyle: React.CSSProperties = {
      ...styles.textarea,
      ...(isFocused ? { borderColor: accentColor } : {}),
    };

    // Multi-select uses green accent
    const effectiveAccentColor = isMultiSelect ? '#34C759' : accentColor;

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
          <div style={styles.header}>
            <span style={styles.element}>{element}</span>
          </div>

          {selectedText && (
            <div style={styles.quote}>
              &ldquo;{selectedText.slice(0, 80)}
              {selectedText.length > 80 ? '...' : ''}&rdquo;
            </div>
          )}

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

          <div style={styles.actions}>
            <button
              style={{ ...styles.button, ...styles.cancelButton }}
              onClick={handleCancel}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
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
                  e.currentTarget.style.filter = 'brightness(0.9)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none';
              }}
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </>
    );
  }
);

export default AnnotationPopup;

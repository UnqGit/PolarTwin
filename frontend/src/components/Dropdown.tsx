import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: React.ReactNode;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  onManage?: () => void;
}

export function Dropdown({ value, onChange, options, placeholder = 'Select...', disabled = false, style, onManage }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        minWidth: 200,
        opacity: disabled ? 0.5 : 1,
        ...style
      }}
    >
      {/* Trigger */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          background: 'var(--bg-input)',
          color: 'var(--text-primary)',
          border: `1px solid ${isOpen ? 'var(--accent-primary)' : 'var(--border-color)'}`,
          padding: '7px 12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          boxSizing: 'border-box',
          userSelect: 'none',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          boxShadow: isOpen ? '0 0 0 3px rgba(99,219,188,0.1)' : 'none',
        }}
      >
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: selectedOption ? 'var(--text-primary)' : 'var(--text-tertiary)'
        }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          style={{
            flexShrink: 0,
            color: 'var(--text-tertiary)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          background: 'var(--bg-panel-solid)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg), 0 0 0 1px rgba(99,219,188,0.04)',
          zIndex: 200,
          overflow: 'hidden',
          animation: 'slideInDown 0.18s ease forwards',
        }}>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {/* Clear/placeholder item */}
            {placeholder && (
              <div
                onClick={() => { onChange(''); setIsOpen(false); }}
                style={{
                  padding: '9px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  borderBottom: '1px solid var(--border-color)',
                  userSelect: 'none',
                  transition: 'background 0.12s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {placeholder}
              </div>
            )}

            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  style={{
                    padding: '9px 12px',
                    fontSize: 13,
                    cursor: 'pointer',
                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                    background: isSelected ? 'rgba(99,219,188,0.07)' : 'transparent',
                    userSelect: 'none',
                    transition: 'background 0.12s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                  {isSelected && <Check size={13} style={{ flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>

          {onManage && (
            <div
              onClick={() => { setIsOpen(false); onManage(); }}
              style={{
                padding: '9px 12px',
                fontSize: 13,
                cursor: 'pointer',
                color: 'var(--accent-primary)',
                borderTop: '1px solid var(--border-color)',
                textAlign: 'center',
                userSelect: 'none',
                fontWeight: 600,
                transition: 'background 0.12s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,219,188,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Manage...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

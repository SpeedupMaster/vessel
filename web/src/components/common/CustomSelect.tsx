import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CaretDown, Check } from '@phosphor-icons/react';

export interface SelectOption {
  value: string;
  label: string;
  badge?: string;
  description?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  size?: 'sm' | 'md';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '请选择...',
  disabled = false,
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === 'Escape') {
        setIsOpen(false);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }
      if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        setIsOpen(true);
        return;
      }
      if (isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const currentIndex = options.findIndex((opt) => opt.value === value);
        let nextIndex = currentIndex;
        if (e.key === 'ArrowDown') {
          nextIndex = (currentIndex + 1) % options.length;
        } else {
          nextIndex = (currentIndex - 1 + options.length) % options.length;
        }
        if (options[nextIndex]) {
          onChange(options[nextIndex].value);
        }
      }
    },
    [disabled, isOpen, onChange, options, value]
  );

  const paddingClass = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs';

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full bg-paper border rounded-lg flex items-center justify-between gap-2 text-left font-medium transition-colors shadow-subtle cursor-pointer focus:outline-none ${
          isOpen ? 'border-accent ring-0' : 'border-line hover:border-line-focus hover:bg-paper-2/60'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-paper-2' : ''} ${paddingClass} ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption?.icon && (
            <span className="flex-shrink-0 text-ink-muted">{selectedOption.icon}</span>
          )}
          <span
            className={`truncate ${
              selectedOption ? 'text-ink font-medium' : 'text-ink-faint'
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-3 text-ink-muted border border-line flex-shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </div>

        <CaretDown
          className={`w-3.5 h-3.5 text-ink-muted flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-accent' : ''
          }`}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div
          ref={listboxRef}
          role="listbox"
          tabIndex={-1}
          className={`absolute left-0 right-0 top-full mt-1.5 z-50 bg-paper border border-line rounded-xl shadow-floating py-1 max-h-56 overflow-y-auto ${dropdownClassName}`}
        >
          {options.length === 0 ? (
            <div className="px-3.5 py-2.5 text-xs text-ink-muted text-center">
              暂无可选选项
            </div>
          ) : (
            <div className="px-1 space-y-0.5">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full px-2.5 py-2 text-xs rounded-lg flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-accent/10 text-accent font-semibold'
                        : 'text-ink-muted hover:text-ink hover:bg-paper-2'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {opt.icon && (
                        <span className={`flex-shrink-0 ${isSelected ? 'text-accent' : 'text-ink-muted'}`}>
                          {opt.icon}
                        </span>
                      )}
                      <div className="truncate">
                        <div className="truncate">{opt.label}</div>
                        {opt.description && (
                          <div className="text-[11px] text-ink-faint font-normal truncate mt-0.5">
                            {opt.description}
                          </div>
                        )}
                      </div>
                      {opt.badge && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-3 text-ink-muted border border-line flex-shrink-0">
                          {opt.badge}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-accent flex-shrink-0" weight="bold" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

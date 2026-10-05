import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CaretDown, Check } from '@phosphor-icons/react';

export interface SelectOption<T = string | number> {
  value: T;
  label: string;
  badge?: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps<T = string | number> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'default' | 'pill' | 'ghost';
  labelPrefix?: React.ReactNode;
  align?: 'left' | 'right';
  menuWidth?: 'auto' | 'full' | 'trigger' | string;
}

export function CustomSelect<T extends string | number = string>({
  value,
  onChange,
  options,
  placeholder = '请选择...',
  disabled = false,
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  size = 'md',
  variant = 'default',
  labelPrefix,
  align = 'left',
  menuWidth = 'auto',
}: CustomSelectProps<T>) {
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

  const isPill = variant === 'pill';
  const isGhost = variant === 'ghost';

  // Sizing for default variant
  const sizeClasses = {
    xs: 'px-2 py-1 text-[11px]',
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-xs',
  }[size];

  // Base Trigger classes
  let triggerClasses = '';
  if (isPill) {
    triggerClasses = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-subtle cursor-pointer select-none focus:outline-none ${
      isOpen
        ? 'bg-paper-3 dark:bg-paper-4 border-accent ring-1 ring-accent/20'
        : 'bg-paper-3/70 hover:bg-paper-3 dark:bg-paper-3/40 dark:hover:bg-paper-3/70 border-line dark:border-white/10'
    } ${disabled ? 'opacity-50 cursor-not-allowed bg-paper-2' : ''} ${buttonClassName}`;
  } else if (isGhost) {
    triggerClasses = `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer select-none focus:outline-none hover:bg-paper-3/80 ${
      isOpen ? 'bg-paper-3 text-accent' : 'text-ink-muted hover:text-ink'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${buttonClassName}`;
  } else {
    // Default form input mode
    triggerClasses = `w-full bg-paper dark:bg-paper-2/60 border rounded-lg flex items-center justify-between gap-2 text-left font-medium transition-colors shadow-subtle cursor-pointer focus:outline-none ${
      isOpen
        ? 'border-accent ring-1 ring-accent/20'
        : 'border-line dark:border-white/10 hover:border-line-focus hover:bg-paper-2/60'
    } ${disabled ? 'opacity-60 cursor-not-allowed bg-paper-2' : ''} ${sizeClasses} ${buttonClassName}`;
  }

  // Dropdown menu width & positioning
  const alignClass = align === 'right' ? 'right-0' : 'left-0';
  let widthClass = '';
  if (menuWidth === 'trigger') {
    widthClass = 'left-0 right-0';
  } else if (menuWidth === 'full') {
    widthClass = 'w-full';
  } else {
    widthClass = isPill || isGhost ? 'min-w-full w-max max-w-xs' : 'left-0 right-0';
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${isPill || isGhost ? 'inline-block' : 'w-full'} ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={triggerClasses}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {labelPrefix && (
            <span className="text-ink-muted text-[11px] font-normal select-none flex-shrink-0">
              {labelPrefix}
            </span>
          )}
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
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-3 dark:bg-white/[0.06] text-ink-muted border border-line dark:border-white/10 flex-shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </div>

        <CaretDown
          className={`w-3 h-3 text-ink-muted flex-shrink-0 transition-transform duration-200 ml-0.5 ${
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
          className={`absolute ${alignClass} ${widthClass} top-full mt-1.5 z-50 bg-paper/95 dark:bg-[#16161b]/95 backdrop-blur-xl border border-line dark:border-white/10 rounded-xl shadow-[0_12px_32px_-4px_rgba(0,0,0,0.36),0_0_0_1px_rgba(255,255,255,0.05)] py-1 max-h-60 overflow-y-auto animate-dropdown ${dropdownClassName}`}
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
                    key={String(opt.value)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg flex items-center justify-between gap-3 text-left transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-accent/15 dark:bg-accent/25 text-accent font-semibold'
                        : 'text-ink-muted hover:text-ink hover:bg-paper-2 dark:hover:bg-white/[0.05]'
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
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-3 dark:bg-white/[0.06] text-ink-muted border border-line dark:border-white/10 flex-shrink-0">
                          {opt.badge}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-accent flex-shrink-0 ml-1.5" weight="bold" />
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
}

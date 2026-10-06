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
    triggerClasses = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer select-none focus:outline-none ${
      isOpen
        ? 'bg-paper-4 ring-2 ring-accent'
        : 'bg-paper-3 hover:bg-paper-4'
    } ${disabled ? 'opacity-50 cursor-not-allowed bg-paper-2' : ''} ${buttonClassName}`;
  } else if (isGhost) {
    triggerClasses = `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer select-none focus:outline-none hover:bg-paper-3/80 ${
      isOpen ? 'bg-paper-3 text-accent' : 'text-ink-muted hover:text-ink'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${buttonClassName}`;
  } else {
    // Default form input mode
    triggerClasses = `w-full bg-paper-3 hover:bg-paper-4/60 focus:bg-paper-4 rounded-xl flex items-center justify-between gap-2 text-left font-medium transition-colors cursor-pointer focus:outline-none ${
      isOpen ? 'ring-2 ring-accent' : ''
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
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-paper-4 text-ink-muted flex-shrink-0">
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
          className={`absolute ${alignClass} ${widthClass} top-full mt-1.5 z-50 bg-paper-2 rounded-2xl shadow-2xl py-1.5 max-h-60 overflow-y-auto no-scrollbar animate-dropdown ${dropdownClassName}`}
        >
          {options.length === 0 ? (
            <div className="px-3.5 py-2.5 text-xs text-ink-muted text-center">
              暂无可选选项
            </div>
          ) : (
            <div className="px-1.5 space-y-0.5">
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
                    className={`w-full px-2.5 py-2 text-xs rounded-xl flex items-center justify-between gap-3 text-left transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-paper-4 text-accent font-semibold'
                        : 'text-ink-muted hover:text-ink hover:bg-paper-3'
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
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-paper-4 text-ink-muted flex-shrink-0">
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

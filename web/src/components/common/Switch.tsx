import React from 'react';
import clsx from 'clsx';

export interface SwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  'aria-label'?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  id,
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className,
  label,
  description,
  'aria-label': ariaLabel,
}) => {
  const handleClick = () => {
    if (disabled) return;
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
    onChange(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleClick();
    }
  };

  // Dimensions configuration for pixel-perfect alignment
  const sizeConfig = {
    sm: {
      track: 'h-5 w-9 p-0.5',
      thumb: 'h-4 w-4',
      translate: 'translate-x-4',
    },
    md: {
      track: 'h-6 w-11 p-0.5',
      thumb: 'h-5 w-5',
      translate: 'translate-x-5',
    },
    lg: {
      track: 'h-7 w-13 p-1',
      thumb: 'h-5 w-5',
      translate: 'translate-x-6',
    },
  }[size];

  const switchButton = (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel || (typeof label === 'string' ? label : undefined)}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={clsx(
        'relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out select-none outline-none',
        'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
        sizeConfig.track,
        checked
          ? 'bg-neutral-900 dark:bg-white shadow-xs'
          : 'bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 ring-1 ring-inset ring-black/5 dark:ring-white/10',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-neutral-200 dark:hover:bg-neutral-800',
        className
      )}
    >
      <span
        className={clsx(
          'pointer-events-none inline-block rounded-full shadow-sm transition-transform duration-200 ease-in-out transform',
          sizeConfig.thumb,
          checked ? sizeConfig.translate : 'translate-x-0',
          checked
            ? 'bg-white dark:bg-neutral-900'
            : 'bg-white dark:bg-neutral-300 ring-1 ring-black/5 dark:ring-black/20'
        )}
      />
    </button>
  );

  if (!label && !description) {
    return switchButton;
  }

  return (
    <div
      onClick={handleClick}
      className={clsx(
        'flex items-center justify-between gap-3 cursor-pointer select-none',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <div className="space-y-0.5 min-w-0">
        {label && <div className="text-xs font-semibold text-ink leading-tight">{label}</div>}
        {description && (
          <div className="text-[11px] text-ink-muted leading-relaxed">{description}</div>
        )}
      </div>
      {switchButton}
    </div>
  );
};

export default Switch;

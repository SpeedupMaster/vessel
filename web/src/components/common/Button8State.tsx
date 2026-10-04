import React from 'react';
import clsx from 'clsx';
import { CircleNotch, Check, Warning } from '@phosphor-icons/react';

export interface Button8StateProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  state?: 'default' | 'loading' | 'error' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button8State: React.FC<Button8StateProps> = ({
  variant = 'primary',
  state = 'default',
  size = 'md',
  icon,
  children,
  disabled,
  className,
  ...props
}) => {
  const isDisabled = disabled || state === 'loading';

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2.5 py-1.5 text-xs gap-1.5';
      case 'lg':
        return 'px-5 py-2.5 text-base gap-2.5';
      default:
        return 'px-3.5 py-2 text-sm gap-2';
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'secondary':
        return 'bg-paper-2 text-ink border border-line hover:border-paper-4 hover:bg-paper-3 focus-visible:ring-accent active:bg-paper-4 shadow-subtle';
      case 'danger':
        return 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60 dark:hover:bg-rose-900/50 focus-visible:ring-rose-500 shadow-subtle';
      case 'ghost':
        return 'bg-transparent text-ink-muted hover:text-ink hover:bg-paper-3 focus-visible:ring-accent active:bg-paper-4';
      default:
        return 'bg-accent text-white font-medium hover:bg-accent-hover active:translate-y-px focus-visible:ring-accent shadow-subtle';
    }
  };

  return (
    <button
      disabled={isDisabled}
      data-state={state}
      className={clsx(
        'relative inline-flex items-center justify-center rounded-lg transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-paper',
        getSizeClasses(),
        getVariantClasses(),
        isDisabled && 'opacity-50 cursor-not-allowed hover:bg-auto active:translate-y-0',
        state === 'loading' && 'cursor-wait',
        className
      )}
      {...props}
    >
      {state === 'loading' && <CircleNotch className="animate-spin w-4 h-4" />}
      {state === 'success' && <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />}
      {state === 'error' && <Warning className="w-4 h-4 text-rose-500 dark:text-rose-400" />}
      {state === 'default' && icon}
      <span>{children}</span>
    </button>
  );
};

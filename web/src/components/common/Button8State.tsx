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
        return 'px-2.5 py-1 text-xs gap-1.5';
      case 'lg':
        return 'px-5 py-2.5 text-base gap-2.5';
      default:
        return 'px-3.5 py-1.5 text-sm gap-2';
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'secondary':
        return 'bg-paper-3 text-ink border border-line hover:border-paper-4 hover:bg-paper-4 focus-visible:outline-accent active:bg-paper-2';
      case 'danger':
        return 'bg-rose-950/80 text-rose-200 border border-rose-800/80 hover:bg-rose-900 active:bg-rose-950 focus-visible:outline-rose-500';
      case 'ghost':
        return 'bg-transparent text-ink-muted hover:text-ink hover:bg-paper-3 focus-visible:outline-accent active:bg-paper-4';
      default:
        return 'bg-accent text-paper font-semibold hover:bg-accent-hover active:translate-y-px focus-visible:outline-focus shadow-glow-accent';
    }
  };

  return (
    <button
      disabled={isDisabled}
      data-state={state}
      className={clsx(
        'relative inline-flex items-center justify-center font-medium rounded transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-paper',
        getSizeClasses(),
        getVariantClasses(),
        isDisabled && 'opacity-50 cursor-not-allowed hover:bg-auto active:translate-y-0',
        state === 'loading' && 'cursor-wait',
        className
      )}
      {...props}
    >
      {state === 'loading' && <CircleNotch className="animate-spin w-4 h-4" />}
      {state === 'success' && <Check className="w-4 h-4 text-emerald-400" />}
      {state === 'error' && <Warning className="w-4 h-4 text-rose-400" />}
      {state === 'default' && icon}
      <span>{children}</span>
    </button>
  );
};

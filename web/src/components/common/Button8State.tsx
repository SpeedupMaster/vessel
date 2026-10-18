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
        return 'bg-paper-3 text-ink hover:bg-paper-4 active:bg-paper-4/80 focus-visible:ring-focus disabled:bg-paper-2 disabled:text-ink-muted';
      case 'danger':
        return 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 focus-visible:ring-rose-500 disabled:bg-rose-100 disabled:text-rose-500 dark:disabled:bg-rose-950/40 dark:disabled:text-rose-400';
      case 'ghost':
        return 'bg-transparent text-ink-muted hover:text-ink hover:bg-paper-3 focus-visible:ring-focus active:bg-paper-4 disabled:text-ink-muted/60';
      default:
        return 'btn-vessel-primary font-semibold focus-visible:ring-line-focus';
    }
  };

  return (
    <button
      disabled={isDisabled}
      data-state={state}
      data-variant={variant}
      className={clsx(
        'relative inline-flex items-center justify-center rounded-xl transition-[background-color,color,box-shadow,transform] duration-200 ease-out-expo select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-paper active:scale-[0.97]',
        getSizeClasses(),
        getVariantClasses(),
        isDisabled && 'cursor-not-allowed active:scale-100',
        state === 'loading' && 'cursor-wait',
        className
      )}
      {...props}
    >
      {state === 'loading' && <CircleNotch className="animate-spin w-4 h-4 text-current" />}
      {state === 'success' && <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />}
      {state === 'error' && <Warning className="w-4 h-4 text-rose-500 dark:text-rose-400" />}
      {state === 'default' && icon}
      <span className="text-current">{children}</span>
    </button>
  );
};

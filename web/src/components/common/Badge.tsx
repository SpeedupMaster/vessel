import React from 'react';
import clsx from 'clsx';

export type BadgeVariant =
  | 'running'
  | 'stopped'
  | 'deploying'
  | 'rebuilding'
  | 'error'
  | 'active'
  | 'issuing'
  | 'expired'
  | 'connected'
  | 'unverified'
  | 'default'
  | 'accent';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, pulse, className }) => {
  const getStyles = () => {
    switch (variant) {
      case 'running':
      case 'active':
      case 'connected':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60';
      case 'deploying':
      case 'rebuilding':
      case 'issuing':
        return 'bg-sky-950/60 text-sky-400 border-sky-800/60';
      case 'stopped':
      case 'unverified':
        return 'bg-zinc-900 text-zinc-400 border-zinc-700/60';
      case 'error':
      case 'expired':
        return 'bg-rose-950/60 text-rose-400 border-rose-800/60';
      case 'accent':
        return 'bg-sky-950/80 text-sky-300 border-sky-700/80';
      default:
        return 'bg-paper-3 text-ink-muted border-line';
    }
  };

  const showPulse =
    pulse ?? (variant === 'running' || variant === 'deploying' || variant === 'rebuilding' || variant === 'issuing');

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium border uppercase tracking-wider',
        getStyles(),
        className
      )}
    >
      {showPulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={clsx(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              variant === 'running' || variant === 'active' || variant === 'connected' ? 'bg-emerald-400' : 'bg-sky-400'
            )}
          />
          <span
            className={clsx(
              'relative inline-flex rounded-full h-1.5 w-1.5',
              variant === 'running' || variant === 'active' || variant === 'connected' ? 'bg-emerald-400' : 'bg-sky-400'
            )}
          />
        </span>
      )}
      {children}
    </span>
  );
};

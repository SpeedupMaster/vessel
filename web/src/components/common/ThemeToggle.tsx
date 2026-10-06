import React from 'react';
import clsx from 'clsx';
import { Sun, Moon, Desktop } from '@phosphor-icons/react';
import { useTheme, Theme } from '../../hooks/useTheme.js';

interface ThemeToggleProps {
  className?: string;
  variant?: 'segmented' | 'icon';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className, variant = 'segmented' }) => {
  const { theme, setTheme, resolvedTheme, toggleTheme } = useTheme();

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={(e) => toggleTheme(e)}
        data-tooltip={`切换主题 (当前: ${theme === 'system' ? '跟随系统' : theme === 'dark' ? '深色' : '浅色'})`}
        className={clsx(
          'p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 border border-line transition-transform duration-150 cursor-pointer outline-none focus:outline-none focus-visible:ring-1.5 focus-visible:ring-accent/50 active:scale-90 group',
          className
        )}
      >
        <div className="relative w-4 h-4 flex items-center justify-center">
          {resolvedTheme === 'dark' ? (
            <Moon className="w-4 h-4 text-sky-400 transition-transform duration-300 group-hover:-rotate-12" weight="fill" />
          ) : (
            <Sun className="w-4 h-4 text-amber-500 transition-transform duration-300 group-hover:rotate-45" weight="fill" />
          )}
        </div>
      </button>
    );
  }

  const options: {
    id: Theme;
    label: string;
    icon: (isActive: boolean) => React.ReactNode;
  }[] = [
    {
      id: 'light',
      label: '浅色模式',
      icon: (active) => (
        <Sun
          className={clsx('w-3.5 h-3.5 transition-transform duration-200', active ? 'text-amber-500 scale-110' : 'text-ink-faint hover:scale-105')}
          weight={active ? 'fill' : 'bold'}
        />
      ),
    },
    {
      id: 'system',
      label: '跟随系统',
      icon: (active) => (
        <Desktop
          className={clsx('w-3.5 h-3.5 transition-transform duration-200', active ? 'text-accent scale-110' : 'text-ink-faint hover:scale-105')}
          weight={active ? 'bold' : 'bold'}
        />
      ),
    },
    {
      id: 'dark',
      label: '深色模式',
      icon: (active) => (
        <Moon
          className={clsx('w-3.5 h-3.5 transition-transform duration-200', active ? 'text-sky-400 scale-110' : 'text-ink-faint hover:scale-105')}
          weight={active ? 'fill' : 'bold'}
        />
      ),
    },
  ];

  return (
    <div
      role="group"
      aria-label="主题切换"
      className={clsx(
        'inline-flex items-center p-0.5 bg-paper-3/90 dark:bg-neutral-900 border border-line rounded-lg transition-colors select-none',
        className
      )}
    >
      {options.map((opt) => {
        const isActive = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={(e) => setTheme(opt.id, e)}
            data-tooltip={opt.label}
            className={clsx(
              'relative min-w-[36px] min-h-[36px] p-2 rounded-[6px] text-xs transition-transform duration-150 flex items-center justify-center cursor-pointer outline-none focus:outline-none focus-visible:ring-1.5 focus-visible:ring-accent/50 border active:scale-95',
              isActive
                ? 'bg-white dark:bg-neutral-800 text-ink shadow-subtle border-line/60 dark:border-white/10 font-medium'
                : 'text-ink-faint hover:text-ink-muted hover:bg-paper-2/40 border-transparent'
            )}
          >
            {opt.icon(isActive)}
          </button>
        );
      })}
    </div>
  );
};

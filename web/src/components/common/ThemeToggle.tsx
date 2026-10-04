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
        onClick={toggleTheme}
        title={`切换主题 (当前: ${theme === 'system' ? '跟随系统' : theme === 'dark' ? '深色' : '浅色'})`}
        className={clsx(
          'p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 border border-line transition-all duration-150',
          className
        )}
      >
        {resolvedTheme === 'dark' ? (
          <Moon className="w-4 h-4 text-sky-400" weight="bold" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500" weight="bold" />
        )}
      </button>
    );
  }

  const options: { id: Theme; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: '浅色模式', icon: <Sun className="w-3.5 h-3.5" weight="bold" /> },
    { id: 'system', label: '跟随系统', icon: <Desktop className="w-3.5 h-3.5" weight="bold" /> },
    { id: 'dark', label: '深色模式', icon: <Moon className="w-3.5 h-3.5" weight="bold" /> },
  ];

  return (
    <div
      role="group"
      aria-label="主题切换"
      className={clsx(
        'inline-flex items-center p-0.5 bg-paper-3/80 border border-line rounded-lg transition-colors',
        className
      )}
    >
      {options.map((opt) => {
        const isActive = theme === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => setTheme(opt.id)}
            title={opt.label}
            className={clsx(
              'relative p-1.5 rounded-md text-xs transition-all duration-150 flex items-center justify-center',
              isActive
                ? 'bg-paper text-ink shadow-subtle border border-line/60 font-medium'
                : 'text-ink-faint hover:text-ink-muted'
            )}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
};

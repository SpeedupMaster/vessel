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
          'p-2 rounded-xl text-ink-muted hover:text-ink bg-paper-3 hover:bg-paper-4 transition-transform duration-150 cursor-pointer outline-none focus:outline-none active:scale-90 group',
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
          className={clsx('w-3.5 h-3.5 transition-transform duration-200', active ? 'text-signal scale-110' : 'text-ink-faint hover:scale-105')}
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

  const activeIndex = Math.max(0, options.findIndex((o) => o.id === theme));

  return (
    <div
      role="group"
      aria-label="主题切换"
      className={clsx(
        'relative inline-flex items-center p-[3px] bg-paper-3 border border-line-subtle rounded-xl select-none',
        className
      )}
    >
      {/* Sliding thumb */}
      <span
        aria-hidden="true"
        className="absolute top-[3px] left-[3px] w-[30px] h-[30px] rounded-[9px] bg-paper-2 border border-line shadow-subtle transition-transform duration-[420ms] ease-spring"
        style={{ transform: `translateX(${activeIndex * 30}px)` }}
      />
      {options.map((opt) => {
        const isActive = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={(e) => setTheme(opt.id, e)}
            data-tooltip={opt.label}
            aria-pressed={isActive}
            className={clsx(
              'relative w-[30px] h-[30px] rounded-[9px] text-xs transition-colors duration-200 flex items-center justify-center cursor-pointer outline-none active:scale-90',
              isActive ? 'text-ink' : 'text-ink-muted hover:text-ink'
            )}
          >
            {opt.icon(isActive)}
          </button>
        );
      })}
    </div>
  );
};

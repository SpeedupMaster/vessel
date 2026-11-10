import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { createPortal } from 'react-dom';
import { MagnifyingGlass, HardDrives, Plus, ArrowElbowDownLeft, Icon } from '@phosphor-icons/react';
import { AppItem } from '../../types/index.js';
import { NAV_GROUPS, NavTab } from '../layout/Sidebar.js';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  apps: AppItem[];
  onSelectTab: (tab: NavTab) => void;
  onOpenApp: (appId: string) => void;
  onCreateApp: () => void;
}

interface Command {
  key: string;
  group: string;
  label: string;
  hint?: string;
  icon: Icon;
  keywords: string;
  run: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  apps,
  onSelectTab,
  onOpenApp,
  onCreateApp,
}) => {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCursor(0);
      // Wait for the portal to mount before focusing
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = NAV_GROUPS.flatMap((g) =>
      g.items.map((item) => ({
        key: `tab:${item.id}`,
        group: '页面',
        label: item.label,
        hint: g.label,
        icon: item.icon,
        keywords: `${item.label} ${item.id} ${g.label}`,
        run: () => onSelectTab(item.id),
      }))
    );
    const appCmds: Command[] = apps.map((app) => ({
      key: `app:${app.id}`,
      group: '应用',
      label: app.name,
      hint: app.id,
      icon: HardDrives,
      keywords: `${app.name} ${app.id} ${app.description ?? ''}`,
      run: () => onOpenApp(app.id),
    }));
    const actions: Command[] = [
      {
        key: 'action:new-app',
        group: '操作',
        label: '新建应用',
        icon: Plus,
        keywords: 'new create 新建 创建 应用 compose',
        run: onCreateApp,
      },
    ];
    return [...actions, ...pages, ...appCmds];
  }, [apps, onSelectTab, onOpenApp, onCreateApp]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.keywords.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!isOpen) return null;

  const runAt = (index: number) => {
    const cmd = results[index];
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(results.length - 1, c + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(cursor);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={handleKeyDown}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="搜索或跳转"
        className="relative w-full max-w-xl rounded-2xl surface-pop overflow-hidden animate-dropdown"
      >
        <div className="flex items-center gap-3 px-4 border-b border-line">
          <MagnifyingGlass className="w-[18px] h-[18px] text-ink-faint shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索页面、应用或操作…"
            aria-label="搜索页面、应用或操作"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={results[cursor] ? `cmd-${cursor}` : undefined}
            className="flex-1 h-14 bg-transparent text-[15px] text-ink placeholder:text-ink-faint outline-none"
          />
          <kbd className="text-[10.5px] px-1.5 py-px rounded border border-line text-ink-faint font-mono">Esc</kbd>
        </div>

        <ul id="command-palette-list" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-10 text-center text-sm text-ink-muted">没有匹配「{query}」的结果</li>
          )}
          {results.map((cmd, i) => {
            const showGroup = cmd.group !== lastGroup;
            lastGroup = cmd.group;
            const CmdIcon = cmd.icon;
            const active = i === cursor;
            return (
              <React.Fragment key={cmd.key}>
                {showGroup && (
                  <li role="presentation" className="px-3 pt-3 pb-1.5 text-[11.5px] font-medium text-ink-faint">
                    {cmd.group}
                  </li>
                )}
                <li
                  id={`cmd-${i}`}
                  role="option"
                  aria-selected={active}
                  data-index={i}
                  onMouseMove={() => setCursor(i)}
                  onClick={() => runAt(i)}
                  className={clsx(
                    'min-h-[44px] px-3 flex items-center gap-3 rounded-lg cursor-pointer text-sm',
                    active ? 'bg-paper-3 text-ink' : 'text-ink-muted'
                  )}
                >
                  <CmdIcon className="w-[18px] h-[18px] shrink-0" />
                  <span className="flex-1 truncate font-medium">{cmd.label}</span>
                  {cmd.hint && <span className="text-xs text-ink-faint font-mono truncate max-w-[40%]">{cmd.hint}</span>}
                  {active && <ArrowElbowDownLeft className="w-3.5 h-3.5 text-ink-faint shrink-0" />}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body
  );
};

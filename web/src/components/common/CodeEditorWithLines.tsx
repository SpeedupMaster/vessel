import React, { useRef, useMemo, useLayoutEffect } from 'react';
import clsx from 'clsx';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml.js';
import 'prismjs/components/prism-bash.js';

interface CodeEditorWithLinesProps {
  value: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
  readOnly?: boolean;
  className?: string;
  language?: 'yaml' | 'bash' | 'plain';
  borderless?: boolean;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const CodeEditorWithLines: React.FC<CodeEditorWithLinesProps> = ({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
  minHeight = '380px',
  maxHeight,
  readOnly = false,
  className,
  language = 'yaml',
  borderless = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLElement>(null);

  const lines = value.split('\n');
  const lineCount = Math.max(lines.length, 1);

  const highlightedCode = useMemo(() => {
    if (!value || language === 'plain') return '';
    try {
      const grammar = language === 'yaml' ? Prism.languages.yaml : language === 'bash' ? Prism.languages.bash : null;
      if (grammar) {
        return Prism.highlight(value, grammar, language);
      }
    } catch {
      // fallback to plain text if error occurs
    }
    return '';
  }, [value, language]);

  // Layers follow the textarea by transform rather than their own scrollTop: the textarea can scroll
  // further (its horizontal scrollbar adds to the range), and a clamped overlay drifts off the caret.
  const syncScroll = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (gutterRef.current) {
      gutterRef.current.style.transform = `translateY(${-textarea.scrollTop}px)`;
    }
    if (codeRef.current) {
      codeRef.current.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
    }
  };

  // Content changes (e.g. deleting lines) can move scrollTop without a scroll event
  useLayoutEffect(syncScroll);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (e.shiftKey) {
        // Shift+Tab: Unindent
        const beforeCursor = value.substring(0, start);
        const lineStart = beforeCursor.lastIndexOf('\n') + 1;
        const currentLine = value.substring(lineStart, end);

        if (currentLine.startsWith('  ')) {
          const newValue = value.substring(0, lineStart) + currentLine.substring(2) + value.substring(end);
          onChange?.(newValue);
          requestAnimationFrame(() => {
            textarea.selectionStart = Math.max(lineStart, start - 2);
            textarea.selectionEnd = Math.max(lineStart, end - 2);
          });
        }
      } else {
        // Tab: Indent 2 spaces
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        onChange?.(newValue);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    }
  };

  const handleLineClick = (lineIndex: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const linesArr = value.split('\n');
    let start = 0;
    for (let i = 0; i < lineIndex; i++) {
      start += linesArr[i].length + 1;
    }
    const end = start + (linesArr[lineIndex]?.length || 0);

    textarea.focus();
    textarea.setSelectionRange(start, end);
  };

  const isHighlighting = Boolean(highlightedCode && value);

  return (
    <div
      className={clsx(
        'relative flex text-ink font-mono text-xs overflow-hidden transition-colors',
        borderless ? 'rounded-none bg-transparent' : 'rounded-2xl bg-paper-3',
        className
      )}
      style={{ minHeight, maxHeight }}
    >
      {/* Line Numbers Gutter */}
      <div
        aria-hidden="true"
        className={clsx(
          'select-none py-3 px-3 text-ink-muted text-right font-mono text-xs leading-[1.625rem] overflow-hidden flex-shrink-0 min-w-[3rem] border-r border-zinc-200/60 dark:border-white/5',
          borderless ? 'bg-paper-3/20' : 'bg-paper-2'
        )}
      >
        <div ref={gutterRef}>
          {Array.from({ length: lineCount }).map((_, idx) => (
            <div
              key={idx}
              onClick={() => handleLineClick(idx)}
              className="tabular-nums cursor-pointer hover:text-ink transition-colors select-none"
              data-tooltip={`点击选中第 ${idx + 1} 行`}
            >
              {idx + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Code Area: Container for Syntax Overlay & Editable Textarea */}
      <div className="relative flex-1 min-w-0 overflow-hidden">
        {/* Highlighting Overlay (Pre) */}
        {isHighlighting && (
          <pre
            aria-hidden="true"
            className="absolute inset-0 p-3 m-0 bg-transparent text-ink font-mono text-xs leading-[1.625rem] whitespace-pre overflow-hidden pointer-events-none select-none font-normal"
            style={{ tabSize: 2 }}
          >
            <code
              ref={codeRef}
              className="block w-max"
              dangerouslySetInnerHTML={{
                __html: highlightedCode + (value.endsWith('\n') ? ' ' : ''),
              }}
            />
          </pre>
        )}

        {/* Textarea Input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          placeholder={placeholder}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={clsx(
            'w-full h-full p-3 m-0 bg-transparent font-mono text-xs leading-[1.625rem] resize-none outline-none overflow-auto whitespace-pre font-normal cursor-text',
            isHighlighting
              ? 'relative z-10 text-transparent caret-ink dark:caret-white selection:bg-accent/25 selection:text-transparent'
              : 'text-ink'
          )}
          style={{ minHeight, maxHeight, tabSize: 2 }}
        />
      </div>
    </div>
  );
};


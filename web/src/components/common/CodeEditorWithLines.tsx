import React, { useRef, useEffect } from 'react';
import clsx from 'clsx';

interface CodeEditorWithLinesProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
  readOnly?: boolean;
  className?: string;
}

export const CodeEditorWithLines: React.FC<CodeEditorWithLinesProps> = ({
  value,
  onChange,
  placeholder,
  minHeight = '380px',
  maxHeight,
  readOnly = false,
  className,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lines = value.split('\n');
  const lineCount = Math.max(lines.length, 1);

  const syncScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

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

  return (
    <div
      className={clsx(
        'relative flex rounded-lg border border-line bg-paper text-ink font-mono text-xs overflow-hidden transition-colors',
        className
      )}
      style={{ minHeight, maxHeight }}
    >
      {/* Line Numbers Gutter */}
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="select-none py-3 px-3 bg-paper-2 border-r border-line text-ink-faint text-right font-mono text-xs leading-[1.625rem] overflow-hidden flex-shrink-0 min-w-[3rem]"
      >
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

      {/* Code Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        placeholder={placeholder}
        spellCheck={false}
        className="flex-1 w-full p-3 bg-transparent text-ink font-mono text-xs leading-[1.625rem] resize-y outline-none overflow-auto whitespace-pre font-normal cursor-text select-text"
        style={{ minHeight }}
      />
    </div>
  );
};

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
  disabled?: boolean;
}

interface Coords {
  x: number;
  y: number;
  side: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  delay = 100,
  className = '',
  disabled = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const calculateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    let x = 0;
    let y = 0;

    let effectiveSide = side;
    if (effectiveSide === 'top' && rect.top < 48) {
      effectiveSide = 'bottom';
    } else if (effectiveSide === 'bottom' && rect.bottom > window.innerHeight - 42) {
      effectiveSide = 'top';
    }

    switch (effectiveSide) {
      case 'top':
        x = rect.left + rect.width / 2;
        y = rect.top - 6;
        break;
      case 'bottom':
        x = rect.left + rect.width / 2;
        y = rect.bottom + 6;
        break;
      case 'left':
        x = rect.left - 6;
        y = rect.top + rect.height / 2;
        break;
      case 'right':
        x = rect.right + 6;
        y = rect.top + rect.height / 2;
        break;
    }

    // Clamp x to viewport
    x = Math.max(24, Math.min(window.innerWidth - 24, x));

    setCoords({ x, y, side: effectiveSide });
  }, [side]);

  const handleMouseEnter = () => {
    if (disabled || !content) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      calculateCoords();
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        className={`inline-flex ${className}`}
      >
        {children}
      </div>

      {isVisible &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              left: `${coords.x}px`,
              top: `${coords.y}px`,
              transform:
                coords.side === 'top'
                  ? 'translate(-50%, -100%)'
                  : coords.side === 'bottom'
                  ? 'translate(-50%, 0)'
                  : coords.side === 'left'
                  ? 'translate(-100%, -50%)'
                  : 'translate(0, -50%)',
            }}
            className="fixed z-[99999] pointer-events-none select-none animate-tooltip-in"
          >
            <div className="relative px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-neutral-900/95 dark:bg-neutral-800/95 dark:text-neutral-100 rounded-md shadow-floating border border-neutral-700/60 dark:border-neutral-700 whitespace-nowrap tracking-tight backdrop-blur-sm">
              {content}
              {/* Arrow Indicator */}
              <div
                className={`absolute w-1.5 h-1.5 bg-neutral-900/95 dark:bg-neutral-800/95 transform rotate-45 border-neutral-700/60 dark:border-neutral-700 ${
                  coords.side === 'top'
                    ? 'bottom-[-3px] left-1/2 -translate-x-1/2 border-r border-b'
                    : coords.side === 'bottom'
                    ? 'top-[-3px] left-1/2 -translate-x-1/2 border-l border-t'
                    : coords.side === 'left'
                    ? 'right-[-3px] top-1/2 -translate-y-1/2 border-t border-r'
                    : 'left-[-3px] top-1/2 -translate-y-1/2 border-b border-l'
                }`}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

/**
 * Global Tooltip listener component
 * Automatically intercepts elements with `data-tooltip` or native `title` attributes
 * and renders modern custom floating tooltips across the whole website!
 */
export const GlobalTooltip: React.FC = () => {
  const [tooltipState, setTooltipState] = useState<{
    text: string;
    x: number;
    y: number;
    side: 'top' | 'bottom' | 'left' | 'right';
    visible: boolean;
  }>({
    text: '',
    x: 0,
    y: 0,
    side: 'top',
    visible: false,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentTargetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const hideTooltip = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      currentTargetRef.current = null;
      setTooltipState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };

    // Automatically convert any native title attributes to data-tooltip on hover
    // to prevent ugly browser default tooltips from ever popping up
    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[title], [data-tooltip]') as HTMLElement | null;
      if (!target) return;

      // If it has native title, move it to data-tooltip and remove title
      if (target.hasAttribute('title')) {
        const titleText = target.getAttribute('title') || '';
        if (titleText.trim()) {
          target.setAttribute('data-tooltip', titleText);
        }
        target.removeAttribute('title');
      }

      const text = target.getAttribute('data-tooltip');
      if (!text || !text.trim()) return;

      currentTargetRef.current = target;
      const side = (target.getAttribute('data-tooltip-side') as any) || 'top';
      const delay = Number(target.getAttribute('data-tooltip-delay')) || 100;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // If element is no longer in DOM, abort
        if (!target.isConnected) {
          hideTooltip();
          return;
        }

        const rect = target.getBoundingClientRect();
        let x = 0;
        let y = 0;

        let effectiveSide = side;
        if (effectiveSide === 'top' && rect.top < 48) {
          effectiveSide = 'bottom';
        } else if (effectiveSide === 'bottom' && rect.bottom > window.innerHeight - 42) {
          effectiveSide = 'top';
        }

        switch (effectiveSide) {
          case 'top':
            x = rect.left + rect.width / 2;
            y = rect.top - 6;
            break;
          case 'bottom':
            x = rect.left + rect.width / 2;
            y = rect.bottom + 6;
            break;
          case 'left':
            x = rect.left - 6;
            y = rect.top + rect.height / 2;
            break;
          case 'right':
            x = rect.right + 6;
            y = rect.top + rect.height / 2;
            break;
        }

        // Clamp x to viewport
        x = Math.max(24, Math.min(window.innerWidth - 24, x));

        setTooltipState({
          text,
          x,
          y,
          side: effectiveSide,
          visible: true,
        });
      }, delay);
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-tooltip]');
      if (target) {
        hideTooltip();
      }
    };

    // When clicking any element or moving mouse over detached node, dismiss tooltip immediately
    const handleClick = () => {
      hideTooltip();
    };

    const handleMouseMove = () => {
      if (currentTargetRef.current && !currentTargetRef.current.isConnected) {
        hideTooltip();
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('click', handleClick);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('scroll', handleClick, true);
    document.addEventListener('keydown', handleClick);
    window.addEventListener('blur', handleClick);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('scroll', handleClick, true);
      document.removeEventListener('keydown', handleClick);
      window.removeEventListener('blur', handleClick);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!tooltipState.visible || !tooltipState.text || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      style={{
        left: `${tooltipState.x}px`,
        top: `${tooltipState.y}px`,
        transform:
          tooltipState.side === 'top'
            ? 'translate(-50%, -100%)'
            : tooltipState.side === 'bottom'
            ? 'translate(-50%, 0)'
            : tooltipState.side === 'left'
            ? 'translate(-100%, -50%)'
            : 'translate(0, -50%)',
      }}
      className="fixed z-[99999] pointer-events-none select-none transition-all duration-150 ease-out animate-tooltip-in"
    >
      <div className="relative px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-neutral-900/95 dark:bg-neutral-800/95 dark:text-neutral-100 rounded-md shadow-floating border border-neutral-700/60 dark:border-neutral-700 whitespace-nowrap tracking-tight backdrop-blur-sm">
        {tooltipState.text}
        {/* Arrow Indicator */}
        <div
          className={`absolute w-1.5 h-1.5 bg-neutral-900/95 dark:bg-neutral-800/95 transform rotate-45 border-neutral-700/60 dark:border-neutral-700 ${
            tooltipState.side === 'top'
              ? 'bottom-[-3px] left-1/2 -translate-x-1/2 border-r border-b'
              : tooltipState.side === 'bottom'
              ? 'top-[-3px] left-1/2 -translate-x-1/2 border-l border-t'
              : tooltipState.side === 'left'
              ? 'right-[-3px] top-1/2 -translate-y-1/2 border-t border-r'
              : 'left-[-3px] top-1/2 -translate-y-1/2 border-b border-l'
          }`}
        />
      </div>
    </div>,
    document.body
  );
};

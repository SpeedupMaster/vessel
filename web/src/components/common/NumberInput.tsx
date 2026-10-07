import React, { useRef, useCallback, useEffect } from 'react';
import clsx from 'clsx';
import { CaretUp, CaretDown } from '@phosphor-icons/react';

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'min' | 'max' | 'step'> {
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
  inputClassName?: string;
  showStepper?: boolean;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  unit,
  disabled = false,
  className,
  inputClassName,
  showStepper = true,
  placeholder,
  ...props
}) => {
  const numericValue = typeof value === 'number' ? value : Number(value) || 0;
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const repeatTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clamp = useCallback(
    (val: number) => {
      let clamped = val;
      if (min !== undefined && clamped < min) clamped = min;
      if (max !== undefined && clamped > max) clamped = max;
      return clamped;
    },
    [min, max]
  );

  const handleStep = useCallback(
    (direction: 1 | -1) => {
      if (disabled) return;
      const nextVal = clamp(numericValue + direction * step);
      onChange(nextVal);
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(8);
      }
    },
    [disabled, clamp, numericValue, step, onChange]
  );

  const startHold = useCallback(
    (direction: 1 | -1) => {
      if (disabled) return;
      handleStep(direction);
      holdTimerRef.current = setTimeout(() => {
        repeatTimerRef.current = setInterval(() => {
          handleStep(direction);
        }, 80);
      }, 350);
    },
    [disabled, handleStep]
  );

  const stopHold = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (repeatTimerRef.current) clearInterval(repeatTimerRef.current);
    holdTimerRef.current = null;
    repeatTimerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopHold();
    };
  }, [stopHold]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange(min !== undefined ? min : 0);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      onChange(clamp(parsed));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleStep(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleStep(-1);
    }
  };

  const isMin = min !== undefined && numericValue <= min;
  const isMax = max !== undefined && numericValue >= max;

  return (
    <div
      className={clsx(
        'relative flex items-center rounded-xl bg-white dark:bg-paper-3 border border-zinc-200 dark:border-white/10 shadow-sm transition-colors duration-150 h-10',
        'focus-within:border-zinc-400 dark:focus-within:border-white/30 focus-within:outline-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        role="spinbutton"
        aria-valuenow={numericValue}
        aria-valuemin={min !== undefined ? min : undefined}
        aria-valuemax={max !== undefined ? max : undefined}
        className={clsx(
          'flex-1 min-w-0 bg-transparent px-3.5 h-full text-xs font-mono text-ink placeholder:text-ink-faint',
          'outline-none focus:outline-none border-none ring-0 focus:ring-0 shadow-none focus:shadow-none',
          // Hide native browser spinners in WebKit and Firefox
          '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          inputClassName
        )}
        {...props}
      />

      {/* Right Controls Container: Unit + Custom Stepper (Naturally spaced, no overlap) */}
      <div className="flex items-center shrink-0 pr-2 pl-1 gap-2 select-none h-full">
        {/* Optional Unit Badge */}
        {unit && (
          <span className="text-xs font-medium text-ink-muted/80 select-none pointer-events-none px-0.5">
            {unit}
          </span>
        )}

        {/* Custom Designed Stepper Controls */}
        {showStepper && (
          <div className="flex flex-col justify-center items-center w-5.5 my-0.5 border-l border-zinc-200 dark:border-white/10 pl-1.5 shrink-0">
            <button
              type="button"
              tabIndex={-1}
              aria-label="增加数值"
              disabled={disabled || isMax}
              onMouseDown={() => startHold(1)}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={() => startHold(1)}
              onTouchEnd={stopHold}
              className={clsx(
                'w-full h-3.5 rounded flex items-center justify-center transition-colors cursor-pointer text-ink-muted hover:text-ink hover:bg-paper-3 dark:hover:bg-paper-4 active:scale-95',
                (disabled || isMax) && 'opacity-25 cursor-not-allowed hover:bg-transparent hover:text-ink-muted'
              )}
            >
              <CaretUp className="w-2.5 h-2.5" weight="bold" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="减少数值"
              disabled={disabled || isMin}
              onMouseDown={() => startHold(-1)}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={() => startHold(-1)}
              onTouchEnd={stopHold}
              className={clsx(
                'w-full h-3.5 rounded flex items-center justify-center transition-colors cursor-pointer text-ink-muted hover:text-ink hover:bg-paper-3 dark:hover:bg-paper-4 active:scale-95',
                (disabled || isMin) && 'opacity-25 cursor-not-allowed hover:bg-transparent hover:text-ink-muted'
              )}
            >
              <CaretDown className="w-2.5 h-2.5" weight="bold" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NumberInput;

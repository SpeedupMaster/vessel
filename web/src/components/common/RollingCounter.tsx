import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface RollingCounterProps {
  value: number;
  precision?: number;
  suffix?: string;
  className?: string;
  duration?: number;
}

export const RollingCounter: React.FC<RollingCounterProps> = ({
  value,
  precision = 0,
  suffix = '',
  className = '',
  duration = 0.8,
}) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevValRef = useRef(value);

  useEffect(() => {
    const obj = { val: prevValRef.current };
    const tween = gsap.to(obj, {
      val: value,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        if (spanRef.current) {
          spanRef.current.textContent = obj.val.toFixed(precision) + suffix;
        }
      },
    });

    prevValRef.current = value;
    return () => {
      tween.kill();
    };
  }, [value, precision, suffix, duration]);

  return (
    <span ref={spanRef} className={`tabular-nums ${className}`}>
      {value.toFixed(precision) + suffix}
    </span>
  );
};

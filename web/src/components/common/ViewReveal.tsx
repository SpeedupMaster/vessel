import React, { useLayoutEffect, useRef } from 'react';
import { Anchor } from '@phosphor-icons/react';
import { revealView } from '../../lib/motion.js';

/** Plays the staggered entrance on mount and again whenever `replayKey` changes. */
export const ViewReveal: React.FC<{ replayKey?: string; children: React.ReactNode }> = ({ replayKey, children }) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const tl = revealView(ref.current);
    return () => {
      tl?.progress(1).kill();
    };
  }, [replayKey]);

  return <div ref={ref}>{children}</div>;
};

/** Placeholder shown while a lazily loaded view is fetched. */
export const ViewSkeleton: React.FC = () => (
  <div className="space-y-6" role="status" aria-label="加载页面中">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-[120px] rounded-[var(--radius-lg)]" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="skeleton h-72 rounded-[var(--radius-lg)] lg:col-span-2" />
      <div className="skeleton h-72 rounded-[var(--radius-lg)]" />
    </div>
  </div>
);

/** Full-screen boot state with the brand mark and a breathing loader. */
export const BootScreen: React.FC<{ label: string }> = ({ label }) => (
  <div className="vessel-canvas min-h-screen bg-paper flex items-center justify-center font-sans">
    <div className="flex flex-col items-center gap-5 animate-fade-in">
      <div className="relative w-12 h-12 rounded-2xl bg-paper-2 border border-line shadow-card flex items-center justify-center">
        <VesselMark className="w-6 h-6 text-ink" />
      </div>
      <div className="flex items-center gap-2.5 text-ink-muted">
        <span className="vessel-loader text-ink-faint" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="text-xs tracking-wide">{label}</span>
      </div>
    </div>
  </div>
);

/** Brand glyph: the anchor used by the favicon, set on a raised tile. */
export const VesselMark: React.FC<{ className?: string }> = ({ className }) => (
  <Anchor className={className} weight="duotone" aria-hidden="true" />
);

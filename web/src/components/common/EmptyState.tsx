import React from 'react';
import clsx from 'clsx';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Dashed dot-grid well with an icon tile and optional CTA row (same treatment as the Overview apps empty state). */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className }) => (
  <div
    className={clsx(
      'relative min-h-[240px] rounded-xl border border-dashed border-line overflow-hidden flex flex-col items-center justify-center text-center px-6 py-10',
      className
    )}
  >
    <div className="absolute inset-0 bg-dot-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
    <div className="relative w-11 h-11 rounded-xl bg-paper-2 border border-line shadow-card flex items-center justify-center text-ink mb-4">
      {icon}
    </div>
    <p className="relative text-sm font-semibold text-ink">{title}</p>
    {description && <p className="relative text-xs text-ink-muted mt-1.5 max-w-sm leading-relaxed">{description}</p>}
    {action && <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2.5">{action}</div>}
  </div>
);

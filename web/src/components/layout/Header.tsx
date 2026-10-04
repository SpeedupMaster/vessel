import React from 'react';
import { Cpu, Memory, Globe, ArrowClockwise, ShieldCheck } from '@phosphor-icons/react';
import { SystemMetrics } from '../../types/index.js';
import { RollingCounter } from '../common/RollingCounter.js';
import { Button8State } from '../common/Button8State.js';
import { ThemeToggle } from '../common/ThemeToggle.js';

interface HeaderProps {
  title: string;
  metrics: SystemMetrics;
  onRefresh: () => void;
  onQuickBackup?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, metrics, onRefresh, onQuickBackup }) => {
  const memUsedGb = metrics.memUsedBytes / (1024 * 1024 * 1024);
  const memTotalGb = metrics.memTotalBytes / (1024 * 1024 * 1024);

  return (
    <header className="h-16 bg-paper/80 backdrop-blur-md border-b border-line px-6 md:px-8 flex items-center justify-between sticky top-0 z-20 transition-colors">
      <div>
        <h1 className="text-base font-semibold text-ink tracking-tight font-sans">{title}</h1>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Real-time Telemetry Strip */}
        <div className="hidden lg:flex items-center divide-x divide-line rounded-lg border border-line bg-paper-2 px-1 py-1 text-xs font-mono">
          {/* CPU */}
          <div className="flex items-center gap-2 px-3 py-0.5">
            <Cpu className="w-3.5 h-3.5 text-accent" weight="bold" />
            <span className="text-ink-muted">CPU</span>
            <span className="text-ink font-medium">
              <RollingCounter value={metrics.cpuUsage} suffix="%" />
            </span>
          </div>

          {/* Memory */}
          <div className="flex items-center gap-2 px-3 py-0.5">
            <Memory className="w-3.5 h-3.5 text-accent" weight="bold" />
            <span className="text-ink-muted">RAM</span>
            <span className="text-ink font-medium">
              <RollingCounter value={memUsedGb} precision={1} />
              <span className="text-ink-faint">/{memTotalGb.toFixed(0)}G</span>
            </span>
          </div>

          {/* SSL Status */}
          <div className="flex items-center gap-2 px-3 py-0.5">
            <Globe className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" weight="bold" />
            <span className="text-ink-muted">SSL</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{metrics.activeDomains} 域名</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onQuickBackup && (
            <Button8State
              size="sm"
              variant="secondary"
              icon={<ShieldCheck className="w-3.5 h-3.5 text-accent" weight="bold" />}
              onClick={onQuickBackup}
            >
              系统快照
            </Button8State>
          )}

          <button
            onClick={onRefresh}
            title="刷新数据"
            className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 border border-line transition-all"
          >
            <ArrowClockwise className="w-4 h-4" />
          </button>

          {/* Theme Switcher */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

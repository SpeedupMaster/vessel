import React from 'react';
import { Cpu, Memory, Globe, ArrowClockwise, ShieldCheck } from '@phosphor-icons/react';
import { SystemMetrics } from '../../types/index.js';
import { RollingCounter } from '../common/RollingCounter.js';
import { Button8State } from '../common/Button8State.js';

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
    <header className="h-16 bg-paper-2/60 backdrop-blur-md border-b border-line px-6 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-lg font-bold text-ink tracking-tight font-sans">{title}</h1>
      </div>

      <div className="flex items-center gap-6">
        {/* Real-time Telemetry Strip */}
        <div className="hidden md:flex items-center gap-5 text-xs font-mono">
          {/* CPU */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-paper-3/50 border border-line">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-ink-muted">CPU:</span>
            <span className="text-ink font-semibold">
              <RollingCounter value={metrics.cpuUsage} suffix="%" />
            </span>
          </div>

          {/* Memory */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-paper-3/50 border border-line">
            <Memory className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-ink-muted">RAM:</span>
            <span className="text-ink font-semibold">
              <RollingCounter value={memUsedGb} precision={1} />
              <span className="text-ink-faint">/{memTotalGb.toFixed(0)}G</span>
            </span>
          </div>

          {/* SSL Status */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-paper-3/50 border border-line">
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-ink-muted">SSL HTTPS:</span>
            <span className="text-emerald-400 font-semibold">{metrics.activeDomains} 活跃</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onQuickBackup && (
            <Button8State
              size="sm"
              variant="secondary"
              icon={<ShieldCheck className="w-3.5 h-3.5 text-sky-400" />}
              onClick={onQuickBackup}
            >
              系统快照
            </Button8State>
          )}

          <button
            onClick={onRefresh}
            title="刷新数据"
            className="p-1.5 rounded text-ink-muted hover:text-ink hover:bg-paper-3 border border-line transition-colors"
          >
            <ArrowClockwise className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

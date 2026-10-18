import React, { useEffect, useRef, useState } from 'react';
import { CircleNotch } from '@phosphor-icons/react';
import type { UploadProgress } from '../../hooks/useData.js';
import { formatBytes } from '../../utils/format.js';

/** Byte progress while uploading, then an indeterminate state while the server applies the file. */
export const UploadProgressBar: React.FC<{ progress: UploadProgress; applyingLabel?: string }> = ({
  progress,
  applyingLabel = '上传完成，正在服务器端还原…',
}) => {
  const startedAt = useRef(Date.now());
  const [speed, setSpeed] = useState(0);
  useEffect(() => {
    const seconds = (Date.now() - startedAt.current) / 1000;
    if (seconds > 0.5) setSpeed(progress.loaded / seconds);
  }, [progress.loaded]);

  const pct = progress.total > 0 ? Math.min(100, (progress.loaded / progress.total) * 100) : 0;
  const remaining = speed > 0 ? Math.max(0, (progress.total - progress.loaded) / speed) : null;

  return (
    <div className="p-3.5 rounded-2xl bg-paper-3 space-y-2" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-[11px]">
        {progress.done ? (
          <span className="flex items-center gap-1.5 text-ink font-medium">
            <CircleNotch className="w-3.5 h-3.5 animate-spin" />
            {applyingLabel}
          </span>
        ) : (
          <span className="text-ink font-medium">正在上传 {pct.toFixed(0)}%</span>
        )}
        <span className="font-mono text-ink-muted">
          {progress.done
            ? formatBytes(progress.total)
            : `${formatBytes(progress.loaded)} / ${formatBytes(progress.total)}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-paper-4 overflow-hidden">
        <div
          className={progress.done ? 'h-full w-full bg-emerald-500 animate-pulse' : 'h-full bg-ink transition-[width] duration-200 ease-out'}
          style={progress.done ? undefined : { width: `${pct}%` }}
        />
      </div>
      {!progress.done && speed > 0 && (
        <div className="flex justify-between text-[10.5px] text-ink-faint font-mono">
          <span>{formatBytes(speed)}/s</span>
          {remaining !== null && <span>剩余约 {remaining < 60 ? `${Math.ceil(remaining)} 秒` : `${Math.ceil(remaining / 60)} 分钟`}</span>}
        </div>
      )}
    </div>
  );
};

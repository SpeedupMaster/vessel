import React from 'react';
import clsx from 'clsx';

export type BadgeVariant =
  | 'running'
  | 'stopped'
  | 'deploying'
  | 'rebuilding'
  | 'error'
  | 'active'
  | 'issuing'
  | 'expired'
  | 'connected'
  | 'unverified'
  | 'unknown'
  | 'default'
  | 'accent';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
}

const STATUS_TEXT_MAP: Record<string, string> = {
  running: '运行中',
  stopped: '已停止',
  deploying: '部署中',
  rebuilding: '重建中',
  error: '异常',
  active: '已生效',
  issuing: '签发中',
  expired: '已过期',
  connected: '已连接',
  unverified: '未验证',
  unknown: '未知',
  completed: '已完成',
  failed: '失败',
  success: '成功',
  idle: '空闲',
  starting: '启动中',
  restarting: '重启中',
  degraded: '降级',
  healthy: '健康',
  unhealthy: '异常',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, pulse, className }) => {
  const getStyles = () => {
    switch (variant) {
      case 'running':
      case 'active':
      case 'connected':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 dark:border-transparent font-medium';
      case 'deploying':
      case 'rebuilding':
      case 'issuing':
        return 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/25 dark:border-transparent font-medium';
      case 'stopped':
      case 'unverified':
        return 'bg-paper-3 text-ink-muted border border-zinc-200 dark:border-white/5';
      case 'error':
      case 'expired':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25 dark:border-transparent font-medium';
      case 'accent':
        return 'bg-paper-3 text-ink font-semibold border border-zinc-200 dark:border-white/10';
      default:
        return 'bg-paper-3 text-ink-muted border border-zinc-200 dark:border-white/5';
    }
  };

  const getDotColor = () => {
    switch (variant) {
      case 'running':
      case 'active':
      case 'connected':
        return 'bg-emerald-500 dark:bg-emerald-400';
      case 'deploying':
      case 'rebuilding':
      case 'issuing':
        return 'bg-amber-500 dark:bg-amber-400';
      case 'error':
      case 'expired':
        return 'bg-rose-500 dark:bg-rose-400';
      default:
        return 'bg-zinc-400 dark:bg-zinc-500';
    }
  };

  const showPulse =
    pulse ?? (variant === 'running' || variant === 'deploying' || variant === 'rebuilding' || variant === 'issuing');

  const displayText =
    typeof children === 'string' && STATUS_TEXT_MAP[children.toLowerCase()]
      ? STATUS_TEXT_MAP[children.toLowerCase()]
      : children;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium transition-colors',
        getStyles(),
        className
      )}
    >
      {showPulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={clsx('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', getDotColor())}
          />
          <span className={clsx('relative inline-flex rounded-full h-1.5 w-1.5', getDotColor())} />
        </span>
      )}
      {displayText}
    </span>
  );
};

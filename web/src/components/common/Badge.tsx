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
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50';
      case 'deploying':
      case 'rebuilding':
      case 'issuing':
        return 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/50';
      case 'stopped':
      case 'unverified':
        return 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-400 dark:border-zinc-800';
      case 'error':
      case 'expired':
        return 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/50';
      case 'accent':
        return 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700/50';
      default:
        return 'bg-paper-3 text-ink-muted border-line';
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
        return 'bg-blue-500 dark:bg-blue-400';
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
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium border transition-colors',
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

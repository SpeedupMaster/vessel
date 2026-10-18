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
        return 'bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
      case 'deploying':
      case 'rebuilding':
      case 'issuing':
        return 'bg-amber-500/[0.08] text-amber-700 dark:text-amber-400 border-amber-500/25';
      case 'error':
      case 'expired':
        return 'bg-rose-500/[0.08] text-rose-700 dark:text-rose-400 border-rose-500/20';
      case 'accent':
        return 'bg-signal-soft text-signal border-signal-ring font-semibold';
      default:
        return 'bg-paper-3 text-ink-muted border-line';
    }
  };

  const getDotColor = () => {
    switch (variant) {
      case 'running':
      case 'active':
      case 'connected':
        return 'text-emerald-500 dark:text-emerald-400';
      case 'deploying':
      case 'rebuilding':
      case 'issuing':
        return 'text-amber-500 dark:text-amber-400';
      case 'error':
      case 'expired':
        return 'text-rose-500 dark:text-rose-400';
      default:
        return 'text-zinc-400 dark:text-zinc-500';
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
        'inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full border text-[10.5px] leading-none font-medium whitespace-nowrap transition-colors duration-300',
        getStyles(),
        className
      )}
    >
      {showPulse && <span className={clsx('status-dot !w-1.5 !h-1.5', getDotColor())} data-live="true" />}
      {displayText}
    </span>
  );
};

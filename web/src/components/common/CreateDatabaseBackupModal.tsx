import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  ArrowsClockwise,
  CheckCircle,
  CloudArrowUp,
  CircleNotch,
  Clock,
  FloppyDisk,
} from '@phosphor-icons/react';
import { Modal } from './Modal.js';
import { Button8State } from './Button8State.js';
import { Switch } from './Switch.js';
import { NumberInput } from './NumberInput.js';
import { AppItem, DatabaseBackupSchedule } from '../../types/index.js';
import { apiFetch } from '../../hooks/useData.js';

interface CreateDatabaseBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  app: AppItem;
  engineName: string;
  onConfirm: (
    databaseName: string,
    schedule?: DatabaseBackupSchedule,
    runNow?: boolean
  ) => Promise<void>;
}

const CRON_PRESETS = [
  { label: '每天 02:00', expr: '0 2 * * *', desc: '每天凌晨 02:00 执行' },
  { label: '每 12 小时', expr: '0 */12 * * *', desc: '每 12 小时整点执行' },
  { label: '每 6 小时', expr: '0 */6 * * *', desc: '每 6 小时整点执行' },
  { label: '每小时', expr: '0 * * * *', desc: '每小时整点执行' },
  { label: '每周日 03:00', expr: '0 3 * * 0', desc: '每周日凌晨 03:00 执行' },
];

function getCronDescription(expr: string) {
  const found = CRON_PRESETS.find((p) => p.expr === expr.trim());
  if (found) return found.desc;
  if (expr === '0 0 * * *') return '每天午夜 00:00 执行';
  return `自定义计划: ${expr}`;
}

export const CreateDatabaseBackupModal: React.FC<CreateDatabaseBackupModalProps> = ({
  isOpen,
  onClose,
  app,
  engineName,
  onConfirm,
}) => {
  const [scope, setScope] = useState<'all' | 'specific'>('specific');
  const [selectedDb, setSelectedDb] = useState<string>('');
  const [customDb, setCustomDb] = useState<string>('');
  const [availableDatabases, setAvailableDatabases] = useState<string[]>([]);
  const [loadingDbs, setLoadingDbs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Scheduled Automatic Backup state
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [cronExpr, setCronExpr] = useState('0 2 * * *');
  const [retentionCount, setRetentionCount] = useState(7);

  // Fetch databases inside container
  const fetchDatabases = useCallback(async () => {
    setLoadingDbs(true);
    try {
      const res = await apiFetch(`/api/apps/${app.id}/databases`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.databases) && data.databases.length > 0) {
          setAvailableDatabases(data.databases);
          if (!selectedDb) {
            setSelectedDb(data.databases[0]);
          }
        }
      }
    } catch {
      // Fallback: parse from env
    } finally {
      setLoadingDbs(false);
    }
  }, [app.id, selectedDb]);

  useEffect(() => {
    if (isOpen) {
      // Parse default db from env
      const envLines = (app.envContent || '').split('\n');
      let envDb = '';
      for (const line of envLines) {
        const trimmed = line.trim();
        if (
          trimmed.startsWith('POSTGRES_DB=') ||
          trimmed.startsWith('MYSQL_DATABASE=') ||
          trimmed.startsWith('MARIADB_DATABASE=') ||
          trimmed.startsWith('MONGO_INITDB_DATABASE=')
        ) {
          envDb = trimmed.split('=')[1]?.trim() || '';
          break;
        }
      }
      const initial = envDb || (engineName.toLowerCase().includes('postgres') ? 'postgres' : 'app_db');
      setSelectedDb(initial);
      setCustomDb(initial);

      // Load existing schedule config
      if (app.backupSchedule) {
        setEnableSchedule(!!app.backupSchedule.enabled);
        setCronExpr(app.backupSchedule.cronSchedule || '0 2 * * *');
        setRetentionCount(app.backupSchedule.retentionCount || 7);
        if (app.backupSchedule.targetDatabase && app.backupSchedule.targetDatabase !== 'all') {
          setScope('specific');
          setCustomDb(app.backupSchedule.targetDatabase);
          setSelectedDb(app.backupSchedule.targetDatabase);
        } else if (app.backupSchedule.targetDatabase === 'all') {
          setScope('all');
        }
      } else {
        setEnableSchedule(false);
        setCronExpr('0 2 * * *');
        setRetentionCount(7);
      }

      fetchDatabases();
    }
  }, [isOpen, app.envContent, app.backupSchedule, engineName, fetchDatabases]);

  const handleSubmit = async (runNow: boolean = true) => {
    if (isSubmitting) return;

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }

    const target = scope === 'all' ? 'all' : (customDb.trim() || selectedDb.trim() || 'all');
    const scheduleData: DatabaseBackupSchedule = {
      enabled: enableSchedule,
      cronSchedule: cronExpr.trim() || '0 2 * * *',
      targetDatabase: target,
      retentionCount: Number(retentionCount) || 7,
      lastBackupAt: app.backupSchedule?.lastBackupAt,
      lastBackupStatus: app.backupSchedule?.lastBackupStatus,
    };

    setIsSubmitting(true);
    try {
      await onConfirm(target, scheduleData, runNow);
      onClose();
    } catch {
      // Handled by caller toast
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title="新建数据库备份"
      subtitle={`目标应用: ${app.name} (${engineName})`}
      maxWidth="max-w-lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(true);
        }}
        className="space-y-4 pt-1 text-xs"
      >
        {/* Backup Scope Selection */}
        <div>
          <label className="block text-xs font-semibold text-ink mb-2">选择备份范围</label>
          <div className="grid grid-cols-1 gap-2.5">
            {/* Specific Database Option */}
            <label
              className={`p-3.5 rounded-2xl transition-colors cursor-pointer flex items-start gap-3 ${
                scope === 'specific'
                  ? 'bg-paper-3 ring-1 ring-zinc-400 dark:ring-white/30'
                  : 'bg-paper-3/60 hover:bg-paper-3'
              }`}
            >
              <input
                type="radio"
                name="backup_scope"
                checked={scope === 'specific'}
                onChange={() => setScope('specific')}
                className="mt-0.5 text-accent focus:ring-accent"
              />
              <div className="flex-1 space-y-1">
                <div className="font-semibold text-ink flex items-center justify-between">
                  <span>指定单个数据库</span>
                  {scope === 'specific' && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-accent/10 text-accent font-medium">
                      推荐
                    </span>
                  )}
                </div>
                <p className="text-ink-muted text-[11px] leading-relaxed">
                  仅备份指定的业务数据库，导出体积轻量，还原时可按库独立导入。
                </p>
              </div>
            </label>

            {/* All Databases Option */}
            <label
              className={`p-3.5 rounded-2xl transition-colors cursor-pointer flex items-start gap-3 ${
                scope === 'all'
                  ? 'bg-paper-3 ring-1 ring-zinc-400 dark:ring-white/30'
                  : 'bg-paper-3/60 hover:bg-paper-3'
              }`}
            >
              <input
                type="radio"
                name="backup_scope"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
                className="mt-0.5 text-accent focus:ring-accent"
              />
              <div className="flex-1 space-y-1">
                <div className="font-semibold text-ink">全部数据库 (All Databases)</div>
                <p className="text-ink-muted text-[11px] leading-relaxed">
                  备份该实例下的所有数据库、系统架构与权限配置（全量转储快照）。
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Database Selection / Input when scope === 'specific' */}
        {scope === 'specific' && (
          <div className="p-4 rounded-2xl bg-paper-3 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink">
                选择要备份的数据库名称
              </label>
              <button
                type="button"
                onClick={fetchDatabases}
                disabled={loadingDbs}
                className="text-[11px] text-ink-muted hover:text-ink flex items-center gap-1 transition-colors cursor-pointer"
                title="从正在运行的容器中重新检测数据库"
              >
                <ArrowsClockwise className={`w-3 h-3 ${loadingDbs ? 'animate-spin text-accent' : ''}`} />
                <span>刷新数据库</span>
              </button>
            </div>

            {/* Available Database Pills */}
            {availableDatabases.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {availableDatabases.map((dbName) => (
                  <button
                    key={dbName}
                    type="button"
                    onClick={() => {
                      setSelectedDb(dbName);
                      setCustomDb(dbName);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                      customDb === dbName
                        ? 'bg-accent text-accent-contrast font-semibold shadow-sm'
                        : 'bg-paper-4 hover:opacity-80 text-ink'
                    }`}
                  >
                    <Database className="w-3 h-3 opacity-70" />
                    <span>{dbName}</span>
                    {customDb === dbName && <CheckCircle className="w-3 h-3 text-emerald-400" weight="fill" />}
                  </button>
                ))}
              </div>
            )}

            {/* Manual Database Input */}
            <div className="pt-1">
              <input
                type="text"
                value={customDb}
                onChange={(e) => setCustomDb(e.target.value)}
                placeholder="或输入自定义数据库名称 (例如: app_db)"
                className="w-full h-10 bg-white dark:bg-paper-3 border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 text-xs font-mono text-ink placeholder:text-ink-faint/80 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-white/30 transition-colors shadow-sm"
                required={scope === 'specific'}
              />
            </div>
          </div>
        )}

        {/* Scheduled Automatic Backup Section */}
        <div className="p-4 rounded-2xl bg-paper-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4.5 h-4.5 text-accent" />
              <div>
                <div className="font-semibold text-xs text-ink flex items-center gap-1.5">
                  <span>定时自动备份</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent/10 text-accent font-medium font-sans">
                    自动化任务
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  按照 Cron 计划定时自动生成数据库快照并维护历史版本
                </p>
              </div>
            </div>

            <Switch
              checked={enableSchedule}
              onChange={setEnableSchedule}
              size="sm"
              aria-label="开启周期性自动备份计划"
            />
          </div>

          {enableSchedule && (
            <div className="pt-2 space-y-3 animate-fade-in">
              {/* Presets */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-ink-muted">快捷预设计划</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {CRON_PRESETS.map((p) => (
                    <button
                      key={p.expr}
                      type="button"
                      onClick={() => setCronExpr(p.expr)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] text-left transition-all cursor-pointer ${
                        cronExpr === p.expr
                          ? 'bg-accent text-accent-contrast font-semibold shadow-xs'
                          : 'bg-paper-4 text-ink-muted hover:text-ink'
                      }`}
                    >
                      <div className="truncate">{p.label}</div>
                      <div className="text-[9.5px] font-mono opacity-60 truncate">{p.expr}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cron Expression & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-medium text-ink-muted mb-1 block">
                    Cron 表达式
                  </label>
                  <input
                    type="text"
                    value={cronExpr}
                    onChange={(e) => setCronExpr(e.target.value)}
                    placeholder="0 2 * * *"
                    className="w-full h-10 bg-white dark:bg-paper-3 border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 text-xs font-mono text-ink placeholder:text-ink-faint/80 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-white/30 transition-colors shadow-sm"
                  />
                  <p className="text-[10px] text-accent mt-1.5 font-sans">
                    {getCronDescription(cronExpr)}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-ink-muted mb-1 block">
                    保留历史份数 (Retention)
                  </label>
                  <NumberInput
                    min={1}
                    max={365}
                    value={retentionCount}
                    onChange={setRetentionCount}
                    unit="份"
                    className="w-full h-10"
                  />
                  <p className="text-[10px] text-ink-faint mt-1.5 font-sans">
                    最多保留最新 {retentionCount} 份，自动轮转清理旧版本
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Backup Format & Notice */}
        <div className="p-3.5 rounded-2xl bg-paper-3 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">📦</span>
            <div>
              <div className="font-semibold text-ink">导出格式: Gzip 原生转储 (.sql.gz)</div>
              <div className="text-[11px] text-ink-muted mt-0.5">
                生成压缩 SQL 脚本快照，支持直接在线还原与本地下载
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5">
          <Button8State
            size="sm"
            variant="primary"
            state={isSubmitting ? 'loading' : 'default'}
            disabled={isSubmitting || (scope === 'specific' && !customDb.trim())}
            icon={<CloudArrowUp className="w-4 h-4" />}
            onClick={() => handleSubmit(true)}
            className="order-1 sm:order-3 w-full sm:w-auto min-h-[40px] sm:min-h-0 rounded-xl"
          >
            {isSubmitting
              ? '正在处理...'
              : enableSchedule
              ? '立即备份并保存配置'
              : '立即生成备份'}
          </Button8State>

          {enableSchedule && (
            <Button8State
              size="sm"
              variant="secondary"
              state={isSubmitting ? 'loading' : 'default'}
              disabled={isSubmitting || (scope === 'specific' && !customDb.trim())}
              icon={<FloppyDisk className="w-4 h-4 text-accent" />}
              onClick={() => handleSubmit(false)}
              className="order-2 sm:order-2 w-full sm:w-auto min-h-[40px] sm:min-h-0 rounded-xl"
            >
              仅保存定时配置
            </Button8State>
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-vessel-secondary order-3 sm:order-1 w-full sm:w-auto py-2.5 sm:py-2 px-4 text-xs font-medium rounded-xl text-center cursor-pointer select-none"
          >
            取消
          </button>
        </div>
      </form>
    </Modal>
  );
};

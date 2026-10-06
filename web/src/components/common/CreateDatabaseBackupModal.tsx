import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  ArrowsClockwise,
  CheckCircle,
  CloudArrowUp,
  CircleNotch,
} from '@phosphor-icons/react';
import { Modal } from './Modal.js';
import { Button8State } from './Button8State.js';
import { AppItem } from '../../types/index.js';
import { apiFetch } from '../../hooks/useData.js';

interface CreateDatabaseBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  app: AppItem;
  engineName: string;
  onConfirm: (databaseName: string) => Promise<void>;
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
        if (trimmed.startsWith('POSTGRES_DB=') || trimmed.startsWith('MYSQL_DATABASE=') || trimmed.startsWith('MARIADB_DATABASE=') || trimmed.startsWith('MONGO_INITDB_DATABASE=')) {
          envDb = trimmed.split('=')[1]?.trim() || '';
          break;
        }
      }
      const initial = envDb || (engineName.toLowerCase().includes('postgres') ? 'postgres' : 'app_db');
      setSelectedDb(initial);
      setCustomDb(initial);
      fetchDatabases();
    }
  }, [isOpen, app.envContent, engineName, fetchDatabases]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const target = scope === 'all' ? 'all' : (customDb.trim() || selectedDb.trim() || 'all');
    setIsSubmitting(true);
    try {
      await onConfirm(target);
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
      <form onSubmit={handleSubmit} className="space-y-5 pt-1 text-xs">
        {/* Backup Scope Selection */}
        <div>
          <label className="block text-xs font-semibold text-ink mb-2">选择备份范围</label>
          <div className="grid grid-cols-1 gap-2.5">
            {/* Specific Database Option */}
            <label
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                scope === 'specific'
                  ? 'bg-paper-2 border-accent/80 shadow-sm'
                  : 'bg-paper-2/40 border-line hover:border-line-strong'
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
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
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
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                scope === 'all'
                  ? 'bg-paper-2 border-accent/80 shadow-sm'
                  : 'bg-paper-2/40 border-line hover:border-line-strong'
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
          <div className="p-3.5 rounded-xl bg-paper-2/60 border border-line space-y-2.5">
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
                        ? 'bg-black text-white dark:bg-white dark:text-black font-semibold shadow-sm'
                        : 'bg-paper-3 hover:bg-paper-2 text-ink border border-line'
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
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs font-mono text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
                required={scope === 'specific'}
              />
            </div>
          </div>
        )}

        {/* Backup Format & R2 Notice */}
        <div className="p-3 rounded-xl bg-paper-2/40 border border-line flex items-center justify-between gap-3 text-xs">
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
        <div className="pt-3 border-t border-line flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-paper-2 hover:bg-paper-3 text-ink text-xs font-medium rounded-lg border border-line transition-colors cursor-pointer"
          >
            取消
          </button>

          <Button8State
            size="sm"
            variant="primary"
            state={isSubmitting ? 'loading' : 'default'}
            disabled={isSubmitting || (scope === 'specific' && !customDb.trim())}
            icon={<CloudArrowUp className="w-4 h-4 text-white" />}
            onClick={() => handleSubmit({ preventDefault: () => {} } as any)}
          >
            {isSubmitting ? '正在导出备份...' : '立即生成备份'}
          </Button8State>
        </div>
      </form>
    </Modal>
  );
};

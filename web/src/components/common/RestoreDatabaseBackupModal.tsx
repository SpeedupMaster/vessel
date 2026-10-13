import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Database,
  ArrowsClockwise,
  UploadSimple,
  Archive,
  Warning,
  CircleNotch,
  CheckCircle,
  FileCode,
  X,
} from '@phosphor-icons/react';
import { Modal } from './Modal.js';
import { Button8State } from './Button8State.js';
import { AppItem, BackupRecord } from '../../types/index.js';
import { apiFetch } from '../../hooks/useData.js';
import { formatBytes } from '../../utils/format.js';

interface RestoreDatabaseBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  app: AppItem;
  engineName: string;
  backups: BackupRecord[];
  onRestoreRecord: (recordId: string, databaseName?: string) => Promise<any>;
  onRestoreFile?: (appId: string, file: File, databaseName?: string) => Promise<any>;
}

export const RestoreDatabaseBackupModal: React.FC<RestoreDatabaseBackupModalProps> = ({
  isOpen,
  onClose,
  app,
  engineName,
  backups,
  onRestoreRecord,
  onRestoreFile,
}) => {
  const [sourceType, setSourceType] = useState<'existing' | 'upload'>('existing');
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [targetDb, setTargetDb] = useState<string>('');
  const [availableDatabases, setAvailableDatabases] = useState<string[]>([]);
  const [loadingDbs, setLoadingDbs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore-by-ID acts on the record's owning app, so never list another app's archives.
  const appBackups = backups.filter(
    (b) => b.targetId === app.id && b.type === 'app_db'
  );
  const initialRecordId = appBackups[0]?.id || '';

  // Fetch databases inside container
  const fetchDatabases = useCallback(async () => {
    setLoadingDbs(true);
    try {
      const res = await apiFetch(`/api/apps/${app.id}/databases`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.databases) && data.databases.length > 0) {
          setAvailableDatabases(data.databases);
        }
      }
    } catch {
      // Fallback: parse from env
    } finally {
      setLoadingDbs(false);
    }
  }, [app.id]);

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
      const initial = engineName.toLowerCase().includes('mongo') ? '' :
        envDb || (engineName.toLowerCase().includes('postgres') ? 'postgres' : 'app_db');
      setTargetDb(initial);

      setSelectedRecordId(initialRecordId);
      if (initialRecordId) {
        setSourceType('existing');
      } else {
        setSourceType('upload');
      }
      setSelectedFile(null);
      fetchDatabases();
    }
  }, [isOpen, app.id, app.envContent, engineName, fetchDatabases, initialRecordId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([30, 50, 60]);
    }

    setIsSubmitting(true);
    try {
      const dbTarget = targetDb.trim() || undefined;
      if (sourceType === 'existing') {
        if (!appBackups.some(record => record.id === selectedRecordId)) throw new Error('请选择当前应用的数据库备份归档');
        await onRestoreRecord(selectedRecordId, dbTarget);
      } else {
        if (!selectedFile) throw new Error('请选择或拖拽要导入的备份文件');
        if (!onRestoreFile) throw new Error('暂不支持文件直接还原');
        await onRestoreFile(app.id, selectedFile, dbTarget);
      }
      onClose();
    } catch {
      // Handled by toast in caller
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedRecord = appBackups.find((b) => b.id === selectedRecordId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title="恢复数据库备份"
      subtitle={`目标应用: ${app.name} (${engineName})`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5 pt-1 text-xs">
        {/* Source Selection Tabs */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-ink-muted">备份源模式</label>
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-paper-3 rounded-2xl">
            <button
              type="button"
              onClick={() => setSourceType('existing')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                sourceType === 'existing'
                  ? 'bg-paper-2 shadow-sm text-ink font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Archive className="w-4 h-4 text-accent" />
              <span>历史归档快照 ({appBackups.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceType('upload')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                sourceType === 'upload'
                  ? 'bg-paper-2 shadow-sm text-ink font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <UploadSimple className="w-4 h-4 text-emerald-500" />
              <span>上传本地文件</span>
            </button>
          </div>
        </div>

        {/* TAB 1: Existing Backup Records */}
        {sourceType === 'existing' && (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-ink-muted">选择历史备份归档</label>
            {appBackups.length === 0 ? (
              <div className="p-4 rounded-2xl text-center text-ink-muted bg-paper-3 space-y-2">
                <p>暂无此数据库的历史备份快照。</p>
                <button
                  type="button"
                  onClick={() => setSourceType('upload')}
                  className="text-accent hover:opacity-80 font-medium text-xs cursor-pointer inline-flex items-center gap-1"
                >
                  <UploadSimple className="w-3.5 h-3.5" />
                  <span>切换至「上传本地文件」导入</span>
                </button>
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-2 pr-1 divide-y-0 no-scrollbar">
                {appBackups.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => setSelectedRecordId(b.id)}
                    className={`p-3.5 rounded-2xl transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                      selectedRecordId === b.id
                        ? 'bg-paper-4 ring-1 ring-zinc-400 dark:ring-white/30'
                        : 'bg-paper-3 hover:bg-paper-4/60'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-accent flex-shrink-0" />
                        <span className="font-mono text-ink font-semibold truncate text-[11.5px]">
                          {b.fileName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10.5px] text-ink-muted pl-6">
                        <span>{formatBytes(b.fileSizeBytes)}</span>
                        <span>•</span>
                        <span>{new Date(b.createdAt).toLocaleString()}</span>
                        {b.databaseName && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-md bg-paper-4 text-ink-muted font-mono">
                            {b.databaseName === 'all' ? '全部库' : b.databaseName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <input
                        type="radio"
                        name="restoreRecord"
                        checked={selectedRecordId === b.id}
                        onChange={() => setSelectedRecordId(b.id)}
                        className="text-accent focus:ring-accent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Upload Local File */}
        {sourceType === 'upload' && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-ink-muted">选择本地 SQL 或归档文件</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".sql,.gz,.dump,.archive,.rdb"
              onChange={handleFileChange}
              className="hidden"
            />
            {!selectedFile ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 rounded-2xl transition-colors cursor-pointer text-center space-y-2 ${
                  isDragging
                    ? 'bg-paper-4 ring-1 ring-zinc-400 dark:ring-white/30'
                    : 'bg-paper-3 hover:bg-paper-4/60'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-paper-4 text-ink-muted flex items-center justify-center mx-auto shadow-sm">
                  <UploadSimple className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-ink hover:underline">点击选择文件</span>
                  <span className="text-ink-muted text-xs"> 或将文件拖拽至此处</span>
                </div>
                <p className="text-[11px] text-ink-faint">
                  支持 .sql, .sql.gz, .archive, .archive.gz, .dump, .rdb
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-paper-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-ink truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      {formatBytes(selectedFile.size)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-4 cursor-pointer"
                  title="清除所选文件"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Target Database Name */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-ink-muted flex items-center gap-1">
              <span>目标数据库名称 (Database Name)</span>
              {!engineName.toLowerCase().includes('mongo') && <span className="text-rose-500">*</span>}
            </label>
            <button
              type="button"
              onClick={fetchDatabases}
              disabled={loadingDbs}
              className="text-[11px] text-accent hover:opacity-80 flex items-center gap-1 cursor-pointer"
            >
              <ArrowsClockwise className={`w-3 h-3 ${loadingDbs ? 'animate-spin' : ''}`} />
              <span>检测运行中的数据库</span>
            </button>
          </div>

          <input
            type="text"
            required={!engineName.toLowerCase().includes('mongo')}
            value={targetDb}
            onChange={(e) => setTargetDb(e.target.value)}
            placeholder={engineName.toLowerCase().includes('mongo') ? '留空按归档恢复全部数据库' : '如 postgres 或 app_db'}
            className="w-full bg-white dark:bg-paper-3 border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-ink font-mono placeholder:text-ink-faint/80 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-white/30 transition-colors shadow-sm"
          />

          {/* Quick Select Chips */}
          {availableDatabases.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] text-ink-muted">检测到现有库:</span>
              {availableDatabases.map((dbName) => (
                <button
                  key={dbName}
                  type="button"
                  onClick={() => setTargetDb(dbName)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
                    targetDb === dbName
                      ? 'bg-accent text-accent-contrast font-semibold'
                      : 'bg-paper-4 text-ink-muted hover:text-ink'
                  }`}
                >
                  {dbName}
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-ink-muted leading-relaxed">
            MongoDB 留空时按归档中的数据库名称恢复。SQL 归档中的 USE 或连接切换语句可能指定其他数据库。
          </p>
        </div>

        {/* Warning Callout */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
            <Warning className="w-4 h-4 text-amber-500 flex-shrink-0" weight="fill" />
            <span>高危数据覆写风险提示</span>
          </div>
          <p className="text-ink-muted leading-relaxed text-[11.5px]">
            还原会修改现有数据，冲突时也可能中途失败并留下部分修改。请先备份当前数据，并在还原期间暂停业务写入。
          </p>
        </div>

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3">
          <Button8State
            size="sm"
            variant="primary"
            state={isSubmitting ? 'loading' : 'default'}
            disabled={
              isSubmitting ||
              (sourceType === 'existing' && !selectedRecordId) ||
              (sourceType === 'upload' && !selectedFile)
            }
            icon={<ArrowsClockwise className="w-3.5 h-3.5" />}
            className="order-1 sm:order-2 w-full sm:w-auto min-h-[40px] sm:min-h-0 rounded-xl font-semibold"
          >
            确认恢复备份
          </Button8State>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-vessel-secondary order-2 sm:order-1 w-full sm:w-auto py-2.5 sm:py-2 px-4 text-xs font-medium rounded-xl text-center cursor-pointer select-none"
          >
            取消
          </button>
        </div>
      </form>
    </Modal>
  );
};

import React, { useState } from 'react';
import {
  CloudArrowUp,
  CheckCircle,
  WarningCircle,
  ShieldCheck,
} from '@phosphor-icons/react';
import { R2Config, BackupRecord } from '../../types/index.js';
import { Button8State } from '../common/Button8State.js';
import { Badge } from '../common/Badge.js';

interface BackupsViewProps {
  r2Config: R2Config | null;
  backups: BackupRecord[];
  onSaveConfig: (cfg: Partial<R2Config>) => Promise<any>;
  onTestConnection: (cfg: Partial<R2Config>) => Promise<any>;
  onTriggerBackupNow: () => Promise<any>;
}

export const BackupsView: React.FC<BackupsViewProps> = ({
  r2Config,
  backups,
  onSaveConfig,
  onTestConnection,
  onTriggerBackupNow,
}) => {
  const [enabled, setEnabled] = useState(r2Config?.enabled ?? false);
  const [endpoint, setEndpoint] = useState(r2Config?.endpoint || '');
  const [bucketName, setBucketName] = useState(r2Config?.bucketName || '');
  const [accessKeyId, setAccessKeyId] = useState(r2Config?.accessKeyId || '');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [cronSchedule, setCronSchedule] = useState(r2Config?.cronSchedule || '0 3 * * *');
  const [retentionCount, setRetentionCount] = useState(r2Config?.retentionCount || 7);

  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await onTestConnection({
        endpoint,
        bucketName,
        accessKeyId,
        secretAccessKey,
      });
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveConfig({
        enabled,
        endpoint,
        bucketName,
        accessKeyId,
        secretAccessKey,
        cronSchedule,
        retentionCount,
      });
      alert('Cloudflare R2 备份策略保存成功！');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    try {
      await onTriggerBackupNow();
      alert('已成功生成并上传快照至 Cloudflare R2！');
    } catch (e: any) {
      alert(`备份失败: ${e.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Configuration Panel */}
      <div className="card-vessel p-7 sm:p-8 shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-line gap-4">
          <div>
            <h3 className="font-semibold text-base text-ink flex items-center gap-2.5 font-sans tracking-tight">
              <CloudArrowUp className="w-5 h-5 text-accent" weight="bold" />
              Cloudflare R2 远程对象存储灾备配置
            </h3>
            <p className="text-xs text-ink-muted mt-1">
              将平台 SQLite 数据、全部 Compose 编排文件以及应用数据卷定时压缩归档并上传至 Cloudflare R2
            </p>
          </div>

          <Button8State
            variant="primary"
            size="sm"
            icon={<ShieldCheck className="w-4 h-4" weight="bold" />}
            state={isBackingUp ? 'loading' : 'default'}
            onClick={handleManualBackup}
          >
            立即执行系统快照
          </Button8State>
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-5">
          <div className="flex items-center gap-3 p-3.5 bg-paper-3/50 rounded-lg border border-line">
            <input
              type="checkbox"
              id="enableR2"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-line bg-paper text-accent focus:ring-accent"
            />
            <label htmlFor="enableR2" className="text-xs font-semibold text-ink cursor-pointer">
              开启 Cloudflare R2 定时自动化备份任务
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-ink-muted mb-1.5">
                R2 S3 API Endpoint *
              </label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://<account_id>.r2.cloudflarestorage.com"
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-ink-muted mb-1.5">
                Bucket 存储桶名称 *
              </label>
              <input
                type="text"
                value={bucketName}
                onChange={(e) => setBucketName(e.target.value)}
                placeholder="vessel-backups"
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-ink-muted mb-1.5">
                Access Key ID *
              </label>
              <input
                type="text"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                placeholder="R2 API Token Access Key"
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-ink-muted mb-1.5">
                Secret Access Key *
              </label>
              <input
                type="password"
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
                placeholder="留空则保持现有密钥不变"
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-ink-muted mb-1.5">
                Cron 定时周期表达式
              </label>
              <input
                type="text"
                value={cronSchedule}
                onChange={(e) => setCronSchedule(e.target.value)}
                placeholder="0 3 * * * (每日凌晨3点)"
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-ink-muted mb-1.5">
                保留版本数 (超过自动清理旧归档)
              </label>
              <input
                type="number"
                value={retentionCount}
                onChange={(e) => setRetentionCount(Number(e.target.value))}
                min={1}
                max={30}
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Test feedback */}
          {testResult && (
            <div
              className={`p-3.5 rounded-lg text-xs flex items-center gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" weight="fill" />
              ) : (
                <WarningCircle className="w-4 h-4 text-rose-500 flex-shrink-0" weight="fill" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="pt-4 border-t border-line flex items-center justify-between">
            <Button8State
              type="button"
              variant="secondary"
              size="sm"
              state={isTesting ? 'loading' : 'default'}
              onClick={handleTest}
            >
              测试 R2 连通性
            </Button8State>

            <Button8State
              type="submit"
              variant="primary"
              size="sm"
              state={isSaving ? 'loading' : 'default'}
            >
              保存备份策略
            </Button8State>
          </div>
        </form>
      </div>

      {/* Backup History Table */}
      <div className="card-vessel overflow-hidden shadow-subtle">
        <div className="p-5 border-b border-line flex items-center justify-between">
          <h4 className="text-xs font-mono uppercase text-ink-muted font-bold tracking-wider">
            归档版本历史记录 ({backups.length})
          </h4>
          <span className="text-xs font-mono text-ink-faint">
            保留策略: 最新 {retentionCount} 个版本
          </span>
        </div>

        {backups.length === 0 ? (
          <div className="py-16 text-center text-ink-muted text-xs">
            暂无备份历史。点击上方「立即执行系统快照」或在应用详情中进行备份。
          </div>
        ) : (
          <div className="divide-y divide-line">
            {backups.map((b) => (
              <div
                key={b.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono hover:bg-paper-3/40 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-ink text-sm font-sans">{b.targetName}</span>
                    <Badge variant={b.type === 'system' ? 'accent' : 'default'}>
                      {b.type === 'system' ? '系统级快照' : '应用卷备份'}
                    </Badge>
                    <Badge variant="running">已同步 R2</Badge>
                  </div>
                  <p className="text-ink-muted truncate max-w-lg">{b.fileName}</p>
                </div>

                <div className="flex items-center gap-6 text-ink-faint">
                  <span>大小: <strong className="text-ink font-medium">{(b.fileSizeBytes / 1024 / 1024).toFixed(2)} MB</strong></span>
                  <span>时间: {new Date(b.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

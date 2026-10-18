export type AppStatus = 'running' | 'stopped' | 'deploying' | 'rebuilding' | 'error';

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: 'running' | 'exited' | 'restarting' | 'created';
  status: string;
  ports: string[];
}

export interface AppItem {
  id: string;
  name: string;
  description: string;
  status: AppStatus;
  composeYaml: string;
  envContent: string;
  autoUpdate: boolean;
  updateAvailable?: boolean;
  currentImageTag?: string;
  currentDigest?: string;
  latestDigest?: string;
  createdAt: string;
  updatedAt: string;
  lastDeployedAt?: string;
  containers: ContainerInfo[];
  backupSchedule?: DatabaseBackupSchedule;
  deploySettings?: AppDeploySettings;
}

export interface DatabaseBackupSchedule {
  enabled: boolean;
  cronSchedule: string;
  targetDatabase?: string;
  retentionCount?: number;
  lastBackupAt?: string;
  lastBackupStatus?: 'success' | 'failed' | 'idle';
}

export interface DomainItem {
  id: string;
  domain: string;
  appId: string;
  serviceName: string;
  targetPort: number;
  targetType: 'internal' | 'host';
  sslStatus: 'active' | 'issuing' | 'expired' | 'error' | 'unknown';
  sslIssuer: string;
  sslExpiresAt?: string;
  createdAt: string;
}

export interface R2Config {
  enabled: boolean;
  endpoint: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  cronSchedule: string;
  retentionCount: number;
  lastBackupAt?: string;
  lastBackupStatus?: 'success' | 'failed' | 'idle' | 'running';
  lastBackupMessage?: string;
}

export interface BackupRecord {
  id: string;
  type: 'system' | 'app_db' | 'app_volume';
  targetId: string;
  targetName: string;
  fileName: string;
  fileSizeBytes: number;
  createdAt: string;
  status: 'completed' | 'uploading' | 'failed';
  downloadUrl?: string;
  databaseName?: string;
}

export interface RegistryItem {
  id: string;
  name: string;
  server: string;
  username: string;
  token: string;
  status: 'connected' | 'unverified' | 'error';
  lastTestedAt?: string;
  errorMessage?: string;
}

export interface MaintenanceConfig {
  autoPrune: boolean;
  pruneSchedule: string;
  pruneDangling: boolean;
  pruneBuilderCache: boolean;
  unusedRetentionHours: number;
  lastPruneAt?: string;
  lastFreedBytes?: number;
  autoCheckUpdates: boolean;
  checkSchedule: string;
  lastCheckedAt?: string;
}

export interface SystemMetrics {
  cpuUsage: number;
  memUsedBytes: number;
  memTotalBytes: number;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
  dockerStatus: 'running' | 'disconnected';
  runningContainers: number | null;
  totalImages: number | null;
  totalApps: number;
  activeDomains: number;
  totalBackups: number;
}

export interface AdminUser {
  initialized: boolean;
  username: string;
  passwordHash: string;
  jwtSecret: string;
  mustChangePassword?: boolean;
}

export interface DatabaseSchema {
  admin: AdminUser;
  apps: AppItem[];
  domains: DomainItem[];
  r2Config: R2Config;
  backups: BackupRecord[];
  registries: RegistryItem[];
  maintenance: MaintenanceConfig;
  deployments: DeploymentRecord[];
  notifications: NotificationChannel[];
}

export type DeploymentAction = 'deploy' | 'rebuild' | 'fresh-volumes' | 'rollback';
export type DeploymentTrigger = 'manual' | 'webhook' | 'auto-update' | 'auto-rollback';

export interface DeploymentRecord {
  id: string;
  appId: string;
  /** Monotonic per-app sequence shown as #N in the UI */
  seq: number;
  action: DeploymentAction;
  trigger: DeploymentTrigger;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  /** Configuration snapshot the deployment ran with; rollback re-applies it */
  composeYaml: string;
  envContent: string;
  imageDigest?: string;
  error?: string;
  rollbackOf?: string;
}

export type PullPolicy = 'missing' | 'always';

export interface AppDeploySettings {
  webhookEnabled: boolean;
  webhookToken: string;
  pullPolicy: PullPolicy;
  removeOrphans: boolean;
  waitHealthy: boolean;
  timeoutMinutes: number;
  autoRollback: boolean;
  historyLimit: number;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  notifyOnUpdate: boolean;
}

export type NotificationEvent = 'deploy.success' | 'deploy.failure' | 'update.available' | 'backup.failure';
export type NotificationChannelType = 'webhook' | 'telegram' | 'feishu' | 'dingtalk' | 'wecom';

export interface NotificationChannel {
  id: string;
  name: string;
  type: NotificationChannelType;
  enabled: boolean;
  /** Webhook / bot URL; masked in API responses */
  url: string;
  /** Telegram bot token; masked in API responses */
  botToken?: string;
  chatId?: string;
  events: NotificationEvent[];
  lastSentAt?: string;
  lastStatus?: 'success' | 'failed';
  lastError?: string;
}

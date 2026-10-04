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
}

export interface DomainItem {
  id: string;
  domain: string;
  appId: string;
  serviceName: string;
  targetPort: number;
  targetType: 'internal' | 'host';
  sslStatus: 'active' | 'issuing' | 'expired' | 'error';
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
  diskUsedBytes: number;
  diskTotalBytes: number;
  dockerStatus: 'running' | 'disconnected';
  runningContainers: number;
  totalImages: number;
  totalApps: number;
  activeDomains: number;
  totalBackups: number;
}

export interface AdminUser {
  initialized: boolean;
  username: string;
  passwordHash: string;
  jwtSecret: string;
}

export interface DatabaseSchema {
  admin: AdminUser;
  apps: AppItem[];
  domains: DomainItem[];
  r2Config: R2Config;
  backups: BackupRecord[];
  registries: RegistryItem[];
  maintenance: MaintenanceConfig;
}

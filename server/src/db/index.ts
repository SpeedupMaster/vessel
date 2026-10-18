import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { hashPassword } from '../services/password.js';
import { fileURLToPath } from 'url';
import { DatabaseSchema, AppItem, DomainItem, R2Config, BackupRecord, RegistryItem, MaintenanceConfig, AdminUser } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '../../data');
export const APPS_DATA_DIR = path.join(DATA_DIR, 'apps');
const DB_FILE = path.join(DATA_DIR, 'vessel_db.json');

const DEFAULT_R2_CONFIG: R2Config = {
  enabled: false,
  endpoint: '',
  bucketName: '',
  accessKeyId: '',
  secretAccessKey: '',
  cronSchedule: '0 3 * * *',
  retentionCount: 7,
  lastBackupStatus: 'idle',
};

const DEFAULT_MAINTENANCE_CONFIG: MaintenanceConfig = {
  autoPrune: true,
  pruneSchedule: '0 4 * * 0', // Weekly Sunday 4 AM
  pruneDangling: true,
  pruneBuilderCache: true,
  unusedRetentionHours: 72,
  autoCheckUpdates: true,
  checkSchedule: '0 */6 * * *', // Every 6 hours
};

function createAdmin(): AdminUser {
  const supplied = process.env.VESSEL_ADMIN_PASSWORD;
  if (supplied && (supplied.length < 8 || supplied.length > 1024 || supplied === 'vessel2026')) {
    throw new Error('VESSEL_ADMIN_PASSWORD must contain at least 8 characters and cannot be the legacy default');
  }
  const password = supplied || crypto.randomBytes(24).toString('base64url');
  if (!supplied) {
    fs.writeFileSync(path.join(DATA_DIR, 'initial-admin-password'), password + '\n', { mode: 0o600 });
    console.log(`[Vessel] Initial admin password written to ${path.join(DATA_DIR, 'initial-admin-password')}. Change it after signing in.`);
  }
  return {
    initialized: true,
    username: 'admin',
    passwordHash: hashPassword(password),
    jwtSecret: crypto.randomBytes(32).toString('hex'),
    mustChangePassword: !supplied,
  };
}

const DEFAULT_REGISTRIES: RegistryItem[] = [
  {
    id: 'ghcr',
    name: 'GitHub Packages (GHCR)',
    server: 'ghcr.io',
    username: '',
    token: '',
    status: 'unverified',
  },
  {
    id: 'dockerhub',
    name: 'Docker Hub',
    server: 'index.docker.io/v1/',
    username: '',
    token: '',
    status: 'unverified',
  },
];

export class Database {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDirs();
    this.data = this.load();
  }

  private ensureDirs() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(APPS_DATA_DIR)) {
      fs.mkdirSync(APPS_DATA_DIR, { recursive: true });
    }
  }

  private load(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.admin?.passwordHash || !parsed.admin?.jwtSecret) {
          throw new Error('Database admin record is missing or invalid');
        }
        return {
          admin: parsed.admin,
          apps: parsed.apps || [],
          domains: parsed.domains || [],
          r2Config: parsed.r2Config || DEFAULT_R2_CONFIG,
          backups: parsed.backups || [],
          registries: parsed.registries || DEFAULT_REGISTRIES,
          maintenance: parsed.maintenance || DEFAULT_MAINTENANCE_CONFIG,
          deployments: parsed.deployments || [],
          notifications: parsed.notifications || [],
        };
      } catch (e) {
        throw new Error(`Cannot read database ${DB_FILE}; original file was preserved: ${String(e)}`);
      }
    }

    const initial: DatabaseSchema = {
      admin: createAdmin(),
      apps: [],
      domains: [],
      r2Config: DEFAULT_R2_CONFIG,
      backups: [],
      registries: DEFAULT_REGISTRIES,
      maintenance: DEFAULT_MAINTENANCE_CONFIG,
      deployments: [],
      notifications: [],
    };
    this.save(initial);
    return initial;
  }

  private save(data: DatabaseSchema) {
    this.ensureDirs();
    const tempFile = `${DB_FILE}.tmp.${crypto.randomUUID()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tempFile, DB_FILE);
  }

  public get<K extends keyof DatabaseSchema>(key: K): DatabaseSchema[K] {
    return this.data[key];
  }

  public set<K extends keyof DatabaseSchema>(key: K, value: DatabaseSchema[K]): void {
    const next = { ...this.data, [key]: value };
    this.save(next);
    this.data = next;
  }

  public updateApp(id: string, update: Partial<AppItem> | ((app: AppItem) => AppItem)): AppItem | undefined {
    const apps = this.data.apps;
    const index = apps.findIndex(app => app.id === id);
    if (index < 0) return undefined;
    const app = typeof update === 'function' ? update(apps[index]) : { ...apps[index], ...update };
    this.set('apps', apps.map((item, i) => i === index ? app : item));
    return app;
  }

  public getAll(): DatabaseSchema {
    return this.data;
  }

  public reload(): DatabaseSchema {
    this.data = this.load();
    return this.data;
  }
}

export const db = new Database();

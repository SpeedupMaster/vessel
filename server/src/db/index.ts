import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { DatabaseSchema, AppItem, DomainItem, R2Config, BackupRecord, RegistryItem, MaintenanceConfig, AdminUser } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DATA_DIR = path.resolve(__dirname, '../../data');
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

const DEFAULT_ADMIN: AdminUser = {
  initialized: true,
  username: 'admin',
  passwordHash: crypto.createHash('sha256').update('vessel2026').digest('hex'),
  jwtSecret: crypto.randomBytes(32).toString('hex'),
};

const DEFAULT_APPS: AppItem[] = [
  {
    id: 'n8n-workflow',
    name: 'n8n Workflow Automation',
    description: 'Fair-code workflow automation platform',
    status: 'stopped',
    composeYaml: `services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: n8n-app
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=\${DOMAIN:-localhost}
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - NODE_ENV=production
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
`,
    envContent: `DOMAIN=n8n.local
NODE_ENV=production
`,
    autoUpdate: true,
    currentImageTag: 'docker.n8n.io/n8nio/n8n:latest',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    containers: [],
  },
  {
    id: 'redis-cache',
    name: 'Redis In-Memory Store',
    description: 'High-performance key-value caching service',
    status: 'stopped',
    composeYaml: `services:
  redis:
    image: redis:7-alpine
    container_name: redis-cache
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
`,
    envContent: ``,
    autoUpdate: false,
    currentImageTag: 'redis:7-alpine',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    containers: [],
  },
];

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

class Database {
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
        return {
          admin: parsed.admin || DEFAULT_ADMIN,
          apps: parsed.apps || DEFAULT_APPS,
          domains: parsed.domains || [],
          r2Config: parsed.r2Config || DEFAULT_R2_CONFIG,
          backups: parsed.backups || [],
          registries: parsed.registries || DEFAULT_REGISTRIES,
          maintenance: parsed.maintenance || DEFAULT_MAINTENANCE_CONFIG,
        };
      } catch (e) {
        console.error('Failed to parse database file, falling back to defaults:', e);
      }
    }

    const initial: DatabaseSchema = {
      admin: DEFAULT_ADMIN,
      apps: DEFAULT_APPS,
      domains: [],
      r2Config: DEFAULT_R2_CONFIG,
      backups: [],
      registries: DEFAULT_REGISTRIES,
      maintenance: DEFAULT_MAINTENANCE_CONFIG,
    };
    this.save(initial);
    return initial;
  }

  private save(data: DatabaseSchema) {
    this.ensureDirs();
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  }

  public get<K extends keyof DatabaseSchema>(key: K): DatabaseSchema[K] {
    return this.data[key];
  }

  public set<K extends keyof DatabaseSchema>(key: K, value: DatabaseSchema[K]): void {
    this.data[key] = value;
    this.save(this.data);
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

import fs from 'fs';
import path from 'path';
import { runDocker } from './process.js';
import YAML from 'yaml';
import { db } from '../db/index.js';
import { hostPathService } from './hostPaths.js';
import { mysqlClientCommand } from './mysqlClient.js';
import { ContainerInfo, AppItem, AppDeploySettings, AppDiagnostics, ContainerDiagnostics } from '../types/index.js';

const ZERO_TIME = '0001-01-01T00:00:00Z';
const realTime = (value: unknown) => (typeof value === 'string' && value && value !== ZERO_TIME ? value : undefined);

/** Map one `docker inspect` object to the fields the monitoring view needs */
export function toDiagnostics(raw: any): ContainerDiagnostics {
  const state = raw?.State || {};
  const health = state.Health;
  const lastProbe = Array.isArray(health?.Log) && health.Log.length ? health.Log[health.Log.length - 1] : undefined;
  const portMap = raw?.NetworkSettings?.Ports || {};
  const ports = Object.entries<any>(portMap).flatMap(([container, bindings]) =>
    Array.isArray(bindings) && bindings.length
      ? bindings.map((b: any) => ({ container, hostIp: b.HostIp || undefined, hostPort: b.HostPort || undefined }))
      : [{ container }]);
  return {
    id: String(raw?.Id || '').slice(0, 12),
    name: String(raw?.Name || '').replace(/^\//, ''),
    service: raw?.Config?.Labels?.['com.docker.compose.service'] || '',
    image: raw?.Config?.Image || '',
    state: state.Status || 'unknown',
    running: !!state.Running,
    exitCode: Number(state.ExitCode) || 0,
    oomKilled: !!state.OOMKilled,
    error: state.Error || '',
    startedAt: realTime(state.StartedAt),
    finishedAt: realTime(state.FinishedAt),
    restartCount: Number(raw?.RestartCount) || 0,
    restartPolicy: raw?.HostConfig?.RestartPolicy?.Name || 'no',
    health: health?.Status && health.Status !== 'none'
      ? {
          status: health.Status,
          failingStreak: Number(health.FailingStreak) || 0,
          lastOutput: lastProbe?.Output ? String(lastProbe.Output).trim().slice(-500) : undefined,
          lastCheckAt: realTime(lastProbe?.End),
        }
      : undefined,
    mounts: (raw?.Mounts || []).map((m: any) => ({
      type: m.Type || '', source: m.Source || '', destination: m.Destination || '', name: m.Name || undefined, readOnly: m.RW === false,
    })),
    networks: Object.keys(raw?.NetworkSettings?.Networks || {}),
    ports,
  };
}

export type DeployOptions = Partial<Pick<AppDeploySettings, 'pullPolicy' | 'removeOrphans' | 'waitHealthy' | 'timeoutMinutes'>>;

const DEFAULT_TIMEOUT_MINUTES = 15;



export class DockerService {
  private networkName = 'vessel-net';



  /**
   * Check if Docker daemon is responsive
   */
  public async checkDaemon(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const { stdout } = await runDocker(['info', '--format', '{{.ServerVersion}}'], { timeout: 4000 });
      return { available: true, version: stdout.trim() };
    } catch (e: any) {
      return { available: false, error: e.message || 'Docker daemon is not running' };
    }
  }

  /**
   * Ensure standard internal bridge network vessel-net exists
   */
  public async ensureNetwork(): Promise<void> {
    try {
      await runDocker(['network', 'create', this.networkName], { timeout: 3000 });
    } catch {
      // Ignored if network already exists or docker is offline
    }
  }

  /**
   * Prepare project workspace directory with compose file and .env
   */
  public prepareAppFiles(app: AppItem): { appDir: string; composePath: string; envPath: string } {
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(app.id)) throw new Error('Invalid application ID');
    // Reached through the host path of the data directory so relative binds resolve on the host too
    const appDir = path.join(hostPathService.appsDir(), app.id);
    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true });
    }

    const composePath = path.join(appDir, 'docker-compose.yml');
    const envPath = path.join(appDir, '.env');

    let finalYaml = app.composeYaml;
    try {
      const parsed = YAML.parse(finalYaml);
      if (parsed?.services?.database) {
        let modified = false;
        if (!parsed.services.database.container_name) {
          parsed.services.database.container_name = app.id;
          modified = true;
        }
        if (!parsed.networks) {
          parsed.networks = {
            'vessel-net': { external: true },
          };
          modified = true;
        } else if (!parsed.networks['vessel-net']) {
          parsed.networks['vessel-net'] = { external: true };
          modified = true;
        }
        if (!parsed.services.database.networks) {
          parsed.services.database.networks = ['default', 'vessel-net'];
          modified = true;
        } else if (Array.isArray(parsed.services.database.networks) && !parsed.services.database.networks.includes('vessel-net')) {
          parsed.services.database.networks.push('vessel-net');
          modified = true;
        }
        if (modified) {
          finalYaml = YAML.stringify(parsed);
        }
      }
    } catch {}

    fs.writeFileSync(composePath, finalYaml, 'utf-8');
    fs.writeFileSync(envPath, app.envContent || '', 'utf-8');

    return { appDir, composePath, envPath };
  }

  public composeArgs(app: AppItem, args: string[]) {
    const { composePath, envPath, appDir } = this.prepareAppFiles(app);
    return { args: ['compose', '-f', composePath, '--env-file', envPath, ...args], cwd: appDir };
  }

  public async compose(app: AppItem, args: string[], onLog?: (chunk: string) => void, timeoutMs = DEFAULT_TIMEOUT_MINUTES * 60 * 1000) {
    await hostPathService.ready();
    const command = this.composeArgs(app, args);
    return runDocker(command.args, { cwd: command.cwd, onLog, timeout: timeoutMs });
  }

  /** Flags appended to `up -d` according to the app's deploy settings */
  private upFlags(options: DeployOptions = {}): string[] {
    const flags: string[] = [];
    if (options.removeOrphans !== false) flags.push('--remove-orphans');
    if (options.pullPolicy === 'always') flags.push('--pull', 'always');
    if (options.waitHealthy) {
      const minutes = options.timeoutMinutes || DEFAULT_TIMEOUT_MINUTES;
      flags.push('--wait', '--wait-timeout', String(minutes * 60));
    }
    return flags;
  }

  private async lifecycle(app: AppItem, commands: string[][], onLog?: (text: string) => void, options: DeployOptions = {}): Promise<{ success: boolean; error?: string }> {
    const timeoutMs = (options.timeoutMinutes || DEFAULT_TIMEOUT_MINUTES) * 60 * 1000;
    try {
      for (const command of commands) {
        onLog?.(`[vessel] docker compose ${command.join(' ')}
`);
        await this.compose(app, command, onLog, timeoutMs);
      }
      await this.syncAppContainers(app.id);
      onLog?.('[vessel] Operation completed successfully.\n');
      return { success: true };
    } catch (error: any) {
      onLog?.(`[vessel] Operation failed: ${error.message}
`);
      return { success: false, error: error.message };
    }
  }

  public async deployApp(app: AppItem, onLog?: (text: string) => void, options?: DeployOptions) {
    await this.ensureNetwork();
    return this.lifecycle(app, [['up', '-d', ...this.upFlags(options)]], onLog, options);
  }

  public stopApp(app: AppItem, onLog?: (text: string) => void) {
    return this.lifecycle(app, [['stop']], onLog);
  }

  public restartApp(app: AppItem, onLog?: (text: string) => void) {
    return this.lifecycle(app, [['restart']], onLog);
  }

  /** Live container state from docker inspect; never throws */
  public async diagnoseApp(app: AppItem): Promise<AppDiagnostics> {
    const checkedAt = new Date().toISOString();
    try {
      const { stdout } = await this.compose(app, ['ps', '--all', '-q'], undefined, 15000);
      const ids = stdout.trim().split(/\s+/).filter(Boolean);
      if (!ids.length) return { dockerAvailable: true, containers: [], checkedAt };
      const inspected = JSON.parse((await runDocker(['inspect', ...ids], { timeout: 10000 })).stdout);
      return { dockerAvailable: true, containers: (Array.isArray(inspected) ? inspected : []).map(toDiagnostics), checkedAt };
    } catch (error: any) {
      return { dockerAvailable: false, error: String(error?.message || error).slice(0, 500), containers: [], checkedAt };
    }
  }

  public async syncAppContainers(appId: string): Promise<ContainerInfo[]> {
    const app = db.get('apps').find(item => item.id === appId);
    if (!app) return [];
    const { stdout } = await this.compose(app, ['ps', '--all', '--format', 'json']);
    const rows: any[] = stdout.trim().startsWith('[') ? JSON.parse(stdout) : stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    const containers: ContainerInfo[] = rows.map(item => ({
      id: item.ID || item.Name || '', name: item.Name || item.Service || '', image: item.Image || '',
      state: item.State === 'running' ? 'running' : item.State === 'restarting' ? 'restarting' : 'exited',
      status: item.Status || '', ports: (item.Publishers || []).map((p: any) => `${p.PublishedPort}->${p.TargetPort}`),
    }));
    const status = containers.some(item => item.state === 'running') ? 'running' : 'stopped';
    db.updateApp(appId, { containers, status });
    return containers;
  }

  public async pullAndRebuild(app: AppItem, onLog?: (text: string) => void, options?: DeployOptions) {
    await this.ensureNetwork();
    const up = ['up', '-d', '--force-recreate', ...this.upFlags({ ...options, removeOrphans: false, pullPolicy: 'missing' })];
    return this.lifecycle(app, [['pull'], up], onLog, options);
  }

  public async freshVolumesRebuild(app: AppItem, onLog?: (text: string) => void, options?: DeployOptions) {
    await this.ensureNetwork();
    const up = ['up', '-d', '--build', ...this.upFlags({ ...options, removeOrphans: false, pullPolicy: 'missing' })];
    return this.lifecycle(app, [['down', '-v', '--remove-orphans'], up], onLog, options);
  }

  /**
   * Get runtime container logs (docker compose logs)
   */
  public async getAppLogs(
    app: AppItem,
    options: { service?: string; tail?: number; timestamps?: boolean } = {}
  ): Promise<string[]> {
    const { composePath, appDir } = this.prepareAppFiles(app);
    const tail = Math.max(1, Math.min(5000, Number.isFinite(options.tail) ? Math.trunc(options.tail!) : 100));
    const args = ['compose', '-f', composePath, 'logs', '--tail', String(tail), '--no-color'];
    if (options.timestamps !== false) {
      args.push('--timestamps');
    }
    if (options.service && options.service !== 'all') {
      const services = YAML.parse(app.composeYaml)?.services || {};
      if (!Object.hasOwn(services, options.service) || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(options.service)) throw new Error('Unknown Compose service');
      args.push(options.service);
    }

    try {
      const { stdout, stderr } = await runDocker(args, {
        cwd: appDir,
        timeout: 8000,
      });
      const output = (stdout || '') + (stderr || '');
      const lines = output.split('\n').map((l) => l.trimEnd()).filter(Boolean);
      return lines;
    } catch (err: any) {
      return [
        `[vessel] ${new Date().toISOString()} No runtime logs yet or containers are currently stopped.`,
      ];
    }
  }

  /**
   * Get Docker disk usage details
   */
  public async getDiskUsage(): Promise<{ imagesSize: string; containersSize: string; volumesSize: string; raw: string }> {
    const { stdout } = await runDocker(['system', 'df', '--format', '{{json .}}'], { timeout: 5000 });
    const rows = stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    const size = (type: string) => rows.find(row => row.Type === type)?.Size || '未知';
    return { imagesSize: size('Images'), containersSize: size('Containers'), volumesSize: size('Local Volumes'), raw: stdout };
  }

  public async getEngineCounts(): Promise<{ runningContainers: number; totalImages: number }> {
    const { stdout } = await runDocker(['info', '--format', '{{json .}}'], { timeout: 4000 });
    const info = JSON.parse(stdout);
    return { runningContainers: info.ContainersRunning, totalImages: info.Images };
  }

  /**
   * Execute command inside container for an application
   */
  public async execInApp(
    app: AppItem,
    options: {
      command: string;
      mode?: 'db' | 'shell';
      service?: string;
    }
  ): Promise<{ success: boolean; output: string; exitCode?: number }> {
    const { composePath, appDir, envPath } = this.prepareAppFiles(app);
    let service = options.service;
    if (!service) {
      try {
        const parsed = YAML.parse(app.composeYaml);
        if (parsed?.services) {
          const keys = Object.keys(parsed.services);
          service = keys.includes('database') ? 'database' : keys[0];
        }
      } catch {}
    }
    service = service || 'database';

    const rawCmd = (options.command || '').trim();
    if (!rawCmd) {
      return { success: true, output: '' };
    }

    // Parse env vars from app.envContent
    const envVars: Record<string, string> = {};
    (app.envContent || '').split('\n').forEach((l) => {
      const trimmed = l.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        envVars[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
      }
    });

    const yamlLower = (app.composeYaml || '').toLowerCase();
    const isPostgres = yamlLower.includes('postgres');
    const isMariaDB = yamlLower.includes('mariadb');
    const isMySQL = !isMariaDB && yamlLower.includes('mysql');
    const isRedis = yamlLower.includes('redis');
    const isMongo = yamlLower.includes('mongo');

    let execArgs: string[] = [];

    if (options.mode === 'db') {
      if (isPostgres) {
        const user = envVars['POSTGRES_USER'] || 'postgres';
        const dbName = envVars['POSTGRES_DB'] || 'postgres';
        if (rawCmd.startsWith('psql') || rawCmd.startsWith('sh ') || rawCmd.startsWith('bash ')) {
          execArgs = ['sh', '-c', rawCmd];
        } else {
          execArgs = ['psql', '-U', user, '-d', dbName, '-c', rawCmd];
        }
      } else if (isMariaDB || isMySQL) {
        const tool = isMariaDB ? 'mariadb' : 'mysql';
        const dbName = envVars['MARIADB_DATABASE'] || envVars['MYSQL_DATABASE'] || '';
        if (rawCmd.startsWith('mariadb') || rawCmd.startsWith('mysql') || rawCmd.startsWith('sh ') || rawCmd.startsWith('bash ')) {
          execArgs = ['sh', '-c', rawCmd];
        } else {
          // Terminal queries run as the application user; the password stays out of argv
          execArgs = mysqlClientCommand(tool, [...(dbName ? [dbName] : []), '-e', rawCmd], { preferRoot: false });
        }
      } else if (isRedis) {
        const pass = envVars['REDIS_PASSWORD'] || '';
        if (rawCmd.startsWith('redis-cli') || rawCmd.startsWith('sh ') || rawCmd.startsWith('bash ')) {
          execArgs = ['sh', '-c', rawCmd];
        } else {
          const passPart = pass ? `-a "${pass}"` : '';
          execArgs = ['sh', '-c', `redis-cli ${passPart} ${rawCmd}`];
        }
      } else if (isMongo) {
        const user = envVars['MONGO_INITDB_ROOT_USERNAME'] || '';
        const pass = envVars['MONGO_INITDB_ROOT_PASSWORD'] || '';
        if (rawCmd.startsWith('mongosh') || rawCmd.startsWith('mongo') || rawCmd.startsWith('sh ') || rawCmd.startsWith('bash ')) {
          execArgs = ['sh', '-c', rawCmd];
        } else {
          execArgs = ['mongosh'];
          if (user && pass) {
            execArgs.push('-u', user, '-p', pass, '--authenticationDatabase', 'admin');
          }
          execArgs.push('--eval', rawCmd);
        }
      } else {
        execArgs = ['sh', '-c', rawCmd];
      }
    } else {
      execArgs = ['sh', '-c', rawCmd];
    }

    try {
      const services = YAML.parse(app.composeYaml)?.services || {};
      if (!Object.hasOwn(services, service) || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(service)) throw new Error('Unknown Compose service');
      const args = ['compose', '-f', composePath, '--env-file', envPath, 'exec', '-T', service, ...execArgs];
      const result = await runDocker(args, { cwd: appDir, timeout: 15000 });
      return { success: true, output: result.stdout.trimEnd() || result.stderr.trimEnd() || '命令已执行', exitCode: 0 };
    } catch (error: any) {
      return { success: false, output: error.message, exitCode: 1 };
    }
  }

  /**
   * List available database names inside database container
   */
  public async listDatabasesInApp(app: AppItem): Promise<string[]> {
    const yamlLower = (app.composeYaml || '').toLowerCase();
    const envVars: Record<string, string> = {};
    (app.envContent || '').split('\n').forEach((l) => {
      const trimmed = l.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        envVars[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
      }
    });

    const defaultDb =
      envVars['POSTGRES_DB'] ||
      envVars['MYSQL_DATABASE'] ||
      envVars['MARIADB_DATABASE'] ||
      envVars['MONGO_INITDB_DATABASE'] ||
      '';

    if (yamlLower.includes('postgres')) {
      const res = await this.execInApp(app, {
        command: 'SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;',
        mode: 'db',
      });
      if (res.success && res.output) {
        const dbs = res.output
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s && !s.startsWith('datname') && !s.startsWith('-') && !s.startsWith('(') && !s.includes('rows'));
        if (dbs.length > 0) return dbs;
      }
      return defaultDb ? [defaultDb] : ['postgres'];
    }

    if (yamlLower.includes('mysql') || yamlLower.includes('mariadb')) {
      const res = await this.execInApp(app, {
        command: 'SHOW DATABASES;',
        mode: 'db',
      });
      if (res.success && res.output) {
        const ignored = ['information_schema', 'performance_schema', 'sys', 'mysql', 'Database'];
        const dbs = res.output
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s && !ignored.includes(s));
        if (dbs.length > 0) return dbs;
      }
      return defaultDb ? [defaultDb] : ['app_db'];
    }

    if (yamlLower.includes('mongo')) {
      const res = await this.execInApp(app, {
        command: 'show dbs',
        mode: 'db',
      });
      if (res.success && res.output) {
        const dbs = res.output
          .split('\n')
          .map((s) => s.trim().split(/\s+/)[0])
          .filter((s) => s && !['admin', 'config', 'local'].includes(s));
        if (dbs.length > 0) return dbs;
      }
      return defaultDb ? [defaultDb] : ['app_db'];
    }

    if (yamlLower.includes('redis')) {
      return ['db0'];
    }

    return defaultDb ? [defaultDb] : ['default'];
  }
}

export const dockerService = new DockerService();

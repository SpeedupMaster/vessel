import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppItem,
  DomainItem,
  R2Config,
  BackupRecord,
  RegistryItem,
  MaintenanceConfig,
  SystemMetrics,
} from '../types/index.js';
import { getAuthHeaders } from './useAuth.js';

export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const authHeaders = getAuthHeaders();
  const headers = new Headers(init?.headers || {});
  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value);
  }
  return fetch(input, { ...init, headers });
};

export function useData() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpuUsage: 0,
    memUsedBytes: 0,
    memTotalBytes: 16 * 1024 * 1024 * 1024,
    diskUsedBytes: 0,
    diskTotalBytes: 256 * 1024 * 1024 * 1024,
    dockerStatus: 'disconnected',
    runningContainers: 0,
    totalImages: 0,
    totalApps: 0,
    activeDomains: 0,
    totalBackups: 0,
  });

  const [apps, setApps] = useState<AppItem[]>([]);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [r2Config, setR2Config] = useState<R2Config | null>(null);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [registries, setRegistries] = useState<RegistryItem[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [logsMap, setLogsMap] = useState<Record<string, string[]>>({});

  const wsRef = useRef<WebSocket | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [appsRes, domainsRes, r2Res, backupsRes, regRes, maintRes] = await Promise.all([
        apiFetch('/api/apps').then((r) => r.json()),
        apiFetch('/api/domains').then((r) => r.json()),
        apiFetch('/api/r2/config').then((r) => r.json()),
        apiFetch('/api/r2/backups').then((r) => r.json()),
        apiFetch('/api/registries').then((r) => r.json()),
        apiFetch('/api/maintenance/config').then((r) => r.json()),
      ]);

      if (Array.isArray(appsRes)) setApps(appsRes);
      if (Array.isArray(domainsRes)) setDomains(domainsRes);
      if (r2Res) setR2Config(r2Res);
      if (Array.isArray(backupsRes)) setBackups(backupsRes);
      if (Array.isArray(regRes)) setRegistries(regRes);
      if (maintRes) setMaintenance(maintRes);
    } catch (e) {
      console.error('Error fetching initial data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket Connection
  useEffect(() => {
    fetchAll();

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'metrics' && msg.data) {
            setMetrics(msg.data);
          } else if (msg.type === 'log' && msg.appId && msg.text) {
            setLogsMap((prev) => {
              const current = prev[msg.appId] || [];
              return {
                ...prev,
                [msg.appId]: [...current.slice(-250), msg.text],
              };
            });
          }
        } catch {}
      };

      ws.onclose = () => {
        setTimeout(connectWs, 3000);
      };
    };

    connectWs();
    return () => {
      wsRef.current?.close();
    };
  }, [fetchAll]);

  const subscribeLogs = (appId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', channel: `logs:${appId}` }));
    }
  };

  // APP ACTIONS
  const createApp = async (app: Partial<AppItem> & { domainBinding?: any }) => {
    const res = await apiFetch('/api/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(app),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create app');
    }
    const created = await res.json();
    setApps((prev) => [...prev, created]);
    if (app.domainBinding?.domain) {
      apiFetch('/api/domains')
        .then((r) => r.json())
        .then((doms) => {
          if (Array.isArray(doms)) setDomains(doms);
        })
        .catch(console.error);
    }
    return created;
  };

  const updateApp = async (id: string, updates: Partial<AppItem>) => {
    const res = await apiFetch(`/api/apps/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update app');
    }
    const updated = await res.json();
    setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return updated;
  };

  const deleteApp = async (id: string) => {
    const res = await apiFetch(`/api/apps/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete app');
    setApps((prev) => prev.filter((a) => a.id !== id));
    setDomains((prev) => prev.filter((d) => d.appId !== id));
  };

  const deployApp = async (id: string) => {
    subscribeLogs(id);
    const res = await apiFetch(`/api/apps/${id}/deploy`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to initiate deploy');
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'deploying' } : a)));
  };

  const stopApp = async (id: string) => {
    const res = await apiFetch(`/api/apps/${id}/stop`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to stop app');
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'stopped' } : a)));
  };

  const restartApp = async (id: string) => {
    const res = await apiFetch(`/api/apps/${id}/restart`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to restart app');
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'running' } : a)));
  };

  const rebuildApp = async (id: string) => {
    subscribeLogs(id);
    const res = await apiFetch(`/api/apps/${id}/rebuild`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to rebuild app');
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'rebuilding' } : a)));
  };

  const freshVolumesApp = async (id: string) => {
    subscribeLogs(id);
    const res = await apiFetch(`/api/apps/${id}/fresh-volumes`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to initiate fresh volumes reset');
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'rebuilding' } : a)));
  };

  const backupApp = async (
    id: string,
    options?: { databaseName?: string; schedule?: any; runNow?: boolean }
  ) => {
    const res = await apiFetch(`/api/apps/${id}/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to backup app');
    if (data.record) {
      setBackups((prev) => [data.record, ...prev]);
    }
    if (data.schedule !== undefined) {
      setApps((prev) =>
        prev.map((a) => (a.id === id ? { ...a, backupSchedule: data.schedule } : a))
      );
    }
    return data;
  };

  // DOMAINS ACTIONS
  const createDomain = async (domainData: Partial<DomainItem>) => {
    const res = await apiFetch('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(domainData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to bind domain');
    }
    const created = await res.json();
    setDomains((prev) => [...prev, created]);
    return created;
  };

  const updateDomain = async (id: string, domainData: Partial<DomainItem>) => {
    const res = await apiFetch(`/api/domains/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(domainData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update domain');
    }
    const updated = await res.json();
    setDomains((prev) => prev.map((d) => (d.id === id ? updated : d)));
    return updated;
  };

  const deleteDomain = async (id: string) => {
    const res = await apiFetch(`/api/domains/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete domain');
    setDomains((prev) => prev.filter((d) => d.id !== id));
  };

  const renewDomain = async (id: string) => {
    const res = await apiFetch(`/api/domains/${id}/renew`, { method: 'POST' });
    const updated = await res.json();
    setDomains((prev) => prev.map((d) => (d.id === id ? updated : d)));
    return updated;
  };

  // R2 BACKUP ACTIONS
  const saveR2Config = async (config: Partial<R2Config>) => {
    const res = await apiFetch('/api/r2/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save R2 config');
    setR2Config(data.config);
    return data;
  };

  const testR2Connection = async (config: Partial<R2Config>) => {
    const res = await apiFetch('/api/r2/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return res.json();
  };

  const triggerSystemBackup = async () => {
    const res = await apiFetch('/api/r2/backup-now', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'System backup failed');
    if (data.record) {
      setBackups((prev) => [data.record, ...prev]);
    }
    return data;
  };

  const deleteBackup = async (id: string) => {
    const res = await apiFetch(`/api/r2/backups/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete backup');
    }
    setBackups((prev) => prev.filter((b) => b.id !== id));
  };

  const downloadBackup = (id: string, fileName: string) => {
    const token = localStorage.getItem('vessel_token') || '';
    const url = `/api/r2/backups/${id}/download?token=${encodeURIComponent(token)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const restoreBackup = async (id: string, options?: { databaseName?: string }) => {
    const res = await apiFetch(`/api/r2/backups/${id}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to restore backup');
    await fetchAll();
    return data;
  };

  const restoreDatabaseFromFile = async (appId: string, file: File, databaseName?: string) => {
    const token = localStorage.getItem('vessel_token') || '';
    const query = new URLSearchParams();
    query.set('filename', file.name);
    if (databaseName) query.set('databaseName', databaseName);
    const res = await fetch(`/api/apps/${appId}/restore-file?${query.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Authorization': `Bearer ${token}`,
      },
      body: file,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to restore backup file');
    await fetchAll();
    return data;
  };

  // REGISTRIES ACTIONS
  const saveRegistry = async (reg: Partial<RegistryItem>) => {
    const res = await apiFetch('/api/registries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reg),
    });
    const data = await res.json();
    if (!res.ok) throw new Error('Failed to save registry');
    setRegistries((prev) => {
      const idx = prev.findIndex((r) => r.id === data.registry.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = data.registry;
        return next;
      }
      return [...prev, data.registry];
    });
    return data;
  };

  const testRegistry = async (id: string) => {
    const res = await apiFetch(`/api/registries/${id}/test`, { method: 'POST' });
    const data = await res.json();
    await fetchAll();
    return data;
  };

  // MAINTENANCE ACTIONS
  const saveMaintenance = async (cfg: Partial<MaintenanceConfig>) => {
    const res = await apiFetch('/api/maintenance/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    const data = await res.json();
    setMaintenance(data);
    return data;
  };

  const triggerPrune = async () => {
    const res = await apiFetch('/api/maintenance/prune', { method: 'POST' });
    const data = await res.json();
    await fetchAll();
    return data;
  };

  const triggerCheckUpdates = async () => {
    const res = await apiFetch('/api/maintenance/check-updates', { method: 'POST' });
    const data = await res.json();
    if (data.apps) setApps(data.apps);
    return data;
  };

  return {
    metrics,
    apps,
    domains,
    r2Config,
    backups,
    registries,
    maintenance,
    loading,
    logsMap,
    subscribeLogs,
    createApp,
    updateApp,
    deleteApp,
    deployApp,
    stopApp,
    restartApp,
    rebuildApp,
    freshVolumesApp,
    backupApp,
    createDomain,
    updateDomain,
    deleteDomain,
    renewDomain,
    saveR2Config,
    testR2Connection,
    triggerSystemBackup,
    deleteBackup,
    downloadBackup,
    restoreBackup,
    restoreDatabaseFromFile,
    saveRegistry,
    testRegistry,
    saveMaintenance,
    triggerPrune,
    triggerCheckUpdates,
    refreshAll: fetchAll,
  };
}

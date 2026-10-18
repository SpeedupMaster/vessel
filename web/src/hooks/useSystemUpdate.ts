import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from './useData.js';

export interface ReleaseInfo {
  version: string;
  tag: string;
  url: string;
  notes: string;
  publishedAt: string | null;
}

export interface UpdateStatus {
  currentVersion: string;
  latest: ReleaseInfo | null;
  updateAvailable: boolean;
  checkedAt: string | null;
  checkError: string | null;
  supported: boolean;
  unsupportedReason: string | null;
  phase: 'idle' | 'pulling' | 'restarting' | 'failed';
  phaseError: string | null;
  targetVersion: string | null;
  lastResult: { status: 'running' | 'success' | 'rolled_back' | 'failed'; from?: string; to?: string; message?: string } | null;
}

/** Client-side view of an update: the server goes away mid-way, so progress is inferred by polling. */
export type ApplyState =
  | { stage: 'idle' }
  | { stage: 'pulling' | 'restarting'; target: string }
  | { stage: 'failed'; error: string };

const UPDATED_FLAG = 'vessel-updated-to';
const IDLE_POLL = 30 * 60 * 1000;
const APPLY_POLL = 2000;
const APPLY_TIMEOUT = 15 * 60 * 1000;

export function useSystemUpdate(enabled: boolean) {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [apply, setApply] = useState<ApplyState>({ stage: 'idle' });
  const [justUpdatedTo] = useState(() => {
    const value = sessionStorage.getItem(UPDATED_FLAG);
    sessionStorage.removeItem(UPDATED_FLAG);
    return value;
  });
  const applyStarted = useRef<{ from: string; target: string; at: number } | null>(null);

  const refresh = useCallback(async () => {
    const next: UpdateStatus = await (await apiFetch('/api/system/update')).json();
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh().catch(() => {});
    const id = window.setInterval(() => {
      if (!applyStarted.current) refresh().catch(() => {});
    }, IDLE_POLL);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const next: UpdateStatus = await (await apiFetch('/api/system/update/check', { method: 'POST' })).json();
      setStatus(next);
      return next;
    } finally {
      setChecking(false);
    }
  }, []);

  const start = useCallback(async () => {
    if (!status) return;
    const res = await (await apiFetch('/api/system/update', { method: 'POST' })).json();
    applyStarted.current = { from: status.currentVersion, target: res.targetVersion, at: Date.now() };
    setApply({ stage: 'pulling', target: res.targetVersion });
  }, [status]);

  const reset = useCallback(() => {
    applyStarted.current = null;
    setApply({ stage: 'idle' });
  }, []);

  // While applying, poll until the server comes back on the new version (or reports why it did not)
  useEffect(() => {
    if (apply.stage !== 'pulling' && apply.stage !== 'restarting') return;
    const started = applyStarted.current!;
    let cancelled = false;
    const tick = async () => {
      if (Date.now() - started.at > APPLY_TIMEOUT) {
        applyStarted.current = null;
        setApply({ stage: 'failed', error: '等待更新超时，请在服务器上执行 docker logs vessel-updater 查看原因' });
        return;
      }
      try {
        const next = await refresh();
        if (cancelled) return;
        if (next.currentVersion !== started.from) {
          sessionStorage.setItem(UPDATED_FLAG, next.currentVersion);
          window.location.reload();
          return;
        }
        if (next.phase === 'failed') {
          applyStarted.current = null;
          setApply({ stage: 'failed', error: next.phaseError || '更新失败' });
          return;
        }
        // An idle phase on the old version means the process restarted after a rollback
        const result = next.lastResult;
        if (next.phase === 'idle' && result && result.to === started.target && (result.status === 'rolled_back' || result.status === 'failed')) {
          applyStarted.current = null;
          setApply({ stage: 'failed', error: result.message || '更新失败，已回滚' });
          return;
        }
        if (next.phase === 'restarting') setApply({ stage: 'restarting', target: started.target });
      } catch {
        // The old container is gone and the new one is still booting
        if (!cancelled) setApply({ stage: 'restarting', target: started.target });
      }
    };
    const id = window.setInterval(tick, APPLY_POLL);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [apply.stage, refresh]);

  return { status, checking, check, apply, start, reset, justUpdatedTo };
}

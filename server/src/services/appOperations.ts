import { EventEmitter } from 'node:events';

export class OperationConflict extends Error {
  status = 409;
}

const active = new Set<string>();
export const appEvents = new EventEmitter();

export function assertAppIdle(id: string) {
  if (active.has(id) || active.has('*')) throw new OperationConflict('应用正在执行其他任务，请稍后重试');
}

export function hasActiveOperations() {
  return active.size > 0;
}

export async function withAppLock<T>(id: string, action: () => Promise<T>): Promise<T> {
  assertAppIdle(id);
  if (id === '*' && active.size) throw new OperationConflict('仍有应用任务运行，无法恢复系统快照');
  active.add(id);
  try {
    return await action();
  } finally {
    active.delete(id);
    appEvents.emit('changed', id);
  }
}

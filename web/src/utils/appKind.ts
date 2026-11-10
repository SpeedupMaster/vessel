import { AppItem } from '../types/index.js';

/** Heuristic shared with the app editor: does this compose app look like a database? */
export function isDatabaseApp(app: Pick<AppItem, 'name' | 'description' | 'composeYaml'>): boolean {
  const desc = app.description || '';
  const yaml = app.composeYaml || '';
  const n = (app.name || '').toLowerCase();
  return (
    desc.includes('Database') ||
    yaml.includes('services:\n  database:') ||
    yaml.includes('services:\r\n  database:') ||
    n.endsWith('-db') ||
    ['postgres', 'mysql', 'mariadb', 'mongo', 'redis', 'libsql'].some((p) => n.startsWith(p))
  );
}

export interface ServicePorts {
  /** Ports the container listens on: `expose` plus the container side of `ports` */
  container: number[];
  /** Published host ports, the target for "host port" proxying */
  host: number[];
}

const toPort = (value: unknown): number | null => {
  // "8000-8010" ranges resolve to their first port; ${VAR} interpolations are unknown until deploy
  const port = parseInt(String(value).trim().split('/')[0].split('-')[0], 10);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
};

/** Read ports from one Compose service, supporting short and long `ports` syntax and `expose`. */
export function servicePorts(config: any): ServicePorts {
  const container = new Set<number>();
  const host = new Set<number>();
  const ports = Array.isArray(config?.ports) ? config.ports : [];
  for (const entry of ports) {
    if (entry && typeof entry === 'object') {
      const target = toPort(entry.target);
      const published = entry.published !== undefined ? toPort(entry.published) : null;
      if (target) container.add(target);
      if (published) host.add(published);
      continue;
    }
    // [ip:][host:]container[/protocol]; IPv6 addresses arrive bracketed, e.g. "[::1]:8080:80"
    const parts = String(entry).replace(/^\[[^\]]*\]:/, '').split(':');
    const target = toPort(parts[parts.length - 1]);
    if (target) container.add(target);
    if (parts.length > 1) {
      const published = toPort(parts[parts.length - 2]);
      if (published) host.add(published);
    }
  }
  for (const entry of Array.isArray(config?.expose) ? config.expose : []) {
    const port = toPort(entry);
    if (port) container.add(port);
  }
  return { container: [...container], host: [...host] };
}

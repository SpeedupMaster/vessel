import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { apiRouter } from './routes/api.js';
import { wsHub } from './ws/wsHub.js';
import { dockerService } from './services/docker.js';
import { caddyService } from './services/caddy.js';
import { apiErrorHandler } from './middleware/validation.js';
import { schedulerService } from './services/scheduler.js';
import { selfUpdateService } from './services/selfUpdate.js';
import { hostPathService } from './services/hostPaths.js';
import { cleanerService } from './services/cleaner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

app.disable('x-powered-by');
// The bundled Caddy proxies to 127.0.0.1; trust its X-Forwarded-For so the login limiter sees real client IPs
app.set('trust proxy', 'loopback');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  // Backup download links carry the session token in the query string
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// REST API
app.use('/api', apiRouter);
app.use('/api', apiErrorHandler);

// Serve Web Frontend in Production
const webDistPath = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(webDistPath)) {
  // Vite emits content-hashed file names under /assets, so they never change in place
  app.use('/assets', express.static(path.join(webDistPath, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(webDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    res.sendFile(path.join(webDistPath, 'index.html'));
  });
}

// WebSocket Hub
wsHub.init(server);

const PORT = parseInt(process.env.PORT || '3900', 10);
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, async () => {
  console.log(`
  ╦  ╦╔═╗╔═╗╔═╗╔═╗╦  
  ╚╗╔╝║╣ ╚═╗╚═╗║╣ ║  
   ╚╝ ╚═╝╚═╝╚═╝╚═╝╩═╝
  ── Lean Docker Compose Control Hub ──
  `);
  console.log(`[Vessel] Control Plane listening at http://${HOST}:${PORT}`);
  console.log(`[Vessel] WebSocket Hub attached at ws://${HOST}:${PORT}/ws`);

  // Background checks
  const daemon = await dockerService.checkDaemon();
  if (daemon.available) {
    console.log(`[Vessel] Docker Engine detected (v${daemon.version}).`);
    await hostPathService.ready();
    await dockerService.ensureNetwork();
  } else {
    console.log(`[Vessel] Docker Engine currently offline: ${daemon.error}`);
  }

  caddyService.syncCaddyfile();
  console.log(`[Vessel] Caddyfile synced at: ${caddyService.getCaddyfilePath()}`);
  await caddyService.ensureDaemon();
  selfUpdateService.start();
  cleanerService.start();
});

process.on('SIGTERM', () => {
  caddyService.stopDaemon();
  wsHub.destroy();
  schedulerService.stopJobs();
  process.exit(0);
});

process.on('SIGINT', () => {
  caddyService.stopDaemon();
  wsHub.destroy();
  schedulerService.stopJobs();
  process.exit(0);
});

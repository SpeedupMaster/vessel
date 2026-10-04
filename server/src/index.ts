import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { apiRouter } from './routes/api.js';
import { wsHub } from './ws/wsHub.js';
import { dockerService } from './services/docker.js';
import { caddyService } from './services/caddy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// REST API
app.use('/api', apiRouter);

// Serve Web Frontend in Production
const webDistPath = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(webDistPath)) {
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
    await dockerService.ensureNetwork();
  } else {
    console.log(`[Vessel] Docker Engine currently offline: ${daemon.error}`);
  }

  caddyService.syncCaddyfile();
  console.log(`[Vessel] Caddyfile synced at: ${caddyService.getCaddyfilePath()}`);
});

process.on('SIGTERM', () => {
  wsHub.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  wsHub.destroy();
  process.exit(0);
});

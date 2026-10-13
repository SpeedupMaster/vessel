import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    username: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.method === 'GET' && req.path.endsWith('/download') && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: '请先登录以访问控制台接口' });
  }

  const result = authService.verifyToken(token);
  if (!result.valid || !result.username) {
    return res.status(401).json({ error: result.error || '登录令牌已失效，请重新登录' });
  }

  req.user = { username: result.username };
  next();
}

export function requirePasswordChanged(_req: Request, res: Response, next: NextFunction) {
  if (authService.isDefaultPassword()) {
    return res.status(403).json({ error: '请先修改初始密码', code: 'PASSWORD_CHANGE_REQUIRED' });
  }
  next();
}

const attempts = new Map<string, { count: number; until: number }>();
export function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  if (entry.count >= 10 || (!attempts.has(key) && attempts.size >= 10000)) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.until - now) / 1000))));
    return res.status(429).json({ error: '登录尝试过多，请稍后重试' });
  }
  entry.count++;
  attempts.set(key, entry);
  res.once('finish', () => { if (res.statusCode < 400) attempts.delete(key); });
  next();
}

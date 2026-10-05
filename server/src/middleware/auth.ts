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
  } else if (typeof req.query.token === 'string') {
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

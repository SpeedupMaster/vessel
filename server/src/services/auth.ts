import crypto from 'crypto';
import { db } from '../db/index.js';
import { AdminUser } from '../types/index.js';

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) {
    normalized += '=';
  }
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

export function createJwt(payload: { sub: string; username: string }, secret: string, expiresInSec = 7 * 24 * 3600): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const body = { ...payload, exp };

  const h = base64UrlEncode(JSON.stringify(header));
  const p = base64UrlEncode(JSON.stringify(body));
  const s = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');

  return `${h}.${p}.${s}`;
}

export function verifyJwt(token: string, secret: string): { valid: boolean; payload?: any; error?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token format' };
    }
    const [h, p, s] = parts;
    const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');

    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(s);

    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return { valid: false, error: 'Signature mismatch' };
    }

    const payload = JSON.parse(base64UrlDecode(p));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Token has expired' };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Token verification failed' };
  }
}

export class AuthService {
  private getAdmin(): AdminUser {
    let admin = db.get('admin');
    if (!admin) {
      admin = {
        initialized: true,
        username: 'admin',
        passwordHash: crypto.createHash('sha256').update('vessel2026').digest('hex'),
        jwtSecret: crypto.randomBytes(32).toString('hex'),
      };
      db.set('admin', admin);
    }
    return admin;
  }

  public hashPassword(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  public login(username: string, password: string): {
    success: boolean;
    token?: string;
    error?: string;
    username?: string;
    isDefaultPassword?: boolean;
  } {
    const admin = this.getAdmin();

    if (!username || !password) {
      return { success: false, error: '请输入用户名和密码' };
    }

    if (username.trim() !== admin.username) {
      return { success: false, error: '用户名或密码错误' };
    }

    const inputHash = this.hashPassword(password);
    if (inputHash !== admin.passwordHash) {
      return { success: false, error: '用户名或密码错误' };
    }

    const token = createJwt({ sub: admin.username, username: admin.username }, admin.jwtSecret);
    return {
      success: true,
      token,
      username: admin.username,
      isDefaultPassword: this.isDefaultPassword(),
    };
  }

  public verifyToken(token: string): { valid: boolean; username?: string; error?: string } {
    if (!token) return { valid: false, error: 'No token provided' };
    const admin = this.getAdmin();
    const res = verifyJwt(token, admin.jwtSecret);
    if (!res.valid) return { valid: false, error: res.error };
    return { valid: true, username: res.payload.username || admin.username };
  }

  public changePassword(
    currentPassword: string,
    newPassword: string
  ): { success: boolean; error?: string; token?: string; isDefaultPassword?: boolean } {
    const admin = this.getAdmin();

    if (!currentPassword || !newPassword) {
      return { success: false, error: '当前密码与新密码均不能为空' };
    }

    if (newPassword.length < 6) {
      return { success: false, error: '新密码长度至少需要 6 个字符' };
    }

    const curHash = this.hashPassword(currentPassword);
    if (curHash !== admin.passwordHash) {
      return { success: false, error: '当前旧密码不正确' };
    }

    // Update password and rotate JWT secret for maximum security
    const newSecret = crypto.randomBytes(32).toString('hex');
    const newHash = this.hashPassword(newPassword);

    const updatedAdmin: AdminUser = {
      ...admin,
      passwordHash: newHash,
      jwtSecret: newSecret,
    };

    db.set('admin', updatedAdmin);

    // Issue fresh token
    const newToken = createJwt({ sub: updatedAdmin.username, username: updatedAdmin.username }, newSecret);
    return {
      success: true,
      token: newToken,
      isDefaultPassword: false,
    };
  }

  public isDefaultPassword(): boolean {
    const admin = this.getAdmin();
    const defaultHash = this.hashPassword('vessel2026');
    return admin.passwordHash === defaultHash;
  }

  public getAdminProfile() {
    const admin = this.getAdmin();
    return {
      username: admin.username,
      initialized: admin.initialized,
      isDefaultPassword: this.isDefaultPassword(),
    };
  }
}

export const authService = new AuthService();

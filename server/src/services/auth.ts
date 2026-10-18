import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, DATA_DIR } from '../db/index.js';
import { hashPassword, matchesPassword } from './password.js';
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
  const body = { ...payload, jti: crypto.randomBytes(12).toString('base64url'), exp };

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
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Token has expired' };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Token verification failed' };
  }
}

export class AuthService {
  private getAdmin(): AdminUser {
    const admin = db.get('admin');
    if (!admin) throw new Error('Admin account is not initialized');
    return admin;
  }

  public hashPassword(raw: string): string {
    return hashPassword(raw);
  }

  public login(username: string, password: string): {
    success: boolean;
    token?: string;
    error?: string;
    username?: string;
    isDefaultPassword?: boolean;
  } {
    const admin = this.getAdmin();

    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password || password.length > 1024) {
      return { success: false, error: '请输入用户名和密码' };
    }

    if (username.trim() !== admin.username) {
      return { success: false, error: '用户名或密码错误' };
    }

    if (!matchesPassword(password, admin.passwordHash)) {
      return { success: false, error: '用户名或密码错误' };
    }

    if (!admin.passwordHash.startsWith('scrypt:')) {
      admin.mustChangePassword = this.isDefaultPassword();
      admin.passwordHash = hashPassword(password);
      db.set('admin', { ...admin });
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
    if (!res.valid || res.payload?.sub !== admin.username) return { valid: false, error: res.error || 'Invalid subject' };
    if (res.payload.jti && admin.revokedTokens?.some(item => item.jti === res.payload.jti)) return { valid: false, error: 'Token has been revoked' };
    return { valid: true, username: res.payload.username || admin.username };
  }

  /** Revoke one session; other devices stay signed in */
  public logout(token: string): void {
    const admin = this.getAdmin();
    const res = verifyJwt(token, admin.jwtSecret);
    if (!res.valid || res.payload?.sub !== admin.username || typeof res.payload.jti !== 'string') return;
    const now = Math.floor(Date.now() / 1000);
    const revoked = (admin.revokedTokens || []).filter(item => item.exp > now && item.jti !== res.payload.jti);
    revoked.push({ jti: res.payload.jti, exp: res.payload.exp });
    db.set('admin', { ...admin, revokedTokens: revoked.slice(-1000) });
  }

  public changePassword(
    currentPassword: string,
    newPassword: string
  ): { success: boolean; error?: string; token?: string; isDefaultPassword?: boolean } {
    const admin = this.getAdmin();

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
      return { success: false, error: '当前密码与新密码均不能为空' };
    }

    if (newPassword.length < 8 || newPassword.length > 1024 || newPassword === 'vessel2026' || newPassword === currentPassword) {
      return { success: false, error: '新密码长度不能少于 8 位，且不能与旧密码或默认密码相同' };
    }

    if (!matchesPassword(currentPassword, admin.passwordHash)) {
      return { success: false, error: '当前旧密码不正确' };
    }

    // Update password and rotate JWT secret for maximum security
    const newSecret = crypto.randomBytes(32).toString('hex');
    const newHash = this.hashPassword(newPassword);

    const updatedAdmin: AdminUser = {
      ...admin,
      passwordHash: newHash,
      jwtSecret: newSecret,
      mustChangePassword: false,
      revokedTokens: [],
    };

    db.set('admin', updatedAdmin);
    fs.rmSync(path.join(DATA_DIR, 'initial-admin-password'), { force: true });

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
    return !!admin.mustChangePassword || admin.passwordHash === crypto.createHash('sha256').update('vessel2026').digest('hex');
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

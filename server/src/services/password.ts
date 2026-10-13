import crypto from 'node:crypto';

export function hashPassword(raw: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt:${salt}:${crypto.scryptSync(raw, salt, 64).toString('hex')}`;
}

export function matchesPassword(raw: string, stored: string): boolean {
  if (typeof raw !== 'string' || raw.length > 1024 || typeof stored !== 'string') return false;
  const [kind, salt, digest] = stored.split(':');
  const expected = Buffer.from(kind === 'scrypt' ? digest || '' : stored, 'hex');
  const actual = kind === 'scrypt'
    ? crypto.scryptSync(raw, salt, 64)
    : crypto.createHash('sha256').update(raw).digest();
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

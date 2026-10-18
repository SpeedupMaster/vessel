import fs from 'node:fs';
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto';
import { pipeline } from 'node:stream/promises';

/**
 * Passphrase encryption for backup archives.
 * File layout: MAGIC (8) | scrypt salt (16) | GCM IV (12) | AES-256-GCM ciphertext | auth tag (16).
 * The header is authenticated as AAD, so tampering with salt/IV also fails the tag check.
 */
const MAGIC = Buffer.from('VSLENC01');
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + IV_BYTES;

export const ENCRYPTED_SUFFIX = '.enc';
export const MIN_PASSPHRASE_LENGTH = 8;
export const PASSPHRASE_REQUIRED = 'BACKUP_PASSPHRASE_REQUIRED';

/** Thrown when an encrypted backup cannot be opened with the available passphrase. */
export class PassphraseError extends Error {
  code = PASSPHRASE_REQUIRED;
}

export const isEncryptedBackup = (fileName: string) => fileName.endsWith(ENCRYPTED_SUFFIX);

function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(passphrase, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key));
  });
}

export async function encryptFile(source: string, destination: string, passphrase: string): Promise<void> {
  const header = Buffer.concat([MAGIC, randomBytes(SALT_BYTES), randomBytes(IV_BYTES)]);
  const key = await deriveKey(passphrase, header.subarray(MAGIC.length, MAGIC.length + SALT_BYTES));
  const cipher = createCipheriv('aes-256-gcm', key, header.subarray(MAGIC.length + SALT_BYTES));
  cipher.setAAD(header);
  fs.writeFileSync(destination, header, { mode: 0o600 });
  try {
    await pipeline(fs.createReadStream(source), cipher, fs.createWriteStream(destination, { flags: 'a' }));
    fs.appendFileSync(destination, cipher.getAuthTag());
  } catch (error) {
    fs.rmSync(destination, { force: true });
    throw error;
  }
}

export async function decryptFile(source: string, destination: string, passphrase: string): Promise<void> {
  const size = fs.statSync(source).size;
  if (size < HEADER_BYTES + TAG_BYTES) throw new Error('加密备份文件已损坏');
  const header = Buffer.alloc(HEADER_BYTES);
  const tag = Buffer.alloc(TAG_BYTES);
  const fd = fs.openSync(source, 'r');
  try {
    fs.readSync(fd, header, 0, HEADER_BYTES, 0);
    fs.readSync(fd, tag, 0, TAG_BYTES, size - TAG_BYTES);
  } finally {
    fs.closeSync(fd);
  }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('不是 Vessel 加密备份文件');

  const key = await deriveKey(passphrase, header.subarray(MAGIC.length, MAGIC.length + SALT_BYTES));
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(MAGIC.length + SALT_BYTES));
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  try {
    await pipeline(
      fs.createReadStream(source, { start: HEADER_BYTES, end: size - TAG_BYTES - 1 }),
      decipher,
      fs.createWriteStream(destination, { mode: 0o600 }),
    );
  } catch (error: any) {
    fs.rmSync(destination, { force: true });
    // GCM reports a wrong key and a corrupted file identically
    if (/unable to authenticate/i.test(String(error?.message))) throw new PassphraseError('备份口令错误或文件已损坏');
    throw error;
  }
}

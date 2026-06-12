import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Key must be exactly 64 hex chars (= 32 bytes / AES-256).
// Generate once with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// TOKEN_ENCRYPTION_KEY adalah nama generik (dipakai semua integrasi: Shopee,
// Instagram, WhatsApp-per-bisnis, dll). Fallback ke SHOPEE_TOKEN_ENCRYPTION_KEY
// agar key lama yang sudah di-set tetap berlaku.
const RAW_KEY =
  process.env.TOKEN_ENCRYPTION_KEY ?? process.env.SHOPEE_TOKEN_ENCRYPTION_KEY ?? '';

function getKey(): Buffer {
  if (!RAW_KEY || RAW_KEY.length !== 64) {
    throw new Error('SHOPEE_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(RAW_KEY, 'hex');
}

/**
 * Encrypt a plaintext token string.
 * Output format: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 * Always produces a new random IV so identical inputs yield different ciphertexts.
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a token produced by encryptToken.
 * Throws if the ciphertext is tampered (GCM auth tag mismatch).
 */
export function decryptToken(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}

/**
 * Returns true if the value looks like an encrypted token (iv:tag:data format).
 * Used to safely handle rows that were written before encryption was added.
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 3 && parts[0].length === 24; // 12-byte IV = 24 hex chars
}

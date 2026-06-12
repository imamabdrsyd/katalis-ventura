/**
 * Helper generic untuk `channel_integrations.config` — penyimpanan token
 * per-bisnis (multi-tenant). Dipakai lintas channel:
 * - Instagram (sekarang): token hasil OAuth disimpan terenkripsi di config
 * - WhatsApp-per-bisnis (rencana): nomor + token per bisnis pakai pola sama
 *
 * Token SELALU disimpan terenkripsi (AES-256-GCM via tokenCrypto) dan
 * di-strip sebelum dikirim ke client (lihat stripSecrets).
 */

import type { ChannelIntegration } from '@/types';
import { encryptToken, decryptToken, isEncrypted } from '@/lib/utils/tokenCrypto';

/**
 * Bentuk `config` JSONB untuk integrasi berbasis token (mis. Instagram).
 * `access_token` disimpan dalam bentuk terenkripsi.
 */
export interface IntegrationTokenConfig {
  /** Token terenkripsi (format iv:tag:cipher dari tokenCrypto) */
  access_token?: string;
  /** ISO timestamp kapan token kedaluwarsa (long-lived IG ~60 hari) */
  token_expires_at?: string;
  /** Username/handle akun yang terhubung — aman ditampilkan ke client */
  username?: string;
  [key: string]: unknown;
}

/** Field config yang aman dikirim ke client (tanpa token). */
const SECRET_CONFIG_KEYS = ['access_token'] as const;

/**
 * Bangun objek config dengan token plaintext dienkripsi. Field lain
 * (username, token_expires_at, dll) disimpan apa adanya.
 */
export function buildTokenConfig(params: {
  accessToken: string;
  tokenExpiresAt?: string | null;
  username?: string | null;
  extra?: Record<string, unknown>;
}): IntegrationTokenConfig {
  return {
    ...params.extra,
    access_token: encryptToken(params.accessToken),
    ...(params.tokenExpiresAt ? { token_expires_at: params.tokenExpiresAt } : {}),
    ...(params.username ? { username: params.username } : {}),
  };
}

/**
 * Ambil token plaintext dari integration. Return null kalau tidak ada /
 * format tidak valid. Backward-compatible: kalau ternyata belum terenkripsi
 * (mis. data lama), kembalikan apa adanya.
 */
export function getDecryptedToken(integration: ChannelIntegration): string | null {
  const raw = (integration.config as IntegrationTokenConfig | null)?.access_token;
  if (!raw || typeof raw !== 'string') return null;
  try {
    return isEncrypted(raw) ? decryptToken(raw) : raw;
  } catch (err) {
    console.warn('[integrations/config] gagal decrypt token:', err);
    return null;
  }
}

/**
 * Hapus field rahasia dari config sebelum dikirim ke client.
 * Mengembalikan salinan dangkal config tanpa token.
 */
export function stripSecrets(
  config: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!config) return null;
  const clone = { ...config };
  for (const key of SECRET_CONFIG_KEYS) delete clone[key];
  return clone;
}

/**
 * Versi ChannelIntegration yang aman dikirim ke client — config tanpa token.
 */
export function toClientIntegration(integration: ChannelIntegration): ChannelIntegration {
  return { ...integration, config: stripSecrets(integration.config) };
}

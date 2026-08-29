/**
 * Menjaga long-lived token Instagram tetap hidup.
 *
 * Token IG umurnya 60 hari dan TIDAK diperpanjang otomatis oleh Meta. Sebelum
 * ini token Telcantik & elvéa mati 11 Agu 2026 tanpa gejala yang kelihatan:
 * webhook tetap menerima DM (webhook tidak butuh token), tapi semua panggilan
 * Graph API diam-diam gagal — nama lead jatuh ke fallback "@<IGSID>" dan
 * auto-send mati. Karena itu refresh dilakukan oportunistik di jalur webhook:
 * selama masih ada DM masuk, token tidak akan pernah sampai kedaluwarsa.
 *
 * Meta mensyaratkan token berumur >= 24 jam dan belum kedaluwarsa untuk bisa
 * di-refresh. Kalau sudah telanjur mati, tidak ada jalan lain selain user
 * menyambungkan ulang lewat OAuth.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChannelIntegration } from '@/types';
import { refreshLongLivedToken } from './oauth';
import { buildTokenConfig, getDecryptedToken } from '@/lib/integrations/config';

/** Refresh saat sisa umur token di bawah ambang ini. */
const REFRESH_THRESHOLD_DAYS = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sisa umur token dalam hari; null kalau expiry tidak tercatat. */
export function getTokenDaysLeft(integration: ChannelIntegration): number | null {
  const raw = (integration.config as Record<string, unknown> | null)?.token_expires_at;
  if (typeof raw !== 'string') return null;
  const expiresAt = new Date(raw).getTime();
  if (Number.isNaN(expiresAt)) return null;
  return (expiresAt - Date.now()) / DAY_MS;
}

/**
 * Kembalikan token yang dijamin masih segar. Kalau sisa umurnya sudah menipis,
 * perpanjang dulu lalu simpan token baru ke DB.
 *
 * Selalu mengembalikan token yang ada meski refresh gagal — token lama mungkin
 * masih hidup beberapa hari lagi, jadi jangan matikan alur pesan hanya karena
 * refresh tidak berhasil.
 */
export async function getFreshToken(
  supabase: SupabaseClient,
  integration: ChannelIntegration
): Promise<string | null> {
  const current = getDecryptedToken(integration);
  if (!current) return null;

  const daysLeft = getTokenDaysLeft(integration);
  // Expiry tidak tercatat → jangan tebak-tebak, pakai apa adanya.
  if (daysLeft === null) return current;
  // Sudah kedaluwarsa → refresh pasti ditolak Meta, user harus reconnect.
  if (daysLeft <= 0) {
    console.warn(
      '[instagram/token] token kedaluwarsa untuk bisnis',
      integration.business_id,
      '— perlu sambungkan ulang'
    );
    return current;
  }
  if (daysLeft > REFRESH_THRESHOLD_DAYS) return current;

  const refreshed = await refreshLongLivedToken(current);
  if (!refreshed) return current;

  const expiresAt = refreshed.expiresIn
    ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
    : null;

  // Merge ke config lama supaya setelan non-token (mis. ai_tier) tidak hilang.
  const config = buildTokenConfig({
    accessToken: refreshed.accessToken,
    tokenExpiresAt: expiresAt,
    extra: (integration.config as Record<string, unknown> | null) ?? undefined,
  });

  const { error } = await supabase
    .from('channel_integrations')
    .update({ config })
    .eq('id', integration.id);

  if (error) {
    // Token baru gagal disimpan — tetap dipakai untuk request ini, percobaan
    // berikutnya akan mengulang refresh.
    console.warn('[instagram/token] gagal simpan token hasil refresh:', error.message);
  } else {
    console.info('[instagram/token] token diperpanjang untuk bisnis', integration.business_id);
  }

  return refreshed.accessToken;
}

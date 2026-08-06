import { createAdminClient } from '@/lib/supabase-server';
import { encryptToken, decryptToken, isEncrypted } from '@/lib/utils/tokenCrypto';
import { refreshGoogleAccessToken, revokeGoogleToken, REQUIRED_SCOPE } from './oauth';

/**
 * Lapisan penyimpanan + siklus hidup token Google (per-USER).
 *
 * ⚠️ SERVER-ONLY. Modul ini JANGAN PERNAH diimpor dari komponen 'use client'.
 * Ia memakai `createAdminClient()` (service role) dan menangani token mentah.
 *
 * Kenapa admin client, padahal RLS sudah ada: kolom token sengaja TIDAK
 * di-GRANT ke role `authenticated` di migrasi 127, jadi klien biasa memang
 * tidak bisa membacanya sama sekali — itu lapisan pertahanan kedua kalau
 * suatu saat ada kode yang tidak sengaja `select('*')` dari browser.
 *
 * KONTRAK: setiap pemanggil WAJIB sudah memverifikasi `userId` lewat
 * `getAuthenticatedUser()` di route handler. Fungsi di sini percaya begitu saja
 * pada `userId` yang diberikan.
 */

const TABLE = 'google_sheets_connections';

/** Ambang refresh: token dianggap kedaluwarsa 2 menit sebelum waktunya. */
const EXPIRY_SKEW_MS = 120_000;

export interface GoogleConnectionStatus {
  connected: boolean;
  email: string | null;
  connected_at: string | null;
  /** true bila refresh gagal invalid_grant — UI menawarkan "Hubungkan ulang". */
  needs_reconnect: boolean;
}

const DISCONNECTED: GoogleConnectionStatus = {
  connected: false,
  email: null,
  connected_at: null,
  needs_reconnect: false,
};

/**
 * Status koneksi untuk UI. TIDAK PERNAH memuat token — objeknya disusun
 * manual field-per-field, bukan hasil spread baris DB, supaya kolom rahasia
 * tidak bisa ikut bocor karena kelalaian.
 */
export async function getGoogleConnectionStatus(userId: string): Promise<GoogleConnectionStatus> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from(TABLE)
    .select('google_account_email, is_active, last_error, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return DISCONNECTED;

  const needsReconnect = !data.is_active || data.last_error === 'invalid_grant';

  return {
    connected: !needsReconnect,
    email: data.google_account_email ?? null,
    connected_at: data.created_at ?? null,
    needs_reconnect: needsReconnect,
  };
}

export type AccessTokenResult =
  | { ok: true; accessToken: string; expiresAt: string; email: string }
  | { ok: false; reason: 'not_connected' | 'revoked' | 'refresh_failed' };

/**
 * Kembalikan access token yang dijamin masih berlaku.
 *
 * Alur: baris tidak ada → not_connected · masih berlaku (skew 2 menit) →
 * dekripsi & kembalikan · selain itu refresh → `invalid_grant` maka tandai
 * koneksi perlu dihubungkan ulang → revoked · sukses maka enkripsi ulang & simpan.
 *
 * Catatan race: dua request bersamaan bisa sama-sama me-refresh. Itu tidak
 * berbahaya — Google menyimpan hingga 100 refresh token per klien/user dan
 * access token lama tetap berlaku sampai kedaluwarsa. Tidak perlu lock.
 */
export async function getValidGoogleAccessToken(userId: string): Promise<AccessTokenResult> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from(TABLE)
    .select('google_account_email, access_token, refresh_token, token_expires_at, is_active')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data || !data.refresh_token) return { ok: false, reason: 'not_connected' };
  if (!data.is_active) return { ok: false, reason: 'revoked' };

  const email = data.google_account_email ?? '';

  // Masih berlaku? Pakai yang tersimpan.
  if (data.access_token && data.token_expires_at) {
    const expiresAtMs = new Date(data.token_expires_at).getTime();
    if (Number.isFinite(expiresAtMs) && expiresAtMs - EXPIRY_SKEW_MS > Date.now()) {
      try {
        const accessToken = isEncrypted(data.access_token)
          ? decryptToken(data.access_token)
          : data.access_token;
        return { ok: true, accessToken, expiresAt: data.token_expires_at, email };
      } catch {
        // Dekripsi gagal (mis. TOKEN_ENCRYPTION_KEY dirotasi) — jatuh ke refresh.
      }
    }
  }

  let refreshToken: string;
  try {
    refreshToken = isEncrypted(data.refresh_token)
      ? decryptToken(data.refresh_token)
      : data.refresh_token;
  } catch {
    await markRevoked(userId, 'decrypt_failed');
    return { ok: false, reason: 'revoked' };
  }

  const refreshed = await refreshGoogleAccessToken(refreshToken);

  if (!refreshed.ok) {
    if (refreshed.reason === 'invalid_grant') {
      // User mencabut akses di myaccount.google.com/permissions, atau refresh
      // token kedaluwarsa. Tidak ada gunanya retry — minta hubungkan ulang.
      await markRevoked(userId, 'invalid_grant');
      return { ok: false, reason: 'revoked' };
    }
    return { ok: false, reason: 'refresh_failed' };
  }

  const expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();

  await supabase
    .from(TABLE)
    .update({
      access_token: encryptToken(refreshed.accessToken),
      token_expires_at: expiresAt,
      last_error: null,
    })
    .eq('user_id', userId);

  return { ok: true, accessToken: refreshed.accessToken, expiresAt, email };
}

async function markRevoked(userId: string, reason: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from(TABLE)
    .update({ is_active: false, revoked_at: new Date().toISOString(), last_error: reason })
    .eq('user_id', userId);
}

export interface SaveConnectionInput {
  userId: string;
  email: string;
  googleSub: string;
  accessToken: string;
  /** Plaintext. Bila null, refresh token lama dipertahankan (lihat callback). */
  refreshToken: string | null;
  expiresInSeconds: number;
  scopes: string[];
}

/**
 * Simpan/perbarui koneksi setelah consent berhasil.
 *
 * Google hanya mengirim `refresh_token` saat consent pertama (atau saat
 * `prompt=consent`). Bila kali ini tidak dikirim DAN akun Google-nya sama,
 * refresh token lama tetap dipakai — jadi reconnect tidak menghasilkan koneksi
 * lumpuh yang mati dalam 1 jam.
 */
export async function saveGoogleConnection(
  input: SaveConnectionInput
): Promise<{ ok: true } | { ok: false; reason: 'no_refresh_token' }> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from(TABLE)
    .select('refresh_token, google_sub')
    .eq('user_id', input.userId)
    .maybeSingle();

  let refreshTokenCipher: string | null = null;
  if (input.refreshToken) {
    refreshTokenCipher = encryptToken(input.refreshToken);
  } else if (existing?.refresh_token && existing.google_sub === input.googleSub) {
    refreshTokenCipher = existing.refresh_token; // sudah terenkripsi
  }

  if (!refreshTokenCipher) return { ok: false, reason: 'no_refresh_token' };

  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: input.userId,
      google_account_email: input.email,
      google_sub: input.googleSub,
      access_token: encryptToken(input.accessToken),
      refresh_token: refreshTokenCipher,
      token_expires_at: new Date(Date.now() + input.expiresInSeconds * 1000).toISOString(),
      scopes: input.scopes,
      is_active: true,
      last_error: null,
      revoked_at: null,
    },
    { onConflict: 'user_id' }
  );

  if (error) throw new Error(`Gagal menyimpan koneksi Google: ${error.message}`);
  return { ok: true };
}

/**
 * Putuskan koneksi: cabut token di Google lalu hapus barisnya.
 *
 * Mencabut refresh token otomatis mencabut semua access token turunannya.
 * Baris tetap dihapus walau pencabutan gagal — kalau tidak, user "sudah
 * memutus" di UI tapi grant-nya masih hidup di Google, dan itu lebih buruk.
 */
export async function disconnectGoogle(userId: string): Promise<{ revoked: boolean }> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from(TABLE)
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle();

  let revoked = false;
  if (data?.refresh_token) {
    try {
      const token = isEncrypted(data.refresh_token)
        ? decryptToken(data.refresh_token)
        : data.refresh_token;
      revoked = await revokeGoogleToken(token);
    } catch {
      revoked = false;
    }
  }

  await supabase.from(TABLE).delete().eq('user_id', userId);
  await supabase.from('google_sheets_recent_files').delete().eq('user_id', userId);

  return { revoked };
}

/** Cek apakah koneksi punya scope drive.file (bisa hilang bila user tidak mencentangnya). */
export function hasRequiredScope(scopes: string[] | null | undefined): boolean {
  return Array.isArray(scopes) && scopes.includes(REQUIRED_SCOPE);
}

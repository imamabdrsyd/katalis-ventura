import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import {
  exchangeGoogleCode,
  verifyState,
  decodeIdToken,
  REQUIRED_SCOPE,
  NONCE_COOKIE,
} from '@/lib/google/oauth';
import { saveGoogleConnection } from '@/lib/google/connection';

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/** Redirect balik ke UI dengan pesan error yang bisa dibaca user. */
function fail(returnTo: string, message: string): NextResponse {
  const url = new URL(returnTo, APP_URL());
  url.searchParams.set('google_sheets_error', message);
  const res = NextResponse.redirect(url);
  res.cookies.delete(NONCE_COOKIE);
  return res;
}

/** Bandingkan dua string tanpa membocorkan lewat waktu eksekusi. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * GET /api/integrations/google-sheets/callback?code=...&state=...
 *
 * Urutan guard-nya disengaja — masing-masing menutup satu kelas serangan:
 *  1. verifyState        → state dipalsukan / kedaluwarsa
 *  2. cookie nonce cocok → URL callback dikirim penyerang ke korban
 *  3. user terautentikasi
 *  4. state.u === user.id → account-linking CSRF (akun Google penyerang
 *                            ditempelkan ke akun AXION korban)
 *  5. scope drive.file ada → user tidak mencentang izin file
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawState = params.get('state');
  const payload = rawState ? verifyState(rawState) : null;

  // returnTo hanya dipercaya bila state-nya valid; kalau tidak, pakai default.
  const returnTo = payload?.r ?? '/settings';

  const oauthError = params.get('error');
  if (oauthError) {
    const message =
      oauthError === 'access_denied'
        ? 'Kamu membatalkan proses menghubungkan akun Google.'
        : `Google menolak permintaan: ${oauthError}`;
    return fail(returnTo, message);
  }

  if (!payload) {
    return fail('/settings', 'Sesi otorisasi tidak valid atau kedaluwarsa. Coba hubungkan lagi.');
  }

  const nonceCookie = request.cookies.get(NONCE_COOKIE)?.value;
  if (!nonceCookie || !safeEqual(nonceCookie, payload.n)) {
    return fail(returnTo, 'Verifikasi keamanan gagal. Coba hubungkan lagi dari halaman Pengaturan.');
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', APP_URL()));
  }

  // Akun yang memulai flow harus sama dengan yang menyelesaikannya.
  if (user.id !== payload.u) {
    return fail(returnTo, 'Sesi tidak cocok dengan akun yang sedang masuk. Coba hubungkan lagi.');
  }

  const code = params.get('code');
  if (!code) {
    return fail(returnTo, 'Google tidak mengirim kode otorisasi. Coba hubungkan lagi.');
  }

  try {
    const redirectUri = `${APP_URL()}/api/integrations/google-sheets/callback`;
    const tokens = await exchangeGoogleCode(code, redirectUri);

    const grantedScopes = (tokens.scope ?? '').split(' ').filter(Boolean);
    if (!grantedScopes.includes(REQUIRED_SCOPE)) {
      return fail(
        returnTo,
        'Izin akses berkas belum dicentang. Hubungkan lagi dan pastikan izin Google Drive disetujui.'
      );
    }

    const identity = decodeIdToken(tokens.id_token);
    if (!identity?.sub) {
      return fail(returnTo, 'Gagal membaca identitas akun Google. Coba hubungkan lagi.');
    }

    const saved = await saveGoogleConnection({
      userId: user.id,
      email: identity.email ?? '',
      googleSub: identity.sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresInSeconds: tokens.expires_in ?? 3600,
      scopes: grantedScopes,
    });

    if (!saved.ok) {
      // Google hanya mengirim refresh_token pada consent pertama. Kalau tidak
      // ada DAN tidak punya yang lama, koneksi akan mati dalam 1 jam — lebih
      // baik gagal sekarang dengan instruksi yang jelas.
      return fail(
        returnTo,
        'Google tidak mengirim izin jangka panjang. Hapus akses AXION di myaccount.google.com/permissions lalu hubungkan lagi.'
      );
    }

    const successUrl = new URL(returnTo, APP_URL());
    successUrl.searchParams.set('google_sheets_connected', '1');
    const res = NextResponse.redirect(successUrl);
    res.cookies.delete(NONCE_COOKIE);
    return res;
  } catch (error) {
    console.error('[google-sheets] callback gagal', error);
    return fail(returnTo, 'Gagal menghubungkan akun Google. Coba lagi beberapa saat.');
  }
}

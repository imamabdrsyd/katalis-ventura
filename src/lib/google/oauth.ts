import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Klien OAuth Google untuk integrasi Google Sheets (playground).
 *
 * Modul ini MURNI: tidak menyentuh database sama sekali, supaya bisa diuji unit
 * tanpa Supabase. Lapisan yang menyimpan/merefresh token ada di `./connection.ts`.
 *
 * ── Kenapa scope-nya cuma tiga ──────────────────────────────────────────────
 * `drive.file` memberi akses HANYA ke file yang dibuat aplikasi ini atau yang
 * dipilih user lewat Google Picker. Scope ini non-sensitive, jadi consent screen
 * bisa langsung "In production" tanpa security assessment (CASA).
 *
 * JANGAN menambahkan `.../auth/spreadsheets` atau `drive.readonly`. Keduanya
 * sensitive/restricted dan akan menyeret aplikasi ke antrean verifikasi Google
 * — padahal Sheets API sudah menghormati `drive.file` untuk semua operasi yang
 * dibutuhkan (values.get, values.update, spreadsheets.create).
 */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/drive.file',
] as const;

/** Scope yang WAJIB ada di respons token; user bisa saja tidak mencentangnya. */
export const REQUIRED_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

/** Umur `state` yang masih diterima. Cukup longgar untuk consent yang lambat. */
const STATE_TTL_MS = 10 * 60 * 1000;

/** Nama cookie HttpOnly penyimpan nonce (double-submit terhadap `state`). */
export const NONCE_COOKIE = 'gs_oauth_nonce';

export interface GoogleStatePayload {
  /** nonce — dicocokkan dengan cookie HttpOnly (double-submit). */
  n: string;
  /** userId AXION yang memulai flow — mencegah account-linking CSRF. */
  u: string;
  /** returnTo, wajib path relatif same-origin. */
  r: string;
  /** issuedAt (ms epoch). */
  t: number;
}

function getStateSecret(): string {
  // Dibaca lazily (bukan di module load) supaya modul tetap bisa diimpor di
  // lingkungan tanpa env — mis. saat unit test mengeset env sebelum memanggil.
  const secret = process.env.GOOGLE_OAUTH_STATE_SECRET ?? '';
  if (!secret) {
    throw new Error('GOOGLE_OAUTH_STATE_SECRET belum diset');
  }
  return secret;
}

const b64url = (buf: Buffer): string => buf.toString('base64url');

function hmac(data: string): Buffer {
  return createHmac('sha256', getStateSecret()).update(data).digest();
}

/** Nonce acak untuk cookie + payload state. */
export function generateNonce(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Tanda tangani payload state: `base64url(JSON).base64url(HMAC-SHA256)`.
 *
 * Ini memperbaiki kelemahan flow Instagram/Shopee yang memakai businessId
 * mentah sebagai state tanpa nonce maupun tanda tangan.
 */
export function signState(payload: GoogleStatePayload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${body}.${b64url(hmac(body))}`;
}

/**
 * Verifikasi tanda tangan + TTL. Mengembalikan `null` untuk SEMUA bentuk
 * kegagalan (format salah, tanda tangan tidak cocok, kedaluwarsa) supaya
 * pemanggil tidak bisa membedakan penyebabnya.
 */
export function verifyState(state: string): GoogleStatePayload | null {
  if (typeof state !== 'string') return null;

  const parts = state.split('.');
  if (parts.length !== 2) return null;

  const [body, sig] = parts;
  if (!body || !sig) return null;

  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = hmac(body);
    actual = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }

  // timingSafeEqual melempar bila panjangnya beda — cek dulu.
  if (actual.length !== expected.length) return null;
  if (!timingSafeEqual(actual, expected)) return null;

  let payload: GoogleStatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (
    !payload ||
    typeof payload.n !== 'string' ||
    typeof payload.u !== 'string' ||
    typeof payload.r !== 'string' ||
    typeof payload.t !== 'number'
  ) {
    return null;
  }

  const age = Date.now() - payload.t;
  // Tolak juga state "dari masa depan" (clock skew besar / payload dikarang).
  if (age < -60_000 || age > STATE_TTL_MS) return null;

  return payload;
}

/**
 * Bersihkan `returnTo` jadi path relatif same-origin.
 *
 * Menolak URL absolut (`https://evil.com`) DAN protocol-relative (`//evil.com`)
 * — keduanya jalur open-redirect klasik.
 */
export function sanitizeReturnTo(raw: string | null | undefined, fallback = '/settings'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  if (!raw.startsWith('/')) return fallback;
  if (raw.startsWith('//')) return fallback;
  if (raw.includes('\\')) return fallback;
  if (!/^\/[\w\-./?=&%]*$/.test(raw)) return fallback;
  return raw;
}

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? '';
  if (!clientId) throw new Error('GOOGLE_OAUTH_CLIENT_ID belum diset');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    // WAJIB: tanpa ini Google tidak pernah mengirim refresh_token.
    access_type: 'offline',
    // WAJIB juga: tanpa `prompt=consent`, refresh_token hanya dikirim pada
    // consent PERTAMA seumur hidup akun. Reconnect setelah token hilang akan
    // menghasilkan koneksi yang mati dalam 1 jam tanpa cara memperbaruinya.
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });

  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Token exchange gagal (${res.status}): ${detail.slice(0, 200)}`);
  }

  return (await res.json()) as GoogleTokenResponse;
}

export type RefreshResult =
  | { ok: true; accessToken: string; expiresIn: number; scope: string }
  | { ok: false; reason: 'invalid_grant' | 'network' | 'unknown'; detail?: string };

/**
 * Tukar refresh token jadi access token baru.
 *
 * `invalid_grant` dibedakan dari error lain karena artinya spesifik: user
 * mencabut akses di myaccount.google.com/permissions, atau refresh token
 * kedaluwarsa (terjadi tiap 7 hari bila consent screen masih "Testing").
 * Pemanggil harus menandai koneksi sebagai perlu-dihubungkan-ulang, bukan retry.
 */
export async function refreshGoogleAccessToken(refreshToken: string): Promise<RefreshResult> {
  let res: Response;
  try {
    res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
        grant_type: 'refresh_token',
      }),
    });
  } catch (e) {
    return { ok: false, reason: 'network', detail: e instanceof Error ? e.message : undefined };
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (detail.includes('invalid_grant')) {
      return { ok: false, reason: 'invalid_grant', detail };
    }
    return { ok: false, reason: 'unknown', detail: detail.slice(0, 200) };
  }

  const json = (await res.json()) as GoogleTokenResponse;
  return {
    ok: true,
    accessToken: json.access_token,
    expiresIn: json.expires_in,
    scope: json.scope ?? '',
  };
}

/**
 * Cabut token di sisi Google. Mencabut refresh token otomatis mencabut semua
 * access token turunannya. HTTP 400 dianggap sukses — artinya token memang
 * sudah tidak berlaku, dan tujuan kita (tidak ada grant tersisa) sudah tercapai.
 */
export async function revokeGoogleToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
    return res.ok || res.status === 400;
  } catch {
    return false;
  }
}

/**
 * Ambil `email` dan `sub` dari id_token TANPA memverifikasi tanda tangan.
 *
 * Aman di sini: id_token datang langsung dari token endpoint Google lewat TLS
 * pada koneksi server-ke-server, bukan dari browser. Kalau suatu saat id_token
 * diterima dari klien, verifikasi tanda tangan menjadi WAJIB.
 */
export function decodeIdToken(idToken: string | undefined): { email?: string; sub?: string } | null {
  if (!idToken) return null;
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return { email: payload.email, sub: payload.sub };
  } catch {
    return null;
  }
}

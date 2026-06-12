/**
 * OAuth "Instagram API with Instagram Login" (multi-tenant).
 * Tiap bisnis login akun Instagram profesionalnya sendiri → kita simpan
 * long-lived token per-bisnis di channel_integrations.config.
 *
 * Env: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET.
 * Ref: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
 */

const IG_GRAPH_VERSION = 'v21.0';
const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
const SHORT_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const GRAPH_BASE = 'https://graph.instagram.com';

// Izin minimal: baca profil dasar + kelola pesan (DM masuk/keluar).
const SCOPES = ['instagram_business_basic', 'instagram_business_manage_messages'];

export interface InstagramTokenResult {
  accessToken: string;
  /** IG-scoped user id akun bisnis — dipakai sebagai external_account_id (lookup webhook) */
  userId: string;
}

export interface InstagramProfile {
  userId: string;
  username: string;
}

/** URL otorisasi Instagram — `state` membawa businessId agar terbaca di callback. */
export function getInstagramAuthUrl(redirectUri: string, state: string): string {
  const appId = process.env.INSTAGRAM_APP_ID;
  const params = new URLSearchParams({
    client_id: appId ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(','),
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/** Tukar authorization code → short-lived token + user_id. */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<InstagramTokenResult | null> {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) {
    console.warn('[instagram/oauth] INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET belum di-set');
    return null;
  }

  try {
    const body = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    });
    const res = await fetch(SHORT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      console.warn('[instagram/oauth] exchange code gagal:', res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as { access_token?: string; user_id?: number | string };
    if (!json.access_token || json.user_id == null) return null;
    return { accessToken: json.access_token, userId: String(json.user_id) };
  } catch (err) {
    console.warn('[instagram/oauth] exchange code error:', err);
    return null;
  }
}

/** Tukar short-lived → long-lived token (~60 hari). */
export async function getLongLivedToken(
  shortToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) return null;

  try {
    const params = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: appSecret,
      access_token: shortToken,
    });
    const res = await fetch(`${GRAPH_BASE}/access_token?${params.toString()}`);
    if (!res.ok) {
      console.warn('[instagram/oauth] long-lived token gagal:', res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    return { accessToken: json.access_token, expiresIn: json.expires_in ?? 0 };
  } catch (err) {
    console.warn('[instagram/oauth] long-lived token error:', err);
    return null;
  }
}

/** Ambil user_id + username akun yang terhubung. */
export async function getInstagramProfile(token: string): Promise<InstagramProfile | null> {
  try {
    const params = new URLSearchParams({ fields: 'user_id,username', access_token: token });
    const res = await fetch(`${GRAPH_BASE}/${IG_GRAPH_VERSION}/me?${params.toString()}`);
    if (!res.ok) {
      console.warn('[instagram/oauth] ambil profil gagal:', res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as { user_id?: number | string; username?: string };
    if (json.user_id == null) return null;
    return { userId: String(json.user_id), username: json.username ?? '' };
  } catch (err) {
    console.warn('[instagram/oauth] ambil profil error:', err);
    return null;
  }
}

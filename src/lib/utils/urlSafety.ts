/**
 * URL safety helpers untuk link yang disimpan user dan dirender di halaman
 * publik (omni-channel link-in-bio).
 *
 * Stored XSS guard: tanpa ini, url `javascript:...`/`data:...` yang disimpan
 * manager (atau akun manager yang terkompromi) akan ter-render sebagai anchor
 * yang mengeksekusi script di browser pengunjung (audit 2026-06-11, SEC-M2).
 *
 * Dipakai di DUA layer:
 *   1. Validasi Zod di API route (tolak saat simpan)
 *   2. Scheme-guard saat render di OmnichannelLinks/OmnichannelLinkCards
 *      (data lama yang tersimpan sebelum validasi tetap dinetralkan)
 */

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'tel:', 'mailto:']);

/**
 * Mengembalikan URL yang aman untuk dipakai sebagai href, atau null bila
 * skema tidak diizinkan / tidak bisa di-parse.
 *
 * URL tanpa skema (mis. "wa.me/628...") dianggap https.
 */
export function safeLinkUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (!SAFE_PROTOCOLS.has(parsed.protocol)) return null;
    return candidate;
  } catch {
    return null;
  }
}

/** True bila URL lolos allowlist skema (http/https/tel/mailto). */
export function isSafeLinkUrl(rawUrl: string): boolean {
  return safeLinkUrl(rawUrl) !== null;
}

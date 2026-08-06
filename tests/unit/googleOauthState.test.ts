import { describe, it, expect, beforeAll } from 'vitest';
import {
  signState,
  verifyState,
  sanitizeReturnTo,
  buildGoogleAuthUrl,
  decodeIdToken,
  GOOGLE_SCOPES,
  type GoogleStatePayload,
} from '@/lib/google/oauth';

/**
 * Parameter `state` OAuth adalah pertahanan CSRF utama flow ini. Test di sini
 * mengunci tiga sifatnya: tidak bisa dipalsukan, kedaluwarsa, dan terikat ke
 * user yang memulai flow.
 */
beforeAll(() => {
  process.env.GOOGLE_OAUTH_STATE_SECRET = 'a'.repeat(64);
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
});

const payload = (over: Partial<GoogleStatePayload> = {}): GoogleStatePayload => ({
  n: 'abc123',
  u: 'user-uuid-1',
  r: '/settings',
  t: Date.now(),
  ...over,
});

describe('signState / verifyState', () => {
  it('bolak-balik untuk state yang sah', () => {
    const p = payload();
    const verified = verifyState(signState(p));

    expect(verified).not.toBeNull();
    expect(verified!.u).toBe('user-uuid-1');
    expect(verified!.n).toBe('abc123');
    expect(verified!.r).toBe('/settings');
  });

  it('menolak state dengan tanda tangan dirusak', () => {
    const signed = signState(payload());
    const [body] = signed.split('.');
    expect(verifyState(`${body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`)).toBeNull();
  });

  it('menolak state dengan payload diubah (tanda tangan tidak ikut berubah)', () => {
    const signed = signState(payload());
    const [, sig] = signed.split('.');
    const forged = Buffer.from(JSON.stringify(payload({ u: 'user-penyerang' })), 'utf8').toString(
      'base64url'
    );
    expect(verifyState(`${forged}.${sig}`)).toBeNull();
  });

  it('menolak state kedaluwarsa (> 10 menit)', () => {
    const stale = signState(payload({ t: Date.now() - 11 * 60 * 1000 }));
    expect(verifyState(stale)).toBeNull();
  });

  it('menerima state yang masih dalam TTL', () => {
    const fresh = signState(payload({ t: Date.now() - 5 * 60 * 1000 }));
    expect(verifyState(fresh)).not.toBeNull();
  });

  it('menolak state dari masa depan (payload dikarang)', () => {
    const future = signState(payload({ t: Date.now() + 5 * 60 * 1000 }));
    expect(verifyState(future)).toBeNull();
  });

  it('menolak input berformat salah', () => {
    expect(verifyState('')).toBeNull();
    expect(verifyState('tanpa-titik')).toBeNull();
    expect(verifyState('a.b.c')).toBeNull();
    expect(verifyState('.')).toBeNull();
  });
});

describe('sanitizeReturnTo', () => {
  it('meloloskan path relatif', () => {
    expect(sanitizeReturnTo('/settings')).toBe('/settings');
    expect(sanitizeReturnTo('/sheets?file=abc123')).toBe('/sheets?file=abc123');
  });

  it('menolak URL absolut dan protocol-relative (open redirect)', () => {
    expect(sanitizeReturnTo('https://evil.com')).toBe('/settings');
    expect(sanitizeReturnTo('//evil.com')).toBe('/settings');
    expect(sanitizeReturnTo('http://evil.com/x')).toBe('/settings');
    expect(sanitizeReturnTo('/\\evil.com')).toBe('/settings');
  });

  it('mengembalikan fallback untuk input kosong', () => {
    expect(sanitizeReturnTo(null)).toBe('/settings');
    expect(sanitizeReturnTo(undefined)).toBe('/settings');
    expect(sanitizeReturnTo('')).toBe('/settings');
  });
});

describe('buildGoogleAuthUrl', () => {
  const url = () => new URL(buildGoogleAuthUrl('https://app.test/cb', 'STATE'));

  it('meminta offline access + prompt consent agar refresh token pasti dikirim', () => {
    const p = url().searchParams;
    expect(p.get('access_type')).toBe('offline');
    expect(p.get('prompt')).toBe('consent');
    expect(p.get('state')).toBe('STATE');
    expect(p.get('redirect_uri')).toBe('https://app.test/cb');
  });

  it('hanya meminta scope non-sensitive', () => {
    const scope = url().searchParams.get('scope') ?? '';
    expect(scope).toBe(GOOGLE_SCOPES.join(' '));
    // Regresi guard: scope sensitive menyeret app ke antrean verifikasi Google.
    expect(scope).not.toContain('auth/spreadsheets');
    expect(scope).not.toContain('drive.readonly');
    expect(scope).toContain('drive.file');
  });
});

describe('decodeIdToken', () => {
  it('mengambil email dan sub', () => {
    const body = Buffer.from(JSON.stringify({ email: 'a@b.com', sub: '12345' })).toString(
      'base64url'
    );
    expect(decodeIdToken(`header.${body}.sig`)).toEqual({ email: 'a@b.com', sub: '12345' });
  });

  it('mengembalikan null untuk input tidak valid', () => {
    expect(decodeIdToken(undefined)).toBeNull();
    expect(decodeIdToken('bukan-jwt')).toBeNull();
    expect(decodeIdToken('a.!!!.c')).toBeNull();
  });
});

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import {
  buildGoogleAuthUrl,
  signState,
  sanitizeReturnTo,
  generateNonce,
  NONCE_COOKIE,
} from '@/lib/google/oauth';

/**
 * GET /api/integrations/google-sheets/auth?returnTo=/settings
 *
 * Mulai alur OAuth Google untuk fitur playground Sheets.
 *
 * Integrasi ini PER-USER (bukan per-bisnis seperti Instagram/WhatsApp), karena
 * Google Drive itu milik pribadi seseorang — mengikatnya ke bisnis akan membuat
 * Drive pribadi satu manager terjangkau rekan satu bisnisnya.
 *
 * `state` ditandatangani HMAC + diikat ke nonce cookie DAN ke user.id.
 * Ini memperbaiki kelemahan alur Instagram/Shopee yang memakai businessId
 * mentah tanpa tanda tangan maupun nonce.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_STATE_SECRET) {
    return NextResponse.json(
      { error: 'Integrasi Google Sheets belum dikonfigurasi di server.' },
      { status: 503 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/integrations/google-sheets/callback`;

  const nonce = generateNonce();
  const state = signState({
    n: nonce,
    u: user.id,
    r: sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo')),
    t: Date.now(),
  });

  const response = NextResponse.redirect(buildGoogleAuthUrl(redirectUri, state));

  // Double-submit: nonce disimpan di cookie HttpOnly dan dicocokkan di callback.
  // Penyerang yang bisa membuat URL callback tetap tidak bisa menulis cookie ini.
  response.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/integrations/google-sheets',
    maxAge: 600,
  });

  return response;
}

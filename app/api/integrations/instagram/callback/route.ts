import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getInstagramProfile,
} from '@/lib/instagram/oauth';
import { buildTokenConfig } from '@/lib/integrations/config';

/**
 * GET /api/integrations/instagram/callback?code=...&state=<businessId>
 * Instagram redirect ke sini setelah user authorize.
 * Tukar code → long-lived token, simpan terenkripsi di channel_integrations,
 * lalu redirect balik ke tab Integrasi.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const businessId = searchParams.get('state');
  const oauthError = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const ok = (bid: string) =>
    NextResponse.redirect(`${appUrl}/businesses/${bid}/config?tab=integrations&instagram_connected=1`);
  const fail = (msg: string, bid?: string | null) => {
    const path = bid ? `/businesses/${bid}/config?tab=integrations` : '/businesses';
    const sep = path.includes('?') ? '&' : '?';
    return NextResponse.redirect(`${appUrl}${path}${sep}instagram_error=${encodeURIComponent(msg)}`);
  };

  // User membatalkan / Meta menolak
  if (oauthError) {
    return fail(searchParams.get('error_description') || 'Otorisasi Instagram dibatalkan', businessId);
  }
  if (!code || !businessId) {
    return fail('Parameter tidak lengkap dari Instagram', businessId);
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  const supabase = await createServerClient();
  if (!(await canManageBusiness(supabase, user.id, businessId))) {
    return fail('Akses ditolak', businessId);
  }

  try {
    const redirectUri = `${appUrl}/api/integrations/instagram/callback`;

    const short = await exchangeCodeForToken(code, redirectUri);
    if (!short) return fail('Gagal menukar kode otorisasi Instagram', businessId);

    const long = await getLongLivedToken(short.accessToken);
    if (!long) return fail('Gagal mengambil token Instagram', businessId);

    const profile = await getInstagramProfile(long.accessToken);
    // external_account_id = IGSID akun bisnis (dipakai webhook lookup).
    // Fallback ke user_id dari token exchange kalau profil gagal diambil.
    const igUserId = profile?.userId ?? short.userId;
    const username = profile?.username ?? null;

    const tokenExpiresAt = long.expiresIn
      ? new Date(Date.now() + long.expiresIn * 1000).toISOString()
      : null;

    const config = buildTokenConfig({
      accessToken: long.accessToken,
      tokenExpiresAt,
      username,
    });

    // Manual upsert by (business_id, 'instagram') — partial unique index tidak
    // bisa dipakai ON CONFLICT lewat PostgREST. Reconnect = update row lama.
    const { data: existing } = await supabase
      .from('channel_integrations')
      .select('id')
      .eq('business_id', businessId)
      .eq('channel', 'instagram')
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('channel_integrations')
        .update({
          is_active: true,
          external_account_id: igUserId,
          config,
        })
        .eq('id', existing.id);
      if (error) {
        console.error('[instagram/callback] update error:', error.message);
        return fail('Gagal menyimpan koneksi', businessId);
      }
    } else {
      const { error } = await supabase.from('channel_integrations').insert({
        business_id: businessId,
        channel: 'instagram',
        is_active: true,
        external_account_id: igUserId,
        config,
        ai_enabled: false,
        ai_mode: 'draft',
        created_by: user.id,
      });
      if (error) {
        console.error('[instagram/callback] insert error:', error.message);
        return fail('Gagal menyimpan koneksi', businessId);
      }
    }

    return ok(businessId);
  } catch (err) {
    console.error('[instagram/callback] error:', err);
    return fail('Terjadi kesalahan saat menghubungkan Instagram', businessId);
  }
}

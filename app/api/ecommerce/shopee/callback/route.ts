import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { exchangeCodeForToken, getShopInfo } from '@/lib/ecommerce/shopee/auth';
import { encryptToken } from '@/lib/utils/tokenCrypto';

/**
 * GET /api/ecommerce/shopee/callback?code=...&shop_id=...&businessId=...
 * Shopee redirect ke sini setelah user authorize.
 * Tukar code → token, simpan ke DB, redirect ke halaman detail bisnis.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const shopId = searchParams.get('shop_id');
  const businessId = searchParams.get('businessId');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const errorRedirect = (msg: string, redirectBusinessId?: string) => {
    const path = redirectBusinessId ? `/businesses/${redirectBusinessId}` : '/businesses';
    return NextResponse.redirect(`${appUrl}${path}?shopee_error=${encodeURIComponent(msg)}`);
  };

  if (!code || !shopId || !businessId) {
    return errorRedirect('Parameter tidak lengkap dari Shopee', businessId ?? undefined);
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  const supabase = await createServerClient();

  // Verifikasi role
  const { data: role } = await supabase
    .from('user_business_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .single();

  if (!role || !['business_manager', 'both', 'superadmin'].includes(role.role)) {
    return errorRedirect('Akses ditolak', businessId);
  }

  try {
    // Tukar code → token
    const tokenData = await exchangeCodeForToken(code, Number(shopId));

    if (tokenData.error && tokenData.error !== '') {
      return errorRedirect(`Shopee error: ${tokenData.message}`, businessId);
    }

    // Ambil info toko
    let shopName = '';
    let shopLogo = '';
    try {
      const shopInfo = await getShopInfo(tokenData.access_token, Number(shopId));
      shopName = shopInfo.shop_name;
      shopLogo = shopInfo.logo;
    } catch {
      // Non-fatal: lanjut meski gagal ambil shop info
    }

    // Hitung waktu expiry access_token
    const tokenExpiresAt = new Date(Date.now() + tokenData.expire_in * 1000).toISOString();

    // Upsert koneksi ke DB
    const { error: dbError } = await supabase
      .from('business_ecommerce_connections')
      .upsert(
        {
          business_id: businessId,
          platform: 'shopee',
          shop_id: Number(shopId),
          shop_name: shopName,
          shop_logo: shopLogo,
          access_token: encryptToken(tokenData.access_token),
          refresh_token: encryptToken(tokenData.refresh_token),
          token_expires_at: tokenExpiresAt,
          is_active: true,
          created_by: user.id,
        },
        { onConflict: 'business_id,platform' }
      );

    if (dbError) {
      console.error('Shopee callback DB error:', dbError);
      return errorRedirect('Gagal menyimpan koneksi', businessId);
    }

    return NextResponse.redirect(`${appUrl}/businesses/${businessId}?shopee_connected=1`);
  } catch (err) {
    console.error('Shopee callback error:', err);
    return errorRedirect('Terjadi kesalahan saat menghubungkan Shopee', businessId);
  }
}

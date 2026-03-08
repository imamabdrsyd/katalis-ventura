import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { getShopeeAuthUrl } from '@/lib/ecommerce/shopee/auth';
import { businessIdSchema } from '@/lib/validations';

/**
 * GET /api/ecommerce/shopee/auth?businessId=<uuid>
 * Redirect user ke halaman otorisasi Shopee.
 * State (businessId) di-encode di redirect URL agar bisa dibaca di callback.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const businessId = request.nextUrl.searchParams.get('businessId');
  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
  }

  const parsed = businessIdSchema.safeParse(businessId);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid business ID' }, { status: 400 });
  }

  // Verifikasi user adalah manager bisnis ini
  const supabase = await createServerClient();
  const { data: role } = await supabase
    .from('user_business_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .single();

  if (!role || !['business_manager', 'both', 'superadmin'].includes(role.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Callback URL — sertakan businessId sebagai query param
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUrl = `${appUrl}/api/ecommerce/shopee/callback?businessId=${businessId}`;

  const authUrl = getShopeeAuthUrl(redirectUrl);

  return NextResponse.redirect(authUrl);
}

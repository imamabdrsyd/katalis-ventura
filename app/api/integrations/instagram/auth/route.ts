import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { getInstagramAuthUrl } from '@/lib/instagram/oauth';
import { businessIdSchema } from '@/lib/validations';

/**
 * GET /api/integrations/instagram/auth?businessId=<uuid>
 * Redirect manager ke halaman otorisasi Instagram.
 * businessId dibawa di `state` agar terbaca di callback.
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

  // Hanya manager bisnis ini yang boleh menghubungkan akun
  const supabase = await createServerClient();
  if (!(await canManageBusiness(supabase, user.id, businessId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/integrations/instagram/callback`;

  return NextResponse.redirect(getInstagramAuthUrl(redirectUri, businessId));
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { businessIdSchema } from '@/lib/validations';
import { toClientIntegration } from '@/lib/integrations/config';
import type { ChannelIntegration } from '@/types';

/**
 * GET /api/integrations?businessId=<uuid>
 * List integrasi channel sebuah bisnis untuk UI (status koneksi + setelan AI).
 * RLS membatasi SELECT ke bisnis yang user jadi member-nya. Token di config
 * di-strip sebelum dikirim ke client.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const businessId = request.nextUrl.searchParams.get('businessId');
  const parsed = businessIdSchema.safeParse(businessId);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid business ID' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('channel_integrations')
    .select('*')
    .eq('business_id', parsed.data)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const safe = ((data as ChannelIntegration[]) ?? []).map(toClientIntegration);
  return NextResponse.json({ data: safe });
}

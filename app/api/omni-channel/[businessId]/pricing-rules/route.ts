import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser, createAdminClient } from '@/lib/supabase-server';

const ruleSchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
  price: z.number().nonnegative(),
  label: z.string().max(100).nullable().optional(),
}).refine((d) => d.date_from <= d.date_to, {
  message: 'date_from harus <= date_to',
  path: ['date_to'],
});

async function verifyManager(userId: string, businessId: string) {
  const supabase = createAdminClient();
  const [roleResult, businessResult, profileResult] = await Promise.all([
    supabase.from('user_business_roles').select('role').eq('user_id', userId).eq('business_id', businessId).maybeSingle(),
    supabase.from('businesses').select('created_by').eq('id', businessId).maybeSingle(),
    supabase.from('profiles').select('default_role').eq('id', userId).maybeSingle(),
  ]);
  return (
    profileResult.data?.default_role === 'superadmin' ||
    roleResult.data?.role === 'business_manager' ||
    roleResult.data?.role === 'both' ||
    businessResult.data?.created_by === userId
  );
}

async function getOmniChannelId(businessId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('business_omni_channels')
    .select('id')
    .eq('business_id', businessId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { businessId } = await params;
  const omniChannelId = await getOmniChannelId(businessId);
  if (!omniChannelId) return NextResponse.json({ data: [] });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('business_pricing_rules')
    .select('*')
    .eq('omni_channel_id', omniChannelId)
    .order('date_from', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { businessId } = await params;
  if (!(await verifyManager(user.id, businessId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const omniChannelId = await getOmniChannelId(businessId);
  if (!omniChannelId) {
    return NextResponse.json({ error: 'Halaman publik belum dibuat' }, { status: 400 });
  }

  const body = await req.json();
  const parsed = ruleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('business_pricing_rules')
    .insert({ ...parsed.data, omni_channel_id: omniChannelId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createAdminClient } from '@/lib/supabase-server';
import { z } from 'zod';

const VALID_CHANNEL_TYPES = [
  'instagram', 'facebook', 'tiktok', 'twitter', 'youtube', 'linkedin',
  'shopee', 'tokopedia', 'lazada', 'bukalapak', 'blibli',
  'whatsapp', 'telegram', 'line', 'custom',
] as const;

const linkSchema = z.object({
  channel_type: z.enum(VALID_CHANNEL_TYPES),
  label: z.string().min(1).max(200),
  url: z.string().min(1).max(2048),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

async function verifyManager(userId: string, businessId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const [{ data: role }, { data: business }] = await Promise.all([
    supabase.from('user_business_roles').select('role').eq('user_id', userId).eq('business_id', businessId).single(),
    supabase.from('businesses').select('created_by').eq('id', businessId).single(),
  ]);
  return role?.role === 'business_manager' || role?.role === 'both' || business?.created_by === userId;
}

// POST /api/omni-channel/[businessId]/links
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { businessId } = await params;
  const body = await req.json();
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
  }

  if (!(await verifyManager(user.id, businessId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: channel } = await supabase
    .from('business_omni_channels')
    .select('id')
    .eq('business_id', businessId)
    .single();

  if (!channel) {
    return NextResponse.json({ error: 'Omni-channel tidak ditemukan untuk bisnis ini' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('business_omni_channel_links')
    .insert({ ...parsed.data, omni_channel_id: channel.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

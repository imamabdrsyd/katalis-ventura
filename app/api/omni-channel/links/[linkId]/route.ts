import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createAdminClient } from '@/lib/supabase-server';
import { z } from 'zod';

const VALID_CHANNEL_TYPES = [
  'instagram', 'facebook', 'tiktok', 'twitter', 'youtube', 'linkedin',
  'shopee', 'tokopedia', 'lazada', 'bukalapak', 'blibli',
  'whatsapp', 'telegram', 'line', 'custom',
] as const;

const patchSchema = z.object({
  channel_type: z.enum(VALID_CHANNEL_TYPES).optional(),
  label: z.string().min(1).max(200).optional(),
  url: z.string().min(1).max(2048).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

async function verifyManagerOwnsLink(userId: string, linkId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data: link } = await supabase
    .from('business_omni_channel_links')
    .select('omni_channel_id, business_omni_channels!inner(business_id, created_by)')
    .eq('id', linkId)
    .single();

  if (!link) return false;
  const ch = (link as any).business_omni_channels;
  const businessId = ch?.business_id;
  const createdBy = ch?.created_by;
  if (!businessId) return false;

  if (createdBy === userId) return true;

  const { data: role } = await supabase
    .from('user_business_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .single();

  return role?.role === 'business_manager' || role?.role === 'both';
}

// PATCH /api/omni-channel/links/[linkId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { linkId } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
  }

  if (!(await verifyManagerOwnsLink(user.id, linkId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('business_omni_channel_links')
    .update(parsed.data)
    .eq('id', linkId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

// DELETE /api/omni-channel/links/[linkId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { linkId } = await params;

  if (!(await verifyManagerOwnsLink(user.id, linkId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('business_omni_channel_links')
    .delete()
    .eq('id', linkId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

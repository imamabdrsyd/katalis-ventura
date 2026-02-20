import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createAdminClient } from '@/lib/supabase-server';
import { isReservedSlug, isValidSlugFormat } from '@/lib/utils/slugUtils';
import { z } from 'zod';

const upsertSchema = z.object({
  slug: z.string().min(3).max(64),
  is_published: z.boolean(),
  title: z.string().min(1).max(200),
  tagline: z.string().max(300).optional().nullable(),
  bio: z.string().max(1000).optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { businessId } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('business_omni_channels')
    .select('*, links:business_omni_channel_links(*)')
    .eq('business_id', businessId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? null });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { businessId } = await params;
  const body = await req.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
  }

  const { slug } = parsed.data;
  if (!isValidSlugFormat(slug)) {
    return NextResponse.json({ error: 'Format slug tidak valid' }, { status: 400 });
  }
  if (isReservedSlug(slug)) {
    return NextResponse.json({ error: 'Slug tidak tersedia (reserved)' }, { status: 400 });
  }

  // Use admin client to bypass RLS — auth is already verified above via getAuthenticatedUser
  const supabase = createAdminClient();

  // Verify user is a member of this business
  const { data: role } = await supabase
    .from('user_business_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .single();

  const { data: business } = await supabase
    .from('businesses')
    .select('created_by')
    .eq('id', businessId)
    .single();

  const isManager =
    role?.role === 'business_manager' ||
    role?.role === 'both' ||
    business?.created_by === user.id;

  if (!isManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('business_omni_channels')
    .upsert(
      { ...parsed.data, business_id: businessId, created_by: user.id, updated_by: user.id },
      { onConflict: 'business_id' }
    )
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Slug sudah digunakan bisnis lain' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

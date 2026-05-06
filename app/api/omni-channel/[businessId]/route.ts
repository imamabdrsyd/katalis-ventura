import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createAdminClient } from '@/lib/supabase-server';
import { isReservedSlug, isValidSlugFormat } from '@/lib/utils/slugUtils';
import { z } from 'zod';

const widgetLabelsSchema = z.object({
  date_label: z.string().optional(),
  checkin_label: z.string().optional(),
  checkout_label: z.string().optional(),
  note_label: z.string().optional(),
  note_placeholder: z.string().optional(),
  cta_label: z.string().optional(),
  action_label: z.string().optional(),
}).optional().nullable();

const featuredProductSchema = z.object({
  show: z.boolean(),
  name: z.string().max(200),
  description: z.string().max(500).optional(),
  image_url: z.string().url().optional().or(z.literal('')),
  price_label: z.string().max(100).optional(),
  link_url: z.string().url().optional().or(z.literal('')),
  link_label: z.string().max(100).optional(),
}).optional().nullable();

const upsertSchema = z.object({
  slug: z.string().min(3).max(64),
  is_published: z.boolean(),
  title: z.string().min(1).max(200),
  tagline: z.string().max(300).optional().nullable(),
  bio: z.string().max(1000).optional().nullable(),
  logo_url: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
    z.string().url().nullable().optional()
  ),
  banner_url: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
    z.string().url().nullable().optional()
  ),
  layout_mode: z.enum(['classic', 'modern', 'clean']).optional().nullable(),
  widget_date_mode: z.enum(['single', 'double']).optional().nullable(),
  widget_labels: widgetLabelsSchema,
  show_pricing: z.boolean().optional(),
  show_gallery: z.boolean().optional(),
  show_showcase: z.boolean().optional(),
  show_widget: z.boolean().optional(),
  show_links: z.boolean().optional(),
  default_price: z.number().nonnegative().nullable().optional(),
  price_unit: z.string().max(50).nullable().optional(),
  featured_product: featuredProductSchema,
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
    .select('*, links:business_omni_channel_links(*), pricing_rules:business_pricing_rules(*)')
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

  // Verify user is a manager of this business
  const [roleResult, businessResult] = await Promise.all([
    supabase
      .from('user_business_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .maybeSingle(),
    supabase
      .from('businesses')
      .select('created_by')
      .eq('id', businessId)
      .maybeSingle(),
  ]);

  const role = roleResult.data;
  const business = businessResult.data;

  // Check superadmin
  const { data: profile } = await supabase.from('profiles').select('default_role').eq('id', user.id).maybeSingle();
  const isManager =
    profile?.default_role === 'superadmin' ||
    role?.role === 'business_manager' ||
    role?.role === 'both' ||
    business?.created_by === user.id;

  if (!isManager) {
    console.error('[omni-channel] Forbidden debug:', {
      userId: user.id,
      businessId,
      role: role?.role ?? null,
      roleError: roleResult.error?.message ?? null,
      businessCreatedBy: business?.created_by ?? null,
      businessError: businessResult.error?.message ?? null,
    });
    return NextResponse.json({
      error: 'Forbidden',
      debug: {
        hasRole: !!role,
        roleValue: role?.role ?? null,
        hasBusiness: !!business,
        isCreator: business?.created_by === user.id,
      },
    }, { status: 403 });
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

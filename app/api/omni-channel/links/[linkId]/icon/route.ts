import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createAdminClient } from '@/lib/supabase-server';

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

async function verifyManagerOwnsLink(userId: string, linkId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data: profile } = await supabase.from('profiles').select('default_role').eq('id', userId).maybeSingle();
  if (profile?.default_role === 'superadmin') return true;

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { linkId } = await params;
  if (!(await verifyManagerOwnsLink(user.id, linkId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await req.formData();
  const file = (formData as any).get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Format file tidak didukung. Gunakan JPG, PNG, WebP, atau GIF.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Ukuran file maksimal 2MB' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const ext = file.name.split('.').pop() ?? 'png';
  const filePath = `link-icons/${linkId}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('profiles')
    .upload(filePath, buffer, { contentType: file.type, cacheControl: '3600', upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data } = supabase.storage.from('profiles').getPublicUrl(filePath);
  return NextResponse.json({ url: data.publicUrl });
}

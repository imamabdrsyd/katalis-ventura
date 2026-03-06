import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createAdminClient } from '@/lib/supabase-server';

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { businessId } = await params;
  const supabase = createAdminClient();

  // Verify user is a manager of this business (or superadmin)
  const [{ data: role }, { data: business }, { data: profile }] = await Promise.all([
    supabase.from('user_business_roles').select('role').eq('user_id', user.id).eq('business_id', businessId).maybeSingle(),
    supabase.from('businesses').select('created_by').eq('id', businessId).maybeSingle(),
    supabase.from('profiles').select('default_role').eq('id', user.id).maybeSingle(),
  ]);

  const isSuperadmin = profile?.default_role === 'superadmin';
  const isManager =
    isSuperadmin ||
    role?.role === 'business_manager' ||
    role?.role === 'both' ||
    business?.created_by === user.id;

  if (!isManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Format file tidak didukung. Gunakan JPG, PNG, WebP, atau GIF.' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Ukuran file maksimal 2MB' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const filePath = `business-logos/${businessId}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('profiles')
    .upload(filePath, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = supabase.storage.from('profiles').getPublicUrl(filePath);

  // Save logo_url to business record
  const { error: updateError } = await supabase
    .from('businesses')
    .update({ logo_url: data.publicUrl })
    .eq('id', businessId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ url: data.publicUrl });
}

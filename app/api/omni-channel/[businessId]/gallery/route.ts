import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createAdminClient } from '@/lib/supabase-server';
import crypto from 'crypto';

const MAX_GALLERY = 12;

interface GalleryImage {
  path: string;  // Cloudinary public_id
  url: string;   // Cloudinary secure_url
  sort_order: number;
}

async function assertManager(userId: string, businessId: string) {
  const supabase = createAdminClient();
  const [{ data: role }, { data: business }, { data: profile }] = await Promise.all([
    supabase.from('user_business_roles').select('role').eq('user_id', userId).eq('business_id', businessId).maybeSingle(),
    supabase.from('businesses').select('created_by').eq('id', businessId).maybeSingle(),
    supabase.from('profiles').select('default_role').eq('id', userId).maybeSingle(),
  ]);
  return (
    profile?.default_role === 'superadmin' ||
    role?.role === 'business_manager' ||
    role?.role === 'both' ||
    business?.created_by === userId
  );
}

/**
 * POST /api/omni-channel/[businessId]/gallery
 * Terima { url, public_id } dari client setelah upload ke Cloudinary,
 * simpan ke gallery_images di DB.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { businessId } = await params;
  if (!(await assertManager(user.id, businessId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { url, public_id } = body ?? {};
  if (!url || !public_id) {
    return NextResponse.json({ error: 'url dan public_id wajib diisi' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('business_omni_channels')
    .select('id, gallery_images')
    .eq('business_id', businessId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { error: 'Simpan halaman publik terlebih dahulu sebelum upload gallery' },
      { status: 400 }
    );
  }

  const current: GalleryImage[] = Array.isArray(existing.gallery_images) ? existing.gallery_images : [];
  if (current.length >= MAX_GALLERY) {
    return NextResponse.json({ error: `Maksimal ${MAX_GALLERY} gambar per bisnis` }, { status: 400 });
  }

  const newImage: GalleryImage = { path: public_id, url, sort_order: current.length };
  const next = [...current, newImage];

  const { error: updateError } = await supabase
    .from('business_omni_channels')
    .update({ gallery_images: next, updated_by: user.id })
    .eq('id', existing.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ image: newImage, gallery: next });
}

/**
 * DELETE /api/omni-channel/[businessId]/gallery?path=<cloudinary_public_id>
 * Hapus gambar dari Cloudinary + DB.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { businessId } = await params;
  if (!(await assertManager(user.id, businessId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const reqUrl = new URL(req.url);
  const publicId = reqUrl.searchParams.get('path');
  if (!publicId) {
    return NextResponse.json({ error: 'path (public_id) wajib disertakan' }, { status: 400 });
  }

  // Hapus dari Cloudinary via signed API
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signatureStr = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha256').update(signatureStr).digest('hex');

  await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_id: publicId, signature, api_key: apiKey, timestamp }),
  }).catch(() => {});

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('business_omni_channels')
    .select('id, gallery_images')
    .eq('business_id', businessId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Halaman publik tidak ditemukan' }, { status: 404 });
  }

  const current: GalleryImage[] = Array.isArray(existing.gallery_images) ? existing.gallery_images : [];
  const next = current
    .filter((img) => img.path !== publicId)
    .map((img, i) => ({ ...img, sort_order: i }));

  const { error: updateError } = await supabase
    .from('business_omni_channels')
    .update({ gallery_images: next, updated_by: user.id })
    .eq('id', existing.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ gallery: next });
}

/**
 * PATCH /api/omni-channel/[businessId]/gallery
 * Reorder gambar. Body: { paths: string[] } — urutan public_id baru.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { businessId } = await params;
  if (!(await assertManager(user.id, businessId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const paths: string[] | undefined = body?.paths;
  if (!Array.isArray(paths)) {
    return NextResponse.json({ error: 'paths harus array' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('business_omni_channels')
    .select('id, gallery_images')
    .eq('business_id', businessId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Halaman publik tidak ditemukan' }, { status: 404 });
  }

  const current: GalleryImage[] = Array.isArray(existing.gallery_images) ? existing.gallery_images : [];
  const byPath = new Map(current.map((img) => [img.path, img]));
  const next: GalleryImage[] = paths
    .map((p, i) => {
      const found = byPath.get(p);
      return found ? { ...found, sort_order: i } : null;
    })
    .filter((x): x is GalleryImage => x !== null);

  const { error: updateError } = await supabase
    .from('business_omni_channels')
    .update({ gallery_images: next, updated_by: user.id })
    .eq('id', existing.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ gallery: next });
}

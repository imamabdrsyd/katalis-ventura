import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createAdminClient } from '@/lib/supabase-server';
import crypto from 'crypto';

/**
 * DELETE /api/transactions/attachments?public_id=<cloudinary_public_id>&businessId=<id>
 * Hapus file lampiran dari Cloudinary (server-side signed request).
 */
export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const publicId = url.searchParams.get('public_id');
  const businessId = url.searchParams.get('businessId');

  if (!publicId || !businessId) {
    return NextResponse.json({ error: 'public_id dan businessId wajib disertakan' }, { status: 400 });
  }

  // Verifikasi user punya akses ke bisnis ini
  const supabase = createAdminClient();
  const { data: role } = await supabase
    .from('user_business_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .maybeSingle();

  const { data: business } = await supabase
    .from('businesses')
    .select('created_by')
    .eq('id', businessId)
    .maybeSingle();

  const { data: profile } = await supabase
    .from('profiles')
    .select('default_role')
    .eq('id', user.id)
    .maybeSingle();

  const hasAccess =
    profile?.default_role === 'superadmin' ||
    role?.role === 'business_manager' ||
    role?.role === 'both' ||
    business?.created_by === user.id;

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Pastikan public_id berada di folder axion/attachments/<businessId> (proteksi tambahan)
  if (!publicId.startsWith(`axion/attachments/${businessId}/`)) {
    return NextResponse.json({ error: 'public_id tidak valid untuk bisnis ini' }, { status: 400 });
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signatureStr = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha256').update(signatureStr).digest('hex');

  const cloudRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_id: publicId, signature, api_key: apiKey, timestamp }),
    }
  ).catch(() => null);

  if (!cloudRes?.ok) {
    // Log tapi jangan block — file bisa sudah terhapus sebelumnya
    console.error('Cloudinary destroy failed for', publicId);
  }

  return NextResponse.json({ ok: true });
}

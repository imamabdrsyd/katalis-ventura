import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v2 as cloudinary } from 'cloudinary';
import {
  createServerClient,
  getAuthenticatedUser,
  getBusinessRoleForUser,
} from '@/lib/supabase-server';
import { badRequest, forbidden, serverError, unauthorized, validationError } from '@/lib/api/server/responses';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_ID_PREFIX_REGEX = /^axion\/attachments\/([0-9a-f-]{36})\//i;

const querySchema = z.object({
  public_id: z.string().min(1).max(500),
  resource_type: z.enum(['image', 'raw', 'video']).optional(),
});

/**
 * GET /api/transactions/attachments/cloudinary-sign?public_id=<id>&resource_type=<image|raw|video>
 *
 * Hasilkan signed delivery URL untuk lampiran Cloudinary ber-`type: authenticated`.
 * URL mentah `/authenticated/...` tanpa tanda tangan akan ditolak Cloudinary;
 * hanya server (punya API secret) yang bisa membuat signed URL ini, dan hanya
 * setelah verifikasi user adalah member dari business yang memiliki file.
 *
 * Auth: user harus member (manager/investor) dari business pada folder public_id.
 * Return: { data: { url } }
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const parsed = querySchema.safeParse({
      public_id: request.nextUrl.searchParams.get('public_id') ?? '',
      resource_type: request.nextUrl.searchParams.get('resource_type') ?? undefined,
    });
    if (!parsed.success) return validationError(parsed.error);

    const publicId = parsed.data.public_id;
    const resourceType = parsed.data.resource_type ?? 'image';

    // Tolak path traversal & pastikan file ada di folder axion/attachments/<businessId>/
    if (publicId.includes('..')) return badRequest('public_id tidak valid');
    const m = publicId.match(PUBLIC_ID_PREFIX_REGEX);
    if (!m || !UUID_REGEX.test(m[1])) {
      return badRequest('public_id harus berada di axion/attachments/<businessId>/');
    }
    const businessId = m[1];

    const supabase = await createServerClient();
    const role = await getBusinessRoleForUser(supabase, user.id, businessId);
    if (!role) return forbidden('Tidak berhak mengakses file ini');

    cloudinary.config({
      cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });

    // sign_url + type authenticated → URL hanya valid dengan tanda tangan yang
    // dihitung pakai API secret. Tanpa auth_token, signature bersifat statis
    // (tanpa TTL) — tetap menutup akses publik/enumerasi karena butuh secret.
    const url = cloudinary.url(publicId, {
      type: 'authenticated',
      resource_type: resourceType,
      sign_url: true,
      secure: true,
    });

    return NextResponse.json({ data: { url } });
  } catch (err) {
    return serverError(err);
  }
}

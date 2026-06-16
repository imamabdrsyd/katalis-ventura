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
  type: z.enum(['upload', 'authenticated']).optional(),
  filename: z.string().min(1).max(255).optional(),
});

/** Bersihkan filename untuk header Content-Disposition (cegah header injection). */
function sanitizeFilename(name: string): string {
  return name.replace(/[\r\n"\\]/g, '').slice(0, 200) || 'lampiran';
}

/**
 * GET /api/transactions/attachments/download?public_id=<id>&resource_type=<t>&filename=<name>
 *
 * Unduh lampiran Cloudinary `type: authenticated` via proxy server (same-origin,
 * tanpa CORS — beda dari fetch langsung ke res.cloudinary.com yang diblokir CORS
 * untuk asset authenticated). Server membuat signed URL, mengambil byte, lalu
 * stream balik dengan Content-Disposition: attachment.
 *
 * Auth: user harus member (manager/investor) dari business pada folder public_id.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const parsed = querySchema.safeParse({
      public_id: request.nextUrl.searchParams.get('public_id') ?? '',
      resource_type: request.nextUrl.searchParams.get('resource_type') ?? undefined,
      filename: request.nextUrl.searchParams.get('filename') ?? undefined,
    });
    if (!parsed.success) return validationError(parsed.error);

    const publicId = parsed.data.public_id;
    const resourceType = parsed.data.resource_type ?? 'image';

    if (publicId.includes('..')) return badRequest('public_id tidak valid');
    const m = publicId.match(PUBLIC_ID_PREFIX_REGEX);
    if (!m || !UUID_REGEX.test(m[1])) {
      return badRequest('public_id harus berada di axion/attachments/<businessId>/');
    }
    const businessId = m[1];

    const supabase = await createServerClient();
    const role = await getBusinessRoleForUser(supabase, user.id, businessId);
    if (!role) return forbidden('Tidak berhak mengakses file ini');

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return serverError(new Error('Konfigurasi server belum lengkap (Cloudinary credentials)'));
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    // File lama = type 'upload' (publik, tak perlu sign); file baru/migrasi =
    // 'authenticated' (perlu signed URL). Server fetch dua-duanya → tak ada CORS.
    const deliveryType = parsed.data.type ?? 'authenticated';
    const fileUrl = cloudinary.url(publicId, {
      type: deliveryType,
      resource_type: resourceType,
      sign_url: deliveryType === 'authenticated',
      secure: true,
    });

    const upstream = await fetch(fileUrl, { cache: 'no-store' });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'Gagal mengambil file dari storage' }, { status: 502 });
    }

    const filename = sanitizeFilename(parsed.data.filename ?? 'lampiran');
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return serverError(err);
  }
}

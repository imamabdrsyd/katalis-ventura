import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createServerClient,
  createAdminClient,
  getAuthenticatedUser,
  getBusinessRoleForUser,
} from '@/lib/supabase-server';
import { badRequest, forbidden, serverError, unauthorized, validationError } from '@/lib/api/server/responses';

const BUCKET = 'transaction-attachments';
const DEFAULT_TTL_SECONDS = 60 * 30; // 30 menit

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const querySchema = z.object({
  path: z.string().min(1).max(500),
  ttl: z.coerce.number().int().min(60).max(60 * 60).optional(),
});

/**
 * GET /api/transactions/attachments/sign?path=<businessId>/<filename>&ttl=<seconds>
 *
 * Auth: user harus member (manager/investor/superadmin) dari business
 *       yang ditandai oleh segmen pertama path.
 * Return: { url: string, expiresAt: ISO timestamp }
 *
 * Digunakan oleh klien untuk meng-handle file legacy yang sebelumnya
 * tersimpan di bucket Supabase Storage. Bucket sekarang private — akses
 * harus via signed URL berdurasi pendek.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const parsed = querySchema.safeParse({
      path: request.nextUrl.searchParams.get('path') ?? '',
      ttl: request.nextUrl.searchParams.get('ttl') ?? undefined,
    });
    if (!parsed.success) return validationError(parsed.error);

    // Tolak path traversal & format aneh
    if (parsed.data.path.includes('..') || parsed.data.path.startsWith('/')) {
      return badRequest('Path tidak valid');
    }

    const businessId = parsed.data.path.split('/')[0];
    if (!UUID_REGEX.test(businessId)) {
      return badRequest('Path harus berbentuk <businessId>/<filename>');
    }

    const supabase = await createServerClient();
    const role = await getBusinessRoleForUser(supabase, user.id, businessId);
    if (!role) return forbidden('Tidak berhak mengakses file ini');

    // Sign via admin (RLS pada storage.objects member-only sudah cocok, tapi
    // signed URL Supabase tidak butuh RLS — service role lebih reliable
    // karena tidak terpengaruh dialect cookie/session di Edge runtime).
    const admin = createAdminClient();
    const ttl = parsed.data.ttl ?? DEFAULT_TTL_SECONDS;
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(parsed.data.path, ttl);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message ?? 'Gagal membuat signed URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        url: data.signedUrl,
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      },
    });
  } catch (err) {
    return serverError(err);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v2 as cloudinary } from 'cloudinary';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { forbidden, serverError, unauthorized, validationError } from '@/lib/api/server/responses';

const querySchema = z.object({
  businessId: z.string().uuid({ message: 'businessId harus UUID valid' }),
});

/**
 * GET /api/transactions/attachments/upload-sign?businessId=<id>
 *
 * Hasilkan parameter signed upload Cloudinary agar lampiran transaksi/kontak
 * di-upload sebagai `type: authenticated` (private sejak detik pertama) — tanpa
 * lewat preset unsigned publik (yang juga dipakai galeri link-in-bio).
 *
 * Auth: hanya manager dari business (operasi tulis). Mengembalikan signature
 * yang HANYA mencakup param non-file (folder, timestamp, type) — file dikirim
 * client langsung ke Cloudinary.
 *
 * Return: { data: { cloudName, apiKey, timestamp, folder, type, signature } }
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const parsed = querySchema.safeParse({
      businessId: request.nextUrl.searchParams.get('businessId') ?? '',
    });
    if (!parsed.success) return validationError(parsed.error);

    const businessId = parsed.data.businessId;
    const supabase = await createServerClient();
    if (!(await canManageBusiness(supabase, user.id, businessId))) {
      return forbidden('Hanya manager yang dapat mengunggah lampiran');
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
    const apiKey = process.env.CLOUDINARY_API_KEY!;
    const apiSecret = process.env.CLOUDINARY_API_SECRET!;

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `axion/attachments/${businessId}`;
    // Param yang ditandatangani harus PERSIS sama dengan yang dikirim client
    // (selain file/api_key/signature/cloud_name/resource_type).
    const signature = cloudinary.utils.api_sign_request(
      { folder, timestamp, type: 'authenticated' },
      apiSecret
    );

    return NextResponse.json({
      data: { cloudName, apiKey, timestamp, folder, type: 'authenticated', signature },
    });
  } catch (err) {
    return serverError(err);
  }
}

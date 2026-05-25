import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createServerClient,
  getAuthenticatedUser,
  getBusinessRoleForUser,
} from '@/lib/supabase-server';
import {
  hashFile,
  OcrProviderError,
  OcrQuotaExceededError,
  scanReceipt,
} from '@/lib/ocr';
import { downloadOcrSource, OcrDownloadError } from '@/lib/ocr/download';
import { withRouteTiming } from '@/lib/api/server/timing';

const bodySchema = z.object({
  business_id: z.string().uuid({ message: 'business_id harus UUID valid' }),
  image_url: z
    .string()
    .url({ message: 'image_url harus URL valid' })
    .refine((u) => u.startsWith('https://'), {
      message: 'image_url harus https',
    }),
});

/**
 * POST /api/ocr/scan
 * Body: { business_id: uuid, image_url: allowlisted HTTPS URL }
 * Response: { data: OcrResult }
 *
 * Auth: user harus member dari business_id (manager atau investor).
 * Image: di-fetch dari allowlisted storage, SHA-256 hash, call scanReceipt()
 * (cache → Vision → fallback OCR.space).
 */
export async function POST(req: NextRequest) {
  return withRouteTiming(req, '/api/ocr/scan', async () => {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Body harus JSON valid' }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { business_id, image_url } = parsed.data;

    // Verifikasi user adalah member dari business (manager ATAU investor — keduanya boleh scan)
    const supabase = await createServerClient();
    const role = await getBusinessRoleForUser(supabase, user.id, business_id);
    if (!role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let imageBuffer: Buffer;
    let mimeType = 'image/jpeg';
    try {
      const downloaded = await downloadOcrSource(image_url, business_id);
      imageBuffer = downloaded.buffer;
      mimeType = downloaded.mimeType;
    } catch (err) {
      if (err instanceof OcrDownloadError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error('[ocr/scan] download error:', err);
      return NextResponse.json(
        { error: 'Gagal mengunduh gambar' },
        { status: 400 }
      );
    }

    const fileHash = hashFile(imageBuffer);

    try {
      const result = await scanReceipt(imageBuffer, fileHash, mimeType);
      return NextResponse.json({ data: result });
    } catch (err) {
      if (err instanceof OcrQuotaExceededError) {
        return NextResponse.json({ error: err.message }, { status: 429 });
      }
      if (err instanceof OcrProviderError) {
        console.error('[ocr/scan] provider error:', err.provider, err.message);
        return NextResponse.json(
          { error: `OCR provider error: ${err.message}` },
          { status: 502 }
        );
      }
      console.error('[ocr/scan] unexpected error:', err);
      return NextResponse.json(
        { error: 'OCR gagal diproses' },
        { status: 500 }
      );
    }
  });
}

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
import { downloadOcrSource, OcrDownloadError, OCR_DOWNLOAD_MAX_BYTES } from '@/lib/ocr/download';
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

const ALLOWED_OCR_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function normalizeOcrMime(contentType: string | null | undefined): string | null {
  const mime = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  if (!mime) return null;
  if (mime === 'image/jpg') return 'image/jpeg';
  return mime;
}

/**
 * POST /api/ocr/scan
 *
 * Dua mode input:
 * 1. multipart/form-data: { business_id, file } — byte gambar dikirim langsung,
 *    TIDAK numpang Cloudinary. Dipakai tombol Scan Struk. (tanpa permukaan SSRF)
 * 2. application/json (legacy): { business_id, image_url } — image_url di-fetch
 *    dari allowlisted storage. Dipakai AIChatPanel.
 *
 * Response: { data: OcrResult }
 * Auth: user harus member dari business_id (manager atau investor).
 * Flow: SHA-256 hash → scanReceipt() (cache → Vision → fallback OCR.space).
 */
export async function POST(req: NextRequest) {
  return withRouteTiming(req, '/api/ocr/scan', async () => {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') ?? '';
    const isMultipart = contentType.includes('multipart/form-data');

    let businessId: string;
    let imageBuffer: Buffer;
    let mimeType = 'image/jpeg';

    if (isMultipart) {
      // --- Mode 1: file langsung (multipart) ---
      let form: FormData;
      try {
        form = await req.formData();
      } catch {
        return NextResponse.json({ error: 'Form data tidak valid' }, { status: 400 });
      }

      const businessIdRaw = form.get('business_id');
      businessId = typeof businessIdRaw === 'string' ? businessIdRaw : '';
      if (!z.string().uuid().safeParse(businessId).success) {
        return NextResponse.json({ error: 'business_id harus UUID valid' }, { status: 400 });
      }

      const file = form.get('file');
      if (!(file instanceof Blob)) {
        return NextResponse.json({ error: 'file wajib disertakan' }, { status: 400 });
      }
      if (file.size > OCR_DOWNLOAD_MAX_BYTES) {
        return NextResponse.json({ error: 'Ukuran gambar melebihi 10MB' }, { status: 413 });
      }
      const mt = normalizeOcrMime(file.type);
      if (!mt || !ALLOWED_OCR_MIME.has(mt)) {
        return NextResponse.json({ error: 'Format file OCR tidak didukung' }, { status: 415 });
      }

      // Verifikasi user adalah member dari business (manager ATAU investor)
      const supabase = await createServerClient();
      const role = await getBusinessRoleForUser(supabase, user.id, businessId);
      if (!role) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      imageBuffer = Buffer.from(await file.arrayBuffer());
      mimeType = mt;
    } else {
      // --- Mode 2: image_url (legacy JSON) ---
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
      businessId = business_id;

      // Verifikasi user adalah member dari business (manager ATAU investor)
      const supabase = await createServerClient();
      const role = await getBusinessRoleForUser(supabase, user.id, business_id);
      if (!role) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

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

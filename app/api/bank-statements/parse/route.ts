import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createServerClient,
  getAuthenticatedUser,
  getBusinessRoleForUser,
} from '@/lib/supabase-server';
import {
  scanBankStatement,
  BankStatementParseError,
  type BankCode,
} from '@/lib/bankStatements';
import {
  hashFile,
  OcrProviderError,
  OcrQuotaExceededError,
} from '@/lib/ocr';
import { withRouteTiming } from '@/lib/api/server/timing';

const VALID_BANK_CODES: BankCode[] = ['BCA', 'MANDIRI', 'BRI', 'BNI', 'GENERIC'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const metadataSchema = z.object({
  business_id: z.string().uuid(),
  bank_code: z.enum(['BCA', 'MANDIRI', 'BRI', 'BNI', 'GENERIC']),
});

/**
 * POST /api/bank-statements/parse
 * multipart/form-data:
 *   - file: PDF/image
 *   - business_id: uuid
 *   - bank_code: BCA | MANDIRI | BRI | BNI | GENERIC
 *
 * Response: { data: { parsed, raw_text, source, cached, file_hash } }
 *
 * Catatan: TIDAK simpan ke DB. Client review hasil, lalu kirim ke /commit.
 */
export async function POST(req: NextRequest) {
  return withRouteTiming(req, '/api/bank-statements/parse', async () => {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Body harus multipart/form-data' }, { status: 400 });
    }

    const file = form.get('file');
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'File tidak ditemukan di form' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File terlalu besar (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` },
        { status: 400 }
      );
    }

    const meta = metadataSchema.safeParse({
      business_id: form.get('business_id'),
      bank_code: form.get('bank_code'),
    });
    if (!meta.success) {
      return NextResponse.json(
        { error: 'Metadata invalid', details: meta.error.flatten() },
        { status: 400 }
      );
    }

    const { business_id, bank_code } = meta.data;

    const supabase = await createServerClient();
    const role = await getBusinessRoleForUser(supabase, user.id, business_id);
    if (!role || !['business_manager', 'both', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden — butuh role manager' }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'application/octet-stream';
    const fileHash = hashFile(buffer);

    const fileName = (file as File).name ?? undefined;

    try {
      const result = await scanBankStatement(buffer, {
        bankCode: bank_code,
        mimeType,
        fileName,
        fileHash,
      });

      return NextResponse.json({
        data: {
          file_hash: fileHash,
          file_name: fileName ?? null,
          source: result.source,
          cached: result.cached,
          raw_text: result.raw_text,
          parsed: result.parsed,
        },
      });
    } catch (err) {
      if (err instanceof OcrQuotaExceededError) {
        return NextResponse.json({ error: err.message }, { status: 429 });
      }
      if (err instanceof OcrProviderError) {
        console.error('[bank-statements/parse] OCR error:', err.provider, err.message);
        return NextResponse.json(
          { error: `OCR error: ${err.message}` },
          { status: 502 }
        );
      }
      if (err instanceof BankStatementParseError) {
        return NextResponse.json({ error: err.message }, { status: 422 });
      }
      console.error('[bank-statements/parse] unexpected:', err);
      return NextResponse.json(
        { error: 'Gagal parse mutasi bank' },
        { status: 500 }
      );
    }
  });
}

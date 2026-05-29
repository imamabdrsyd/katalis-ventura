import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createServerClient,
  getAuthenticatedUser,
  getBusinessRoleForUser,
} from '@/lib/supabase-server';
import { commitBankStatement } from '@/lib/bankStatements/importer';
import { withRouteTiming } from '@/lib/api/server/timing';

const rowSchema = z.object({
  posted_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string(),
  amount: z.number(),
  running_balance: z.number().optional(),
  reference_code: z.string().optional(),
  counterparty_name: z.string().optional(),
});

const bodySchema = z.object({
  business_id: z.string().uuid(),
  account_id: z.string().uuid(),
  source: z.enum(['csv', 'xlsx', 'pdf_ocr', 'image_ocr', 'manual']),
  file_name: z.string().optional(),
  file_hash: z.string().optional(),
  raw_text: z.string().optional(),
  parsed: z.object({
    bank_code: z.enum(['BCA', 'MANDIRI', 'BRI', 'BNI', 'GENERIC']),
    account_number: z.string().optional(),
    period_start: z.string().optional(),
    period_end: z.string().optional(),
    opening_balance: z.number().optional(),
    closing_balance: z.number().optional(),
    total_credit: z.number().optional(),
    total_debit: z.number().optional(),
    rows: z.array(rowSchema).min(1, 'Minimal 1 baris transaksi'),
  }),
});

/**
 * POST /api/bank-statements/commit
 * Body: parsed result yang sudah di-review user.
 *
 * Auth: butuh role manager untuk business_id.
 * Validasi: account_id harus milik business_id (di-cek via RLS).
 */
export async function POST(req: NextRequest) {
  return withRouteTiming(req, '/api/bank-statements/commit', async () => {
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

    const data = parsed.data;
    const supabase = await createServerClient();
    const role = await getBusinessRoleForUser(supabase, user.id, data.business_id);
    if (!role || !['business_manager', 'both', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden — butuh role manager' }, { status: 403 });
    }

    // Validasi account_id milik business
    const { data: account, error: accErr } = await supabase
      .from('accounts')
      .select('id, business_id, account_code')
      .eq('id', data.account_id)
      .eq('business_id', data.business_id)
      .single();
    if (accErr || !account) {
      return NextResponse.json(
        { error: 'Akun tidak ditemukan atau bukan milik bisnis ini' },
        { status: 404 }
      );
    }

    try {
      const result = await commitBankStatement(supabase, {
        businessId: data.business_id,
        accountId: data.account_id,
        userId: user.id,
        source: data.source,
        fileName: data.file_name,
        fileHash: data.file_hash,
        rawText: data.raw_text ?? '',
        parsed: {
          ...data.parsed,
          rows: data.parsed.rows.map(r => ({
            posted_at: r.posted_at,
            value_date: r.value_date,
            description: r.description,
            amount: r.amount,
            running_balance: r.running_balance,
            reference_code: r.reference_code,
            counterparty_name: r.counterparty_name,
          })),
        },
      });

      return NextResponse.json({ data: result });
    } catch (err) {
      console.error('[bank-statements/commit] error:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Gagal commit mutasi' },
        { status: 500 }
      );
    }
  });
}


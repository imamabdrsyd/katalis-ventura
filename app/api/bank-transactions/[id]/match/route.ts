import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createServerClient,
  getAuthenticatedUser,
  getBusinessRoleForUser,
} from '@/lib/supabase-server';
import { withRouteTiming } from '@/lib/api/server/timing';

const bodySchema = z.object({
  transaction_id: z.string().uuid(),
});

/**
 * POST /api/bank-transactions/[id]/match
 * Body: { transaction_id }
 *
 * Link bank line ke transaksi ledger:
 *   - bank_transactions.match_status = 'manual_matched'
 *   - bank_transactions.matched_transaction_id = transaction_id
 *   - transactions.is_reconciled = true
 *
 * Auth: manager only.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withRouteTiming(req, '/api/bank-transactions/[id]/match', async () => {
    const { id: bankTxId } = await params;

    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Body harus JSON' }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
    }

    const { transaction_id } = parsed.data;
    const supabase = await createServerClient();

    // Fetch bank row untuk dapat business_id
    const { data: bankRow, error: bankErr } = await supabase
      .from('bank_transactions')
      .select('id, business_id, match_status')
      .eq('id', bankTxId)
      .single();
    if (bankErr || !bankRow) {
      return NextResponse.json({ error: 'Bank transaction tidak ditemukan' }, { status: 404 });
    }

    const role = await getBusinessRoleForUser(supabase, user.id, bankRow.business_id);
    if (!role || !['business_manager', 'both', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden — butuh role manager' }, { status: 403 });
    }

    // Validate transaction_id juga milik bisnis yang sama
    const { data: tx, error: txErr } = await supabase
      .from('transactions')
      .select('id, business_id, is_reconciled')
      .eq('id', transaction_id)
      .eq('business_id', bankRow.business_id)
      .single();
    if (txErr || !tx) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan di bisnis ini' }, { status: 404 });
    }

    // Update bank line
    const now = new Date().toISOString();
    const { error: updBankErr } = await supabase
      .from('bank_transactions')
      .update({
        match_status: 'manual_matched',
        matched_transaction_id: transaction_id,
        matched_by: user.id,
        matched_at: now,
        match_confidence: 1.0,
      })
      .eq('id', bankTxId);
    if (updBankErr) {
      return NextResponse.json({ error: updBankErr.message }, { status: 500 });
    }

    // Tandai transaksi ledger sebagai reconciled (kalau belum)
    if (!tx.is_reconciled) {
      const { error: updTxErr } = await supabase
        .from('transactions')
        .update({
          is_reconciled: true,
          reconciled_at: now,
          reconciled_by: user.id,
        })
        .eq('id', transaction_id);
      if (updTxErr) {
        console.warn('[match] failed to mark transaction reconciled:', updTxErr);
      }
    }

    return NextResponse.json({ data: { ok: true } });
  });
}

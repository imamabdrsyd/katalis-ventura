import { NextRequest, NextResponse } from 'next/server';
import {
  createServerClient,
  getAuthenticatedUser,
  getBusinessRoleForUser,
} from '@/lib/supabase-server';
import { withRouteTiming } from '@/lib/api/server/timing';

/**
 * POST /api/bank-transactions/[id]/unmatch
 *
 * Reset bank line ke unmatched. Juga set transactions.is_reconciled = false
 * KALAU tidak ada bank line lain yang masih ter-link ke transaksi itu.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withRouteTiming(req, '/api/bank-transactions/[id]/unmatch', async () => {
    const { id: bankTxId } = await params;

    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createServerClient();

    const { data: bankRow, error: bankErr } = await supabase
      .from('bank_transactions')
      .select('id, business_id, matched_transaction_id')
      .eq('id', bankTxId)
      .single();
    if (bankErr || !bankRow) {
      return NextResponse.json({ error: 'Bank transaction tidak ditemukan' }, { status: 404 });
    }

    const role = await getBusinessRoleForUser(supabase, user.id, bankRow.business_id);
    if (!role || !['business_manager', 'both', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden — butuh role manager' }, { status: 403 });
    }

    const prevMatchedTxId = bankRow.matched_transaction_id;

    const { error: updErr } = await supabase
      .from('bank_transactions')
      .update({
        match_status: 'unmatched',
        matched_transaction_id: null,
        matched_by: null,
        matched_at: null,
        match_confidence: null,
      })
      .eq('id', bankTxId);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // Cek apakah transaksi ledger masih ter-link ke bank line LAIN
    if (prevMatchedTxId) {
      const { data: stillLinked } = await supabase
        .from('bank_transactions')
        .select('id')
        .eq('matched_transaction_id', prevMatchedTxId)
        .neq('id', bankTxId)
        .limit(1);

      if (!stillLinked || stillLinked.length === 0) {
        // Tidak ada bank line lain → safe untuk un-reconcile
        await supabase
          .from('transactions')
          .update({
            is_reconciled: false,
            reconciled_at: null,
            reconciled_by: null,
          })
          .eq('id', prevMatchedTxId);
      }
    }

    return NextResponse.json({ data: { ok: true } });
  });
}

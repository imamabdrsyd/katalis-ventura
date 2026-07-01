import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { bulkPostTransactionsSchema } from '@/lib/validations';
import { badRequest, forbidden, serverError, unauthorized, validationError } from '@/lib/api/server/responses';
import { isPostableDraft } from '@/lib/api/server/postableDraft';

/**
 * POST /api/transactions/bulk-post
 * Body: { ids: string[] }
 * Transition multiple draft transactions to posted. All transactions must
 * belong to the same business (manager-only).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const parsed = bulkPostTransactionsSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createServerClient();

    // Verify all transactions belong to a single business that the user manages.
    const { data: txns, error: fetchErr } = await supabase
      .from('transactions')
      .select('id, business_id, status, deleted_at, amount, debit_account_id, credit_account_id')
      .in('id', parsed.data.ids);

    if (fetchErr) return serverError(fetchErr);
    if (!txns || txns.length === 0) return badRequest('Transaksi tidak ditemukan');

    const businessIds = new Set(txns.map((t) => t.business_id));
    if (businessIds.size > 1) {
      return badRequest('Semua transaksi harus dalam bisnis yang sama');
    }
    const businessId = txns[0].business_id;

    if (!(await canManageBusiness(supabase, user.id, businessId))) {
      return forbidden('Hanya manager bisnis yang dapat mem-posting transaksi');
    }

    // Hanya draft yang lengkap yang boleh di-posting. Draft belum lengkap
    // (mis. dari "Save Draft" tanpa akun) di-skip, bukan digagalkan sepenuhnya.
    const postableIds = txns
      .filter((t) => t.status === 'draft' && !t.deleted_at && isPostableDraft(t))
      .map((t) => t.id);
    const skipped = parsed.data.ids.length - postableIds.length;

    if (postableIds.length === 0) {
      return badRequest(
        'Tidak ada draft yang bisa di-posting. Lengkapi akun debit & kredit dan jumlah terlebih dahulu.'
      );
    }

    const { data, error } = await supabase
      .from('transactions')
      .update({
        status: 'posted',
        posted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .in('id', postableIds)
      .eq('status', 'draft')
      .is('deleted_at', null)
      .select('id');

    if (error) return serverError(error);
    return NextResponse.json({ data: { posted: data?.length ?? 0, skipped } });
  } catch (err) {
    return serverError(err);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { transactionIdSchema } from '@/lib/validations';
import { badRequest, forbidden, notFound, serverError, unauthorized } from '@/lib/api/server/responses';
import { isPostableDraft } from '@/lib/api/server/postableDraft';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/transactions/[id]/post
 * Transition a draft transaction to posted (one-way).
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const parsedId = transactionIdSchema.safeParse(id);
    if (!parsedId.success) return badRequest('Format ID transaksi tidak valid');

    const supabase = await createServerClient();

    const { data: existing, error: fetchErr } = await supabase
      .from('transactions')
      .select('id, business_id, status, amount, is_multi_line, debit_account_id, credit_account_id')
      .eq('id', parsedId.data)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchErr || !existing) return notFound('Transaksi tidak ditemukan');
    if (!(await canManageBusiness(supabase, user.id, existing.business_id))) {
      return forbidden('Hanya manager bisnis yang dapat mem-posting transaksi');
    }
    if (existing.status !== 'draft') {
      return badRequest('Hanya transaksi draft yang bisa di-posting');
    }
    if (!isPostableDraft(existing)) {
      return badRequest(
        'Draft belum lengkap. Lengkapi akun debit & kredit dan jumlah sebelum mem-posting.'
      );
    }

    const { data, error } = await supabase
      .from('transactions')
      .update({
        status: 'posted',
        posted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', parsedId.data)
      .eq('status', 'draft')
      .select()
      .single();

    if (error) return serverError(error);
    return NextResponse.json({ data });
  } catch (err) {
    return serverError(err);
  }
}

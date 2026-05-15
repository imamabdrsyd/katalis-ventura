import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { settleTransactionSchema, transactionIdSchema } from '@/lib/validations';
import { badRequest, forbidden, notFound, serverError, unauthorized, validationError } from '@/lib/api/server/responses';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/transactions/[id]/settle
 * Settle a payable/receivable (full or partial) atomically via RPC.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const parsedId = transactionIdSchema.safeParse(id);
    if (!parsedId.success) return badRequest('Format ID transaksi tidak valid');

    const body = await request.json();
    const parsed = settleTransactionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createServerClient();

    const { data: original, error: fetchErr } = await supabase
      .from('transactions')
      .select('id, business_id, date')
      .eq('id', parsedId.data)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchErr || !original) return notFound('Transaksi tidak ditemukan');
    if (!(await canManageBusiness(supabase, user.id, original.business_id))) {
      return forbidden('Hanya manager bisnis yang dapat melunasi transaksi');
    }

    // Period lock check (against settlement date)
    const { data: biz } = await supabase
      .from('businesses')
      .select('closed_until_date')
      .eq('id', original.business_id)
      .single();

    if (biz?.closed_until_date && parsed.data.settlement_data.date <= biz.closed_until_date) {
      return NextResponse.json(
        { error: `Periode hingga ${biz.closed_until_date} sudah dikunci.` },
        { status: 423 }
      );
    }

    const { data, error } = await supabase.rpc('settle_transaction', {
      p_original_transaction_id: parsedId.data,
      p_settlement_data: parsed.data.settlement_data,
      p_partial_amount: parsed.data.partial_amount ?? null,
      p_outstanding_amount: parsed.data.outstanding_amount ?? null,
    });

    if (error) return serverError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return serverError(new Error('Gagal melunasi transaksi'));
    return NextResponse.json({ data: row });
  } catch (err) {
    return serverError(err);
  }
}

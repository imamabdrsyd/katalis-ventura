import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { transactionIdSchema, updateMultiLineTransactionSchema } from '@/lib/validations';
import { badRequest, forbidden, notFound, serverError, unauthorized, validationError } from '@/lib/api/server/responses';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/transactions/[id]/multi-line
 * Update header fields and optionally replace journal_lines atomically via RPC.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const parsedId = transactionIdSchema.safeParse(id);
    if (!parsedId.success) return badRequest('Format ID transaksi tidak valid');

    const body = await request.json();
    const parsed = updateMultiLineTransactionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createServerClient();

    const { data: existing, error: fetchErr } = await supabase
      .from('transactions')
      .select('id, business_id, status, date, is_multi_line')
      .eq('id', parsedId.data)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchErr || !existing) return notFound('Transaksi tidak ditemukan');
    if (!(await canManageBusiness(supabase, user.id, existing.business_id))) {
      return forbidden('Hanya manager bisnis yang dapat mengubah transaksi');
    }

    // Block editing posted unless status-only change
    const isOnlyStatusChange =
      Object.keys(parsed.data).length === 1 && parsed.data.status === 'posted';
    if (existing.status === 'posted' && !isOnlyStatusChange) {
      return badRequest('Transaksi yang sudah di-posting tidak dapat diedit');
    }

    // Period lock
    const { data: biz } = await supabase
      .from('businesses')
      .select('closed_until_date')
      .eq('id', existing.business_id)
      .single();

    if (biz?.closed_until_date && existing.date <= biz.closed_until_date) {
      return NextResponse.json(
        { error: `Periode hingga ${biz.closed_until_date} sudah dikunci. Transaksi tidak dapat diedit.` },
        { status: 423 }
      );
    }

    // Build header update payload
    const headerUpdate: Record<string, unknown> = { updated_by: user.id };
    if (parsed.data.date !== undefined) headerUpdate.date = parsed.data.date;
    if (parsed.data.category !== undefined) headerUpdate.category = parsed.data.category;
    if (parsed.data.name !== undefined) headerUpdate.name = parsed.data.name;
    if (parsed.data.description !== undefined) headerUpdate.description = parsed.data.description;
    if (parsed.data.notes !== undefined) headerUpdate.notes = parsed.data.notes;
    if (parsed.data.status !== undefined) headerUpdate.status = parsed.data.status;
    if (parsed.data.meta !== undefined) headerUpdate.meta = parsed.data.meta;

    if (parsed.data.journal_lines) {
      // Verify all accounts belong to this business
      const accountIds = [...new Set(parsed.data.journal_lines.map((l) => l.account_id))];
      const { data: accs, error: accErr } = await supabase
        .from('accounts')
        .select('id, business_id')
        .in('id', accountIds);

      if (accErr || !accs || accs.length !== accountIds.length) {
        return badRequest('Satu atau lebih akun tidak ditemukan');
      }
      if (!accs.every((a) => a.business_id === existing.business_id)) {
        return badRequest('Semua akun harus dalam bisnis yang sama');
      }

      const totalDebit = parsed.data.journal_lines.reduce((s, l) => s + l.debit_amount, 0);
      headerUpdate.amount = totalDebit;
    }

    if (parsed.data.status === 'posted' && existing.status === 'draft') {
      headerUpdate.posted_at = new Date().toISOString();
    }

    const { data: updated, error: updateErr } = await supabase
      .from('transactions')
      .update(headerUpdate)
      .eq('id', parsedId.data)
      .select()
      .single();

    if (updateErr || !updated) return serverError(updateErr ?? new Error('Update failed'));

    if (parsed.data.journal_lines) {
      const lines = parsed.data.journal_lines.map((l, i) => ({
        account_id: l.account_id,
        debit_amount: l.debit_amount,
        credit_amount: l.credit_amount,
        description: l.description ?? null,
        sort_order: l.sort_order ?? i,
      }));

      const { error: rpcErr } = await supabase.rpc('replace_journal_lines', {
        p_transaction_id: parsedId.data,
        p_lines: lines,
      });

      if (rpcErr) return serverError(rpcErr);
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    return serverError(err);
  }
}

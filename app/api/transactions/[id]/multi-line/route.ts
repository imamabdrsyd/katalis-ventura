import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { transactionIdSchema, updateMultiLineTransactionSchema } from '@/lib/validations';
import { badRequest, forbidden, notFound, serverError, unauthorized, validationError } from '@/lib/api/server/responses';
import { isSuperadminRole } from '@/lib/roles';
import { normalizeCurrencyFields } from '@/lib/currency';

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
      .select('id, business_id, status, date, is_multi_line, amount, original_amount, currency_code, fx_rate, fx_rate_date')
      .eq('id', parsedId.data)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchErr || !existing) return notFound('Transaksi tidak ditemukan');
    if (!existing.is_multi_line) return badRequest('Transaksi ini bukan jurnal multi-line');

    if (!(await canManageBusiness(supabase, user.id, existing.business_id))) {
      return forbidden('Hanya manager bisnis yang dapat mengubah transaksi');
    }

    // Superadmin punya privilege bypass cek posted & period lock
    const { data: profile } = await supabase
      .from('profiles')
      .select('default_role')
      .eq('id', user.id)
      .single();
    const isSuperadmin = isSuperadminRole(profile?.default_role);

    // Block editing posted unless status-only change (superadmin dikecualikan)
    const isOnlyStatusChange =
      Object.keys(parsed.data).length === 1 && parsed.data.status === 'posted';
    if (existing.status === 'posted' && !isOnlyStatusChange && !isSuperadmin) {
      return badRequest('Transaksi yang sudah di-posting tidak dapat diedit');
    }

    // Period lock (superadmin dikecualikan)
    const { data: biz } = await supabase
      .from('businesses')
      .select('closed_until_date')
      .eq('id', existing.business_id)
      .single();

    const effectiveDate = parsed.data.date ?? existing.date;
    if (
      biz?.closed_until_date &&
      (existing.date <= biz.closed_until_date || effectiveDate <= biz.closed_until_date) &&
      !isSuperadmin
    ) {
      return NextResponse.json(
        { error: `Periode hingga ${biz.closed_until_date} sudah dikunci. Transaksi tidak dapat diedit.` },
        { status: 423 }
      );
    }

    // Build header update payload
    const headerUpdate: Record<string, unknown> = {};
    if (parsed.data.date !== undefined) headerUpdate.date = parsed.data.date;
    if (parsed.data.category !== undefined) headerUpdate.category = parsed.data.category;
    if (parsed.data.name !== undefined) headerUpdate.name = parsed.data.name;
    if (parsed.data.description !== undefined) headerUpdate.description = parsed.data.description;
    if (parsed.data.notes !== undefined) headerUpdate.notes = parsed.data.notes;
    if (parsed.data.status !== undefined) headerUpdate.status = parsed.data.status;
    if (parsed.data.meta !== undefined) headerUpdate.meta = parsed.data.meta;
    if (parsed.data.fx_gain_loss_amount !== undefined) {
      headerUpdate.fx_gain_loss_amount = parsed.data.fx_gain_loss_amount ?? 0;
    }

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

    const hasCurrencyUpdate = [
      'original_amount',
      'currency_code',
      'fx_rate',
      'fx_rate_date',
    ].some((key) => Object.prototype.hasOwnProperty.call(parsed.data, key));

    if (parsed.data.journal_lines || hasCurrencyUpdate) {
      const amount = (headerUpdate.amount as number | undefined) ?? existing.amount;
      const fxFields = normalizeCurrencyFields({
        amount,
        original_amount: parsed.data.original_amount ?? existing.original_amount ?? amount,
        currency_code: parsed.data.currency_code ?? existing.currency_code,
        fx_rate: parsed.data.fx_rate ?? existing.fx_rate,
        fx_rate_date: parsed.data.fx_rate_date ?? existing.fx_rate_date ?? parsed.data.date ?? existing.date,
      });
      Object.assign(headerUpdate, {
        original_amount: fxFields.original_amount,
        currency_code: fxFields.currency_code,
        fx_rate: fxFields.fx_rate,
        fx_rate_date: fxFields.fx_rate_date,
      });
    }

    let lines: Array<Record<string, unknown>> | null = null;
    if (parsed.data.journal_lines) {
      lines = parsed.data.journal_lines.map((l, i) => ({
        account_id: l.account_id,
        debit_amount: l.debit_amount,
        credit_amount: l.credit_amount,
        currency_code: l.currency_code ?? 'IDR',
        original_debit_amount: l.original_debit_amount ?? l.debit_amount,
        original_credit_amount: l.original_credit_amount ?? l.credit_amount,
        fx_rate: l.fx_rate ?? 1,
        description: l.description ?? null,
        sort_order: l.sort_order ?? i,
      }));
    }

    const { data: rpcData, error: rpcErr } = await supabase.rpc('update_multi_line_transaction', {
      p_transaction_id: parsedId.data,
      p_header: headerUpdate,
      p_lines: lines,
    });

    if (rpcErr) return serverError(rpcErr);
    const updated = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!updated) return serverError(new Error('Update failed'));

    return NextResponse.json({ data: updated });
  } catch (err) {
    return serverError(err);
  }
}

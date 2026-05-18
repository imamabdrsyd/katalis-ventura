import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { bulkCreateTransactionsSchema } from '@/lib/validations';
import { badRequest, forbidden, serverError, unauthorized, validationError } from '@/lib/api/server/responses';
import { normalizeCurrencyFields } from '@/lib/currency';

const BATCH_SIZE = 100;

/**
 * POST /api/transactions/bulk
 * Body: { business_id: string, transactions: TransactionInsert[] }
 * Bulk-insert transactions from import (excel/csv). Manager-only.
 * Returns counts of inserted/failed plus per-batch errors.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const parsed = bulkCreateTransactionsSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { business_id, transactions } = parsed.data;
    const supabase = await createServerClient();

    if (!(await canManageBusiness(supabase, user.id, business_id))) {
      return forbidden('Hanya manager bisnis yang dapat mengimpor transaksi');
    }

    // Period lock check — reject if ANY transaction is inside the locked period.
    const { data: biz } = await supabase
      .from('businesses')
      .select('closed_until_date')
      .eq('id', business_id)
      .single();

    if (biz?.closed_until_date) {
      const lockedDate = biz.closed_until_date;
      const hasLocked = transactions.some((t) => t.date <= lockedDate);
      if (hasLocked) {
        return NextResponse.json(
          { error: `Periode hingga ${lockedDate} sudah dikunci. Beberapa transaksi tidak dapat diimpor.` },
          { status: 423 }
        );
      }
    }

    // Verify all referenced account IDs belong to this business
    const accountIds = new Set<string>();
    for (const t of transactions) {
      if (t.debit_account_id) accountIds.add(t.debit_account_id);
      if (t.credit_account_id) accountIds.add(t.credit_account_id);
    }
    if (accountIds.size > 0) {
      const { data: accts, error: acctErr } = await supabase
        .from('accounts')
        .select('id, business_id')
        .in('id', [...accountIds]);

      if (acctErr) return serverError(acctErr);
      if (!accts || accts.length !== accountIds.size) {
        return badRequest('Satu atau lebih akun tidak ditemukan');
      }
      if (!accts.every((a) => a.business_id === business_id)) {
        return badRequest('Semua akun harus dalam bisnis yang sama');
      }
    }

    const stamped = transactions.map((t) => {
      const fxFields = normalizeCurrencyFields({
        amount: t.amount,
        original_amount: t.original_amount ?? t.amount,
        currency_code: t.currency_code,
        fx_rate: t.fx_rate,
        fx_rate_date: t.fx_rate_date ?? t.date,
      });

      return {
        ...t,
        ...fxFields,
        fx_gain_loss_amount: t.fx_gain_loss_amount ?? 0,
        business_id,
        created_by: user.id,
      };
    });

    let inserted = 0;
    let failed = 0;
    const errors: string[] = [];
    const insertedData: unknown[] = [];

    for (let i = 0; i < stamped.length; i += BATCH_SIZE) {
      const batch = stamped.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from('transactions')
        .insert(batch)
        .select();

      if (error) {
        failed += batch.length;
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else if (data) {
        inserted += data.length;
        insertedData.push(...data);
      }
    }

    return NextResponse.json({
      data: {
        success: failed === 0,
        inserted,
        failed,
        errors,
        data: insertedData,
      },
    });
  } catch (err) {
    return serverError(err);
  }
}

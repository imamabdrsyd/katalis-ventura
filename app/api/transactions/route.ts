import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { createTransactionSchema, createMultiLineTransactionSchema, businessIdSchema } from '@/lib/validations';
import { normalizeCurrencyFields } from '@/lib/currency';

/**
 * GET /api/transactions?businessId=<uuid>
 * Server-side validated transaction listing
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = request.nextUrl.searchParams.get('businessId');
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const parsed = businessIdSchema.safeParse(businessId);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid business ID format' }, { status: 400 });
    }

    const supabase = await createServerClient();

    // RLS will enforce that user can only access businesses they belong to
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        debit_account:accounts!transactions_debit_account_id_fkey(*),
        credit_account:accounts!transactions_credit_account_id_fkey(*),
        journal_lines(*, account:accounts(*))
      `)
      .eq('business_id', parsed.data)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Transactions GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/transactions
 * Server-side validated transaction creation
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Route to multi-line handler when journal_lines array is present
    if (body.journal_lines && Array.isArray(body.journal_lines)) {
      const parsed = createMultiLineTransactionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: parsed.error.issues.map((i) => ({
              field: i.path.join('.'),
              message: i.message,
            })),
          },
          { status: 400 }
        );
      }

      const supabase = await createServerClient();

      if (!(await canManageBusiness(supabase, user.id, parsed.data.business_id))) {
        return NextResponse.json({ error: 'Only business managers can create transactions' }, { status: 403 });
      }

      // Period lock check
      const { data: biz } = await supabase
        .from('businesses')
        .select('closed_until_date')
        .eq('id', parsed.data.business_id)
        .single();

      if (biz?.closed_until_date && parsed.data.date <= biz.closed_until_date) {
        return NextResponse.json(
          { error: `Periode hingga ${biz.closed_until_date} sudah dikunci.` },
          { status: 423 }
        );
      }

      // Verify all accounts belong to this business
      const accountIds = [...new Set(parsed.data.journal_lines.map((l) => l.account_id))];
      const { data: accs, error: accsErr } = await supabase
        .from('accounts').select('id, business_id').in('id', accountIds);

      if (accsErr || !accs || accs.length !== accountIds.length) {
        return NextResponse.json({ error: 'One or more accounts not found' }, { status: 400 });
      }
      if (!accs.every((a) => a.business_id === parsed.data.business_id)) {
        return NextResponse.json({ error: 'All accounts must belong to the same business' }, { status: 400 });
      }

      const totalDebit = parsed.data.journal_lines.reduce((s, l) => s + l.debit_amount, 0);
      const fxFields = normalizeCurrencyFields({
        amount: totalDebit,
        original_amount: parsed.data.original_amount ?? totalDebit,
        currency_code: parsed.data.currency_code,
        fx_rate: parsed.data.fx_rate,
        fx_rate_date: parsed.data.fx_rate_date ?? parsed.data.date,
      });

      const lines = parsed.data.journal_lines.map((l, i) => ({
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

      const { data: rpcData, error: rpcErr } = await supabase.rpc('create_multi_line_transaction', {
        p_header: {
          business_id: parsed.data.business_id,
          date: parsed.data.date,
          category: parsed.data.category,
          name: parsed.data.name,
          description: parsed.data.description,
          notes: parsed.data.notes ?? null,
          amount: totalDebit,
          original_amount: fxFields.original_amount,
          currency_code: fxFields.currency_code,
          fx_rate: fxFields.fx_rate,
          fx_rate_date: fxFields.fx_rate_date,
          fx_gain_loss_amount: parsed.data.fx_gain_loss_amount ?? 0,
          account: 'Multi-line journal entry',
          status: parsed.data.status ?? 'draft',
          meta: parsed.data.meta ?? null,
          sales_channel: parsed.data.sales_channel ?? null,
        },
        p_lines: lines,
      });

      const transaction = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (rpcErr || !transaction) {
        return NextResponse.json({ error: rpcErr?.message ?? 'Insert failed' }, { status: 500 });
      }

      return NextResponse.json({ data: transaction }, { status: 201 });
    }

    // --- Standard single-entry path ---
    // Server-side validation with zod
    const parsed = createTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Verify user has write access to this business.
    if (!(await canManageBusiness(supabase, user.id, parsed.data.business_id))) {
      return NextResponse.json(
        { error: 'Only business managers can create transactions' },
        { status: 403 }
      );
    }

    // Period lock check: reject if transaction date is within locked period
    const { data: biz } = await supabase
      .from('businesses')
      .select('closed_until_date')
      .eq('id', parsed.data.business_id)
      .single();

    if (biz?.closed_until_date && parsed.data.date <= biz.closed_until_date) {
      return NextResponse.json(
        { error: `Periode hingga ${biz.closed_until_date} sudah dikunci. Tidak dapat membuat transaksi di periode ini.` },
        { status: 423 }
      );
    }

    // If double-entry, verify both accounts belong to this business
    if (parsed.data.is_double_entry && parsed.data.debit_account_id && parsed.data.credit_account_id) {
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id, business_id')
        .in('id', [parsed.data.debit_account_id, parsed.data.credit_account_id]);

      if (accountsError || !accounts || accounts.length !== 2) {
        return NextResponse.json(
          { error: 'One or both accounts not found' },
          { status: 400 }
        );
      }

      const allBelongToBusiness = accounts.every(
        (acc) => acc.business_id === parsed.data.business_id
      );
      if (!allBelongToBusiness) {
        return NextResponse.json(
          { error: 'Accounts must belong to the same business' },
          { status: 400 }
        );
      }
    }

    // If linked to a contact, verify it belongs to this business
    if (parsed.data.contact_id) {
      const { data: contact } = await supabase
        .from('business_contacts')
        .select('id, business_id')
        .eq('id', parsed.data.contact_id)
        .maybeSingle();

      if (!contact || contact.business_id !== parsed.data.business_id) {
        return NextResponse.json(
          { error: 'Contact not found in this business' },
          { status: 400 }
        );
      }
    }

    const fxFields = normalizeCurrencyFields({
      amount: parsed.data.amount,
      original_amount: parsed.data.original_amount ?? parsed.data.amount,
      currency_code: parsed.data.currency_code,
      fx_rate: parsed.data.fx_rate,
      fx_rate_date: parsed.data.fx_rate_date ?? parsed.data.date,
    });

    // Insert the transaction — created_by is set to the authenticated user
    const { data: transaction, error: insertError } = await supabase
      .from('transactions')
      .insert({
        ...parsed.data,
        ...fxFields,
        fx_gain_loss_amount: parsed.data.fx_gain_loss_amount ?? 0,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating transaction:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ data: transaction }, { status: 201 });
  } catch (error) {
    console.error('Transactions POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

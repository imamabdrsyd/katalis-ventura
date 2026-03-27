import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { updateTransactionSchema, transactionIdSchema } from '@/lib/validations';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/transactions/[id]
 * Server-side validated transaction update
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const idParsed = transactionIdSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json({ error: 'Invalid transaction ID format' }, { status: 400 });
    }

    const body = await request.json();

    // Server-side validation
    const parsed = updateTransactionSchema.safeParse(body);
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

    // Fetch the existing transaction to verify ownership and status
    const { data: existing, error: fetchError } = await supabase
      .from('transactions')
      .select('id, business_id, status, date')
      .eq('id', idParsed.data)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Block editing posted transactions (except status change draft→posted)
    const isOnlyStatusChange = Object.keys(parsed.data).length === 1 && parsed.data.status === 'posted';
    if (existing.status === 'posted' && !isOnlyStatusChange) {
      return NextResponse.json(
        { error: 'Transaksi yang sudah di-posting tidak dapat diedit. Hapus dan buat ulang jika perlu.' },
        { status: 400 }
      );
    }

    // Period lock check: reject if transaction date is within locked period
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

    // Verify user has write access to this business
    const { data: role, error: roleError } = await supabase
      .from('user_business_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('business_id', existing.business_id)
      .single();

    if (roleError || !role) {
      return NextResponse.json(
        { error: 'You do not have access to this business' },
        { status: 403 }
      );
    }

    if (role.role !== 'business_manager' && role.role !== 'both') {
      return NextResponse.json(
        { error: 'Only business managers can update transactions' },
        { status: 403 }
      );
    }

    // Validate account ownership if debit/credit accounts are being updated
    const debitId = parsed.data.debit_account_id;
    const creditId = parsed.data.credit_account_id;
    const accountIdsToCheck = [debitId, creditId].filter(Boolean) as string[];

    if (accountIdsToCheck.length > 0) {
      const { data: accts, error: acctErr } = await supabase
        .from('accounts')
        .select('id, business_id')
        .in('id', accountIdsToCheck);

      if (acctErr || !accts || accts.length !== accountIdsToCheck.length) {
        return NextResponse.json(
          { error: 'Satu atau kedua akun tidak ditemukan' },
          { status: 400 }
        );
      }

      if (!accts.every((a) => a.business_id === existing.business_id)) {
        return NextResponse.json(
          { error: 'Akun harus milik bisnis yang sama' },
          { status: 400 }
        );
      }
    }

    // If posting, set posted_at timestamp
    const updateData = { ...parsed.data, updated_by: user.id } as Record<string, unknown>;
    if (parsed.data.status === 'posted' && existing.status === 'draft') {
      updateData.posted_at = new Date().toISOString();
    }

    // Update with audit trail
    const { data: updated, error: updateError } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', idParsed.data)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating transaction:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Transaction PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/transactions/[id]
 * Server-side validated soft-delete
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const idParsed = transactionIdSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json({ error: 'Invalid transaction ID format' }, { status: 400 });
    }

    const supabase = await createServerClient();

    // Fetch the existing transaction to verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('transactions')
      .select('id, business_id, date')
      .eq('id', idParsed.data)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Verify user has write access to this business
    const { data: role, error: roleError } = await supabase
      .from('user_business_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('business_id', existing.business_id)
      .single();

    if (roleError || !role) {
      return NextResponse.json(
        { error: 'You do not have access to this business' },
        { status: 403 }
      );
    }

    if (role.role !== 'business_manager' && role.role !== 'both') {
      return NextResponse.json(
        { error: 'Only business managers can delete transactions' },
        { status: 403 }
      );
    }

    // Period lock check: reject if transaction date is within locked period
    const { data: biz } = await supabase
      .from('businesses')
      .select('closed_until_date')
      .eq('id', existing.business_id)
      .single();

    if (biz?.closed_until_date && existing.date <= biz.closed_until_date) {
      return NextResponse.json(
        { error: `Periode hingga ${biz.closed_until_date} sudah dikunci. Transaksi tidak dapat dihapus.` },
        { status: 423 }
      );
    }

    // Soft delete via stored procedure
    const { error: deleteError } = await supabase.rpc('soft_delete_transaction', {
      transaction_id: idParsed.data,
    });

    if (deleteError) {
      console.error('Error deleting transaction:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Transaction DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

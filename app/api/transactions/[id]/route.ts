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

    // Fetch the existing transaction to verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('transactions')
      .select('id, business_id')
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
        { error: 'Only business managers can update transactions' },
        { status: 403 }
      );
    }

    // Update with audit trail
    const { data: updated, error: updateError } = await supabase
      .from('transactions')
      .update({
        ...parsed.data,
        updated_by: user.id,
      })
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
      .select('id, business_id')
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

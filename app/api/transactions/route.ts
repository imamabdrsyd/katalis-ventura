import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { createTransactionSchema, businessIdSchema } from '@/lib/validations';

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
        credit_account:accounts!transactions_credit_account_id_fkey(*)
      `)
      .eq('business_id', parsed.data)
      .is('deleted_at', null)
      .order('date', { ascending: false });

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

    // Verify user has write access to this business (manager or both)
    const { data: role, error: roleError } = await supabase
      .from('user_business_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('business_id', parsed.data.business_id)
      .single();

    if (roleError || !role) {
      return NextResponse.json(
        { error: 'You do not have access to this business' },
        { status: 403 }
      );
    }

    if (role.role !== 'business_manager' && role.role !== 'both') {
      return NextResponse.json(
        { error: 'Only business managers can create transactions' },
        { status: 403 }
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

    // Insert the transaction — created_by is set to the authenticated user
    const { data: transaction, error: insertError } = await supabase
      .from('transactions')
      .insert({
        ...parsed.data,
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

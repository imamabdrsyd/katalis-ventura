import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { businessIdSchema } from '@/lib/validations';

/**
 * GET /api/sync/pull?businessId=<uuid>&lastSyncAt=<ISO8601>
 * Returns transactions that changed since lastSyncAt (for WatermelonDB sync)
 * Format: { transactions: { created, updated, deleted } }
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = request.nextUrl.searchParams.get('businessId');
    const lastSyncAt = request.nextUrl.searchParams.get('lastSyncAt');

    if (!businessId || !lastSyncAt) {
      return NextResponse.json(
        { error: 'businessId and lastSyncAt are required' },
        { status: 400 }
      );
    }

    const parsed = businessIdSchema.safeParse(businessId);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid business ID format' }, { status: 400 });
    }

    // Parse lastSyncAt as timestamp (milliseconds)
    const lastSyncTimestamp = parseInt(lastSyncAt, 10);
    if (isNaN(lastSyncTimestamp)) {
      return NextResponse.json({ error: 'Invalid lastSyncAt timestamp' }, { status: 400 });
    }
    const lastSyncDate = new Date(lastSyncTimestamp).toISOString();

    const supabase = await createServerClient();

    // Verify user has access to this business
    const { data: role, error: roleError } = await supabase
      .from('user_business_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('business_id', parsed.data)
      .single();

    if (roleError || !role) {
      return NextResponse.json(
        { error: 'You do not have access to this business' },
        { status: 403 }
      );
    }

    // Pull created transactions (created after lastSyncAt and not deleted)
    const { data: created, error: createdError } = await supabase
      .from('transactions')
      .select(
        `*,
        debit_account:accounts!transactions_debit_account_id_fkey(*),
        credit_account:accounts!transactions_credit_account_id_fkey(*)`
      )
      .eq('business_id', parsed.data)
      .gt('created_at', lastSyncDate)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (createdError) {
      console.error('Error fetching created transactions:', createdError);
      return NextResponse.json({ error: createdError.message }, { status: 500 });
    }

    // Pull updated transactions (updated after lastSyncAt, but not created after)
    const { data: updated, error: updatedError } = await supabase
      .from('transactions')
      .select(
        `*,
        debit_account:accounts!transactions_debit_account_id_fkey(*),
        credit_account:accounts!transactions_credit_account_id_fkey(*)`
      )
      .eq('business_id', parsed.data)
      .gt('updated_at', lastSyncDate)
      .lte('created_at', lastSyncDate)
      .is('deleted_at', null)
      .order('updated_at', { ascending: true });

    if (updatedError) {
      console.error('Error fetching updated transactions:', updatedError);
      return NextResponse.json({ error: updatedError.message }, { status: 500 });
    }

    // Pull deleted transactions (soft-deleted after lastSyncAt)
    const { data: deletedRaw, error: deletedError } = await supabase
      .from('transactions')
      .select('id')
      .eq('business_id', parsed.data)
      .gt('deleted_at', lastSyncDate)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: true });

    if (deletedError) {
      console.error('Error fetching deleted transactions:', deletedError);
      return NextResponse.json({ error: deletedError.message }, { status: 500 });
    }

    const deleted = (deletedRaw || []).map((tx: any) => tx.id);

    return NextResponse.json({
      transactions: {
        created: created || [],
        updated: updated || [],
        deleted,
      },
    });
  } catch (error) {
    console.error('Sync pull error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

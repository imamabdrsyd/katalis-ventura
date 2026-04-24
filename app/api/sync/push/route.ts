import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { businessIdSchema, createTransactionSchema } from '@/lib/validations';

interface PushPayload {
  businessId: string;
  changes: {
    transactions: {
      created: any[];
      updated: any[];
      deleted: string[];
    };
  };
}

/**
 * POST /api/sync/push
 * Receives transaction changes from mobile app and applies them to server
 * Body: { businessId, changes: { transactions: { created, updated, deleted } } }
 * Returns: { success: boolean, conflicts: [] }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: PushPayload = await request.json();
    const { businessId, changes } = body;

    if (!businessId || !changes) {
      return NextResponse.json(
        { error: 'businessId and changes are required' },
        { status: 400 }
      );
    }

    const parsed = businessIdSchema.safeParse(businessId);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid business ID format' }, { status: 400 });
    }

    const supabase = await createServerClient();

    // Verify user has manager access to this business
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

    if (role.role !== 'business_manager' && role.role !== 'both') {
      return NextResponse.json(
        { error: 'Only business managers can push transactions' },
        { status: 403 }
      );
    }

    const conflicts = [];

    // Handle created transactions
    if (changes.transactions.created && changes.transactions.created.length > 0) {
      for (const tx of changes.transactions.created) {
        // Validate before inserting
        const validation = createTransactionSchema.safeParse({
          business_id: parsed.data,
          ...tx,
        });

        if (!validation.success) {
          conflicts.push({
            id: tx.id,
            error: 'Validation failed',
          });
          continue;
        }

        const { error: insertError } = await supabase.from('transactions').insert({
          ...tx,
          business_id: parsed.data,
          created_by: user.id,
          updated_by: user.id,
        });

        if (insertError) {
          conflicts.push({
            id: tx.id,
            error: insertError.message,
          });
        }
      }
    }

    // Handle updated transactions
    if (changes.transactions.updated && changes.transactions.updated.length > 0) {
      for (const tx of changes.transactions.updated) {
        const { id, ...updateData } = tx;

        // Check for conflicts (server-side updated_at > client-side updated_at)
        // Also enforces business_id scope — only fetch if owned by this business
        const { data: existing } = await supabase
          .from('transactions')
          .select('updated_at')
          .eq('id', id)
          .eq('business_id', parsed.data)
          .is('deleted_at', null)
          .single();

        if (!existing) {
          conflicts.push({ id, error: 'Transaction not found in this business' });
          continue;
        }

        if (new Date(existing.updated_at).getTime() > new Date(updateData.updated_at).getTime()) {
          conflicts.push({
            id,
            error: 'Conflict: server version is newer',
          });
          continue;
        }

        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            ...updateData,
            updated_by: user.id,
          })
          .eq('id', id)
          .eq('business_id', parsed.data);

        if (updateError) {
          conflicts.push({
            id,
            error: updateError.message,
          });
        }
      }
    }

    // Handle deleted transactions (soft delete)
    if (changes.transactions.deleted && changes.transactions.deleted.length > 0) {
      for (const txId of changes.transactions.deleted) {
        // Verify ownership before calling the SECURITY DEFINER RPC (which skips RLS)
        const { data: owned } = await supabase
          .from('transactions')
          .select('id')
          .eq('id', txId)
          .eq('business_id', parsed.data)
          .is('deleted_at', null)
          .maybeSingle();

        if (!owned) {
          conflicts.push({ id: txId, error: 'Transaction not found in this business' });
          continue;
        }

        const { error: deleteError } = await supabase.rpc('soft_delete_transaction', {
          transaction_id: txId,
        });

        if (deleteError) {
          conflicts.push({
            id: txId,
            error: deleteError.message,
          });
        }
      }
    }

    return NextResponse.json({
      success: conflicts.length === 0,
      conflicts,
    });
  } catch (error) {
    console.error('Sync push error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

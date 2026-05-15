import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { transactionIdSchema } from '@/lib/validations';
import { badRequest, forbidden, notFound, serverError, unauthorized } from '@/lib/api/server/responses';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/transactions/[id]/restore
 * Restore a soft-deleted transaction.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const parsedId = transactionIdSchema.safeParse(id);
    if (!parsedId.success) return badRequest('Format ID transaksi tidak valid');

    const supabase = await createServerClient();

    // Read the deleted transaction (RLS may filter — use admin fallback if needed).
    const { data: existing, error: fetchErr } = await supabase
      .from('transactions')
      .select('id, business_id, deleted_at')
      .eq('id', parsedId.data)
      .maybeSingle();

    if (fetchErr || !existing) return notFound('Transaksi tidak ditemukan');
    if (!existing.deleted_at) return badRequest('Transaksi tidak dalam keadaan terhapus');
    if (!(await canManageBusiness(supabase, user.id, existing.business_id))) {
      return forbidden('Hanya manager bisnis yang dapat mengembalikan transaksi');
    }

    const { error } = await supabase.rpc('restore_transaction', {
      transaction_id: parsedId.data,
    });

    if (error) return serverError(error);
    return NextResponse.json({ data: { id: parsedId.data, restored: true } });
  } catch (err) {
    return serverError(err);
  }
}

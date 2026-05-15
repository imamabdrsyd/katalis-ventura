import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { businessIdSchema, updateBusinessSchema } from '@/lib/validations';
import { badRequest, forbidden, notFound, serverError, unauthorized, validationError } from '@/lib/api/server/responses';

interface RouteParams {
  params: Promise<{ businessId: string }>;
}

/**
 * PATCH /api/businesses/[businessId]
 * Update business fields. Also adjusts the auto-generated initial capital
 * transaction when capital_investment changes.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { businessId } = await params;
    const idParsed = businessIdSchema.safeParse(businessId);
    if (!idParsed.success) return badRequest('Format ID bisnis tidak valid');

    const body = await request.json();
    const parsed = updateBusinessSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createServerClient();
    if (!(await canManageBusiness(supabase, user.id, idParsed.data))) {
      return forbidden('Hanya manager bisnis yang dapat mengubah bisnis');
    }

    const { data: business, error: updErr } = await supabase
      .from('businesses')
      .update(parsed.data)
      .eq('id', idParsed.data)
      .select()
      .single();

    if (updErr || !business) return serverError(updErr ?? new Error('Update failed'));

    // Sync capital injection transaction if capital_investment was changed
    if (parsed.data.capital_investment !== undefined) {
      const newAmount = parsed.data.capital_investment;
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('business_id', idParsed.data)
        .eq('category', 'FIN')
        .eq('name', 'Modal Investasi Awal')
        .is('deleted_at', null)
        .maybeSingle();

      if (existingTx) {
        if (newAmount <= 0) {
          await supabase.rpc('soft_delete_transaction', { transaction_id: existingTx.id });
        } else {
          await supabase
            .from('transactions')
            .update({ amount: newAmount, updated_at: new Date().toISOString(), updated_by: user.id })
            .eq('id', existingTx.id);
        }
      } else if (newAmount > 0) {
        // Need to find Cash + Owner's Capital accounts
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id, account_code')
          .eq('business_id', idParsed.data)
          .in('account_code', ['1100', '3100']);

        const cash = accounts?.find((a) => a.account_code === '1100');
        const equity = accounts?.find((a) => a.account_code === '3100');

        if (cash && equity) {
          await supabase.from('transactions').insert({
            business_id: idParsed.data,
            date: new Date().toISOString().split('T')[0],
            category: 'FIN',
            name: 'Modal Investasi Awal',
            description: 'Setoran modal investasi awal dari pemilik',
            amount: newAmount,
            account: 'Cash',
            created_by: user.id,
            debit_account_id: cash.id,
            credit_account_id: equity.id,
            is_double_entry: true,
            status: 'posted',
            posted_at: new Date().toISOString(),
            notes: 'Transaksi modal investasi awal dibuat otomatis saat update bisnis',
          });
        }
      }
    }

    return NextResponse.json({ data: business });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * GET /api/businesses/[businessId]
 * Returns a single business if the user has access (via RLS).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { businessId } = await params;
    const idParsed = businessIdSchema.safeParse(businessId);
    if (!idParsed.success) return badRequest('Format ID bisnis tidak valid');

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', idParsed.data)
      .maybeSingle();

    if (error) return serverError(error);
    if (!data) return notFound('Bisnis tidak ditemukan');
    return NextResponse.json({ data });
  } catch (err) {
    return serverError(err);
  }
}

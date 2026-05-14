import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { bulkUpdateIncomeStatementSectionSchema } from '@/lib/validations';
import { badRequest, forbidden, serverError, unauthorized, validationError } from '@/lib/api/server/responses';

/**
 * PATCH /api/accounts/income-statement-section
 * Bulk update income_statement_section on multiple accounts (manager only).
 * All accounts must belong to the same business.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const parsed = bulkUpdateIncomeStatementSectionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { business_id, updates } = parsed.data;
    const supabase = await createServerClient();

    if (!(await canManageBusiness(supabase, user.id, business_id))) {
      return forbidden('Hanya manager bisnis yang dapat mengubah section laporan');
    }

    const ids = [...new Set(updates.map((u) => u.id))];
    const { data: accounts, error: fetchErr } = await supabase
      .from('accounts')
      .select('id, business_id')
      .in('id', ids);

    if (fetchErr) return serverError(fetchErr);
    if (!accounts || accounts.length !== ids.length) {
      return badRequest('Satu atau lebih akun tidak ditemukan');
    }
    if (!accounts.every((a) => a.business_id === business_id)) {
      return badRequest('Semua akun harus dalam bisnis yang sama');
    }

    await Promise.all(
      updates.map(({ id, section }) =>
        supabase
          .from('accounts')
          .update({ income_statement_section: section })
          .eq('id', id)
          .eq('business_id', business_id)
      )
    );

    return NextResponse.json({ data: { updated: updates.length } });
  } catch (err) {
    return serverError(err);
  }
}

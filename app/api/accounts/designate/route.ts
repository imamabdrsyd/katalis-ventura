import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { badRequest, forbidden, notFound, serverError, unauthorized, validationError } from '@/lib/api/server/responses';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const designateSchema = z.object({
  business_id: z.string().regex(UUID_REGEX, 'Invalid business ID format'),
  account_id: z.string().regex(UUID_REGEX, 'Invalid account ID format'),
  flag: z.enum(['retained_earnings', 'dividend_payable']),
});

/**
 * POST /api/accounts/designate
 * Designate a single account as Retained Earnings (EQUITY) or Dividend Payable (LIABILITY).
 * Clears the same flag on any other account in the same business.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const parsed = designateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { business_id, account_id, flag } = parsed.data;
    const supabase = await createServerClient();

    if (!(await canManageBusiness(supabase, user.id, business_id))) {
      return forbidden('Hanya manager bisnis yang dapat menetapkan akun ini');
    }

    // Verify account belongs to this business and has correct type
    const { data: account, error: accErr } = await supabase
      .from('accounts')
      .select('id, business_id, account_type')
      .eq('id', account_id)
      .maybeSingle();

    if (accErr || !account) return notFound('Akun tidak ditemukan');
    if (account.business_id !== business_id) {
      return badRequest('Akun tidak termasuk dalam bisnis ini');
    }

    const requiredType = flag === 'retained_earnings' ? 'EQUITY' : 'LIABILITY';
    if (account.account_type !== requiredType) {
      return badRequest(
        flag === 'retained_earnings'
          ? 'Akun Retained Earnings harus bertipe EQUITY'
          : 'Akun Hutang Dividen harus bertipe LIABILITY'
      );
    }

    const column = flag === 'retained_earnings' ? 'is_retained_earnings' : 'is_dividend_payable';

    // Clear any existing designation in this business (except target)
    const { error: clearError } = await supabase
      .from('accounts')
      .update({ [column]: false })
      .eq('business_id', business_id)
      .eq(column, true)
      .neq('id', account_id);

    if (clearError) return serverError(clearError);

    // Set the flag on target
    const { error: setError } = await supabase
      .from('accounts')
      .update({ [column]: true })
      .eq('id', account_id)
      .eq('business_id', business_id)
      .eq('account_type', requiredType);

    if (setError) return serverError(setError);
    return NextResponse.json({ data: { account_id, flag, value: true } });
  } catch (err) {
    return serverError(err);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { createAccountSchema } from '@/lib/validations';
import { badRequest, forbidden, serverError, unauthorized, validationError } from '@/lib/api/server/responses';

/**
 * POST /api/accounts
 * Create a new account. Manager-only.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const parsed = createAccountSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createServerClient();

    if (!(await canManageBusiness(supabase, user.id, parsed.data.business_id))) {
      return forbidden('Hanya manager bisnis yang dapat membuat akun');
    }

    // If parent_account_id is set, verify it belongs to this business
    if (parsed.data.parent_account_id) {
      const { data: parent, error: parentErr } = await supabase
        .from('accounts')
        .select('id, business_id')
        .eq('id', parsed.data.parent_account_id)
        .maybeSingle();

      if (parentErr || !parent) return badRequest('Akun induk tidak ditemukan');
      if (parent.business_id !== parsed.data.business_id) {
        return badRequest('Akun induk harus dalam bisnis yang sama');
      }
    }

    const { data, error } = await supabase
      .from('accounts')
      .insert(parsed.data)
      .select()
      .single();

    if (error) return serverError(error);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}

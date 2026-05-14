import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { accountIdSchema, updateAccountSchema } from '@/lib/validations';
import { badRequest, forbidden, notFound, serverError, unauthorized, validationError } from '@/lib/api/server/responses';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function assertManagerOfAccount(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  accountId: string
) {
  const { data: account, error } = await supabase
    .from('accounts')
    .select('id, business_id, is_system')
    .eq('id', accountId)
    .maybeSingle();

  if (error || !account) return { error: notFound('Akun tidak ditemukan') as Response };
  if (!(await canManageBusiness(supabase, userId, account.business_id))) {
    return { error: forbidden('Hanya manager bisnis yang dapat mengubah akun') as Response };
  }
  return { account };
}

/**
 * PATCH /api/accounts/[id]
 * Update an account (partial). Manager-only.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const parsedId = accountIdSchema.safeParse(id);
    if (!parsedId.success) return badRequest('Format ID akun tidak valid');

    const body = await request.json();
    const parsed = updateAccountSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createServerClient();
    const check = await assertManagerOfAccount(supabase, user.id, parsedId.data);
    if ('error' in check) return check.error;

    const { data, error } = await supabase
      .from('accounts')
      .update(parsed.data)
      .eq('id', parsedId.data)
      .select()
      .single();

    if (error) return serverError(error);
    return NextResponse.json({ data });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/accounts/[id]
 * Soft-delete an account by deactivating it. System accounts cannot be deactivated.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const parsedId = accountIdSchema.safeParse(id);
    if (!parsedId.success) return badRequest('Format ID akun tidak valid');

    const supabase = await createServerClient();
    const check = await assertManagerOfAccount(supabase, user.id, parsedId.data);
    if ('error' in check) return check.error;

    if (check.account.is_system) {
      return badRequest('Akun sistem tidak dapat dinonaktifkan');
    }

    const { error } = await supabase
      .from('accounts')
      .update({ is_active: false })
      .eq('id', parsedId.data)
      .eq('is_system', false);

    if (error) return serverError(error);
    return NextResponse.json({ data: { id: parsedId.data, is_active: false } });
  } catch (err) {
    return serverError(err);
  }
}

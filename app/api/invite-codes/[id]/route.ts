import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { badRequest, forbidden, notFound, serverError, unauthorized } from '@/lib/api/server/responses';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idSchema = z.string().regex(UUID_REGEX, 'Invalid invite code ID');

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function loadAndAuthorize(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  inviteId: string
) {
  const { data: invite, error } = await supabase
    .from('invite_codes')
    .select('id, business_id')
    .eq('id', inviteId)
    .maybeSingle();

  if (error || !invite) return { error: notFound('Kode undangan tidak ditemukan') as Response };
  if (!(await canManageBusiness(supabase, userId, invite.business_id))) {
    return { error: forbidden('Hanya manager bisnis yang dapat mengubah kode undangan') as Response };
  }
  return { invite };
}

/**
 * PATCH /api/invite-codes/[id]
 * Body: { is_active?: boolean }
 * Currently only supports deactivation toggle.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return badRequest('Format ID kode undangan tidak valid');

    const body = await request.json();
    if (typeof body?.is_active !== 'boolean') {
      return badRequest('Field is_active wajib boolean');
    }

    const supabase = await createServerClient();
    const check = await loadAndAuthorize(supabase, user.id, parsedId.data);
    if ('error' in check) return check.error;

    const { data, error } = await supabase
      .from('invite_codes')
      .update({ is_active: body.is_active })
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
 * DELETE /api/invite-codes/[id]
 * Hard-delete an invite code (manager-only).
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return badRequest('Format ID kode undangan tidak valid');

    const supabase = await createServerClient();
    const check = await loadAndAuthorize(supabase, user.id, parsedId.data);
    if ('error' in check) return check.error;

    const { error } = await supabase
      .from('invite_codes')
      .delete()
      .eq('id', parsedId.data);

    if (error) return serverError(error);
    return NextResponse.json({ data: { id: parsedId.data, deleted: true } });
  } catch (err) {
    return serverError(err);
  }
}

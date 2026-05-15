import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { normalizeRole } from '@/lib/roles';
import { businessIdSchema } from '@/lib/validations';
import { badRequest, serverError, unauthorized } from '@/lib/api/server/responses';

interface RouteParams {
  params: Promise<{ businessId: string }>;
}

/**
 * POST /api/businesses/[businessId]/membership
 * Join a business as the authenticated user.
 * Role is derived from profile's default_role (investor unless superadmin).
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { businessId } = await params;
    const idParsed = businessIdSchema.safeParse(businessId);
    if (!idParsed.success) return badRequest('Format ID bisnis tidak valid');

    const supabase = await createServerClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('default_role')
      .eq('id', user.id)
      .maybeSingle();
    const role = normalizeRole(profile?.default_role) === 'superadmin' ? 'superadmin' : 'investor';

    const { error } = await supabase
      .from('user_business_roles')
      .insert({ user_id: user.id, business_id: idParsed.data, role });

    if (error) return serverError(error);
    return NextResponse.json({ data: { joined: true, role } });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/businesses/[businessId]/membership
 * Leave a business (remove your own user_business_roles row).
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { businessId } = await params;
    const idParsed = businessIdSchema.safeParse(businessId);
    if (!idParsed.success) return badRequest('Format ID bisnis tidak valid');

    const supabase = await createServerClient();
    const { error } = await supabase
      .from('user_business_roles')
      .delete()
      .eq('user_id', user.id)
      .eq('business_id', idParsed.data);

    if (error) return serverError(error);
    return NextResponse.json({ data: { left: true } });
  } catch (err) {
    return serverError(err);
  }
}

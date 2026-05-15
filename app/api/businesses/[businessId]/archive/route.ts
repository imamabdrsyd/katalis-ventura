import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { businessIdSchema } from '@/lib/validations';
import { badRequest, forbidden, serverError, unauthorized } from '@/lib/api/server/responses';

interface RouteParams {
  params: Promise<{ businessId: string }>;
}

/**
 * POST /api/businesses/[businessId]/archive
 * Soft-archive a business (sets is_archived = true).
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { businessId } = await params;
    const idParsed = businessIdSchema.safeParse(businessId);
    if (!idParsed.success) return badRequest('Format ID bisnis tidak valid');

    const supabase = await createServerClient();
    if (!(await canManageBusiness(supabase, user.id, idParsed.data))) {
      return forbidden('Hanya manager bisnis yang dapat mengarsipkan bisnis');
    }

    const { data, error } = await supabase
      .from('businesses')
      .update({ is_archived: true })
      .eq('id', idParsed.data)
      .select()
      .single();

    if (error) return serverError(error);
    return NextResponse.json({ data });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/businesses/[businessId]/archive
 * Restore an archived business (sets is_archived = false).
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const { businessId } = await params;
    const idParsed = businessIdSchema.safeParse(businessId);
    if (!idParsed.success) return badRequest('Format ID bisnis tidak valid');

    const supabase = await createServerClient();
    if (!(await canManageBusiness(supabase, user.id, idParsed.data))) {
      return forbidden('Hanya manager bisnis yang dapat mengembalikan bisnis');
    }

    const { data, error } = await supabase
      .from('businesses')
      .update({ is_archived: false })
      .eq('id', idParsed.data)
      .select()
      .single();

    if (error) return serverError(error);
    return NextResponse.json({ data });
  } catch (err) {
    return serverError(err);
  }
}

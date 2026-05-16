import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { businessIdSchema } from '@/lib/validations';
import { isSuperadminRole, normalizeRole } from '@/lib/roles';
import { badRequest, forbidden, serverError, unauthorized } from '@/lib/api/server/responses';

interface RouteParams {
  params: Promise<{ businessId: string }>;
}

/**
 * DELETE /api/businesses/[businessId]/hard-delete
 * Hapus permanen bisnis beserta semua data terkait (cascade via FK).
 * Privilege: hanya superadmin, dan hanya untuk bisnis yang sudah diarsipkan.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
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

    if (!isSuperadminRole(normalizeRole(profile?.default_role))) {
      return forbidden('Hanya superadmin yang dapat menghapus bisnis secara permanen');
    }

    const { data: business, error: fetchError } = await supabase
      .from('businesses')
      .select('id, is_archived')
      .eq('id', idParsed.data)
      .maybeSingle();

    if (fetchError) return serverError(fetchError);
    if (!business) return badRequest('Bisnis tidak ditemukan');
    if (!business.is_archived) {
      return forbidden('Bisnis harus diarsipkan terlebih dahulu sebelum dihapus permanen');
    }

    const { error: deleteError } = await supabase
      .from('businesses')
      .delete()
      .eq('id', idParsed.data);

    if (deleteError) return serverError(deleteError);
    return NextResponse.json({ data: { id: idParsed.data } });
  } catch (err) {
    return serverError(err);
  }
}

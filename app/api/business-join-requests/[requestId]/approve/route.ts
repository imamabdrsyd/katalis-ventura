import { NextResponse } from 'next/server';
import { canManageBusiness, createServerClient, createAdminClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { normalizeRole } from '@/lib/roles';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const supabase = await createServerClient();

    const admin = createAdminClient();

    const { data: req, error: fetchErr } = await admin
      .from('business_join_requests')
      .select('id, business_id, requester_id, status, businesses!inner(created_by)')
      .eq('id', requestId)
      .single();

    if (fetchErr || !req) {
      return NextResponse.json({ error: 'Permintaan tidak ditemukan' }, { status: 404 });
    }

    const business = Array.isArray(req.businesses) ? req.businesses[0] : req.businesses;
    if (!business || !(await canManageBusiness(supabase, user.id, req.business_id))) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk mengelola bisnis ini' }, { status: 403 });
    }

    if (req.status !== 'pending') {
      return NextResponse.json({ error: 'Permintaan sudah diproses sebelumnya' }, { status: 409 });
    }

    const { data: requesterProfile } = await admin
      .from('profiles')
      .select('default_role')
      .eq('id', req.requester_id)
      .single();

    const defaultRole = normalizeRole(requesterProfile?.default_role);
    const role = defaultRole === 'business_manager' || defaultRole === 'superadmin'
      ? defaultRole
      : 'investor';

    const { error: updateErr } = await admin
      .from('business_join_requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateErr) throw updateErr;

    const { error: roleErr } = await admin
      .from('user_business_roles')
      .upsert(
        {
          user_id: req.requester_id,
          business_id: req.business_id,
          role,
          invited_by: user.id,
        },
        { onConflict: 'user_id,business_id' }
      );

    if (roleErr) throw roleErr;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error approving request:', error);
    const message = error instanceof Error ? error.message : 'Gagal menyetujui permintaan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient, getAuthenticatedUser } from '@/lib/supabase-server';

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

    const { data: req, error: fetchErr } = await supabase
      .from('business_join_requests')
      .select('id, business_id, requester_id, status, businesses!inner(created_by)')
      .eq('id', requestId)
      .single();

    if (fetchErr || !req) {
      return NextResponse.json({ error: 'Permintaan tidak ditemukan' }, { status: 404 });
    }

    const business = Array.isArray(req.businesses) ? req.businesses[0] : req.businesses;
    if (!business || business.created_by !== user.id) {
      return NextResponse.json({ error: 'Anda bukan pemilik bisnis ini' }, { status: 403 });
    }

    if (req.status !== 'pending') {
      return NextResponse.json({ error: 'Permintaan sudah diproses sebelumnya' }, { status: 409 });
    }

    const admin = createAdminClient();

    const { data: requesterProfile } = await admin
      .from('profiles')
      .select('default_role')
      .eq('id', req.requester_id)
      .single();

    const role = requesterProfile?.default_role === 'business_manager' || requesterProfile?.default_role === 'both'
      ? requesterProfile.default_role
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

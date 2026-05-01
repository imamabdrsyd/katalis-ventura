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
      .select('id, status, businesses!inner(created_by)')
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
    const { error } = await admin
      .from('business_join_requests')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error rejecting request:', error);
    const message = error instanceof Error ? error.message : 'Gagal menolak permintaan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase-server';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; memberId: string }> }
) {
  try {
    const { businessId, memberId } = await params;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: business, error: businessError } = await admin
      .from('businesses')
      .select('created_by')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: 'Bisnis tidak ditemukan' }, { status: 404 });
    }

    if (business.created_by !== user.id) {
      return NextResponse.json({ error: 'Anda bukan pemilik bisnis ini' }, { status: 403 });
    }

    // memberId dari URL = id row di user_business_roles (PK)
    const { data: member, error: memberError } = await admin
      .from('user_business_roles')
      .select('id, user_id')
      .eq('id', memberId)
      .eq('business_id', businessId)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'Anggota tidak ditemukan' }, { status: 404 });
    }

    // Cegah creator mengeluarkan dirinya sendiri
    if (member.user_id === business.created_by) {
      return NextResponse.json({ error: 'Pemilik bisnis tidak bisa dikeluarkan' }, { status: 400 });
    }

    const { error: deleteError } = await admin
      .from('user_business_roles')
      .delete()
      .eq('id', memberId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    const message = error instanceof Error ? error.message : 'Gagal mengeluarkan anggota';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { isSuperadminRole } from '@/lib/roles';
import { initGcpSchema } from '@/lib/gcpSchema';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // DDL platform-level (CREATE EXTENSION/TABLE pada GCP analytics DB bersama) —
  // hanya superadmin yang boleh menjalankan, bukan sembarang user terautentikasi.
  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('default_role')
    .eq('id', user.id)
    .single();

  if (!isSuperadminRole(profile?.default_role)) {
    return NextResponse.json({ error: 'Forbidden: hanya superadmin yang boleh inisialisasi skema GCP.' }, { status: 403 });
  }

  try {
    const result = await initGcpSchema();
    return NextResponse.json({
      message: 'Schema berhasil diinisialisasi',
      details: result
    });
  } catch (error) {
    console.error('Error in initGcpSchema:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

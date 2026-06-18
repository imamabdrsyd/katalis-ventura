import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getBusinessRoleForUser, createServerClient } from '@/lib/supabase-server';
import { syncBusinessDataToGCP } from '@/lib/gcpSync';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const payload = body as { business_id?: string };
  if (!payload.business_id) {
    return NextResponse.json({ error: 'business_id wajib diisi' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const role = await getBusinessRoleForUser(supabase, user.id, payload.business_id);
  
  // Hanya manager atau superadmin yang boleh sync
  if (!role || role === 'investor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await syncBusinessDataToGCP(payload.business_id);
    return NextResponse.json({
      message: 'Sinkronisasi berhasil',
      details: result
    });
  } catch (error) {
    console.error('Error in syncBusinessDataToGCP:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

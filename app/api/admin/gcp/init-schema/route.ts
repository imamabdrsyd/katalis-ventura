import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import { initGcpSchema } from '@/lib/gcpSchema';

export async function POST(req: NextRequest) {
  // Hanya user yang terautentikasi yang bisa memanggil ini
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

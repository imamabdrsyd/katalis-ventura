import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import { getGoogleConnectionStatus, disconnectGoogle } from '@/lib/google/connection';

/**
 * GET /api/integrations/google-sheets/status
 *
 * Status koneksi Google milik user yang sedang masuk.
 * Respons TIDAK PERNAH memuat token — lihat `getGoogleConnectionStatus`.
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const status = await getGoogleConnectionStatus(user.id);
    return NextResponse.json({ data: status });
  } catch (error) {
    console.error('[google-sheets] gagal membaca status', error);
    return NextResponse.json({ error: 'Gagal membaca status koneksi' }, { status: 500 });
  }
}

/**
 * DELETE /api/integrations/google-sheets/status
 *
 * Putuskan koneksi: cabut token di Google, lalu hapus baris koneksi + daftar
 * file. Tidak boleh menyisakan grant hidup di sisi Google setelah user menekan
 * "Putuskan" di UI.
 */
export async function DELETE() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { revoked } = await disconnectGoogle(user.id);
    return NextResponse.json({ data: { revoked } });
  } catch (error) {
    console.error('[google-sheets] gagal memutus koneksi', error);
    return NextResponse.json({ error: 'Gagal memutus koneksi' }, { status: 500 });
  }
}

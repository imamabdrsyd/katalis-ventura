/**
 * GET /api/public/events/[sessionId]
 *
 * PUBLIK (tanpa auth) — dipakai Lobby untuk polling isi slot selagi halaman
 * terbuka, supaya slot yang baru diambil orang lain langsung terlihat terkunci.
 *
 * Kenapa polling, bukan Supabase Realtime `postgres_changes`: payload realtime
 * membawa ROW LENGKAP tabel dasar, jadi `contact_value` (nomor WA / username IG)
 * pendaftar ikut terkirim ke browser publik. Route ini yang memproyeksikan
 * kolom aman saja (lihat loadPublicSession).
 */

import { NextResponse } from 'next/server';
import { loadPublicSession } from '@/lib/events/publicSession';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const result = await loadPublicSession(sessionId);

  if (!result) {
    return NextResponse.json({ error: 'Event tidak ditemukan' }, { status: 404 });
  }

  return NextResponse.json(
    { session: result.session },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

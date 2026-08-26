/**
 * Pemuat sesi event versi PUBLIK — dipakai halaman Lobby (`/[slug]/events/[id]`)
 * dan route polling `/api/public/events/[sessionId]`.
 *
 * SERVER-ONLY. Ini satu-satunya tempat yang memutuskan kolom apa yang boleh
 * keluar ke browser publik: `contact_value` pendaftar SENGAJA tidak pernah
 * ikut diproyeksikan. Jangan menambah kolom ke bentuk balikan ini tanpa
 * memastikan kolomnya aman dilihat siapa pun yang punya link Lobby.
 */

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase-server';
import type { PublicEventSummary } from '@/components/omnichannel/types';
import type { PublicEventDate, PublicEventSession, PublicEventSlot } from '@/types';

export interface PublicSessionResult {
  session: PublicEventSession;
  businessId: string;
}

/**
 * Dibungkus React `cache()`: `generateMetadata` DAN komponen halaman sama-sama
 * memanggilnya di request yang sama, jadi tanpa dedup seluruh query di sini
 * jalan DUA KALI tiap kali Lobby dibuka.
 *
 * Sesi 'draft' & 'cancelled' → null (tidak pernah tampil publik).
 * Sesi 'closed' TETAP dilayani supaya link yang sudah tersebar tidak jadi 404
 * setelah manager memilih tanggal pemenang — pengunjung malah melihat
 * pengumuman tanggalnya. Pendaftaran baru tetap ditolak di sisi DB.
 */
export const loadPublicSession = cache(async (sessionId: string): Promise<PublicSessionResult | null> => {
  // Guard: sessionId datang dari URL. Bukan UUID → jangan sentuh DB.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) return null;

  const admin = createAdminClient();

  // Sesi & tanggal sama-sama cuma butuh `sessionId` — tidak saling bergantung,
  // jadi jalan bareng. Cuma daftar registrasi yang harus menunggu (butuh id
  // tanggalnya). Memangkas jalur kritis dari 3 round trip berurutan jadi 2.
  const [sessionResult, dateResult] = await Promise.all([
    admin
      .from('event_sessions')
      .select('id, business_id, title, description, eyebrow_text, team_count, players_per_team, team_labels, team_colors, team_text_colors, start_time, end_time, location, contact_method, status')
      .eq('id', sessionId)
      .is('deleted_at', null)
      .in('status', ['open', 'closed'])
      .maybeSingle(),
    admin
      .from('event_session_dates')
      .select('id, event_date, status, sort_order')
      .eq('session_id', sessionId)
      // Kronologis: yang paling dekat di atas. `sort_order` cuma urutan
      // penambahan oleh manager (tidak ada UI reorder), jadi bukan niat urutan.
      .order('event_date', { ascending: true })
      .order('sort_order', { ascending: true }),
  ]);

  const sessionRow = sessionResult.data;
  if (!sessionRow) return null;
  const s = sessionRow as Record<string, unknown>;

  const dates = (dateResult.data ?? []) as Array<{ id: string; event_date: string; status: string; sort_order: number }>;
  const dateIds = dates.map((d) => d.id);

  // Hanya kolom aman. Pendaftar 'cancelled' dibuang: slotnya sudah bebas lagi.
  let slotRows: Array<{
    session_date_id: string;
    team_number: number;
    player_number: number;
    name: string;
    avatar_key: string | null;
    created_at: string;
  }> = [];
  if (dateIds.length > 0) {
    // `created_at` bukan data pribadi — cuma stempel waktu slot dikunci; Lobby
    // memakainya untuk menaikkan tim yang baru saja terisi ke atas.
    const { data } = await admin
      .from('event_registrations')
      .select('session_date_id, team_number, player_number, name, avatar_key, created_at')
      .in('session_date_id', dateIds)
      .neq('status', 'cancelled');
    slotRows = (data ?? []) as typeof slotRows;
  }

  const slotsByDate = new Map<string, PublicEventSlot[]>();
  for (const row of slotRows) {
    const list = slotsByDate.get(row.session_date_id) ?? [];
    list.push({
      team_number: row.team_number,
      player_number: row.player_number,
      name: row.name,
      avatar_key: row.avatar_key,
      created_at: row.created_at,
    });
    slotsByDate.set(row.session_date_id, list);
  }

  const publicDates: PublicEventDate[] = dates.map((d) => ({
    id: d.id,
    event_date: d.event_date,
    status: d.status as PublicEventDate['status'],
    sort_order: d.sort_order,
    slots: slotsByDate.get(d.id) ?? [],
  }));

  return {
    businessId: s.business_id as string,
    session: {
      id: s.id as string,
      title: s.title as string,
      description: (s.description as string | null) ?? null,
      eyebrow_text: (s.eyebrow_text as string | null) ?? null,
      team_count: s.team_count as number,
      players_per_team: s.players_per_team as number,
      team_labels: (s.team_labels as Record<string, string>) ?? {},
      team_colors: (s.team_colors as Record<string, string>) ?? {},
      team_text_colors: (s.team_text_colors as Record<string, 'light' | 'dark'>) ?? {},
      start_time: (s.start_time as string | null) ?? null,
      end_time: (s.end_time as string | null) ?? null,
      location: (s.location as string | null) ?? null,
      contact_method: s.contact_method as PublicEventSession['contact_method'],
      status: s.status as PublicEventSession['status'],
      dates: publicDates,
    },
  };
});

/**
 * Sesi berstatus 'open' milik satu bisnis — untuk kartu "Book Your Spot" di
 * halaman `/[slug]`. Ringkas saja: judul, format, dan tanggal kandidat + jumlah
 * slot terisi, cukup untuk menampilkan sisa kuota tanpa membocorkan apa pun.
 */
export async function loadOpenSessions(businessId: string): Promise<PublicEventSummary[]> {
  const admin = createAdminClient();

  const { data: sessionRows } = await admin
    .from('event_sessions')
    .select('id, title, description, eyebrow_text, team_count, players_per_team, contact_method')
    .eq('business_id', businessId)
    .eq('status', 'open')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const sessions = (sessionRows ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    eyebrow_text: string | null;
    team_count: number;
    players_per_team: number;
    contact_method: 'whatsapp' | 'instagram';
  }>;
  if (sessions.length === 0) return [];

  const { data: dateRows } = await admin
    .from('event_session_dates')
    .select('id, session_id, event_date, sort_order')
    .in('session_id', sessions.map((s) => s.id))
    .eq('status', 'candidate')
    // Kronologis — sama seperti Lobby: tanggal terdekat lebih dulu.
    .order('event_date', { ascending: true })
    .order('sort_order', { ascending: true });

  const dates = (dateRows ?? []) as Array<{ id: string; session_id: string; event_date: string; sort_order: number }>;

  const takenByDate = new Map<string, number>();
  if (dates.length > 0) {
    const { data: regRows } = await admin
      .from('event_registrations')
      .select('session_date_id')
      .in('session_date_id', dates.map((d) => d.id))
      .neq('status', 'cancelled');
    for (const row of (regRows ?? []) as Array<{ session_date_id: string }>) {
      takenByDate.set(row.session_date_id, (takenByDate.get(row.session_date_id) ?? 0) + 1);
    }
  }

  return sessions
    .map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      eyebrow_text: s.eyebrow_text,
      contact_method: s.contact_method,
      capacity: s.team_count * s.players_per_team,
      dates: dates
        .filter((d) => d.session_id === s.id)
        .map((d) => ({ id: d.id, event_date: d.event_date, taken: takenByDate.get(d.id) ?? 0 })),
    }))
    // Sesi tanpa tanggal kandidat tidak punya apa pun untuk diklik — jangan tampilkan.
    .filter((s) => s.dates.length > 0);
}

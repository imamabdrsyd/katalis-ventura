/**
 * Pemuat sesi event versi PUBLIK — dipakai halaman Lobby (`/[slug]/events/[id]`)
 * dan route polling `/api/public/events/[sessionId]`.
 *
 * SERVER-ONLY. Ini satu-satunya tempat yang memutuskan kolom apa yang boleh
 * keluar ke browser publik: `contact_value` pendaftar SENGAJA tidak pernah
 * ikut diproyeksikan. Jangan menambah kolom ke bentuk balikan ini tanpa
 * memastikan kolomnya aman dilihat siapa pun yang punya link Lobby.
 */

import { createAdminClient } from '@/lib/supabase-server';
import type { PublicEventSummary } from '@/components/omnichannel/types';
import type { PublicEventDate, PublicEventSession, PublicEventSlot } from '@/types';

export interface PublicSessionResult {
  session: PublicEventSession;
  businessId: string;
}

/**
 * Sesi 'draft' & 'cancelled' → null (tidak pernah tampil publik).
 * Sesi 'closed' TETAP dilayani supaya link yang sudah tersebar tidak jadi 404
 * setelah manager memilih tanggal pemenang — pengunjung malah melihat
 * pengumuman tanggalnya. Pendaftaran baru tetap ditolak di sisi DB.
 */
export async function loadPublicSession(sessionId: string): Promise<PublicSessionResult | null> {
  // Guard: sessionId datang dari URL. Bukan UUID → jangan sentuh DB.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) return null;

  const admin = createAdminClient();

  const { data: sessionRow } = await admin
    .from('event_sessions')
    .select('id, business_id, title, description, team_count, players_per_team, team_labels, team_colors, contact_method, status')
    .eq('id', sessionId)
    .is('deleted_at', null)
    .in('status', ['open', 'closed'])
    .maybeSingle();

  if (!sessionRow) return null;
  const s = sessionRow as Record<string, unknown>;

  const { data: dateRows } = await admin
    .from('event_session_dates')
    .select('id, event_date, status, sort_order')
    .eq('session_id', sessionId)
    .order('sort_order', { ascending: true })
    .order('event_date', { ascending: true });

  const dates = (dateRows ?? []) as Array<{ id: string; event_date: string; status: string; sort_order: number }>;
  const dateIds = dates.map((d) => d.id);

  // Hanya kolom aman. Pendaftar 'cancelled' dibuang: slotnya sudah bebas lagi.
  let slotRows: Array<{ session_date_id: string; team_number: number; player_number: number; name: string }> = [];
  if (dateIds.length > 0) {
    const { data } = await admin
      .from('event_registrations')
      .select('session_date_id, team_number, player_number, name')
      .in('session_date_id', dateIds)
      .neq('status', 'cancelled');
    slotRows = (data ?? []) as typeof slotRows;
  }

  const slotsByDate = new Map<string, PublicEventSlot[]>();
  for (const row of slotRows) {
    const list = slotsByDate.get(row.session_date_id) ?? [];
    list.push({ team_number: row.team_number, player_number: row.player_number, name: row.name });
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
      team_count: s.team_count as number,
      players_per_team: s.players_per_team as number,
      team_labels: (s.team_labels as Record<string, string>) ?? {},
      team_colors: (s.team_colors as Record<string, string>) ?? {},
      contact_method: s.contact_method as PublicEventSession['contact_method'],
      status: s.status as PublicEventSession['status'],
      dates: publicDates,
    },
  };
}

/**
 * Sesi berstatus 'open' milik satu bisnis — untuk kartu "Book Your Spot" di
 * halaman `/[slug]`. Ringkas saja: judul, format, dan tanggal kandidat + jumlah
 * slot terisi, cukup untuk menampilkan sisa kuota tanpa membocorkan apa pun.
 */
export async function loadOpenSessions(businessId: string): Promise<PublicEventSummary[]> {
  const admin = createAdminClient();

  const { data: sessionRows } = await admin
    .from('event_sessions')
    .select('id, title, description, team_count, players_per_team, contact_method')
    .eq('business_id', businessId)
    .eq('status', 'open')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const sessions = (sessionRows ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
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
    .order('sort_order', { ascending: true })
    .order('event_date', { ascending: true });

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
      contact_method: s.contact_method,
      capacity: s.team_count * s.players_per_team,
      dates: dates
        .filter((d) => d.session_id === s.id)
        .map((d) => ({ id: d.id, event_date: d.event_date, taken: takenByDate.get(d.id) ?? 0 })),
    }))
    // Sesi tanpa tanggal kandidat tidak punya apa pun untuk diklik — jangan tampilkan.
    .filter((s) => s.dates.length > 0);
}

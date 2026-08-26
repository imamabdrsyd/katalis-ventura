/**
 * Data access layer modul Event Registration ("Book Your Spot", migr 136).
 *
 * SEMUA fungsi di sini adalah jalur ADMIN (manager login) — pakai client
 * anon-key biasa, RLS yang menegakkan haknya. Jalur publik (audience yang
 * mengunci slot) TIDAK lewat file ini melainkan lewat route
 * /api/public/events/* dengan service role, supaya `contact_value` tidak
 * pernah bisa terbaca dari browser.
 */

import { createClient } from '@/lib/supabase';
import type {
  EventRegistration,
  EventRegistrationStatus,
  EventSession,
  EventSessionDate,
  EventSessionInsert,
  EventSessionUpdate,
} from '@/types';

const SESSION_WITH_DATES = `
  *,
  dates:event_session_dates ( * )
`;

function sortDates(session: EventSession): EventSession {
  // Kronologis (terdekat dulu), sama seperti halaman publik. `sort_order` cuma
  // urutan penambahan — dipakai sekadar tie-break bila tanggalnya sama.
  const dates = [...(session.dates ?? [])].sort(
    (a, b) => a.event_date.localeCompare(b.event_date) || a.sort_order - b.sort_order
  );
  return { ...session, dates };
}

/** Semua sesi event bisnis (terbaru dulu), lengkap dengan tanggal kandidatnya. */
export async function getEventSessions(businessId: string): Promise<EventSession[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('event_sessions')
    .select(SESSION_WITH_DATES)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as EventSession[]).map(sortDates);
}

export async function createEventSession(input: EventSessionInsert): Promise<EventSession> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('event_sessions')
    .insert(input)
    .select(SESSION_WITH_DATES)
    .single();

  if (error) throw new Error(error.message);
  return sortDates(data as unknown as EventSession);
}

export async function updateEventSession(id: string, patch: EventSessionUpdate): Promise<EventSession> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('event_sessions')
    .update(patch)
    .eq('id', id)
    .select(SESSION_WITH_DATES)
    .single();

  if (error) throw new Error(error.message);
  return sortDates(data as unknown as EventSession);
}

/**
 * Soft delete — sesi hilang dari daftar manager DAN dari halaman publik
 * (route publik memfilter `deleted_at IS NULL`), tapi pendaftar & lead-nya
 * tetap utuh untuk follow-up.
 */
export async function deleteEventSession(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('event_sessions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function addEventDate(
  sessionId: string,
  businessId: string,
  eventDate: string,
  sortOrder: number
): Promise<EventSessionDate> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('event_session_dates')
    .insert({ session_id: sessionId, business_id: businessId, event_date: eventDate, sort_order: sortOrder })
    .select('*')
    .single();

  // 23505 = UNIQUE (session_id, event_date) — tanggal yang sama ditambah dua kali.
  if (error) {
    if (error.code === '23505') throw new Error('Tanggal itu sudah ada di event ini.');
    throw new Error(error.message);
  }
  return data as unknown as EventSessionDate;
}

/** Hapus tanggal kandidat. Pendaftar di tanggal itu ikut terhapus (ON DELETE CASCADE). */
export async function deleteEventDate(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('event_session_dates').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Semua pendaftar (termasuk yang dibatalkan) untuk sekumpulan tanggal. */
export async function getEventRegistrations(dateIds: string[]): Promise<EventRegistration[]> {
  if (dateIds.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from('event_registrations')
    .select('*')
    .in('session_date_id', dateIds)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EventRegistration[];
}

/**
 * Tetapkan tanggal pemenang: tanggal ini jadi 'won', kandidat lain 'discarded',
 * sesi jadi 'closed' — satu transaksi di DB (migr 136).
 */
export async function markEventDateWinner(sessionDateId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('mark_event_date_winner', { p_session_date_id: sessionDateId });
  if (error) throw new Error(error.message);
}

/**
 * Ubah status pendaftar. Set 'cancelled' MEMBEBASKAN slotnya (index unik parsial
 * hanya mencakup status <> 'cancelled'), jadi orang lain bisa mengisi lagi.
 */
export async function updateRegistrationStatus(
  id: string,
  status: EventRegistrationStatus
): Promise<EventRegistration> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('event_registrations')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as EventRegistration;
}

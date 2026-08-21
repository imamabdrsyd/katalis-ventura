/**
 * POST /api/public/events/register
 * { sessionDateId, teamNumber, playerNumber, name, contact, avatarKey?, website? }
 *
 * PUBLIK (tanpa auth) — dipanggil Lobby saat audience mengunci satu slot.
 * Menulis lewat `register_event_slot` (migr 136) dengan service role, jadi
 * seluruh rangkaian (upsert lead → klaim slot → catat pesan ke inbox) terjadi
 * dalam SATU transaksi: kalau slotnya keburu diambil orang lain, tidak ada
 * lead setengah jadi yang tertinggal.
 *
 * Balasannya sengaja TIDAK menyertakan kontak pendaftar — cuma konfirmasi slot.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { normalizeEventContact } from '@/lib/events/contact';
import { isValidEventAvatarKey } from '@/lib/events/avatars';
import type { EventContactMethod } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * Batas slot per kontak per tanggal. Kapten tim yang mendaftarkan seluruh
 * timnya sekaligus itu wajar, memborong dua tim penuh tidak — angka ini
 * memberi ruang untuk yang pertama tanpa membiarkan satu orang mengunci Lobby.
 */
const MAX_SLOTS_PER_CONTACT = 6;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    sessionDateId?: string;
    teamNumber?: number;
    playerNumber?: number;
    name?: string;
    contact?: string;
    /** Opsional — key dari galeri avatar tetap (migr 140), lihat src/lib/events/avatars.ts. */
    avatarKey?: string;
    /** Honeypot: field tersembunyi yang cuma diisi bot. */
    website?: string;
  } | null;

  // Bot mengisi semua field termasuk yang tersembunyi. Jawab "sukses" palsu
  // supaya tidak memberi sinyal balik, tapi jangan tulis apa pun.
  if (body?.website) return NextResponse.json({ ok: true });

  const sessionDateId = body?.sessionDateId?.trim();
  const teamNumber = Number(body?.teamNumber);
  const playerNumber = Number(body?.playerNumber);
  const name = body?.name?.trim() ?? '';
  const contactRaw = body?.contact ?? '';

  if (!sessionDateId || !Number.isInteger(teamNumber) || !Number.isInteger(playerNumber)) {
    return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
  }
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: 'Nama harus 2–80 karakter' }, { status: 400 });
  }
  // Dobel validasi dgn CHECK constraint di DB (migr 140) — bukan cuma jaring
  // pengaman terakhir, tapi juga pesan error yang jelas sebelum sempat ke RPC.
  const avatarKeyRaw = body?.avatarKey?.trim();
  if (avatarKeyRaw && !isValidEventAvatarKey(avatarKeyRaw)) {
    return NextResponse.json({ error: 'Avatar tidak valid' }, { status: 400 });
  }
  const avatarKey = avatarKeyRaw || null;

  const admin = createAdminClient();

  // contact_method sesi induk menentukan cara normalisasi kontak.
  const { data: dateRow } = await admin
    .from('event_session_dates')
    .select('id, session:event_sessions!event_session_dates_session_id_fkey ( contact_method, status )')
    .eq('id', sessionDateId)
    .maybeSingle();

  const session = (dateRow as { session?: { contact_method: string; status: string } } | null)?.session;
  if (!dateRow || !session) {
    return NextResponse.json({ error: 'Event tidak ditemukan' }, { status: 404 });
  }
  if (session.status !== 'open') {
    return NextResponse.json({ error: 'Pendaftaran untuk event ini sudah ditutup' }, { status: 409 });
  }

  const { value: contact, error: contactError } = normalizeEventContact(
    session.contact_method as EventContactMethod,
    contactRaw
  );
  if (!contact) {
    return NextResponse.json({ error: contactError ?? 'Kontak tidak valid' }, { status: 400 });
  }

  const { count } = await admin
    .from('event_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('session_date_id', sessionDateId)
    .eq('contact_value', contact)
    .neq('status', 'cancelled');

  if ((count ?? 0) >= MAX_SLOTS_PER_CONTACT) {
    return NextResponse.json(
      { error: 'Kontak ini sudah mengambil banyak slot di tanggal tersebut.' },
      { status: 429 }
    );
  }

  const { data, error } = await admin.rpc('register_event_slot', {
    p_session_date_id: sessionDateId,
    p_team_number: teamNumber,
    p_player_number: playerNumber,
    p_name: name,
    p_contact_value: contact,
    p_avatar_key: avatarKey,
  });

  if (error) {
    // 23505 = index unik parsial event_registrations_slot_unique — dua orang
    // menekan slot yang sama nyaris bersamaan. DB-lah wasit akhirnya.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Slot ini baru saja diambil orang lain. Pilih slot lain ya.', code: 'slot_taken' },
        { status: 409 }
      );
    }
    // P0001 = RAISE EXCEPTION dari dalam function; pesannya sudah ramah & ID.
    if (error.code === 'P0001') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('register_event_slot failed:', error);
    return NextResponse.json({ error: 'Gagal menyimpan pendaftaran' }, { status: 500 });
  }

  const registration = data as
    | { team_number: number; player_number: number; name: string; avatar_key: string | null }
    | null;

  return NextResponse.json({
    ok: true,
    slot: registration
      ? {
          team_number: registration.team_number,
          player_number: registration.player_number,
          name: registration.name,
          avatar_key: registration.avatar_key,
        }
      : null,
  });
}

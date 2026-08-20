-- Migration 136: Event Registration ("Book Your Spot")
--
-- Pendaftaran event komunitas untuk bisnis jasa sektor creative_agency
-- (Telcantik, TELYUFOLK). Mekanismenya BUKAN form minat biasa melainkan
-- crowdtesting tanggal: manager membuka beberapa tanggal kandidat sekaligus,
-- audience mengunci slot (tim × player) di tanggal pilihan mereka, dan tanggal
-- yang duluan penuh jadi sinyal — manager yang MEMUTUSKAN pemenangnya manual.
--
-- 3 tabel:
--   1. event_sessions       — 1 "event" (format tim + status publish)
--   2. event_session_dates  — tanggal kandidat di dalam sesi = 1 "Lobby"
--   3. event_registrations  — klaim slot per (tanggal, tim, player)
--
-- Konvensi mengikuti migrasi 101 (leads hub) & 113 (bookings): UUID PK,
-- TIMESTAMPTZ, business_id didenormalisasi ke tabel anak untuk RLS, trigger
-- updated_at/updated_by/audit, RLS pakai get_my_business_ids() + is_business_manager().
--
-- KEAMANAN — kenapa TIDAK ada policy/grant anon di sini:
-- Halaman publik AXION tidak pernah bicara langsung ke Postgres; /[slug]
-- dirender server dengan createAdminClient dan widget menulis lewat
-- /api/public/booking-inquiry. Modul ini ikut pola yang sama:
--   baca  → GET  /api/public/events/[sessionId]  (proyeksi kolom aman saja)
--   tulis → POST /api/public/events/register     → register_event_slot()
-- Konsekuensinya `contact_value` (nomor WA / username IG) tidak pernah bisa
-- terbaca browser lewat jalur mana pun, dan tidak perlu view publik terpisah.
-- Jangan menambah policy untuk anon tanpa memindahkan kolom kontak keluar tabel ini.
--
-- Catatan soal GRANT: Supabase memasang default privileges yang memberi anon &
-- authenticated hak tabel penuh untuk SETIAP objek baru di schema public (sama
-- seperti `leads`, `transactions`, `bookings`) — RLS-lah lapisan penegaknya,
-- dan tabel ini tidak punya policy anon sama sekali. Untuk FUNCTION, default
-- itu juga memberi EXECUTE ke anon/authenticated, jadi `REVOKE ... FROM PUBLIC`
-- saja TIDAK cukup: role-nya di-revoke eksplisit di bawah.

-- ============================================================================
-- 1. event_sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  -- Format tim: team_count × players_per_team = kapasitas slot per tanggal.
  team_count INTEGER NOT NULL DEFAULT 2 CHECK (team_count > 0 AND team_count <= 20),
  players_per_team INTEGER NOT NULL DEFAULT 2 CHECK (players_per_team > 0 AND players_per_team <= 20),
  -- Nama tim opsional: {"1": "Tim Elang", "2": "Tim Garuda"} — key = nomor tim.
  team_labels JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- Cara follow-up manual oleh manager. BUKAN integrasi API luar — nilainya
  -- cuma menentukan label field kontak di form publik & channel lead-nya.
  contact_method TEXT NOT NULL DEFAULT 'whatsapp' CHECK (contact_method IN ('whatsapp', 'instagram')),
  -- draft = belum tampil di halaman publik; open = pendaftaran dibuka;
  -- closed = pemenang sudah dipilih / ditutup manual; cancelled = dibatalkan.
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_event_sessions_business
  ON event_sessions(business_id) WHERE deleted_at IS NULL;

-- Lookup halaman publik: sesi yang sedang dibuka untuk satu bisnis.
CREATE INDEX IF NOT EXISTS idx_event_sessions_open
  ON event_sessions(business_id, status) WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. event_session_dates
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_session_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES event_sessions(id) ON DELETE CASCADE,
  -- Didenormalisasi (pola sama dgn lead_messages) supaya policy RLS tidak perlu
  -- join ke induk tiap baris.
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  -- candidate = masih diperebutkan; won = dipilih manager; discarded = kalah.
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'won', 'discarded')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, event_date)
);

CREATE INDEX IF NOT EXISTS idx_event_session_dates_session
  ON event_session_dates(session_id);

-- ============================================================================
-- 3. event_registrations
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date_id UUID NOT NULL REFERENCES event_session_dates(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  team_number INTEGER NOT NULL CHECK (team_number > 0),
  player_number INTEGER NOT NULL CHECK (player_number > 0),
  name TEXT NOT NULL,
  -- Nomor WA (format internasional tanpa +) atau username IG (tanpa @), sesuai
  -- contact_method sesi induk. Sudah dinormalisasi oleh register_event_slot.
  contact_value TEXT NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wasit anti-rebutan slot: 1 slot cuma boleh punya 1 pendaftar aktif. Partial
-- (status <> 'cancelled') supaya slot yang dibatalkan manager bisa diisi lagi.
-- Ini backstop terakhir untuk race 2 submit bersamaan — client TIDAK boleh
-- diandalkan; pelanggaran muncul sebagai SQLSTATE 23505 ke API route.
CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_slot_unique
  ON event_registrations(session_date_id, team_number, player_number)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_event_registrations_date
  ON event_registrations(session_date_id);

CREATE INDEX IF NOT EXISTS idx_event_registrations_lead
  ON event_registrations(lead_id) WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_registrations_business
  ON event_registrations(business_id);

-- ============================================================================
-- Trigger (konvensi repo)
-- ============================================================================

DROP TRIGGER IF EXISTS update_event_sessions_updated_at ON event_sessions;
CREATE TRIGGER update_event_sessions_updated_at
  BEFORE UPDATE ON event_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_event_sessions_updated_by ON event_sessions;
CREATE TRIGGER set_event_sessions_updated_by
  BEFORE UPDATE ON event_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_by();

DROP TRIGGER IF EXISTS log_event_sessions_audit ON event_sessions;
CREATE TRIGGER log_event_sessions_audit
  AFTER INSERT OR UPDATE OR DELETE ON event_sessions
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

DROP TRIGGER IF EXISTS update_event_session_dates_updated_at ON event_session_dates;
CREATE TRIGGER update_event_session_dates_updated_at
  BEFORE UPDATE ON event_session_dates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_event_registrations_updated_at ON event_registrations;
CREATE TRIGGER update_event_registrations_updated_at
  BEFORE UPDATE ON event_registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Jejak siapa yang membatalkan/mengubah status pendaftar (changed_by NULL utk
-- pendaftaran publik — memang tidak ada user login di sana).
DROP TRIGGER IF EXISTS log_event_registrations_audit ON event_registrations;
CREATE TRIGGER log_event_registrations_audit
  AFTER INSERT OR UPDATE OR DELETE ON event_registrations
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- ============================================================================
-- RLS — manager-gated, tanpa jalur anon (lihat catatan keamanan di header)
-- ============================================================================

ALTER TABLE event_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_session_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

-- ── event_sessions ──
DROP POLICY IF EXISTS "Members can view event sessions" ON event_sessions;
CREATE POLICY "Members can view event sessions" ON event_sessions
  FOR SELECT USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Managers can insert event sessions" ON event_sessions;
CREATE POLICY "Managers can insert event sessions" ON event_sessions
  FOR INSERT WITH CHECK (is_business_manager(business_id));

DROP POLICY IF EXISTS "Managers can update event sessions" ON event_sessions;
CREATE POLICY "Managers can update event sessions" ON event_sessions
  FOR UPDATE USING (is_business_manager(business_id))
  WITH CHECK (is_business_manager(business_id));

DROP POLICY IF EXISTS "Managers can delete event sessions" ON event_sessions;
CREATE POLICY "Managers can delete event sessions" ON event_sessions
  FOR DELETE USING (is_business_manager(business_id));

-- ── event_session_dates ──
DROP POLICY IF EXISTS "Members can view event session dates" ON event_session_dates;
CREATE POLICY "Members can view event session dates" ON event_session_dates
  FOR SELECT USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Managers can insert event session dates" ON event_session_dates;
CREATE POLICY "Managers can insert event session dates" ON event_session_dates
  FOR INSERT WITH CHECK (is_business_manager(business_id));

DROP POLICY IF EXISTS "Managers can update event session dates" ON event_session_dates;
CREATE POLICY "Managers can update event session dates" ON event_session_dates
  FOR UPDATE USING (is_business_manager(business_id))
  WITH CHECK (is_business_manager(business_id));

DROP POLICY IF EXISTS "Managers can delete event session dates" ON event_session_dates;
CREATE POLICY "Managers can delete event session dates" ON event_session_dates
  FOR DELETE USING (is_business_manager(business_id));

-- ── event_registrations ──
DROP POLICY IF EXISTS "Members can view event registrations" ON event_registrations;
CREATE POLICY "Members can view event registrations" ON event_registrations
  FOR SELECT USING (business_id IN (SELECT get_my_business_ids()));

DROP POLICY IF EXISTS "Managers can insert event registrations" ON event_registrations;
CREATE POLICY "Managers can insert event registrations" ON event_registrations
  FOR INSERT WITH CHECK (is_business_manager(business_id));

DROP POLICY IF EXISTS "Managers can update event registrations" ON event_registrations;
CREATE POLICY "Managers can update event registrations" ON event_registrations
  FOR UPDATE USING (is_business_manager(business_id))
  WITH CHECK (is_business_manager(business_id));

DROP POLICY IF EXISTS "Managers can delete event registrations" ON event_registrations;
CREATE POLICY "Managers can delete event registrations" ON event_registrations
  FOR DELETE USING (is_business_manager(business_id));

-- ============================================================================
-- RPC 1: register_event_slot — klaim slot publik (1 transaksi atomik)
-- ============================================================================
--
-- Dipanggil HANYA dari /api/public/events/register lewat service_role
-- (createAdminClient). SECURITY INVOKER: service_role sudah BYPASSRLS, jadi
-- tidak perlu privilege escalation lewat SECURITY DEFINER — sejalan dgn
-- hardening migrasi 102. search_path di-pin untuk menutup celah shadowing.
--
-- Satu panggilan = 3 tulisan yang harus sukses bareng:
--   1. upsert leads       → pendaftar masuk pipeline inbox AXION
--   2. insert registration → slot terkunci (unique index = wasit race)
--   3. insert lead_message → thread lead punya jejak "Daftar <event>"
CREATE OR REPLACE FUNCTION register_event_slot(
  p_session_date_id UUID,
  p_team_number INTEGER,
  p_player_number INTEGER,
  p_name TEXT,
  p_contact_value TEXT
) RETURNS event_registrations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_business_id UUID;
  v_team_count INTEGER;
  v_players_per_team INTEGER;
  v_team_labels JSONB;
  v_contact_method TEXT;
  v_session_status TEXT;
  v_date_status TEXT;
  v_title TEXT;
  v_event_date DATE;
  v_name TEXT;
  v_contact TEXT;
  v_external_id TEXT;
  v_team_label TEXT;
  v_lead_id UUID;
  v_registration event_registrations;
BEGIN
  SELECT s.id, s.business_id, s.team_count, s.players_per_team, s.team_labels,
         s.contact_method, s.status, s.title, d.status, d.event_date
  INTO v_session_id, v_business_id, v_team_count, v_players_per_team, v_team_labels,
       v_contact_method, v_session_status, v_title, v_date_status, v_event_date
  FROM event_session_dates d
  JOIN event_sessions s ON s.id = d.session_id
  WHERE d.id = p_session_date_id
    AND s.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tanggal event tidak ditemukan';
  END IF;

  IF v_session_status <> 'open' OR v_date_status <> 'candidate' THEN
    RAISE EXCEPTION 'Pendaftaran untuk tanggal ini sudah ditutup';
  END IF;

  -- Batas tim/player TIDAK bisa dijaga CHECK constraint (butuh baca tabel induk),
  -- jadi wajib divalidasi di sini — bukan diasumsikan aman dari sisi client.
  IF p_team_number < 1 OR p_team_number > v_team_count THEN
    RAISE EXCEPTION 'Nomor tim tidak valid';
  END IF;

  IF p_player_number < 1 OR p_player_number > v_players_per_team THEN
    RAISE EXCEPTION 'Nomor player tidak valid';
  END IF;

  v_name := NULLIF(btrim(p_name), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Nama wajib diisi';
  END IF;
  v_name := left(v_name, 80);

  v_contact := NULLIF(btrim(COALESCE(p_contact_value, '')), '');
  IF v_contact IS NULL THEN
    RAISE EXCEPTION 'Kontak wajib diisi';
  END IF;

  -- Normalisasi kontak → external_id lead. Penting: samakan bentuknya dengan
  -- wa_id yang dipakai webhook WhatsApp (digit saja, prefix 62) supaya pendaftar
  -- event nyambung ke thread lead yang sudah ada, bukan bikin lead kembar.
  IF v_contact_method = 'whatsapp' THEN
    v_contact := regexp_replace(v_contact, '\D', '', 'g');
    IF left(v_contact, 1) = '0' THEN
      v_contact := '62' || substring(v_contact FROM 2);
    ELSIF left(v_contact, 2) = '00' THEN
      v_contact := substring(v_contact FROM 3);
    END IF;
    IF length(v_contact) < 8 OR length(v_contact) > 20 THEN
      RAISE EXCEPTION 'Nomor WhatsApp tidak valid';
    END IF;
  ELSE
    v_contact := lower(btrim(v_contact, '@ '));
    IF length(v_contact) < 2 OR length(v_contact) > 40 THEN
      RAISE EXCEPTION 'Username Instagram tidak valid';
    END IF;
  END IF;
  v_external_id := v_contact;

  -- Upsert lead native AXION. `name` yang sudah ada TIDAK ditimpa: kontak lama
  -- bisa jadi sudah dirapikan manager, sementara isian form event bebas.
  -- last_message_at → urutan inbox; last_inbound_at → hitungan unread di bell
  -- (useLeadCounts membandingkan last_read_at vs last_inbound_at). Keduanya
  -- harus di-set, kalau salah satu ketinggalan lead-nya "hilang" dari salah satu
  -- permukaan itu.
  INSERT INTO leads (business_id, channel, external_id, name, phone, status, last_message_at, last_inbound_at, meta)
  VALUES (
    v_business_id, v_contact_method, v_external_id, v_name,
    CASE WHEN v_contact_method = 'whatsapp' THEN v_contact ELSE NULL END,
    'new', now(), now(), jsonb_build_object('source', 'event_registration')
  )
  ON CONFLICT (business_id, channel, external_id) WHERE deleted_at IS NULL
  DO UPDATE SET
    name = COALESCE(NULLIF(btrim(leads.name), ''), excluded.name),
    phone = COALESCE(leads.phone, excluded.phone),
    last_message_at = now(),
    last_inbound_at = now()
  RETURNING id INTO v_lead_id;

  -- Klaim slot. Kalau slot sudah keburu diambil submit lain, index unik parsial
  -- melempar 23505 dan SELURUH transaksi ini batal (lead tetap konsisten).
  INSERT INTO event_registrations (
    session_date_id, business_id, team_number, player_number, name, contact_value, lead_id, status
  )
  VALUES (
    p_session_date_id, v_business_id, p_team_number, p_player_number, v_name, v_contact, v_lead_id, 'new'
  )
  RETURNING * INTO v_registration;

  v_team_label := COALESCE(
    NULLIF(btrim(v_team_labels ->> p_team_number::TEXT), ''),
    'Tim ' || p_team_number
  );

  -- Jejak di thread lead → manager langsung lihat konteksnya di inbox /leads.
  INSERT INTO lead_messages (lead_id, business_id, direction, sender, content, meta)
  VALUES (
    v_lead_id, v_business_id, 'inbound', 'customer',
    format('Daftar "%s" — %s · %s #%s', v_title, to_char(v_event_date, 'DD Mon YYYY'), v_team_label, p_player_number),
    jsonb_build_object('source', 'event_registration', 'registration_id', v_registration.id)
  );

  RETURN v_registration;
END;
$$;

-- Hanya server (service_role) yang boleh memanggil klaim slot. Tanpa REVOKE
-- eksplisit ke anon/authenticated, default privileges Supabase membiarkannya
-- bisa dipanggil langsung dari browser — melewati honeypot & batas per-kontak
-- di route, meski RLS tetap menahan tulisannya karena function ini INVOKER.
REVOKE ALL ON FUNCTION register_event_slot(UUID, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION register_event_slot(UUID, INTEGER, INTEGER, TEXT, TEXT) TO service_role;

-- ============================================================================
-- RPC 2: mark_event_date_winner — manager memutuskan tanggal pemenang
-- ============================================================================
--
-- "Penuh" cuma SINYAL, bukan trigger otomatis: tanggal lain baru ditutup saat
-- manager eksplisit memilih pemenang. Pendaftar di tanggal yang di-discard tetap
-- punya lead_id valid → tetap bisa di-follow-up dari inbox yang sama.
--
-- SECURITY INVOKER: policy RLS di atas yang menegakkan hak tulis. Cek eksplisit
-- di bawah cuma untuk pesan error yang jelas (tanpa itu, UPDATE yang tertolak
-- RLS diam-diam mengenai 0 baris dan UI terlihat "tidak bereaksi").
CREATE OR REPLACE FUNCTION mark_event_date_winner(p_session_date_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_business_id UUID;
BEGIN
  SELECT session_id, business_id INTO v_session_id, v_business_id
  FROM event_session_dates WHERE id = p_session_date_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tanggal tidak ditemukan';
  END IF;

  IF NOT is_business_manager(v_business_id) THEN
    RAISE EXCEPTION 'Tidak punya akses';
  END IF;

  UPDATE event_session_dates SET status = 'won'
    WHERE id = p_session_date_id;

  UPDATE event_session_dates SET status = 'discarded'
    WHERE session_id = v_session_id AND id <> p_session_date_id AND status = 'candidate';

  UPDATE event_sessions SET status = 'closed'
    WHERE id = v_session_id;
END;
$$;

REVOKE ALL ON FUNCTION mark_event_date_winner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mark_event_date_winner(UUID) TO authenticated, service_role;

SELECT 'Migration 136 complete - Event Registration (event_sessions, event_session_dates, event_registrations)' AS status;

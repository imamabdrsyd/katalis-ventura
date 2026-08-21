-- Migration 140: Avatar opsional pendaftar (lanjutan migr 136)
--
-- Audience yang mengunci slot bisa (opsional) memilih avatar dari galeri
-- tetap `public/persona/*.png` — bukan upload bebas. Dua alasan galeri
-- tertutup, bukan URL bebas:
--   1. Halaman publik ini SUDAH nol-grant-anon (§29.4 docs) — jalur upload
--      butuh storage bucket + validasi file yang jadi permukaan baru sama
--      sekali, di luar cakupan fitur "pilih avatar simpel".
--   2. CHECK constraint di kolom ini adalah pengaman terakhir: bahkan kalau
--      validasi di route publik terlewat, DB tetap menolak nilai di luar set
--      tetap — tak pernah bisa jadi jalur nyuntik URL/HTML sembarang.
--
-- Set tetapnya SAMA PERSIS dengan katalog `src/lib/events/avatars.ts` — kalau
-- menambah/mengurangi file di sana, CHECK constraint ini WAJIB ikut diupdate
-- (migrasi baru), dua-duanya harus selalu sinkron.

ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS avatar_key TEXT;

ALTER TABLE event_registrations
  ADD CONSTRAINT event_registrations_avatar_key_valid
  CHECK (avatar_key IS NULL OR avatar_key IN (
    'agent', 'bianca', 'concierge', 'persona-1', 'persona-2', 'sri-mulyani', 'stanley'
  ));

COMMENT ON COLUMN event_registrations.avatar_key IS
  'Avatar opsional yang dipilih pendaftar dari galeri tetap public/persona/*.png. NULL = tampil sbg inisial nama (fallback lama). Dibatasi CHECK ke set tetap — bukan URL bebas, supaya tidak jadi jalur unggah gambar sembarang.';

-- ============================================================================
-- register_event_slot: tambah parameter p_avatar_key (opsional, default NULL)
-- ============================================================================
-- PostgreSQL mencocokkan overload dari TIPE parameter, bukan sekadar nama
-- function — menambah 1 parameter membuat signature (uuid,integer,integer,
-- text,text,text) berbeda dari signature lama (…,text,text), jadi
-- CREATE OR REPLACE TIDAK mengganti versi lama, malah menambah overload baru
-- yang menggantung di sebelahnya. DROP eksplisit dulu supaya hanya ada SATU
-- versi function ini, konsisten dengan seluruh function lain di modul ini.
DROP FUNCTION IF EXISTS register_event_slot(UUID, INTEGER, INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION register_event_slot(
  p_session_date_id UUID,
  p_team_number INTEGER,
  p_player_number INTEGER,
  p_name TEXT,
  p_contact_value TEXT,
  p_avatar_key TEXT DEFAULT NULL
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

  -- Kalau slot sudah keburu diambil submit lain, index unik parsial melempar
  -- 23505 dan SELURUH transaksi ini batal (lead tetap konsisten).
  INSERT INTO event_registrations (
    session_date_id, business_id, team_number, player_number, name, contact_value, avatar_key, lead_id, status
  )
  VALUES (
    p_session_date_id, v_business_id, p_team_number, p_player_number, v_name, v_contact, p_avatar_key, v_lead_id, 'new'
  )
  RETURNING * INTO v_registration;

  v_team_label := COALESCE(
    NULLIF(btrim(v_team_labels ->> p_team_number::TEXT), ''),
    'Tim ' || p_team_number
  );

  INSERT INTO lead_messages (lead_id, business_id, direction, sender, content, meta)
  VALUES (
    v_lead_id, v_business_id, 'inbound', 'customer',
    format('Daftar "%s" — %s · %s #%s', v_title, to_char(v_event_date, 'DD Mon YYYY'), v_team_label, p_player_number),
    jsonb_build_object('source', 'event_registration', 'registration_id', v_registration.id)
  );

  RETURN v_registration;
END;
$$;

-- CREATE OR REPLACE tidak mengubah grant yang sudah ada, tapi ditulis eksplisit
-- lagi di sini supaya migrasi ini tetap benar berdiri sendiri kalau function-nya
-- suatu saat di-drop & dibuat ulang dari file ini.
REVOKE ALL ON FUNCTION register_event_slot(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION register_event_slot(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT) TO service_role;

SELECT 'Migration 140 complete - event_registrations.avatar_key + register_event_slot(p_avatar_key)' AS status;

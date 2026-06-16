# Integrasi Leads Hub — Instagram, WhatsApp & Webhook Inbound

> Terakhir diupdate: 16 Juni 2026

Leads Hub menerima pesan masuk dari berbagai channel dan menyimpannya sebagai
`leads` + `lead_messages`. Jalur masuk:

| Jalur | Channel | Model token | AI default |
|-------|---------|-------------|------------|
| `/api/integrations/instagram/webhook` | Instagram DM | **Per-bisnis** (OAuth, terenkripsi di `config`) | `draft` — manager approve |
| `/api/whatsapp/webhook` | WhatsApp (Meta Cloud API) | **Per-bisnis** (form kredensial, terenkripsi di `config`) — env global = fallback | `auto` — kirim langsung |
| `/api/webhooks/inbound` | Airbnb, Booking.com, dll (Zapier/Make) | — (lookup via business_id) | `draft` — manager approve |

Semua webhook menulis ke database via service role (bypass RLS) dan
di-exclude dari middleware auth (lihat `middleware.ts`).

---

## 1. Baris `channel_integrations`

Setiap bisnis yang mau menerima pesan butuh baris di `channel_integrations`.

- **Instagram**: baris dibuat **otomatis** lewat tombol "Hubungkan Instagram"
  di `Bisnis → Integrasi` (OAuth) — tidak perlu SQL manual.
- **WhatsApp**: baris dibuat **otomatis** lewat form "Hubungkan" di tab
  Integrasi (Phone Number ID + Access Token) — tidak perlu SQL manual.
- **OTA (Airbnb/Booking.com)**: baris dibuat **otomatis** lewat tombol
  "Aktifkan" di kartu Airbnb/Booking.com pada tab Integrasi — tidak ada
  token/OAuth untuk channel ini (pesan masuk lewat webhook generic Zapier/Make,
  lihat §4), jadi tombol cuma memanggil `POST /api/integrations` dengan
  `{ business_id, channel }`. `ai_mode` dipaksa `'draft'` di UI (tidak ada
  API kirim resmi dari Airbnb/Booking.com untuk auto-reply). Disconnect via
  tombol power → `DELETE /api/integrations/[id]` (soft-disable, `is_active=false`).

- `ai_enabled=false` → pesan tetap tersimpan, tapi tanpa balasan/draft AI.
- `ai_persona` → instruksi tone tambahan yang masuk ke system prompt AI.
- AI memakai chain provider existing (Gemini → Groq) — lihat `src/lib/ai/provider.ts`.

---

## 2. Instagram DM (multi-tenant via OAuth)

Tiap bisnis login akun Instagram profesionalnya sendiri lewat satu Meta App
("AXION"). Token long-lived disimpan **terenkripsi** (AES-256-GCM) di
`channel_integrations.config.access_token`, di-decrypt server-side saat kirim DM.

### Environment variables (Vercel → Settings → Environment Variables)

| Nama | Sumber |
|------|--------|
| `INSTAGRAM_APP_ID` | Meta App → produk Instagram → **API setup with Instagram login** → Instagram app ID |
| `INSTAGRAM_APP_SECRET` | Lokasi sama → Instagram app secret |
| `INSTAGRAM_VERIFY_TOKEN` | Bebas — string acak yang sama dengan yang diisi di webhook Meta |
| `TOKEN_ENCRYPTION_KEY` | 64 hex char (`openssl rand -hex 32`). Opsional kalau `SHOPEE_TOKEN_ENCRYPTION_KEY` sudah di-set (dipakai sebagai fallback) |
| `NEXT_PUBLIC_APP_URL` | URL publik aplikasi (sudah ada) |

### Setup di Meta App Dashboard

1. **Create app** → use case **"Manage messaging & content on Instagram"**.
   (Jangan "Engage with customers on Messenger from Meta" — itu Messenger FB Page.)
2. Connect **business portfolio** yang akan diverifikasi (wajib untuk go-live).
3. Produk **Instagram** → **API setup with Instagram login**:
   - **OAuth redirect URI**: `https://<domain>/api/integrations/instagram/callback`
   - Ambil **Instagram app ID** + **secret** → env di atas.
4. **Webhooks** (objek Instagram):
   - **Callback URL**: `https://<domain>/api/integrations/instagram/webhook`
   - **Verify token**: nilai `INSTAGRAM_VERIFY_TOKEN`
   - Subscribe field **`messages`**.
5. Scopes: `instagram_business_basic`, `instagram_business_manage_messages`.

> **App Review**: untuk akun di luar tester, `instagram_business_manage_messages`
> butuh Advanced Access (App Review + business verification). Mode Development
> jalan untuk akun yang punya role di app. Webhook hanya hidup di URL publik
> (localhost tidak menerima webhook).

### Alur connect (OAuth)

```
Manager klik "Hubungkan Instagram" → /api/integrations/instagram/auth
  → redirect ke Instagram OAuth (state = businessId)
  → /api/integrations/instagram/callback
     → tukar code → short-lived → long-lived token (~60 hari)
     → ambil user_id (IGSID) + username
     → simpan terenkripsi ke channel_integrations (external_account_id = IGSID)
  → redirect balik ke tab Integrasi (?instagram_connected=1)
```

### Alur DM masuk

```
Customer kirim DM → Meta POST /api/integrations/instagram/webhook
  → verifikasi X-Hub-Signature-256 (HMAC INSTAGRAM_APP_SECRET)
  → skip echo (pesan kita sendiri) → lookup bisnis via recipient.id (IGSID)
  → upsert leads + simpan lead_messages (dedup by mid)
  → ai_enabled:
       ai_mode='auto'  → decrypt token bisnis → kirim DM → simpan outbound (ai)
       ai_mode='draft' → simpan draft (meta.is_draft=true), manager approve di inbox
```

Kirim DM hanya bisa dalam **24-jam window** sejak pesan customer terakhir.
Di luar window Graph API menolak — error di-log, inbound tetap tersimpan.

> **Token expiry**: long-lived token ~60 hari (`token_expires_at` disimpan di
> config). Job refresh otomatis = pekerjaan lanjutan; sementara reconnect manual
> via tombol Hubungkan.

---

## 3. WhatsApp (Meta Cloud API, per-bisnis)

Tiap bisnis menghubungkan **nomornya sendiri** lewat form di `Bisnis →
Integrasi → WhatsApp → Hubungkan`: isi **Phone Number ID** + **Access Token**
dari Meta dashboard bisnis masing-masing. Kredensial diverifikasi live ke
Graph API sebelum disimpan; token disimpan **terenkripsi** di
`channel_integrations.config.access_token` (`external_account_id` =
phone_number_id). Token expired → tombol **Perbarui token**.

> Upgrade ke **Embedded Signup** (tombol connect ala Instagram, tanpa
> copy-paste token) = pekerjaan lanjutan; butuh business verification +
> Advanced Access `whatsapp_business_management`/`messaging`. Storage shape
> tidak berubah.

### Environment variables

| Nama | Sumber | Status |
|------|--------|--------|
| `WHATSAPP_VERIFY_TOKEN` | Bebas — string acak yang sama dengan yang diisi di Meta Dashboard | **Wajib** (handshake webhook) |
| `WHATSAPP_APP_SECRET` | Meta App Dashboard → App Settings → Basic → App Secret | **Wajib** (signature webhook) |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta App Dashboard → WhatsApp → API Setup | Fallback — dipakai hanya kalau bisnis belum simpan kredensial sendiri |
| `WHATSAPP_ACCESS_TOKEN` | System User token permanen (Business Settings → System Users) | Fallback — sama seperti di atas |

Webhook tetap **satu untuk semua bisnis** — yang per-bisnis hanya kredensial
kirim. Routing inbound sudah per-bisnis via `phone_number_id`.

### Cara ambil kredensial (per bisnis, di Meta dashboard mereka)

1. Meta App tipe Business + produk **WhatsApp** (atau pakai app AXION dengan
   nomor tambahan).
2. **Phone Number ID**: WhatsApp → API Setup.
3. **Access Token permanen**: Business Settings → System Users → buat system
   user → generate token dengan permission `whatsapp_business_messaging`.
4. Isi keduanya di form Hubungkan WhatsApp di AXION.

### Setup webhook di Meta App Dashboard (sekali, global)

1. WhatsApp → Configuration → Webhook:
   - **Callback URL**: `https://axionventura.com/api/whatsapp/webhook`
   - **Verify token**: nilai `WHATSAPP_VERIFY_TOKEN`
   - Klik Verify and Save — Meta kirim GET, route membalas `hub.challenge`.
2. Subscribe ke webhook field **`messages`**.

### Alur pesan masuk

```
Customer kirim WA → Meta POST /api/whatsapp/webhook
  → verifikasi X-Hub-Signature-256 (HMAC app secret)
  → lookup bisnis via phone_number_id
  → upsert leads + simpan lead_messages (dedup by wamid)
  → ai_enabled:
       ai_mode='auto'  → generate → kirim (token bisnis, fallback env) → simpan outbound
       ai_mode='draft' → simpan draft (meta.is_draft=true), manager approve di inbox
```

Catatan: balasan hanya bisa dikirim dalam **24-hour customer service window**
(sejak pesan customer terakhir). Di luar window, Graph API menolak — error
di-log, pesan inbound tetap tersimpan (auto yang gagal kirim jatuh jadi draft).

---

## 4. Webhook Inbound Generic (Airbnb/Booking.com via Zapier/Make)

Airbnb & Booking.com tidak punya API messaging publik — jalur realistis:
notifikasi email → Zapier/Make → POST ke endpoint ini.

### Environment variable

| Nama | Keterangan |
|------|------------|
| `WEBHOOK_INBOUND_SECRET` | String acak (mis. `openssl rand -hex 32`) — wajib sama dengan header Zapier |

### Endpoint

```
POST https://axionventura.com/api/webhooks/inbound
Header: X-Webhook-Secret: <WEBHOOK_INBOUND_SECRET>
Content-Type: application/json
```

Body (ternormalisasi — mapping dilakukan di Zapier/Make):

```json
{
  "business_id": "uuid bisnis di AXION",
  "channel": "airbnb",
  "external_id": "thread-id-atau-email-tamu",
  "name": "Nama Tamu",
  "message": "Isi pesan tamu",
  "contact": { "phone": "+62812...", "email": "tamu@example.com" }
}
```

- `channel` valid: `whatsapp | airbnb | booking_com | instagram | shopee | tokopedia | tiktok_shop`
- `external_id` = identitas unik percakapan (thread ID Airbnb / email tamu) —
  pesan berikutnya dengan `external_id` sama masuk ke lead yang sama.
- Response: `200 { ok, lead_id, draft_created }` | `401` secret salah |
  `422` integrasi channel belum aktif untuk bisnis tsb.

### Aktivasi integrasi (UI, self-service)

Sebelum webhook Zapier/Make bisa mengirim draft AI, channel harus aktif untuk
bisnis tsb: manager klik **Aktifkan** di kartu Airbnb/Booking.com (tab
Integrasi) — tidak perlu SQL manual (lihat §1). Tanpa baris `channel_integrations`
aktif, `/api/webhooks/inbound` membalas `422` (integrasi belum aktif).

### Setup Zapier (contoh Airbnb)

1. **Trigger**: Email by Zapier (atau Gmail) — forward notifikasi
   `automated@airbnb.com` ke alamat trigger Zapier.
2. (Opsional) **Formatter**: ekstrak nama tamu & isi pesan dari body email.
3. **Action**: Webhooks by Zapier → POST
   - URL: `https://axionventura.com/api/webhooks/inbound`
   - Headers: `X-Webhook-Secret: <nilai WEBHOOK_INBOUND_SECRET>`
   - Data: mapping field sesuai body JSON di atas
     (`business_id` di-hardcode per Zap, satu Zap per bisnis per channel).

Setup Make (Integromat) analog: modul Email/Gmail → HTTP Request.

### Alur draft AI (manual approve)

```
Zapier POST → verifikasi secret → upsert leads + simpan inbound
  → ai_enabled && ai_mode='draft'
  → generate draft → simpan lead_messages
     (sender='ai', meta.is_draft=true) — TIDAK dikirim ke mana pun
  → manager review draft dari inbox, kirim manual lewat platform OTA
```

Status lead tetap `'new'` sampai manager menindaklanjuti.

---

## 5. Referensi kode

| Concern | File |
|---------|------|
| OAuth Instagram (auth + callback) | `app/api/integrations/instagram/{auth,callback}/route.ts` |
| Webhook Instagram | `app/api/integrations/instagram/webhook/route.ts` |
| Kirim / handler / OAuth Instagram | `src/lib/instagram/` |
| Token config per-bisnis (encrypt/decrypt/strip) | `src/lib/integrations/config.ts` |
| API manajemen integrasi (list/PATCH/DELETE) | `app/api/integrations/route.ts`, `app/api/integrations/[id]/route.ts` |
| Aktivasi OTA tanpa token (Airbnb/Booking.com) | `POST /api/integrations` (`app/api/integrations/route.ts`) |
| Connect WhatsApp per-bisnis (kredensial) | `app/api/integrations/whatsapp/route.ts` |
| UI tab Integrasi (Pesan & Sosial, termasuk kartu OTA) | `src/components/integrations/ChannelIntegration.tsx` |
| Webhook WhatsApp | `app/api/whatsapp/webhook/route.ts` |
| Webhook generic inbound | `app/api/webhooks/inbound/route.ts` |
| Helper leads (upsert, dedup, history) | `src/lib/leads/index.ts` |
| AI balasan/draft | `src/lib/ai/leadAssistant.ts` |
| Enkripsi token (AES-256-GCM) | `src/lib/utils/tokenCrypto.ts` |
| Schema & RLS | `database/migrations/101_leads_hub.sql` |

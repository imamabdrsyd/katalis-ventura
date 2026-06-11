# Integrasi Leads Hub — WhatsApp & Webhook Inbound (Zapier/Make)

> Terakhir diupdate: 12 Juni 2026

Leads Hub menerima pesan masuk dari berbagai channel dan menyimpannya sebagai
`leads` + `lead_messages`. Dua jalur masuk:

| Jalur | Channel | AI |
|-------|---------|-----|
| `/api/whatsapp/webhook` | WhatsApp (Meta Cloud API) | `ai_mode='auto'` — balasan langsung dikirim |
| `/api/webhooks/inbound` | Airbnb, Booking.com, dll (via Zapier/Make) | `ai_mode='draft'` — draft disimpan, manager approve manual |

Kedua webhook menulis ke database via service role (bypass RLS) dan
di-exclude dari middleware auth (lihat `middleware.ts`).

---

## 1. Prasyarat: baris `channel_integrations`

Setiap bisnis yang mau menerima pesan harus punya baris di `channel_integrations`:

```sql
INSERT INTO channel_integrations
  (business_id, channel, is_active, external_account_id, ai_enabled, ai_mode, ai_persona)
VALUES
  -- WhatsApp: external_account_id = phone_number_id dari Meta App Dashboard
  ('<business_uuid>', 'whatsapp', true, '<phone_number_id>', true, 'auto',
   'Balas dengan gaya santai. Sebut nama properti "Villa Hillside".'),
  -- Airbnb: external_account_id tidak dipakai (lookup via business_id di payload)
  ('<business_uuid>', 'airbnb', true, NULL, true, 'draft', NULL);
```

- `ai_enabled=false` → pesan tetap tersimpan, tapi tanpa balasan/draft AI.
- `ai_persona` → instruksi tone tambahan yang masuk ke system prompt AI.
- AI memakai chain provider existing (Gemini → Groq) — lihat `src/lib/ai/provider.ts`.

---

## 2. WhatsApp (Meta Cloud API)

### Environment variables (Vercel → Settings → Environment Variables)

| Nama | Sumber |
|------|--------|
| `WHATSAPP_VERIFY_TOKEN` | Bebas — string acak yang sama dengan yang diisi di Meta Dashboard |
| `WHATSAPP_APP_SECRET` | Meta App Dashboard → App Settings → Basic → App Secret |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta App Dashboard → WhatsApp → API Setup |
| `WHATSAPP_ACCESS_TOKEN` | System User token permanen (Business Settings → System Users) |

### Setup webhook di Meta App Dashboard

1. Buat Meta App tipe Business + tambah produk **WhatsApp**.
2. WhatsApp → Configuration → Webhook:
   - **Callback URL**: `https://axionventura.com/api/whatsapp/webhook`
   - **Verify token**: nilai `WHATSAPP_VERIFY_TOKEN`
   - Klik Verify and Save — Meta kirim GET, route membalas `hub.challenge`.
3. Subscribe ke webhook field **`messages`**.
4. Isi `channel_integrations.external_account_id` dengan `phone_number_id`
   (satu nomor WhatsApp = satu bisnis).

### Alur pesan masuk

```
Customer kirim WA → Meta POST /api/whatsapp/webhook
  → verifikasi X-Hub-Signature-256 (HMAC app secret)
  → lookup bisnis via phone_number_id
  → upsert leads + simpan lead_messages (dedup by wamid)
  → ai_enabled && ai_mode='auto' → generate balasan → kirim → simpan outbound
```

Catatan: balasan hanya bisa dikirim dalam **24-hour customer service window**
(sejak pesan customer terakhir). Di luar window, Graph API menolak — error
di-log, pesan inbound tetap tersimpan.

---

## 3. Webhook Inbound Generic (Airbnb/Booking.com via Zapier/Make)

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

## 4. Referensi kode

| Concern | File |
|---------|------|
| Webhook WhatsApp | `app/api/whatsapp/webhook/route.ts` |
| Webhook generic inbound | `app/api/webhooks/inbound/route.ts` |
| Kirim pesan WhatsApp | `src/lib/whatsapp/api.ts` |
| Handler pesan WhatsApp | `src/lib/whatsapp/messageHandler.ts` |
| Helper leads (upsert, dedup, history) | `src/lib/leads/index.ts` |
| AI balasan/draft | `src/lib/ai/leadAssistant.ts` |
| Schema & RLS | `database/migrations/101_leads_hub.sql` |
| Zod validation | `src/lib/validations.ts` (`inboundWebhookSchema`) |

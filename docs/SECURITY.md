# Security — Katalis Ventura (AXION)

> Dokumen ringkas model keamanan aplikasi. Fokus utama: **keamanan lampiran/dokumen**
> (struk, faktur, KTP) yang dibangun Juni 2026. Bagian lain merangkum lapisan
> keamanan yang sudah ada.
>
> **Terakhir diupdate:** 17 Juni 2026

---

## 1. Prinsip

- **Data sensitif tidak boleh bisa diakses tanpa otorisasi.** Gerbang akses = **login AXION + keanggotaan bisnis**, divalidasi di **server**.
- **Secret hanya di server.** API secret/credential tidak pernah dikirim ke browser (`NEXT_PUBLIC_*` hanya untuk nilai yang memang publik).
- **Defense in depth.** Auth + RBAC + RLS + validasi input + audit trail bekerja berlapis.

---

## 2. Lapisan keamanan (overview)

| Lapisan | Mekanisme |
|---------|-----------|
| **Autentikasi** | Supabase Auth (`@supabase/ssr`). Selalu `supabase.auth.getUser()` (bukan `getSession()`) untuk verifikasi. `middleware.ts` me-refresh session cookie tiap request. |
| **RBAC** | Role `business_manager` / `investor` / `both` / `superadmin` di `user_business_roles`. Manager = full CRUD; investor = read-only. Diterapkan di **route handler** + **RLS**. |
| **RLS (Row-Level Security)** | PostgreSQL policies berbasis `get_my_business_ids()` / `is_business_manager()` (SECURITY DEFINER, `search_path` di-pin). Views pakai `security_invoker = true`. |
| **Validasi input** | Zod schema di semua route tulis (hindari mass-assignment). |
| **Audit trail** | Trigger `log_audit_trail()` pada `transactions`/`businesses`/`accounts`/`investor_metrics` → `audit_log` (immutable). Soft-delete + restore. |
| **Secrets** | Disimpan di env (Vercel, Sensitive). Server-only untuk credential. |

> Temuan audit akuntansi & hardening RPC terdokumentasi di [ACCOUNTING_LOGIC.md](ACCOUNTING_LOGIC.md) §19 dan [AUDIT_2026-06-11.md](AUDIT_2026-06-11.md) (SEC-H1, SEC-M1, SEC-M2, dll).

---

## 3. Keamanan Lampiran & Dokumen (Cloudinary)

Lampiran transaksi (struk, faktur, "Source of Document") dan KTP kontak disimpan di
**Cloudinary**, di folder `axion/attachments/<businessId>/`. Dokumen ini bersifat
**privat** — hanya bisa diakses anggota bisnis pemiliknya.

### 3.1 Model akses: `type: authenticated` + signed URL

- Asset lampiran diunggah dengan **delivery type `authenticated`** → URL mentahnya
  (`res.cloudinary.com/.../authenticated/...`) **tidak bisa dibuka tanpa tanda tangan**
  (→ HTTP 401).
- **Signed URL** dihasilkan **hanya oleh server AXION** (yang memegang `CLOUDINARY_API_SECRET`),
  dan **hanya setelah** verifikasi: user login + member bisnis + `public_id` ada di
  folder `axion/attachments/<businessId>/`.
- Penting: **"authenticated" bukan berarti login Cloudinary.** Pengguna cukup login
  **AXION**; Cloudinary hanya storage di belakang layar.

### 3.2 Tanda tangan = kriptografi (bukan enkripsi)

- Tanda tangan = **hash satu arah** (SHA-1/SHA-256) atas `public_id + parameter + API_SECRET`,
  ditempel ke URL sebagai `s--<signature>--`.
- Sifat: satu arah (secret tak bisa di-reverse), butuh secret untuk membuat,
  diverifikasi Cloudinary dengan recompute.
- **File-nya sendiri tidak dienkripsi** — yang kriptografis adalah *bukti izin akses*.
  Analogi: segel lilin pada amplop.

### 3.3 Alur per operasi

| Operasi | Endpoint | Otorisasi | Catatan |
|---------|----------|-----------|---------|
| **Upload** | `POST /api/transactions/attachments/upload-sign` → client upload ke Cloudinary | **Manager** (`canManageBusiness`) | Server tandatangani param `type=authenticated` → file private sejak detik pertama. |
| **Preview / lihat** | `GET /api/transactions/attachments/cloudinary-sign` | **Member** (`getBusinessRoleForUser`) | Hook `useDeliverableAttachmentUrl()` minta signed URL otomatis; preview `<img>`/PDF pakai URL itu. |
| **Download** | `GET /api/transactions/attachments/download` (proxy stream) | **Member** | Same-origin, bebas CORS; server fetch byte lalu stream dgn `Content-Disposition: attachment`. Mendukung file lama (`upload`) & baru (`authenticated`). |
| **Delete** | `DELETE /api/transactions/attachments` | **Manager** | Signed destroy request server-side. |

### 3.4 Pemisahan privat vs publik

`uploadAttachment` (lampiran/KTP) memakai **signed upload → authenticated (privat)**.
Sementara fitur **omni-channel link-in-bio** (`OmniChannelGallery`, `OmniChannelShowcase`,
folder `axion/gallery`) **sengaja tetap publik** karena halaman `/[slug]` memang untuk
publik — dan **tidak boleh** diubah ke authenticated.

### 3.5 File legacy Supabase Storage

Lampiran lama di bucket Supabase `transaction-attachments` kini **private** (fix CRIT-04,
migration 091). Diakses via signed URL TTL pendek lewat
`GET /api/transactions/attachments/sign` (lihat `src/lib/storage/signedUrl.ts`).

### 3.6 Migrasi file lama → authenticated

File lampiran yang diunggah **sebelum** signed-upload aktif masih `type: upload` (publik).
Skrip `scripts/migrate-cloudinary-authenticated.mjs` me-rename asset di
`axion/attachments/` ke `authenticated` + rewrite URL di `transactions.meta` &
`business_contacts.id_card_attachments`. Punya mode **dry-run** (default), `LIMIT` untuk
tes kecil, dan throttle anti rate-limit. Folder publik `axion/gallery` tidak disentuh.

---

## 4. Secrets & Environment Variables

- **Server-only** (jangan `NEXT_PUBLIC_`): `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
  `SUPABASE_SERVICE_ROLE_KEY`. Di Vercel ditandai **Sensitive**.
- **Publik (boleh `NEXT_PUBLIC_`)**: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`,
  `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` (preset publik untuk galeri),
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Aturan repo:** jangan pernah membaca/menampilkan file `.env*` atau nilai secret
  (lihat `CLAUDE.md`).
- Perubahan env di Vercel **baru aktif setelah redeploy**.

---

## 5. Known issues & TODO keamanan (jujur)

| Item | Status | Catatan |
|------|--------|---------|
| File lampiran **lama** masih publik | ⬜ Open | Tertutup setelah `scripts/migrate-cloudinary-authenticated.mjs` dijalankan (langkah migrasi). |
| Signed URL **tanpa TTL** | 🟡 By design | Signature-gated (butuh secret). Expiry per-waktu butuh fitur `auth_token` Cloudinary (opsional). |
| Upload **preset unsigned** (`axion_gallery`) bisa disalahgunakan | 🟡 Diterima | Hanya dipakai galeri publik; lampiran privat sudah pindah ke signed upload. |
| Orphan-on-cancel di `journal-entry` & `MultiLineJournalForm` | 🟡 Minor | Upload sudah private; bisa tinggalkan file yatim bila form dibatalkan (form transaksi utama sudah pakai defer upload). |
| OCR jalur `image_url` legacy di `AIChatPanel` | 🟡 Mitigated | Permukaan SSRF dibatasi allowlist host di `src/lib/ocr/download.ts`; tombol Scan Struk sudah pindah ke multipart (tanpa SSRF). |

---

## 6. Referensi file

| Konsern | File |
|---------|------|
| Upload lampiran (signed, authenticated) | `src/lib/storage/attachments.ts`, `app/api/transactions/attachments/upload-sign/route.ts` |
| Signed delivery URL | `app/api/transactions/attachments/cloudinary-sign/route.ts`, `src/lib/storage/signedUrl.ts` |
| Download proxy | `app/api/transactions/attachments/download/route.ts` |
| Delete lampiran | `app/api/transactions/attachments/route.ts` |
| Signed URL legacy Supabase | `app/api/transactions/attachments/sign/route.ts` |
| Migrasi file lama | `scripts/migrate-cloudinary-authenticated.mjs` |
| OCR download allowlist (anti-SSRF) | `src/lib/ocr/download.ts` |
| Auth client/server + admin | `src/lib/supabase.ts`, `src/lib/supabase-server.ts` |
| Middleware refresh session | `middleware.ts` |
| RLS & hardening | `database/rls-policies.sql`, `database/migrations/022,090,102_*.sql` |
| Validasi Zod | `src/lib/validations.ts` |

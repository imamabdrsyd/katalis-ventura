# Claude Code Instructions

## Security

- **Jangan pernah membaca file `.env*`** (`.env`, `.env.local`, `.env.production`, dll)
- Jika perlu tahu nama environment variable, cukup lihat dari kode yang menggunakannya (misal `process.env.SUPABASE_URL`)
- Jangan tampilkan nilai secret keys, API keys, atau credentials apapun di output

## Stack

- **Framework**: Next.js App Router (bukan Pages Router)
- **Auth & Database**: Supabase (`@supabase/ssr` v0.8+, `@supabase/supabase-js` v2)
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Deployment**: Vercel (auto-deploy dari branch `main`)

## Konvensi Supabase

- **Client-side** (komponen `'use client'`): gunakan `createClient()` dari `@/lib/supabase`
  ```ts
  import { createClient } from '@/lib/supabase';
  const supabase = createClient();
  ```
- **Server-side** (Route Handler, Server Component): gunakan `createServerClient()` dari `@/lib/supabase-server`
  ```ts
  import { createServerClient } from '@/lib/supabase-server';
  const supabase = await createServerClient();
  ```
- **Admin/bypass RLS**: gunakan `createAdminClient()` dari `@/lib/supabase-server` — hanya bila benar-benar perlu
- **Jangan pernah** import dari `@supabase/auth-helpers-nextjs` — sudah dihapus, pakai `@supabase/ssr`
- Selalu gunakan `supabase.auth.getUser()` bukan `getSession()` untuk verifikasi auth

## Struktur Route

```
app/
  (auth)/         — halaman login, signup, select-role (layout tanpa sidebar)
  (dashboard)/    — halaman utama dengan sidebar & BusinessProvider
  setup-business/ — onboarding setup bisnis (di luar layout dashboard)
  join-business/  — onboarding join bisnis (di luar layout dashboard)
  auth/callback/  — OAuth callback handler
  api/            — Route Handlers
```

## Auth Flow

1. **Email/Password**: login → dashboard
2. **Google OAuth**: login → `/auth/callback` → `/select-role` (jika user baru) → `/setup-business` atau `/join-business` → dashboard
3. User baru = belum ada record di `user_business_roles`
4. Role disimpan di `user_business_roles.role` dan `profiles.default_role`

## Konvensi Kode

- Commit message dalam **Bahasa Indonesia**
- Komponen page selalu `'use client'` — tidak ada server component di halaman
- Auth check di halaman: gunakan `useEffect` + `supabase.auth.getUser()` lalu redirect jika tidak login
- Setelah `router.push('/dashboard')` selalu tambahkan `router.refresh()` agar middleware me-refresh session
- Tipe data bisnis ada di `src/types/index.ts`
- API helper functions ada di `src/lib/api/`

## Middleware

- `middleware.ts` di root wajib ada — me-refresh session cookies `@supabase/ssr` di setiap request
- Jangan hapus atau modifikasi `supabase.auth.getUser()` di middleware

---

# Konteks Codebase (Fondasi)

> Bagian ini berisi pemahaman mendalam tentang arsitektur dan domain bisnis.
> Claude tidak perlu membaca ulang file-file fondasi — cukup baca file yang baru berubah.

## Identitas Produk

**Katalis Ventura** (branding UI: **AXION**) adalah platform **akuntansi dan pembukuan double-entry** untuk UKM Indonesia. Bukan platform private equity tradisional — ini SaaS pembukuan yang memungkinkan pemilik bisnis dan investor melacak keuangan dengan sistem buku besar berpasangan.

## Struktur Direktori Lengkap

```
app/
  (auth)/login, signup, select-role     — auth pages (layout tanpa sidebar)
  (dashboard)/                          — semua halaman utama (sidebar + BusinessProvider)
    dashboard/                          — KPI overview + chart + transaksi terbaru
    transactions/                       — CRUD ledger + journal-entry
    accounts/                           — Chart of Accounts (CoA)
    general-ledger/                     — Buku besar per akun
    trial-balance/                      — Neraca saldo
    income-statement/                   — Laporan laba rugi
    balance-sheet/                      — Neraca
    cash-flow/                          — Arus kas
    scenario-modeling/                  — Analisis what-if
    reports/                            — Hub laporan
    businesses/                         — Manajemen bisnis + [id]/members
    settings/                           — Profil user
    roi-forecast/                       — Proyeksi ROI
  [slug]/                               — Halaman publik omni-channel (link-in-bio)
  api/                                  — Route Handlers
  setup-business/                       — Onboarding: manager buat bisnis baru
  join-business/                        — Onboarding: investor gabung via invite code
  auth/callback/                        — OAuth callback

src/
  types/index.ts                        — Semua domain types
  context/BusinessContext.tsx            — Global state: user, businesses, activeBusiness
  hooks/                                — Custom hooks per domain (lihat daftar di bawah)
  lib/
    accounting/                         — Engine double-entry bookkeeping
      constants.ts                      — Normal balance rules, valid account combos, error msg (ID)
      guidance/transactionPatterns.ts   — 17 pola transaksi (capital injection, pay OPEX, dll)
    api/                                — Data access layer ke Supabase
      transactions.ts                   — CRUD transaksi
      accounts.ts                       — CRUD akun
      audit.ts                          — Audit trail queries
      businesses.ts                     — CRUD bisnis
      omni-channel.ts                   — Omni-channel API
    import/                             — Excel/CSV import (excelParser, excelValidator, templateGenerator)
    utils/                              — Helper utilities
    calculations.ts                     — ~700 baris engine kalkulasi keuangan
    export.ts                           — PDF (jsPDF) + Excel (xlsx) export
    supabase.ts                         — Client-side Supabase client
    supabase-server.ts                  — Server-side + admin client
    validations.ts                      — Zod schemas untuk API validation
  components/
    transactions/                       — TransactionForm, QuickTransactionForm, FloatingQuickAdd, TransactionList, TransactionDetailModal, TransactionImportModal, AccountDropdown, UnitBreakdownSection, InventoryPicker
    accounts/                           — AccountList (tree), AccountForm, AccountDeleteModal
    business/                           — BusinessCard, BusinessForm, BusinessSwitcher, InviteCodeManager, MemberList, OmniChannelManager, OmniChannelLinkList/Item
    charts/                             — MonitoringChart, ExpenseBreakdownChart, CashFlowChart/Header
    cards/                              — BalanceCard
    ui/                                 — Modal, ThemeToggle, CurrencyInputWithCalculator
    providers/                          — ThemeProvider
    public/                             — Komponen halaman publik omni-channel

database/
  schema.sql                            — Base schema
  migrations/                           — 15 file migrasi
  rls-policies.sql                      — Row-level security
```

## Database Schema

### Tabel Inti

**`businesses`** — Entitas bisnis
- `id`, `business_name`, `business_type` (agribusiness, food_and_beverage, accommodation, short_term_rental, real_estate, creative_agency, personal_care, property_management)
- `business_category` ('jasa'|'produk'|'dagang'), `capital_investment` NUMERIC
- `property_address`, `property_details` JSONB, `is_archived`
- Audit: `created_by`, `updated_by`, `created_at`, `updated_at`

**`accounts`** — Chart of Accounts (CoA)
- `id`, `business_id`, `account_code` TEXT, `account_name`
- `account_type` ('ASSET'|'LIABILITY'|'EQUITY'|'REVENUE'|'EXPENSE')
- `parent_account_id` UUID (tree/hierarki), `normal_balance` ('DEBIT'|'CREDIT')
- `is_active`, `is_system`, `sort_order`, `description`, `default_category`
- Default accounts per bisnis (stored proc `create_default_accounts`):
  - 1000 Aset → 1100 Kas, 1200 Bank, 1300 Aset Tetap
  - 2000 Liabilitas → 2100 Hutang
  - 3000 Ekuitas → 3100 Modal Pemilik
  - 4000 Pendapatan → 4100 Pendapatan Penjualan
  - 5000 Beban → 5100 Beban Operasional, 5200 HPP, 5300 Beban Pajak

**`transactions`** — Jurnal transaksi
- `id`, `business_id`, `date`, `name` (customer/vendor), `description`, `amount` (> 0)
- `category` ('EARN'|'OPEX'|'VAR'|'CAPEX'|'TAX'|'FIN')
- `account` TEXT (legacy), `debit_account_id`, `credit_account_id` (FK → accounts)
- `is_double_entry` BOOLEAN, `notes`, `meta` JSONB (unit_breakdown, sold_stock_ids, entry_type)
- Soft delete: `deleted_at`, `deleted_by`
- Audit: `created_by`, `updated_by`, `created_at`, `updated_at`

**`user_business_roles`** — Junction many-to-many user↔bisnis
- `user_id`, `business_id`, `role` ('business_manager'|'investor'|'both'), `joined_at`, `invited_by`

**`profiles`** — Profil user (id = auth.users.id)
- `full_name`, `avatar_url`, `default_role`

**`invite_codes`** — Kode undangan
- `business_id`, `code` UNIQUE, `role`, `created_by`, `expires_at`, `max_uses`, `current_uses`, `is_active`

**`investor_metrics`** — Metrik kustom investor
- `investor_id`, `business_id`, `metric_name`, `metric_formula` JSONB, `target_value`, `alert_threshold`

**`audit_log`** — Jejak audit (immutable)
- `table_name`, `record_id`, `operation` ('INSERT'|'UPDATE'|'DELETE')
- `old_values` JSONB, `new_values` JSONB, `changed_by`, `changed_at`, `metadata`

**`business_omni_channels`** — Konfigurasi halaman publik
- `business_id` UNIQUE, `slug` UNIQUE, `is_published`, `title`, `tagline`, `bio`, `logo_url`

**`business_omni_channel_links`** — Link sosial/e-commerce
- `omni_channel_id`, `channel_type` (instagram, shopee, whatsapp, dll), `label`, `url`, `is_active`, `sort_order`

### Views
- `active_transactions` — WHERE deleted_at IS NULL
- `deleted_transactions` — soft-deleted + nama penghapus
- `audit_trail_with_users` — audit_log + profiles (nama, avatar)

### Stored Procedures
- `create_default_accounts(p_business_id)` — buat CoA default
- `soft_delete_transaction(id)` — set deleted_at/deleted_by
- `restore_transaction(id)` — bersihkan deleted_at/deleted_by
- `is_slug_available(slug, exclude_id)` — cek ketersediaan slug
- `get_my_business_ids()` — return business IDs milik user
- `is_business_manager(business_id)` — cek apakah user = manager

### Triggers
- `update_updated_at_column()` — auto set updated_at
- `set_updated_by()` — auto set updated_by = auth.uid()
- `log_audit_trail()` — log INSERT/UPDATE/DELETE ke audit_log

## Sistem 6 Kategori Transaksi

| Kode | Nama | Deskripsi | Arus Kas |
|------|------|-----------|----------|
| EARN | Pendapatan | Penjualan, sewa | Operasional (masuk) |
| OPEX | Beban Operasional | Gaji, listrik, sewa | Operasional (keluar) |
| VAR | HPP/Variabel | Cost of goods sold, persediaan | Operasional (keluar) |
| CAPEX | Belanja Modal | Peralatan, properti, aset tetap | Investasi (keluar) |
| TAX | Pajak | Pajak pemerintah | Operasional (keluar) |
| FIN | Pembiayaan | Pinjaman, injeksi modal, penarikan pemilik | Pembiayaan |

**Nuansa penting double-entry:**
- VAR yang debit akun ASSET (persediaan) = pembelian stok (tetap di neraca, BUKAN HPP sampai dijual)
- FIN yang debit akun EXPENSE = beban bunga (masuk laporan laba rugi)
- FIN yang menyentuh EQUITY/LIABILITY = modal/hutang/prive (hanya pembiayaan)

## Engine Kalkulasi Keuangan (`src/lib/calculations.ts`)

Semua kalkulasi dilakukan **client-side di TypeScript**, bukan di database.

### `calculateFinancialSummary(transactions)` → FinancialSummary
- Net Profit = totalEarn - totalOpex - totalVar - totalTax - totalInterest
- totalInterest = FIN yang debit EXPENSE (bukan seluruh totalFin)

### `calculateIncomeStatementMetrics(summary)` → IncomeStatementMetrics
- Gross Profit = Revenue - VAR
- Operating Income = Gross Profit - OPEX
- EBT = Operating Income - Interest
- Margin % = profit / Revenue × 100

### `calculateBalanceSheet(transactions, capital)` → BalanceSheetData
- Proses setiap transaksi double-entry, klasifikasi aset per kode akun
- Kas: 1100, 1200 | Aset tetap: CAPEX / kode 1200-1299 | Persediaan: VAR / akun inventory
- Ekuitas: Cr EQUITY = modal disetor, Dr EQUITY = prive
- Cek persamaan: |totalAset - (totalLiabilitas + totalEkuitas)| < 0.01

### `calculateCashFlow(transactions, capital, all, startDate)` → CashFlowData
- Hanya proses transaksi yang menyentuh akun kas (1100/1200)
- Klasifikasi per counter-account: Revenue/Expense → Operasional, Asset → Investasi, Liability/Equity → Pembiayaan
- Saldo awal: sum ekuitas sebelum startDate

### `calculateROI(netProfit, capital)` → percentage
- ROI = (netProfit / capital) × 100

## Pola Transaksi Double-Entry (17 pola)

Didefinisikan di `src/lib/accounting/guidance/transactionPatterns.ts`:
- Injeksi modal: Dr Kas / Cr Ekuitas
- Terima pendapatan: Dr Kas / Cr Pendapatan
- Terima pinjaman: Dr Kas / Cr Liabilitas
- Bayar OPEX: Dr Beban / Cr Kas
- Beli aset tetap: Dr Aset / Cr Kas
- Bayar pinjaman: Dr Liabilitas / Cr Kas
- Prive (penarikan pemilik): Dr Ekuitas / Cr Kas
- Beban akrual: Dr Beban / Cr Liabilitas
- Pendapatan diterima di muka: Dr Kas / Cr Liabilitas
- Retur penjualan: Dr Pendapatan / Cr Kas
- Penggantian biaya: Dr Kas / Cr Beban
- Dan lainnya...

### Quick Entry Mode
User pilih SATU akun + jumlah → sistem otomatis:
1. Tentukan sisi debit/kredit berdasar akun
2. Assign Kas/Bank (1200 prioritas, lalu 1100) sebagai counter-account
3. Infer kategori transaksi dari kode/tipe akun

### Alur Persediaan → HPP
- Beli stok (VAR ke akun persediaan/ASSET 13xx) → tetap di neraca
- Saat dijual: `handleConvertStockToCOGS()` ubah debit dari Persediaan ke akun HPP/Expense
- `meta.sold_stock_ids` melacak stok mana yang dikonversi bersama penjualan

## Custom Hooks

| Hook | File | Fungsi |
|------|------|--------|
| `useDashboard` | hooks/ | KPI, balance sheet, transaksi terbaru, ROI |
| `useTransactions` | hooks/ | State halaman transaksi: CRUD, paginasi, modal, filter, bulk ops |
| `useBalanceSheet` | hooks/ | Data neraca + export handlers |
| `useIncomeStatement` | hooks/ | Data laba rugi + export |
| `useCashFlow` | hooks/ | Data arus kas + export |
| `useGeneralLedger` | hooks/ | Buku besar per akun + running balance |
| `useTrialBalance` | hooks/ | Total debit/kredit semua akun |
| `useScenarioModeling` | hooks/ | Analisis what-if (optimis/pesimis/kustom) + proyeksi |
| `useReportData` | hooks/ | Base hook laporan: transaksi, filter periode |
| `useAccountingGuidance` | hooks/ | Panduan real-time saat pilih akun debit/kredit |
| `useBusiness` | hooks/ | Operasi manajemen bisnis |

## State Management — BusinessContext

`src/context/BusinessContext.tsx` adalah **spine** aplikasi:
- Menyimpan: `user`, `userRole`, `businesses[]`, `activeBusiness`, `activeBusinessId`
- Active business di-persist ke `localStorage` (key: `katalis_active_business_id`)
- On mount: fetch user via `supabase.auth.getUser()` → fetch `user_business_roles` JOIN `businesses`
- Redirect: unauthenticated → `/login`, user tanpa role → `/select-role`

**Alur data:**
1. `BusinessProvider` membungkus semua halaman dashboard
2. Setiap halaman pakai hook domain (misal `useTransactions`)
3. Hook memanggil `src/lib/api/*` yang query Supabase client-side
4. Kalkulasi keuangan di-compute in-memory di TypeScript
5. `useReportData` menjadi base hook untuk semua hook laporan

**Event lintas komponen:**
- `window.dispatchEvent(new Event('transaction-saved'))` — FloatingQuickAdd → useTransactions refresh

## API Routes

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/transactions?businessId=` | GET | Fetch semua transaksi (RLS enforced) |
| `/api/transactions` | POST | Buat transaksi (Zod validated, role-checked) |
| `/api/transactions/[id]` | PUT | Update transaksi (ownership verified) |
| `/api/transactions/[id]` | DELETE | Soft-delete via stored procedure |
| `/api/stats` | GET | Publik: statistik platform (admin client) |
| `/api/omni-channel/[businessId]` | GET/PUT | Config halaman omni-channel |
| `/api/omni-channel/[businessId]/links` | GET/POST/PUT | Manage link |
| `/api/omni-channel/links/[linkId]` | DELETE | Hapus link |
| `/api/omni-channel/check-slug` | GET | Cek ketersediaan slug |
| `/api/users/profile` | GET | Profil user |

**Pola keamanan:** Semua route autentikasi panggil `getAuthenticatedUser()` dulu, lalu verifikasi role di `user_business_roles` sebelum write. Semua input divalidasi Zod.

## RBAC (Role-Based Access Control)

- **business_manager**: full CRUD transaksi, akun, settings bisnis, invite codes
- **investor**: read-only seluruh data keuangan
- **both**: semua permission kedua role
- Diterapkan di 2 level: PostgreSQL RLS policies + route handler role checks
- UI render kondisional berdasar `userRole` dari BusinessContext

## Import/Export

### Import Excel (`src/lib/import/`)
- `excelParser.ts`: Parse .xlsx/.xls/.csv (max 5MB) via library `xlsx`
- Mapping kolom: support nama EN & ID (tanggal, jumlah, kategori, dll)
- `excelValidator.ts`: Validasi baris sebelum import
- `templateGenerator.ts`: Generate template Excel download
- Bulk insert: batch 100 baris via `createTransactionsBulk()`

### Export PDF/Excel (`src/lib/export.ts`)
- PDF: `jsPDF` + `jspdf-autotable`
- Excel: library `xlsx`
- Tersedia untuk: Laporan Laba Rugi, Neraca, Arus Kas

## Fitur Scenario Modeling

Halaman `/scenario-modeling`, hook `useScenarioModeling`:
- 3 skenario dibanding baseline aktual: Optimistis, Pesimistis, Kustom
- Parameter: growth rate revenue/HPP/OPEX/bunga + tarif pajak
- Output: Revenue, HPP, Laba Kotor, OPEX, Laba Operasi, Bunga, EBT, Pajak, Laba Bersih, semua margin %
- Proyeksi bulanan: rata-rata performa × growth rate compounded N bulan ke depan

## Fitur Omni-Channel (Link-in-Bio)

- Setiap bisnis bisa buat halaman publik di `/[slug]`
- Konfigurasi: title, tagline, bio, logo, status published/draft
- Tipe link: sosial (Instagram, TikTok, YouTube, LinkedIn), e-commerce (Shopee, Tokopedia, Lazada), messaging (WhatsApp, Telegram, LINE), custom
- Slug uniqueness enforced di DB + `is_slug_available()` function
- Validasi reserved slugs di `slugUtils.ts`

## Audit Trail

- Trigger `log_audit_trail()` pada `transactions`, `businesses`, `accounts`, `investor_metrics`
- Menyimpan `old_values` + `new_values` sebagai JSONB
- View `audit_trail_with_users` untuk tampilan dengan nama user
- API: `getRecordAuditHistory()`, `getBusinessAuditLogs()`, `getDeletedTransactions()`, `getFieldChanges()`
- Soft-delete bisa di-restore via `deleted_transactions` view
- Audit logs immutable (RLS mencegah manipulasi langsung)

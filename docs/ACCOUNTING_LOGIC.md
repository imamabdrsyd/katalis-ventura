# Accounting Logic Documentation

> **Live Documentation** - Dokumen ini menjelaskan seluruh logic akuntansi di Katalis Ventura.
> Terakhir diaudit: 11 Juni 2026 | Terakhir diupdate: 21 Juni 2026 (**Fix Legacy Partial Settlements missing remaining_amount**) — transaksi legacy partial settlement yang kehilangan `remaining_amount` di `meta` kini memiliki mekanisme fallback otomatis. `getOutstandingAmount` (client) dan `v_outstanding` (server RPC `settle_transaction`) akan menghitung sisa tagihan secara real-time dari total `partial_settlements` jika field `remaining_amount` absen, mencegah overstate settlement pada full settlement. Sebelumnya 12 Juni 2026 (**Batch fix audit 2026-06-11 (Issue #27)** — semua temuan High + ACC-M1/M11 dari `docs/AUDIT_2026-06-11.md` diperbaiki: retur penjualan & reimbursement & pelunasan akrual kini benar di IS (`calculateFinancialSummary`, `extractIncomeStatementLineItems`, `groupTransactionsByMonth` — ACC-H3/H4/H5/H6/M1/M11); konvensi bulan depresiasi disamakan full-month (Neraca = IS, ACC-H7, Section 16.3); payable settlement & AP aging pakai net baris hutang via `getPayableLineAmount`/`getPayableOutstandingAmount` (ACC-H1, Section 22.2); pemilihan akun piutang settlement pakai `isAnyReceivableAccount` bukan ASSET pertama (ACC-H2); migr 102 hardening (SEC-H1/L1/L2: multi-line RPC kembali SECURITY INVOKER + search_path, helper RLS di-pin, cache write manager-only); period-lock + whitelist field di `/api/sync/push` (SEC-M1); allowlist skema URL omni-channel + `safeLinkUrl()` anti stored-XSS (SEC-M2). Lihat Section 19 / Issue #27. Sebelumnya 11 Juni: **Fix settlement piutang multi-line sisi server (Issue #26, migr 100)** — audit menyeluruh 11 Juni 2026 (temuan ACC-C1) menemukan fix Issue #26 sebelumnya hanya di client: RPC server `settle_transaction` (migr 079) masih hitung outstanding dari header `amount` (gross), sementara client kirim net → sync-check menolak pelunasan piutang multi-line (net≠gross), atau over-book di gross bila outstanding NULL. Migr 100 me-`CREATE OR REPLACE` `settle_transaction` (body identik migr 079 kecuali blok `v_outstanding`): multi-line → `SUM(debit-credit)` baris akun piutang dari `journal_lines` (replika `isAnyReceivableAccount()` — SQL↔TS wajib sinkron), partial → `remaining_amount`, single double-entry → header amount; tetap SECURITY INVOKER + search_path. Laporan audit lengkap: `docs/AUDIT_2026-06-11.md`. Section 19 / Issue #26 diperbarui. Sebelumnya 10 Juni: **Katalog Produk/Jasa + Sales Channel field** — Section 27 baru: migr 099 tabel `catalog_items` (master data produk/jasa per bisnis, harga saja, `revenue_account_id` + `sku` disiapkan untuk fase matching); halaman `/catalog` (manager-only, CRUD); `CatalogItemPicker` 2 mode — `single` di Quick Entry (muncul saat akun REVENUE dipilih, isi amount+nama+akun) & `multi` di MultiLineJournalForm (tombol "Tambah dari Katalog" saat EARN → keranjang qty → generate baris Dr penampung kosong + Cr per item ke akun pendapatannya); soft-delete via `deleted_at`; RLS pola `business_contacts`. Juga: field `sales_channel` di `transactions` (migr 097/098, 13 channel: tiktok/tokopedia/shopee/lazada/blibli/airbnb/booking_com/traveloka/instagram/whatsapp/website/offline/other) dengan badge logo di list & detail modal; importer agent auto-set channel; kolom CASH FLOW di list transaksi kini tampilkan akun kas multi-line (akrual non-kas → akun debit terbesar) seperti double-entry. Sebelumnya 09 Juni: **AXION Agent — channel TikTok Shop / Tokopedia + instruksi NL** — Section 26.7 baru: importer CSV ekspor pesanan Seller Center gabungan TikTok+Tokopedia (`tiktokTokopediaParser.ts`); 1 transaksi per order (multi-SKU digabung, rincian di `meta.line_items`), jurnal 2-baris Dr Kas/Bank · Cr Pendapatan = Σ SKU Subtotal After Discount; pendapatan subtotal-net saja (ongkir disubsidi platform → audit di meta, bukan revenue); tanggal Paid Time; filter hanya status Selesai; idempoten via `meta.order_id`; parser tangani BOM/trailing-TAB/quoted-multiline; `resolveMarketplaceAccounts()` (4100 + Kas/Bank); UI channel digabung jadi satu opsi "TikTok Shop / Tokopedia". **Field instruksi tambahan opsional** (`instructionInterpreter.ts`, provider Gemini Vertex + fallback rule-based) menerjemahkan NL → config impor (status posted/draft, **debitMode bank/receivable** = Dr Piutang Usaha bila dana belum cair, channel/date filter, bank hint) — hanya mengatur perilaku, TIDAK mengubah angka. Sebelumnya 06 Juni: **AXION Agent interaktif tanya nominal** — Section 26.6 baru + 26.4/26.5 diperbarui: kalau user ketik transaksi tanpa nominal (mis. "bayar listrik"), AI tidak lagi error tapi balik tanya "Berapa nominalnya?"; `extractTransactionFromText()` kini return 3 status (`complete`/`needs_amount`/`null`), `PARSE_SYSTEM_PROMPT` izinkan `amount:null`; web simpan `pendingTx` + Telegram simpan `pending_transaction{_type:'needs_amount'}`, jawaban nominal berikutnya digabung + bawa `category_hint`; sebelumnya 05 Juni: **AXION Agent ke Telegram** — Section 26.5 diperbarui (tersambung): command `/tanya` analitik (reuse buildFinancialContext + provider chain, non-streaming, toTelegramMarkdown konversi bold); input transaksi Telegram upgrade ke `extractTransactionFromText()` shared helper (`src/lib/ai/parseTransaction.ts`, Gemini→Groq→regex) yang dipakai web & Telegram; fix import file chat `[object Object]` (validateFile return object); sebelumnya: **AXION Agent multi-provider** — Section 26.1b baru: provider abstraction `src/lib/ai/provider.ts` dengan chain Gemini→Groq→rule-based; `generateText`/`streamText` normalisasi format Gemini native vs Groq OpenAI-compatible; system prompt dipusatkan di `src/lib/ai/prompts.ts` (ACCOUNTING_DOMAIN reusable, nuansa klasifikasi VAR/CAPEX/FIN ditingkatkan); UI tampilkan badge model aktif via header X-AI-Model; env `GROQ_API_KEY` ditambah; sebelumnya 05 Juni: **AXION Agent Opsi B (aksi tulis)** — Section 26.4 baru: (1) catat transaksi via natural language di chat (`/api/ai/parse-transaction`, Gemini extract + smartResolveTransaction, fallback parseTransactionMessage), preview DraftCard → simpan; (2) impor XLS/CSV via lampiran chat (parse client-side reuse engine import, ImportPreviewCard → createTransactionsBulk); (3) Smart Import AI-assist di `/transactions` (`/api/ai/smart-import-assist` klasifikasi batch baris low-confidence, badge "AI"); semua fitur AI=enhancement dgn fallback rule-based; sebelumnya 04 Juni: **AXION Agent (AI Assistant)** — Section 26 baru: chatbot keuangan read-only via FAB kanan-bawah (gantikan FAB Quick Entry), `POST /api/ai/chat` streaming Gemini 2.5 Flash Lite, `buildFinancialContext()` di `src/lib/ai/financialContext.ts` inject ringkasan P&L per-bulan + neraca (transaksi mentah TIDAK dikirim ke AI); `computeSummary()` mereplikasi pipeline useIncomeStatement (calculateFinancialSummary → applyDepreciationToSummary) supaya netProfit ikut kurangi depresiasi & match Income Statement; 8 unit test regression di `aiFinancialContext.test.ts`; Telegram belum tersambung tapi context builder sudah reusable; sebelumnya: **OCR Struk → Gemini multimodal** — `scanReceipt()` kini pakai Gemini `gemini-2.5-flash` sebagai provider utama: gambar struk → JSON `OcrParsed` terstruktur langsung (vendor/total/date/category/line_items/charges) tanpa regex; Vision/OCR.space + `parseReceipt()` tetap sebagai fallback bila quota habis/error/API key kosong; `geminiOcr.ts` + `parseGeminiJson()` baru, enrich keyword via fungsi rule-based `parser.ts` agar matcher CoA tetap jalan; `OcrProvider` tambah `'gemini'`; cache `ocr_scan_cache` re-parse per-provider; Section 25.2 diperbarui; sebelumnya: **Fix outstanding piutang multi-line ambil gross bukan net (Issue #26)** — `getOutstandingAmount` kini hitung net debit baris akun receivable via helper baru `getReceivableLineAmount`, bukan header `amount` (gross); settlement OTA tidak lagi overstate kas & overclear piutang; Section 14.2b + Issue #26 ditambahkan; koreksi data historis Hillside Studio (4 settlement gross→net + 1 transaksi pajak Cr Piutang→Cr Bank); **Fix tombol pelunasan hilang setelah edit transaksi multi-line (Issue #25)** — detector `isReceivableTransaction`/`isTradeReceivableTransaction`/`isPayableTransaction` mengecek cabang `is_double_entry` lebih dulu, padahal transaksi multi-line punya `is_double_entry=TRUE` + `debit_account`/`credit_account` NULL (akun ada di `journal_lines`); urutan cabang dibalik → cek `is_multi_line` dulu; Section 14.2 + Issue #25 ditambahkan; regression test `tests/unit/settlementDetection.test.ts`; sebelumnya: **Fix capital double-count di Neraca (Issue #24)** — legacy branch `calculateBalanceSheet` hanya menyuntik `capital_investment` bila ekuitas belum dibukukan dari double-entry/multi-line (`capitalAlreadyBooked`), mencegah aset & ekuitas overstated sebesar modal awal saat data legacy bercampur dengan transaksi "Modal Investasi Awal" otomatis; Section 6.1B + Issue #24 ditambahkan; sebelumnya: **Promosi double-entry → multi-line** — migr 095: `update_multi_line_transaction` kini mengizinkan upgrade transaksi double-entry sederhana menjadi multi-line via tombol "Tambah Baris" di Edit Transaction (set is_multi_line=TRUE + kosongkan debit/credit_account_id); Section 3.2 diperbarui; **AccountDropdown** kini render via portal (createPortal) agar tidak terpotong overflow modal; sebelumnya: **Statement of Changes in Equity (SCE) + Profit-Sharing & Rekonsiliasi Dividen** — migr 094 tambah kolom `profit_share_pct`, `owner_stock_account_id`, `contact_id` di `accounts`; fungsi `calculateStatementOfChangesInEquity`, hook + halaman `/statement-of-changes-in-equity`, export PDF/Excel; header "Equity (Capital)" di Neraca kini clickable ke SCE; Section 23 baru + Section 6.3 diperbarui; menjawab temuan audit MEDIUM "Tidak Ada SOCE"; sebelumnya: **Retained Earnings = auto-calculate; jurnal penutup manual DIHAPUS** — halaman `/closing-entry`, lib `closingEntry.ts`, dan link nav dihapus karena bertabrakan dengan model auto-calculate dan merusak presentasi ekuitas neraca; `calculateBalanceSheet` kini mem-filter `meta.entry_type.id === 'closing_entry'` sebagai pengaman data historis; Period Lock tetap sebagai soft-close; Section 6.4 & Issue #23 diperbarui; sebelumnya: **Template Jurnal Multi-Baris** — migr 093 kolom `journal_lines` JSONB di `transaction_templates`; "Simpan sebagai Template" & "Gunakan Template" kini tersedia di mode multi-baris Journal Entry; memuat template multi-baris mengganti semua baris (tetap editable); Section 12 diperbarui; sebelumnya: **Bank Statement Import — Phase B** — Section 25 dilengkapi dengan CSV/XLSX parser (Indonesian + English number/date format detection, dua format kolom: Debit+Kredit terpisah atau Mutasi+Type), side-by-side matching UI di `/reconciliation` dengan mode toggle Saldo vs Cocokkan Mutasi, hook `useBankTransactions`, API `/api/bank-transactions` + `/match` + `/unmatch` (auto un-reconcile transaksi ledger kalau tidak ada bank line lain ter-link); sebelumnya: **Bank Statement Import & OCR** — migr 092 + Section 25 — upload mutasi PDF/image BCA, pipeline OCR `runOcr()`, dedup hash UNIQUE(account_id, dedup_hash), 2 tabel `bank_statement_imports` + `bank_transactions`; **Invoice dari Transaksi Piutang** — migr 086 + Section 24; audit fix flag `is_trade_receivable` & `is_operating_payable` — migr 085; depresiasi fix; multi-currency — migr 079)

---

## Daftar Isi

1. [Architecture Overview](#1-architecture-overview)
2. [Chart of Accounts (CoA)](#2-chart-of-accounts)
3. [Double-Entry Bookkeeping Engine](#3-double-entry-bookkeeping-engine)
4. [Transaction Lifecycle](#4-transaction-lifecycle)
5. [Financial Calculations](#5-financial-calculations)
6. [Balance Sheet Logic](#6-balance-sheet-logic)
7. [Income Statement Logic](#7-income-statement-logic)
8. [Cash Flow Logic](#8-cash-flow-logic)
9. [General Ledger Logic](#9-general-ledger-logic)
10. [Trial Balance Logic](#10-trial-balance-logic)
11. [Scenario Modeling Logic](#11-scenario-modeling-logic)
12. [Quick Transaction Resolver](#12-quick-transaction-resolver)
13. [Matching Principle & Inventory (COGS)](#13-matching-principle--inventory-cogs)
14. [Receivable Settlement (Pelunasan Piutang)](#14-receivable-settlement-pelunasan-piutang)
15. [Budget & Forecast Logic](#15-budget--forecast-logic)
16. [Depreciation — Straight-Line (PSAK 16 / IAS 16)](#16-depreciation--straight-line-psak-16--ias-16)
17. [Validation Layers](#17-validation-layers)
18. [Category-to-Report Matrix (Cross-Category Summary)](#18-category-to-report-matrix-cross-category-summary)
19. [Audit Findings & Known Issues](#19-audit-findings--known-issues)
20. [Data Flow Diagrams](#20-data-flow-diagrams)
21. [Business Members & Access Control](#21-business-members--access-control)
22. [AR/AP Aging & Repayment History](#22-arap-aging--repayment-history)
23. [Statement of Changes in Equity (SCE) & Rekonsiliasi Dividen](#23-statement-of-changes-in-equity-sce--rekonsiliasi-dividen)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI LAYER                                 │
│  TransactionForm.tsx  │  QuickTransactionForm.tsx  │  Reports   │
└──────────┬────────────┴──────────────┬─────────────┴────┬───────┘
           │                           │                  │
┌──────────▼───────────────────────────▼──────────────────▼────────┐
│                     HOOKS LAYER (src/hooks/)                     │
│                                                                  │
│  ┌────────────────────┐  ┌───────────────────────────────────┐   │
│  │ useReportData.ts   │  │ Specialized Hooks:                │   │
│  │ (base: period,     │  │  ├── useIncomeStatement.ts        │   │
│  │  dates, txns)      │  │  ├── useBalanceSheet.ts           │   │
│  └────────────────────┘  │  ├── useCashFlow.ts               │   │
│                           │  ├── useGeneralLedger.ts          │   │
│                           │  ├── useTrialBalance.ts           │   │
│                           │  └── useScenarioModeling.ts       │   │
│                           └───────────────────────────────────┘   │
└──────────┬───────────────────────────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────────────────┐
│                     MODEL LAYER (src/lib/)                       │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐  │
│  │ accounting/          │  │ calculations.ts                  │  │
│  │  ├── constants.ts    │  │  ├── calculateFinancialSummary() │  │
│  │  ├── types.ts        │  │  ├── calculateBalanceSheet()     │  │
│  │  ├── validators/     │  │  ├── calculateCashFlow()         │  │
│  │  │   └── tx.ts       │  │  ├── calculateIncomeStatement()  │  │
│  │  └── guidance/       │  │  ├── calculateROI()              │  │
│  │      ├── patterns.ts │  │  └── groupTransactionsByMonth()  │  │
│  │      ├── suggest.ts  │  └──────────────────────────────────┘  │
│  │      └── matching    │                                        │
│  │          Warning.ts  │  ┌──────────────────────────────────┐  │
│  └──────────────────────┘  │ utils/                           │  │
│                            │  ├── transactionHelpers.ts       │  │
│                            │  └── quickTransactionHelper.ts   │  │
│                            └──────────────────────────────────┘  │
└──────────┬───────────────────────────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────────────────┐
│                     API LAYER (src/lib/api/)                     │
│  ┌─────────────────────────┐  ┌───────────────────────────────┐  │
│  │ transactions.ts         │  │ accounts.ts                   │  │
│  │  getTransactions()      │  │  getAccounts()                │  │
│  │  createTransaction()    │  │  createAccount()              │  │
│  │  updateTransaction()    │  │  updateAccount()              │  │
│  │  deleteTransaction()    │  │  deleteAccount()              │  │
│  │  createTransactionsBulk │  └───────────────────────────────┘  │
│  └─────────────────────────┘                                     │
└──────────┬───────────────────────────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────────────────┐
│                     DATABASE LAYER (Supabase/PostgreSQL)         │
│  ┌───────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ transactions  │  │ accounts     │  │ audit_logs             │ │
│  │ (debit/credit │  │ (CoA per     │  │ (auto-tracked changes) │ │
│  │  account_id)  │  │  business)   │  │                        │ │
│  └───────────────┘  └──────────────┘  └────────────────────────┘ │
│                                                                  │
│  Constraints: check_different_accounts, RLS, FK to accounts      │
└──────────────────────────────────────────────────────────────────┘
```

**File Map:**

| File | Fungsi |
|------|--------|
| `src/lib/accounting/constants.ts` | Normal balance rules, valid combinations |
| `src/lib/accounting/types.ts` | Type definitions untuk validation & guidance |
| `src/lib/accounting/validators/transactionValidator.ts` | Double-entry validation engine |
| `src/lib/accounting/guidance/transactionPatterns.ts` | 15 pola transaksi + keyword detection |
| `src/lib/accounting/guidance/suggestions.ts` | Smart account suggestion service |
| `src/lib/accounting/guidance/matchingPrincipleWarning.ts` | Matching principle (EARN → HPP) warning |
| `src/lib/accounting/guidance/receivableSettlement.ts` | Receivable settlement utilities (piutang) |
| `src/lib/accounting/depreciation.ts` | Straight-line depreciation calculator (PSAK 16) |
| `src/lib/calculations.ts` | Semua financial calculations (termasuk budget vs actual) |
| `src/lib/utils/transactionHelpers.ts` | Category detection, account filtering |
| `src/lib/utils/quickTransactionHelper.ts` | Single-account to double-entry resolver |
| `src/lib/export.ts` | PDF & Excel export (jsPDF, xlsx) |
| `src/types/index.ts` | Core TypeScript types |
| `src/hooks/useReportData.ts` | Base hook: period, dates, transaction fetching |
| `src/hooks/useIncomeStatement.ts` | Income statement calculations + export |
| `src/hooks/useBalanceSheet.ts` | Balance sheet calculations + export |
| `src/hooks/useCashFlow.ts` | Cash flow calculations + export |
| `src/hooks/useGeneralLedger.ts` | Per-account ledger with running balance |
| `src/hooks/useTrialBalance.ts` | Trial balance (all accounts, debit/credit columns) |
| `src/hooks/useScenarioModeling.ts` | Scenario analysis & financial projections |
| `src/hooks/useBudget.ts` | Budget CRUD, variance analysis, trend projection |
| `src/lib/api/budgets.ts` | Budget data access layer ke Supabase |
| `src/lib/storage/attachments.ts` | Upload/delete dokumen sumber transaksi |

---

## 2. Chart of Accounts

### 2.1 Struktur 5 Kategori Utama

```
1000 Assets       (Normal Balance: DEBIT)
├── 1100 Cash
├── 1200 Bank
├── 1300 Fixed Assets
└── 1xxx [User-defined sub-accounts]

2000 Liabilities  (Normal Balance: CREDIT)
├── 2100 Loans Payable
└── 2xxx [User-defined sub-accounts]

3000 Equity       (Normal Balance: CREDIT)
├── 3100 Owner's Capital    (is_system: true, default_category: FIN)
└── 3xxx [User-defined sub-accounts]

4000 Revenue      (Normal Balance: CREDIT)
├── 4100 Sales Revenue
├── 4200 FX Gain               (is_system: true, default_category: FIN) — keuntungan selisih kurs terealisasi
└── 4xxx [User-defined sub-accounts]

5000 Expenses     (Normal Balance: DEBIT)
├── 5100 Operating Expenses    (default_category: OPEX)
├── 5200 Variable Cost (COGS)  (default_category: VAR)
├── 5300 Tax Expenses          (default_category: TAX)
├── 5400 FX Loss               (is_system: true, default_category: FIN) — kerugian selisih kurs terealisasi
└── 5xxx [User-defined sub-accounts]
```

**Multi-currency (sejak migrasi 079):** Tiap business punya `base_currency_code` (default `IDR`) — semua laporan keuangan tetap dilaporkan dalam mata uang fungsional ini. Tiap akun, transaksi, dan journal line bisa punya `currency_code` sendiri plus `fx_rate` saat posting. Untuk transaksi non-IDR: `amount` menyimpan nilai fungsional (original_amount × fx_rate), `original_amount` menyimpan nilai sumber. Akun 4200/5400 dipakai oleh RPC `settle_transaction` untuk mencatat realisasi FX gain/loss saat pelunasan piutang/hutang berbeda kurs (lihat §14.7).

### 2.2 Account Code Convention

| Range | Type | Normal Balance |
|-------|------|----------------|
| 1000-1999 | ASSET | DEBIT |
| 2000-2999 | LIABILITY | CREDIT |
| 3000-3999 | EQUITY | CREDIT |
| 4000-4999 | REVENUE | CREDIT |
| 5000-5999 | EXPENSE | DEBIT |

### 2.3 Normal Balance Rules

Definisi di `src/lib/accounting/constants.ts`:

```
ASSET:     Bertambah di DEBIT, Berkurang di CREDIT
LIABILITY: Bertambah di CREDIT, Berkurang di DEBIT
EQUITY:    Bertambah di CREDIT, Berkurang di DEBIT
REVENUE:   Bertambah di CREDIT, Berkurang di DEBIT
EXPENSE:   Bertambah di DEBIT, Berkurang di CREDIT
```

Ini sesuai dengan standar akuntansi (PSAK/IFRS).

### 2.4 Auto-Provisioning

Setiap business baru otomatis mendapat Chart of Accounts lengkap. Flow:
1. Business dibuat → INSERT ke `businesses`
2. User diberi role `business_manager` → INSERT ke `user_business_roles`
3. `create_default_accounts(business_id)` dipanggil via `supabase.rpc()` — function berjalan sebagai `SECURITY DEFINER` (bypass RLS) sehingga dapat INSERT ke `accounts` meski RLS aktif

Lihat `database/migrations/001_add_double_entry_bookkeeping.sql`, `012_fix_accounts_rls_and_function.sql`, dan `016_ensure_equity_subaccount.sql` (definisi terbaru — menambah 3100 Owner's Capital sebagai system account + backfill bisnis lama). Migrasi `079_multi_currency_support.sql` memperluas `create_default_accounts()` agar otomatis mem-provisioning akun 4200 FX Gain & 5400 FX Loss (juga backfill ke seluruh bisnis lama).

### 2.5 Account Code Generation (Smart Auto-Code)

File: `src/lib/api/accounts.ts` → `getNextAccountCode()`

Saat user menambah sub-akun, kode di-generate otomatis dengan strategi bertingkat:

```
Strategy 1: Coba kelipatan 100 dalam range parent
  5000 → cek 5100, 5200, 5300, ... 5900
  → Pakai yang pertama belum ada

Strategy 2: Jika semua kelipatan 100 penuh, coba kelipatan 10
  → 5110, 5120, 5130, ...

Strategy 3: Jika semua kelipatan 10 penuh, coba step 1
  → 5111, 5112, 5113, ...

Error: Hanya jika seluruh range 5001-5999 benar-benar penuh
```

**Aturan utama:** Kode sub-akun **harus** berada dalam range 1000-range parent-nya:
- Sub-akun dari `5000 Expenses` → hanya boleh `5001–5999`
- Sub-akun dari `1000 Assets` → hanya boleh `1001–1999`
- dst.

Kapasitas: hingga **999 sub-akun** per parent account.

---

## 3. Double-Entry Bookkeeping Engine

### 3.1 Valid Account Combinations

Didefinisikan di `constants.ts` → `VALID_COMBINATIONS`:

| # | Debit | Credit | Deskripsi | Contoh |
|---|-------|--------|-----------|--------|
| 1 | ASSET | REVENUE | Terima pendapatan | Bayaran sewa masuk ke bank |
| 2 | ASSET | EQUITY | Suntik modal | Pemilik setor modal ke kas |
| 3 | ASSET | LIABILITY | Terima pinjaman | Pencairan KPR ke bank |
| 4 | EXPENSE | ASSET | Bayar beban | Bayar gaji dari bank |
| 5 | ASSET | ASSET | Transfer antar aset | Beli peralatan dgn kas |
| 6 | LIABILITY | ASSET | Bayar hutang | Bayar cicilan KPR |
| 7 | EQUITY | ASSET | Penarikan prive | Ambil uang pribadi |
| 8 | REVENUE | ASSET | Retur pendapatan | Kembalikan uang sewa |
| 9 | ASSET | EXPENSE | Penggantian biaya | Terima klaim asuransi |
| 10 | LIABILITY | EQUITY | Konversi hutang | Hutang jadi modal |
| 11 | EXPENSE | LIABILITY | Beban terutang (accrued expense) | Beban listrik belum dibayar |
| 12 | LIABILITY | REVENUE | Realisasi pendapatan dimuka | Pengakuan sewa diterima dimuka |
| 13 | LIABILITY | LIABILITY | Reklasifikasi hutang | Hutang jk. panjang → jk. pendek |
| 14 | REVENUE | LIABILITY | Pendapatan diterima dimuka | Terima deposit sewa di muka |

### 3.2 Multi-line Journal Entry

Selain simple 2-line (1 debit + 1 credit), sistem mendukung **compound/multi-line journal entries** (N debit + M credit lines, total debit = total credit).

**Database:**
- Tabel `journal_lines` (FK → `transactions.id`, ON DELETE CASCADE):
  - `account_id` (FK → accounts), `debit_amount`, `credit_amount`, `description`, `sort_order`
  - Constraint `journal_line_one_side_nonzero`: tepat satu sisi harus > 0 per baris
  - Constraint trigger `trg_check_journal_balance` (DEFERRABLE INITIALLY DEFERRED): total debit = total credit per transaction_id, minimal 2 baris (tolerance 0.01)
- Kolom `transactions.is_multi_line` (boolean, default false)

**Validasi (Zod):**
- `journalLineSchema`: satu sisi non-zero per baris
- `createMultiLineTransactionSchema`: min 2 baris, total debit = total kredit (tolerance < 0.01), total > 0

**Kalkulasi:**
- Semua fungsi di `calculations.ts` (`calculateFinancialSummary`, `calculateBalanceSheet`, `calculateCashFlow`, `calculateOpeningBalance`, `groupTransactionsByMonth`) mem-partisi transaksi ke 3 jalur:
  1. `is_multi_line=true` → iterasi `journal_lines[]`, classify per baris berdasar `account.account_type`
  2. `is_double_entry=true` → logik existing (debit_account / credit_account)
  3. Legacy → logik kategori-based

**Income statement (multi-line):**
- REVENUE credit lines → `totalEarn`
- EXPENSE debit lines → `totalOpex`/`totalVar`/`totalTax` (by `default_category`)
- FIN + EXPENSE debit → `totalInterest`

**Balance sheet (multi-line):**
- Setiap baris di-proses independen: debit ASSET → +totalAssets, credit EQUITY → +totalEquityCredit, dst.

**Cash flow (multi-line):**
- Cari baris kas (akun 1100/1200), hitung net (debit − credit)
- Klasifikasi bucket via `transaction.category` (operating/investing/financing)

**UI:**
- Tombol "Multi-Baris" di halaman transaksi → `MultiLineJournalForm.tsx` (tabel dinamis, validasi seimbang real-time).
- **Embedded multi-line di Penjualan, Pengeluaran & Terima Pinjaman:** Di halaman Journal Entry (`journal-entry/page.tsx`), entry type "Penjualan", "Pengeluaran", dan "Terima Pinjaman" memiliki tombol "+ Tambah Baris" yang mengubah form single-line menjadi tabel multi-line (N debit + M credit). Baris pertama di-prefill dari state single-line. Account filtering diterapkan per entry type:
  - Penjualan: debit → ASSET atau EXPENSE (untuk komisi OTA, biaya bank, diskon penjualan yang dikurangkan dari pendapatan bruto — sesuai PSAK/IFRS gross revenue recording), kredit → REVENUE saja
  - Pengeluaran: debit → EXPENSE atau ASSET, kredit → ASSET atau LIABILITY
  - Terima Pinjaman: debit → ASSET atau EXPENSE (biaya layanan, admin fee, provisi), kredit → LIABILITY saja
- Saat disimpan dalam mode multi-line, data dikirim via `createMultiLineTransaction()` (`is_multi_line: true`). Mode single-line tetap menggunakan `createTransaction()` (`is_double_entry: true`).

**Atomic create/update (sejak migrasi 082):** Header transaksi dan baris `journal_lines` sekarang disimpan dalam satu RPC server-side (`create_multi_line_transaction(p_header JSONB, p_lines JSONB)` dan `update_multi_line_transaction(...)`). Sebelumnya API route melakukan INSERT header + INSERT lines sebagai dua request terpisah — jika request kedua gagal, transaksi tertinggal tanpa lines. Route handler `/api/transactions` dan `/api/transactions/[id]/multi-line` sekarang memanggil RPC ini sehingga seluruh mutasi bersifat all-or-nothing. RPC juga memvalidasi: total debit ≈ total kredit (tolerance 0.01), minimal 2 baris, semua akun milik business yang sama, dan tepat satu sisi non-zero per baris.

**Promosi double-entry → multi-line (sejak migrasi 095):** Transaksi double-entry sederhana yang sudah tersimpan dapat **di-upgrade** menjadi multi-line lewat tombol "Tambah Baris" di Edit Transaction. Di frontend (`transactions/page.tsx > handleConvertToMultiLine`), dua akun debit/kredit existing di-konversi otomatis menjadi 2 baris awal `journal_lines`, lalu modal beralih ke `MultiLineJournalForm`. Saat disimpan, `update_multi_line_transaction` mendeteksi `is_multi_line=false` + `p_lines` disediakan sebagai **promosi**: meng-set `is_multi_line=TRUE`, `is_double_entry=TRUE`, dan **mengosongkan** `debit_account_id`/`credit_account_id` (NULL) agar memenuhi constraint `transactions_account_rules` (multi-line wajib NULL pada kedua kolom akun single-line). Konversi bersifat satu arah (tidak ada downgrade kembali ke single-line).

### 3.3 Prinsip Accounting Equation

Setiap transaksi double-entry dan multi-line **harus** menjaga:

```
Assets = Liabilities + Equity + (Revenue - Expenses)
```

Sistem memvalidasi ini di `useBalanceSheet.ts` dengan tolerance `< 0.01`.

### 3.4 Kombinasi yang DITOLAK

Semua kombinasi di luar 14 valid combinations akan ditolak oleh `TransactionValidator`. Contoh yang tidak valid:
- `EXPENSE → REVENUE` (tidak ada artinya secara akuntansi)
- `EXPENSE → EQUITY` (tidak ada artinya)
- `REVENUE → EQUITY` (closing entry — tidak didukung; retained earnings auto-calculate, lihat Section 6.4)
- `EQUITY → EXPENSE` (closing entry — tidak didukung; retained earnings auto-calculate, lihat Section 6.4)

---

## 4. Transaction Lifecycle

### 4.1 Tiga Mode Input

**Mode 1: Full Double-Entry (TransactionForm.tsx)**
```
User memilih:
  1. Nama transaksi
  2. Tanggal
  3. Jumlah
  4. Akun Debit  (manual pick)
  5. Akun Kredit (manual pick)
  6. Kategori    (auto-detected atau manual)
```

**Mode 2: Quick Transaction (QuickTransactionForm.tsx)**
```
User memilih:
  1. Nama transaksi
  2. Tanggal
  3. Jumlah
  4. Satu akun kategori (e.g. "Sales Revenue")

System auto-resolves:
  → Counter-account = default Cash/Bank
  → Debit/Credit side berdasarkan account type
  → Category dari default_category atau type detection
```

**Mode 3: Multi-line Journal Entry (MultiLineJournalForm.tsx)**
```
User memilih:
  1. Nama / referensi jurnal
  2. Tanggal
  3. Kategori (manual)
  4. N baris jurnal, masing-masing:
     - Akun
     - Debit ATAU Kredit (satu sisi per baris)
     - Keterangan baris (opsional)

Validasi:
  → Total debit HARUS = total kredit
  → Minimal 2 baris
  → Amount header = sum debit lines
  → is_multi_line = true, is_double_entry = false
```

### 4.2 Flow: Quick Transaction Resolution

```
User picks "Sales Revenue (4100)"
         │
         ▼
resolveDebitCredit()
  → REVENUE type → money IN
  → Debit: Bank (1200)    ← cash account
  → Credit: Sales Revenue  ← selected account
         │
         ▼
detectCategory(debitCode="1200", creditCode="4100")
  → creditAccount.default_category = "EARN" ← Priority 1
  → Fallback: ASSET debit + REVENUE credit = "EARN"
         │
         ▼
ResolvedTransaction {
  debit_account_id: bank.id,
  credit_account_id: salesRevenue.id,
  category: "EARN",
  is_double_entry: true
}
```

### 4.3 Transaction Status (Draft/Posted)

Setiap transaksi memiliki field `status`:
- **`draft`** (default saat create): Transaksi tersimpan tapi **tidak masuk kalkulasi** laporan keuangan manapun
- **`posted`**: Transaksi aktif dan **masuk semua kalkulasi** (Income Statement, Balance Sheet, Cash Flow, Budget vs Actual, dll)
- Field `posted_at` menyimpan timestamp kapan transaksi di-posting (NULL saat masih draft)

**Semua hook laporan dan dashboard hanya memproses transaksi `posted`:**

```typescript
// useReportData.ts & useDashboard.ts
const transactions = useMemo(
  () => allTransactions.filter((t) => t.status === 'posted'),
  [allTransactions]
);
```

**Workflow:**
1. User buat transaksi → status `draft` (default)
2. User review dan posting → `updateTransaction(id, { status: 'posted' })` (hanya dari `draft`)
3. Bulk posting tersedia via `createTransactionsBulk()` yang langsung set `status: 'posted'`

**UI:**
- Badge "DRAFT" ditampilkan di `TransactionList` untuk transaksi draft
- `TransactionDetailModal` menampilkan tombol "Post" jika status draft
- `useTransactions` menyediakan `draftCount` untuk badge counter

### 4.4 Flow: Full Transaction Lifecycle

```
                    ┌──────────────┐
                    │  User Input  │
                    └──────┬───────┘
                           │
              ┌────────────▼────────────┐
              │  Client-side Validation  │
              │  (TransactionValidator)  │
              │  • Amount > 0            │
              │  • Different accounts    │
              │  • Valid combination     │
              │  • Normal balance warns  │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │  API: createTransaction  │
              │  (src/lib/api/)         │
              │  • Double-entry rules    │
              │  • Auth check            │
              │  • Account ownership     │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │  Database INSERT         │
              │  • FK to accounts        │
              │  • check_different_accts │
              │  • set_created_by trigger│
              │  • Audit log trigger     │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │  Reports Recalculated   │
              │  (client-side, on fetch)│
              └─────────────────────────┘
```

### 4.5 Audit Trail: `created_by` Enforcement

Sejak migrasi `080_ensure_created_by_transactions.sql` (19 Mei 2026), tabel `transactions` punya trigger `BEFORE INSERT set_created_by()` yang otomatis mengisi `created_by := auth.uid()` jika request datang dari context terautentikasi. Service-role insert tetap diizinkan dengan NOTICE (untuk jalur import/seed yang tidak punya `auth.uid()`). Backfill 937 transaksi lama dengan `created_by IS NULL` ke business manager dijalankan dalam migrasi yang sama. Jika populasi pasca-backfill bersih, constraint `NOT NULL` di-attach.

API route `/api/transactions` juga secara eksplisit mengisi `created_by` sebagai defense-in-depth, sehingga trigger jadi fail-safe untuk jalur lain (RPC, import bulk).

### 4.6 Multi-Currency Fields

Setiap baris transaksi membawa field FX (default IDR 1:1 untuk transaksi domestik):

| Field | Lokasi | Deskripsi |
|-------|--------|-----------|
| `businesses.base_currency_code` | header bisnis | Mata uang fungsional/pelaporan (default `IDR`) |
| `accounts.currency_code` | per akun | Mata uang denominasi akun (kas USD, piutang USD, dll) |
| `transactions.currency_code` | per transaksi | Mata uang sumber transaksi |
| `transactions.original_amount` | per transaksi | Nilai dalam currency sumber |
| `transactions.amount` | per transaksi | Nilai fungsional (= `original_amount × fx_rate`) — semua kalkulasi laporan pakai field ini |
| `transactions.fx_rate` | per transaksi | Kurs saat posting |
| `transactions.fx_rate_date` | per transaksi | Tanggal kurs yang diambil |
| `transactions.fx_gain_loss_amount` | per transaksi | Realisasi gain/loss FX (>0 gain, <0 loss) — diisi RPC `settle_transaction` |
| `journal_lines.currency_code` & `fx_rate` | per baris | Mirror field untuk konsistensi compound entries |

Constraint DB: `currency_code ~ '^[A-Z]{3}$'`, `fx_rate > 0`. Helper di `src/lib/currency.ts` (`SUPPORTED_CURRENCIES`, `normalizeCurrencyFields`, `calculateBaseAmount`, `formatMoney`) dan `src/hooks/useFxRate.ts` (auto-fetch kurs ke `/api/market/fx` dengan cache 5 menit).

---

## 5. Financial Calculations

### 5.1 Category System (Legacy + Current)

Setiap transaksi punya `category` field:

| Category | Arti | Accounting Nature |
|----------|-------|-------------------|
| EARN | Revenue / Pendapatan | Credit to Revenue |
| OPEX | Operating Expense | Debit to Expense |
| VAR | Variable Cost (COGS) | Debit to Expense |
| CAPEX | Capital Expenditure | Debit to Asset (Fixed) |
| TAX | Tax Expense | Debit to Expense |
| FIN | Financing | Debit/Credit to Liability/Equity |

### 5.2 Category Auto-Detection

Logic di `transactionHelpers.ts` → `detectCategory()`:

```
Priority 1: Non-cash account's default_category (skip 1100/1200)
Priority 2: Other account's default_category (fallback)
Priority 3: Account type-based detection:
  ASSET←REVENUE      = EARN
  ASSET←LIABILITY    = FIN  (loan received)
  ASSET←EQUITY       = FIN  (capital injection)
  EXPENSE→ASSET      = OPEX (default expense)
  ASSET→ASSET        = CAPEX (asset purchase, unless default_category set)
  EQUITY→ASSET       = FIN  (owner withdrawal)
  LIABILITY→ASSET    = FIN  (loan payment)
  EXPENSE→LIABILITY  = OPEX (accrued expense)
  LIABILITY→REVENUE  = EARN (unearned revenue recognized)
  REVENUE→LIABILITY  = EARN (deferred revenue received)
  LIABILITY→LIABILITY = FIN  (liability reclassification)
  Fallback           = OPEX
```

### 5.3 Financial Summary

`calculateFinancialSummary()` di `calculations.ts`:

```
grossProfit    = totalEarn - totalVar
netProfit      = totalEarn - totalOpex - totalVar - totalTax - totalInterest - totalDepreciation
```

**PENTING — FIN vs Interest distinction:**
- `totalFin`: Semua transaksi FIN (termasuk equity/liability movements). Digunakan di Cash Flow.
- `totalInterest`: Hanya FIN yang debit ke EXPENSE account (bunga/biaya keuangan). Digunakan di Income Statement & Net Profit.
  - Double-entry: FIN di mana `debit_account.account_type === 'EXPENSE'`
  - Legacy: Semua FIN (backward compatibility)

CAPEX tidak masuk net profit karena bukan expense (beli aset). CAPEX hanya muncul di Cash Flow Statement (investing activities).

**Guard tipe akun pada jalur single double-entry** (audit 2026-06-11 — ACC-H3/H4 + ACC-M1):

| Kategori | Bentuk jurnal | Perlakuan |
|----------|---------------|-----------|
| EARN, Cr REVENUE | Dr Kas/Piutang / Cr Pendapatan | `totalEarn += amount` |
| EARN, Cr non-REVENUE, Dr REVENUE | Retur penjualan (Dr Pendapatan / Cr Kas) | **`totalEarn -= amount`** (contra-revenue) |
| EARN, Cr non-REVENUE lainnya | Settlement piutang (Dr Kas / Cr Piutang) | skip (bukan revenue) |
| OPEX/TAX, Cr EXPENSE | Reimbursement / restitusi (Dr Kas / Cr Beban) | **dikurangkan** dari bucket beban (contra-expense) |
| OPEX/TAX, Dr LIABILITY | Pelunasan beban/pajak akrual (Dr Hutang / Cr Kas) | skip — beban sudah diakui saat akrual |
| OPEX, Dr EXPENSE | Normal/akrual | tambah ke bucket sesuai `resolveExpenseSection()` |

Guard yang sama diterapkan di `extractIncomeStatementLineItems()` (drill-down per akun) —
retur penjualan tampil sebagai baris negatif di akun pendapatan, reimbursement sebagai baris
negatif di akun beban yang dikredit.

**Depresiasi di Dashboard P&L card:** `app/(dashboard)/dashboard/page.tsx` menghitung depresiasi periode (via `calculateDepreciationSummary()` + `applyDepreciationToSummary()`) berdasarkan rentang year/month filter yang aktif, sehingga KPI "PROFIT/LOSS" menampilkan Net Income yang konsisten dengan halaman Income Statement. Periode mengikuti filter: Yearly = 1 Jan – 31 Des, Monthly = 1 – akhir bulan terpilih.

### 5.4 Monthly Grouping

`groupTransactionsByMonth()` mengelompokkan transaksi per bulan dan menghitung per-month:
- earn, opex, var, capex, tax, fin, interest, netProfit
- Interest mengikuti logic yang sama (hanya FIN expense)
- Digunakan oleh Scenario Modeling untuk proyeksi

Sejak audit 2026-06-11 (ACC-H5/H6/M11), fungsi ini **memirror penuh guard
`calculateFinancialSummary`**:
- EARN single double-entry: settlement piutang di-skip, retur penjualan = contra-revenue
  (sebelumnya pelunasan piutang double-count revenue di chart vs IS)
- Baris bunga FIN multi-line masuk **hanya** ke `interest` (else-branch), tidak lagi
  additive ke opex/var/tax — netProfit bulanan tidak lagi mengurangkan beban bunga 2×
- Split COGS/OPEX baris beban multi-line pakai `resolveExpenseSection()` (hormati
  override `income_statement_section`), bukan `default_category` mentah
- OPEX/TAX: reimbursement dikurangkan, pelunasan akrual di-skip (sama dengan 5.3)

### 5.5 ROI & Invested Capital

#### Formula

```
ROI (%)                 = (netProfit / grossInvestedCapital) × 100
remainingCapitalROI (%) = (netProfit / remainingInvestedCapital) × 100
```

Formula sesuai praktik akuntansi standar (Return on Investment). `netProfit` di sini adalah akumulasi all-time, bukan per-period.

#### Invested Capital (`calculateInvestedCapital()`)

```
grossInvestedCapital     = sum kredit ke akun EQUITY ber-flag is_stock=true + fallbackContribution
ownerWithdrawals         = sum debit ke akun EQUITY ber-flag is_stock=true ATAU is_dividend=true
remainingInvestedCapital = max(0, grossInvestedCapital - ownerWithdrawals)
```

**Kenapa `is_stock` muncul di sisi withdrawal?**
Prive/penarikan owner bisa dijurnal dua cara yang sama-sama valid:
- `Dr 3100 Modal Owner (is_stock) / Cr Kas` — langsung kurangi akun modal disetor
- `Dr 3200 Prive (is_dividend) / Cr Kas` — pakai akun kontra ekuitas terpisah

Kode membedakan injeksi vs penarikan **bukan dari flag akun**, melainkan dari **sisi entry**: cek `credit_account` untuk injeksi, cek `debit_account` untuk withdrawal.

#### Fallback `business.capital_investment`

Untuk bisnis lama yang setup capital sebelum sistem double-entry, nilai `businesses.capital_investment` dipakai sebagai fallback. Sistem mendeteksi transaksi "Modal Awal" (nama/deskripsi mengandung "modal investasi awal", "modal awal", "owner capital", "owner's capital") dengan amount yang match — jika ditemukan, fallback **tidak** ditambahkan agar tidak double-count.

#### Tampilan Dashboard

Card ROI di `app/(dashboard)/dashboard/page.tsx` menampilkan:
1. **ROI utama** — % atas `grossInvestedCapital`
2. **Remaining ROI** (jika ada withdrawal) — % atas `remainingInvestedCapital`
3. **Konteks periode** — "Sejak {bulan tahun} · {n} bulan" dihitung dari tanggal transaksi paling awal **atau** dari `business.operations_start_date` jika di-set

Konteks periode wajib agar pembaca tidak salah interpretasi: ROI 50% dalam 3 bulan jauh berbeda dari ROI 50% dalam 5 tahun. Annualized ROI belum diimplementasi.

#### Operating ROI vs Holding-Period Return (`operations_start_date`)

Migrasi `076_add_operations_start_date.sql` menambah kolom `businesses.operations_start_date DATE NULL`. Field ini diatur manager via inline date picker di `/businesses/[id]/config`.

- **Jika `operations_start_date IS NULL`** → ROI dihitung dari tanggal transaksi paling awal (holding-period return). Cocok untuk bisnis yang langsung beroperasi sejak hari pertama.
- **Jika `operations_start_date` di-set** → ROI mode **operating ROI**: dashboard hanya menghitung net profit dari transaksi dengan `date >= operations_start_date`. Label periode juga berubah menjadi "Sejak {operations_start_date} · {n} bulan".

Motivasi: untuk bisnis seperti property/Hillside Studio yang membeli aset berbulan-bulan sebelum mulai menyewa, holding-period return akan terlihat negatif sepanjang fase konstruksi karena ada CAPEX & OPEX tanpa revenue. Operating ROI memberikan denominator periode yang relevan dengan masa operasi aktif. Invested capital (numerator denominator) tetap dihitung kumulatif dari semua transaksi modal (termasuk yang sebelum operasi mulai).

#### Helper

`calculateAverageMonthlyROI(netProfit, capital, months)` = `roi / months` — rata-rata sederhana, **bukan** compound annualized rate. Tidak dipakai di UI saat ini; disediakan untuk konsumen eksternal. Untuk annualized compound: `(1 + roi/100)^(12/months) - 1`.

---

## 6. Balance Sheet Logic

> **Titik Waktu (asOfDate), Bukan Period Range**
> Balance Sheet menggunakan `asOfDate` (titik waktu tunggal), bukan `startDate`/`endDate` range.
> Semua transaksi berstatus `posted` dengan tanggal ≤ `asOfDate` diikutsertakan dalam kalkulasi (kumulatif).
> Ini sesuai PSAK/IFRS: Balance Sheet selalu mencerminkan posisi kumulatif pada tanggal tertentu.
> Default `asOfDate` = hari ini. Dikelola oleh `useBalanceSheet.ts` secara independen (tidak inherit dari `useReportData`).

### 6.1 Dual-Mode Processing

`calculateBalanceSheet()` memproses dua jenis transaksi:

**A. Double-Entry Transactions** (is_double_entry = true)
```
Untuk setiap transaksi:
  Debit side:
    ASSET    → totalAssets += amount, classify into cash/inventory/receivables/fixed
    LIABILITY → totalLiabilities -= amount  (mengurangi hutang)
    EQUITY   → totalEquityDebit += amount   (withdrawal/prive)
    EXPENSE  → totalExpenses += amount
    REVENUE  → totalRevenue -= amount       (retur pendapatan)

  Credit side:
    ASSET    → totalAssets -= amount, classify into cash/inventory/receivables/fixed
    LIABILITY → totalLiabilities += amount  (menambah hutang)
    EQUITY   → totalEquityCredit += amount  (capital injection)
    REVENUE  → totalRevenue += amount
    EXPENSE  → totalExpenses -= amount      (koreksi beban)
```

**B. Legacy Transactions** (is_double_entry = false)

Legacy FIN diklasifikasi per-transaksi menggunakan `classifyLegacyFin()` keyword heuristic:

| Keyword | Tipe | Dampak Balance Sheet |
|---------|------|---------------------|
| modal, setoran, injeksi | `equity` | totalEquityCredit += amount |
| pinjaman, kredit, kpr | `liability_in` | totalLiabilities += amount |
| cicilan, pelunasan, bayar hutang | `liability_out` | totalEquityDebit += amount, cash out |
| bunga, interest | `interest` | expense (cash out), sudah di income statement |
| tidak dikenali | `unknown` | totalLiabilities += amount (konservatif) |

```
// capital hanya disuntik bila belum dibukukan sebagai jurnal ekuitas
capitalAlreadyBooked = (totalEquityCredit > 0 || totalEquityDebit > 0)
legacyCapital = capitalAlreadyBooked ? 0 : capital

netFinCash = equityIn + liabilityIn - cashOut
operatingCash = EARN - OPEX - VAR - TAX
closingCash = legacyCapital + operatingCash - CAPEX + netFinCash

totalCash          = closingCash
totalFixedAssets    = CAPEX
totalAssets         = closingCash + CAPEX
totalLiabilities    = legacyFinLiability (hanya pinjaman masuk)
totalEquityCredit  += legacyCapital + legacyFinEquityIn
totalEquityDebit   += legacyFinEquityOut (prive/cicilan)
```

> **Single capital injection (Issue #24).** `capital_investment` boleh masuk neraca **sekali saja**. Sejak bisnis baru otomatis membukukan transaksi "Modal Investasi Awal" (Dr Kas / Cr Ekuitas) saat dibuat, modal sudah terhitung di jalur double-entry. Bila legacy branch ikut menyuntik `capital` lagi, aset & ekuitas overstated sebesar modal awal (dan neraca tetap _balance_ sehingga sulit terdeteksi). Karena itu legacy branch hanya menyuntik `capital` ketika belum ada pergerakan ekuitas dari double-entry/multi-line (`capitalAlreadyBooked === false`) — konsisten dengan fallback di Section 6.3.

### 6.2 Asset Classification (Double-Entry)

Untuk double-entry transactions, asset di-classify berdasarkan:
- **Cash**: Flag `accounts.is_cash_equivalent = TRUE` (legacy fallback: kode `1100`/`1200`)
- **Fixed Assets**: `default_category === 'CAPEX'`
- **Inventory**: `default_category === 'VAR'`
- **Receivables**: `default_category === 'EARN'`
- **Other Current Assets**: Semua ASSET lainnya

### 6.3 Equity Tracking

```
totalEquityCredit = sum of credit movements to EQUITY accounts (suntik modal)
totalEquityDebit  = sum of debit movements from EQUITY accounts (prive/dividen)
netEquityMovements = totalEquityCredit - totalEquityDebit
```

Fallback: Jika tidak ada equity transactions dari double-entry DAN `capital_investment > 0`, gunakan `capital_investment` dari business settings.

#### Cap Table (Kepemilikan Dinamis)

Fungsi `calculateCapTable(transactions): CapTable` di `src/lib/calculations.ts` membangun **cap table dinamis** dari saldo akun EQUITY ber-flag `is_stock=true`.

```
Untuk setiap akun stock:
  net_kontribusi = sum(credit) - sum(debit)   // net karena penarikan kembali setoran (rare) ikut menyesuaikan

percentage = net_kontribusi / totalContributed × 100
```

Multi-line aware: iterasi `journal_lines` jika `is_multi_line=true`, fallback ke `debit_account`/`credit_account` untuk simple double-entry. Akun ber-flag `is_dividend=true` **sengaja tidak dihitung** — itu distribusi laba, bukan modal disetor.

**Konsumen:**
- **Balance Sheet** (`/balance-sheet`): breakdown per pemilik dengan kolom % di section Ekuitas. Header "Equity (Capital)" clickable → drill-down ke `/statement-of-changes-in-equity`.
- **Dashboard** (`CapTableWidget`): widget di samping AR Tracker, layout 2/3 + 1/3.
- **Statement of Changes in Equity** (`/statement-of-changes-in-equity`): saldo modal per pemilik + rekonsiliasi dividen (Section 23).

> **Catatan: % modal ≠ hak atas laba.** Cap table di atas adalah **% modal disetur**. Sejak migr 094, akun `is_stock` punya kolom `profit_share_pct` (hak atas laba, lepas dari modal) dan `contact_id` (link ke `business_contacts`). Akun `is_dividend` punya `owner_stock_account_id` (menunjuk akun stock pemiliknya). Dipakai SCE — lihat Section 23.

### 6.4 Retained Earnings (Auto-Calculate / Soft Close)

```
retainedEarnings = totalRevenue - totalExpenses - accumulatedDepreciation
totalEquity = netEquityMovements + retainedEarnings
```

> Depreciation dihitung on-the-fly (Section 16), bukan dari jurnal.
> Harus dikurangkan dari retained earnings agar sisi Equity turun seimbang
> dengan sisi Assets yang sudah menggunakan nilai buku (cost - depreciation).

**Model retained earnings = AUTO-CALCULATE, bukan jurnal penutup manual.**
Mengikuti pola QuickBooks/Xero/Wave: sistem menurunkan retained earnings
langsung dari akumulasi (revenue − expense), TIDAK membaca saldo akun "Laba
Ditahan" di CoA. Konsekuensinya:

- Akun Laba Ditahan (`is_retained_earnings` / kode 3200) **tidak diperlukan**
  agar neraca benar. Flag tersebut kini vestigial.
- **Closing entry / jurnal penutup manual DIHAPUS** (per 31 Mei 2026). Halaman
  `/closing-entry` dan `src/lib/accounting/closingEntry.ts` dihapus karena
  bertabrakan dengan model auto-calculate (lihat Section 19).
- `calculateBalanceSheet` **mem-filter** transaksi ber-`meta.entry_type.id ===
  'closing_entry'` di awal fungsi. Ini pengaman agar data closing entry historis
  (yang terlanjur dibuat sebelum fitur dihapus) tidak men-nol-kan revenue/expense
  dan salah-mengklasifikasi laba ke pos Modal/Prive.
- "Close period" yang valid = **Period Lock** (`businesses.closed_until_date`),
  yaitu soft-close: mengunci transaksi lama dari edit/hapus TANPA memindahkan
  saldo apa pun.

### 6.5 Balance Check

```typescript
// Di useBalanceSheet.ts
isBalanced = |totalAssets - (totalLiabilities + totalEquity)| < 0.01
```

---

## 7. Income Statement Logic

### 7.1 Struktur Income Statement (PSAK/IFRS Compliant)

```
Revenue (EARN)
─ Variable Costs / COGS (VAR)
─────────────────────────
= Gross Profit
─ Operating Expenses (OPEX)
─────────────────────────
= EBITDA  (Earnings Before Interest, Tax, Depreciation & Amortization)
─ Beban Penyusutan (totalDepreciation, PSAK 16 straight-line)
─────────────────────────
= Operating Income
─ Financing Costs (totalInterest, bukan totalFin)
─────────────────────────
= EBT (Earnings Before Tax)
─ Tax (TAX)
─────────────────────────
= Net Income
```

**EBITDA & ebitdaMargin** dihitung di `calculateIncomeStatementMetrics()` (`src/lib/calculations.ts`):

```
ebitda       = grossProfit - totalOpex
ebitdaMargin = totalEarn > 0 ? (ebitda / totalEarn) × 100 : 0
```

Kotak EBITDA muncul di halaman Income Statement di antara OPEX dan Beban Penyusutan; hanya ditampilkan kalau ada depreciation (kalau tidak, EBITDA == Operating Income jadi redundant). Juga muncul di waterfall summary di left panel.

**PENTING:** Financing Costs hanya menampilkan `totalInterest` (FIN yang debit EXPENSE account), bukan semua FIN. FIN yang menyentuh LIABILITY/EQUITY (loan received, capital injection, loan repayment) TIDAK masuk income statement.

CAPEX tidak muncul langsung di income statement. Namun, aset tetap yang memiliki setting depreciation akan memunculkan **Beban Penyusutan** di income statement (lihat Section 16). CAPEX tetap muncul di Cash Flow Statement (investing activities).

### 7.2 Margin Calculations

```
Gross Margin     = (grossProfit / totalEarn) × 100
Operating Margin = (operatingIncome / totalEarn) × 100
Net Margin       = (netProfit / totalEarn) × 100
```

### 7.3 Per-Account Breakdown (Multi-line Aware)

Income Statement menampilkan breakdown **per akun** di setiap section, bukan per transaksi. Ini penting karena satu transaksi multi-line bisa mengandung baris di beberapa section sekaligus (misalnya transaksi EARN yang juga mengandung debit ke akun beban/EXPENSE).

**Fungsi utama:** `extractIncomeStatementLineItems()` di `src/lib/calculations.ts`

Untuk setiap transaksi:
- **Multi-line (`is_multi_line`)**: Iterasi `journal_lines`, klasifikasi per line berdasarkan `account.account_type` dan `account.default_category`
- **Simple double-entry**: Klasifikasi berdasarkan `category` + `debit_account` / `credit_account`

**Output**: `IncomeStatementLineItems` — object berisi array `AccountLineItem[]` per section:
- `revenue`: Credit ke REVENUE account (debit ke REVENUE = contra-revenue)
- `cogs`: Debit ke EXPENSE account dengan `default_category === 'VAR'`
- `opex`: Debit ke EXPENSE account (bukan VAR, TAX, atau FIN interest)
- `tax`: Debit ke EXPENSE account dengan `default_category === 'TAX'`
- `interest`: Debit ke EXPENSE account dari transaksi `category === 'FIN'`

Setiap `AccountLineItem` berisi: `accountId`, `accountCode`, `accountName`, `total`, `transactions[]` (source untuk drill-down).

**Contoh:** Transaksi EARN multi-line:
```
Dr 1200 Bank          Rp 628.355  ← ASSET, tidak masuk income statement
Dr 5900 Komisi Platform Rp 21.645  ← EXPENSE → opex
Cr 4200 Short-term Rent Rp 650.000 ← REVENUE → revenue
```
Di income statement, akun 4200 muncul di Revenue section dan akun 5900 muncul di OPEX section.

### 7.4 Period Filtering

Income Statement menggunakan `filterTransactionsByDateRange()` → menunjukkan transaksi **dalam** periode tertentu (bukan kumulatif).

### 7.5 Export

- PDF via `jsPDF` + `jspdf-autotable` — menggunakan `lineItems` untuk breakdown per akun
- Excel via `xlsx` library

### 7.6 User Override: Income Statement Section

User dapat override klasifikasi default COGS vs OPEX per akun expense melalui Config Modal di halaman Income Statement (icon `Settings2` di header panel kanan).

**Kolom DB:** `accounts.income_statement_section` — TEXT, nullable
- `'cost_of_revenue'` → paksa masuk Cost of Revenue
- `'operating_expense'` → paksa masuk Operating Expenses
- `NULL` → pakai default logic (`default_category === 'VAR'` → COGS, else OPEX)

**Helper:** `resolveExpenseSection(account)` di `src/lib/calculations.ts` — dipanggil oleh:
- `calculateFinancialSummary()` — saat akumulasi `totalVar` vs `totalOpex`
- `extractIncomeStatementLineItems()` — saat routing line item ke `cogs` vs `opex` map

**Scope:** Hanya berlaku untuk EXPENSE account non-TAX. TAX dan FIN interest tidak ikut override (punya section terpisah).

**Migration:** `046_add_income_statement_section.sql`

**Komponen UI:** `src/components/reports/IncomeStatementConfigModal.tsx` — 3-panel (COGS | Detail+Controls | OpEx), klik akun → tombol pindah section + reset-to-default. Save via `bulkUpdateIncomeStatementSection()` di `src/lib/api/accounts.ts`.

---

## 8. Cash Flow Logic

### 8.1 Dual-Mode Cash Flow Calculation

Cash flow menggunakan dual-mode: double-entry aware untuk transaksi baru, category-based fallback untuk legacy.

**A. Double-Entry Transactions** — Track actual cash movement:
```
Cash detection: flag `accounts.is_cash_equivalent = TRUE` (DB-driven, sejak migration 071).
  Default 1100/1200 di-backfill TRUE saat migration; bisnis baru via
  create_default_accounts() langsung dapat flag.
  Legacy fallback: kode '1100'/'1200' tetap dianggap kas saat objek Account
  tidak tersedia di scope caller (mis. data import lama).

Untuk setiap transaksi yang menyentuh akun kas/setara kas (flag is_cash_equivalent):

Cash MASUK (debit cash):
  Counter = REVENUE/EXPENSE              → Operating  (+amount)
  Counter = ASSET, trade receivable      → Operating  (+amount)  ← IAS 7.14
  Counter = ASSET, advance/talangan      → Financing  (+amount)
  Counter = ASSET, lainnya               → Investing  (+amount)
  Counter = LIABILITY, operating         → Operating  (+amount)  ← IAS 7.14
  Counter = LIABILITY, lainnya           → Financing  (+amount)
  Counter = EQUITY                       → Financing  (+amount)

Cash KELUAR (credit cash):
  Counter = REVENUE/EXPENSE              → Operating  (-amount)
  Counter = ASSET, trade receivable      → Operating  (-amount)  ← IAS 7.14
  Counter = ASSET, advance/talangan      → Financing  (-amount)
  Counter = ASSET, lainnya               → Investing  (-amount)
  Counter = LIABILITY, operating         → Operating  (-amount)  ← IAS 7.14
  Counter = LIABILITY, lainnya           → Financing  (-amount)
  Counter = EQUITY                       → Financing  (-amount)

Transaksi non-cash (tidak menyentuh akun is_cash_equivalent) → diabaikan
Bank transfer (kedua sisi cash) → net zero, diabaikan
```

**Sub-classification per IAS 7 / PSAK 2:**

Sentralisasi di `src/lib/accounting/classification.ts`. Strategi: **flag-first
dengan heuristic fallback** (sejak migration 085).

Counter ASSET dianggap **trade receivable** (→ Operating) jika:
1. `accounts.is_trade_receivable === TRUE` (DB flag — di-backfill saat migration 085, atau di-set user lewat toggle di AccountForm), ATAU
2. (Fallback heuristic) `default_category === 'EARN'`, ATAU `account_name`
   mengandung salah satu: "piutang usaha", "piutang dagang", "piutang pelanggan",
   "trade receivable", "account(s) receivable"
   — tapi BUKAN talangan/advance.

Counter ASSET dianggap **advance/talangan** (→ Financing) jika:
- TIDAK trade receivable (per aturan di atas), DAN
- `account_name` mengandung "talangan"/"advance", ATAU `default_category === 'FIN'`

Semua ASSET lainnya (fixed asset, inventory, dll) → **Investing**.

Counter LIABILITY dianggap **operating payable** (→ Operating) jika:
1. `accounts.is_operating_payable === TRUE` (DB flag — di-backfill saat migration 085, atau di-set user lewat toggle di AccountForm), ATAU
2. (Fallback heuristic) `default_category` ∈ `{'OPEX','VAR','TAX'}`, ATAU
   `account_name` mengandung "hutang usaha", "utang usaha", "hutang dagang",
   "trade payable", "account(s) payable", atau "accrued"
   — tapi BUKAN pinjaman bank (`default_category='FIN'` + nama
   "pinjaman"/"loan"/"kredit bank"/"hutang bank").

Semua LIABILITY lainnya (pinjaman bank, hutang jangka panjang) → **Financing**.

Counter EQUITY → selalu **Financing** (tidak ada sub-classification).

> **Catatan flag-first**: Untuk bisnis yang memakai nama akun non-standar
> (mis. "Tagihan Pelanggan", "Outstanding Bills"), heuristic fallback tidak
> akan match. User wajib mengaktifkan toggle "Akun Piutang Usaha" /
> "Akun Hutang Operasional" di AccountForm agar klasifikasi Cash Flow benar.

**B. Legacy Transactions** — Category-based fallback:
```
Operating  = EARN - OPEX - VAR - TAX
Investing  = -CAPEX
Financing  = FIN
```

**Hasil akhir:**
```
Net Cash Flow = Operating + Investing + Financing
Opening Balance = sum of ALL net cash movements before startDate
Closing Balance = Opening + Net Cash Flow
```

> **Opening Balance** dihitung dari seluruh transaksi yang menyentuh akun kas/bank
> (1100/1200) **sebelum** periode laporan — bukan hanya dari `capital_investment`.
>
> Logika:
> - Double-entry: Dr Kas = +amount, Cr Kas = -amount (termasuk modal, revenue, OPEX, CAPEX, dll)
> - Legacy: category-based (EARN +, OPEX/VAR/TAX/CAPEX -). FIN diklasifikasi via `classifyLegacyFin()`: equity/liability_in → +, liability_out/interest → -.
> - Jika tidak ada transaksi sebelum periode → fallback ke `capital_investment` dari business settings
> - Jika hanya legacy (tanpa double-entry equity) → `capital + legacy cash movements`
>
> Ini memastikan opening balance benar untuk multi-period/multi-year reporting.

---

## 9. General Ledger Logic

### 9.1 Overview

File: `src/hooks/useGeneralLedger.ts`

General Ledger (Buku Besar) menampilkan per-account ledger dengan running balance. Hanya memproses double-entry transactions.

### 9.2 Transaction Index (Performance Optimization)

`buildTransactionIndex(transactions)` — pre-build index O(n) single pass:

```
Input:  Transaction[]
Output: { index: Map<accountId, Transaction[]>, legacyCount: number }

Single pass:
  - Skip legacy (is_double_entry = false) → increment legacyCount
  - Push to index[debit_account_id] dan index[credit_account_id]

Benefit: calculateAccountLedger() melakukan O(1) lookup per akun
         alih-alih O(n) filter berulang untuk setiap akun
```

Digunakan di `useGeneralLedger` dan `useTrialBalance`.

### 9.3 Account Ledger Calculation

`calculateAccountLedger(account, transactions, txIndex?)`:

```
1. Jika txIndex diberikan: O(1) lookup dari pre-built index + deduplicate
   Jika tidak: fallback filter O(n) (backward compat)

2. Sort ascending by date, then by created_at

3. Untuk setiap transaksi:
   - Tentukan apakah account ini di sisi debit atau credit
   - Hitung running balance berdasarkan normal balance rule:
     DEBIT-normal (ASSET, EXPENSE):  balance += debit - credit
     CREDIT-normal (LIABILITY, EQUITY, REVENUE): balance += credit - debit

4. Return: entries[], totalDebits, totalCredits, closingBalance, legacyCount
```

### 9.4 Account Filtering

- Hanya sub-accounts (parent_account_id != null) yang ditampilkan
- Filter berdasarkan account type: ALL, ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
- allLedgers: Summary semua accounts yang di-filter

### 9.5 Legacy Transaction Handling

Legacy transactions (is_double_entry = false) tidak memiliki account links, jadi mereka dicatat sebagai `legacyCount` tapi tidak muncul di ledger entries. UI menampilkan warning jika ada legacy transactions.

---

## 10. Trial Balance Logic

### 10.1 Overview

File: `src/hooks/useTrialBalance.ts`

Trial Balance (Neraca Saldo) menampilkan semua accounts dengan saldo debit/credit. Menggunakan `calculateAccountLedger()` dari General Ledger.

### 10.2 Calculation

```
Untuk setiap active sub-account:
  1. Hitung ledger via calculateAccountLedger()
  2. Skip jika tidak ada entries (account tidak aktif dalam periode)
  3. Tempatkan closing balance di kolom yang sesuai:

     Normal Balance = DEBIT:
       closingBalance ≥ 0 → debitBalance = closingBalance
       closingBalance < 0 → creditBalance = |closingBalance|  (contra account)

     Normal Balance = CREDIT:
       closingBalance ≥ 0 → creditBalance = closingBalance
       closingBalance < 0 → debitBalance = |closingBalance|  (contra account)

  4. totalDebits = sum of all debitBalance
     totalCredits = sum of all creditBalance
     isBalanced = |totalDebits - totalCredits| < 0.01
```

### 10.3 Sorting

Rows di-sort berdasarkan account_code secara ascending (1100, 1200, ..., 5100, 5200, ...).

---

## 11. Scenario Modeling Logic

### 11.1 Overview

File: `src/hooks/useScenarioModeling.ts`

Scenario Modeling memungkinkan simulasi perubahan asumsi keuangan terhadap baseline aktual.

### 11.2 Baseline

Baseline dihitung dari transaksi aktual dalam periode yang dipilih, **termasuk depreciation** (sama seperti Income Statement):

```
baseSummary    = calculateFinancialSummary(filteredTransactions)
periodDeprec   = calculateDepreciationSummary(accounts, costs, endDate, startDate).periodDepreciation
summary        = applyDepreciationToSummary(baseSummary, periodDeprec)
metrics        = calculateIncomeStatementMetrics(summary)

baseline = {
  revenue:         summary.totalEarn,
  cogs:            summary.totalVar,
  grossProfit:     summary.grossProfit,
  opex:            summary.totalOpex,
  depreciation:    periodDeprec,              ← NEW
  operatingIncome: metrics.operatingIncome,   (sudah include depreciation)
  interest:        summary.totalInterest,
  ebt:             metrics.ebt,
  tax:             summary.totalTax,
  netIncome:       summary.netProfit,
  + margins (gross, operating, net)
}
```

### 11.3 Scenario Assumptions

Setiap skenario memiliki 5 parameter asumsi:

| Parameter | Deskripsi | Satuan |
|-----------|-----------|--------|
| revenueGrowth | Perubahan revenue | % |
| cogsGrowth | Perubahan COGS | % |
| opexGrowth | Perubahan OpEx | % |
| taxRate | Tax rate sebagai % dari EBT | % (0 = gunakan aktual) |
| interestGrowth | Perubahan interest | % |

### 11.4 Scenario Calculation

```
applyScenario(baseline, assumptions):
  revenue         = baseline.revenue × (1 + revenueGrowth/100)
  cogs            = baseline.cogs × (1 + cogsGrowth/100)
  grossProfit     = revenue - cogs
  opex            = baseline.opex × (1 + opexGrowth/100)
  depreciation    = baseline.depreciation            ← FIXED, tidak kena growth
  operatingIncome = grossProfit - opex - depreciation
  interest        = baseline.interest × (1 + interestGrowth/100)
  ebt             = operatingIncome - interest
  tax             = taxRate > 0 ? max(0, ebt × taxRate/100) : baseline.tax
  netIncome       = ebt - tax
```

> **Depreciation tetap konstan** di semua skenario karena bergantung pada aset
> yang sudah dimiliki, bukan proyeksi revenue/expense.

### 11.5 Pre-configured Scenarios

| Skenario | Revenue | COGS | OpEx | Tax | Interest |
|----------|---------|------|------|-----|----------|
| **Optimistic** | +20% | +10% | +5% | 0% | 0% |
| **Pessimistic** | -10% | +15% | +10% | 0% | +5% |
| **Custom** | User-defined | User-defined | User-defined | User-defined | User-defined |

Semua parameter dapat di-adjust via slider (-50% to +50%).

### 11.6 Financial Projections

Proyeksi bulanan berdasarkan rata-rata performa historis:

```
avgRevenue = sum(monthly revenue) / jumlah bulan
avgNet     = sum(monthly net profit) / jumlah bulan

Untuk setiap bulan proyeksi (i = 1..N):
  growthFactor     = (1 + revenueGrowth/100/12)^i
  projectedRevenue = avgRevenue × growthFactor
  projectedNet     = avgNet × growthFactor
  cumulativeNet   += projectedNet
```

Periode proyeksi: 3, 6, atau 12 bulan ke depan.

---

## 12. Quick Transaction Resolver

### 12.1 Bagaimana Sistem Menentukan Debit/Credit

File: `src/lib/utils/quickTransactionHelper.ts`

```
User memilih SATU akun, system menentukan sisi:

Money OUT (Debit Selected, Credit Cash):
  • EXPENSE accounts          → Bayar beban
  • EQUITY "prive"/"drawing"/"dividen" → Penarikan pemilik
  • ASSET non-cash (≠1100/1200) → Beli aset

Money IN (Debit Cash, Credit Selected):
  • REVENUE accounts          → Terima pendapatan
  • LIABILITY accounts        → Terima pinjaman
  • EQUITY (non-prive)        → Suntik modal
```

### 12.2 Default Cash Account Selection

```
Filter: ASSET sub-account dengan flag is_cash_equivalent (atau kode legacy 1100/1200).
Priority: code 1200 (Bank) → code 1100 (Cash) → first cash-equivalent by sort_order
```

Sejak migration 071, deteksi tidak lagi tergantung kode akun spesifik — bisnis yang
pakai CoA custom (mis. 1101 Kas Besar, 1210 BCA) bisa tandai akun via toggle
"Akun Kas / Setara Kas" di Chart of Accounts.

### 12.3 Account Filtering untuk Quick Add

`getQuickAddAccounts()` mengecualikan:
- Parent accounts (tanpa parent_account_id)
- Inactive accounts
- Semua akun kas/setara kas (flag `is_cash_equivalent` ATAU kode legacy 1100/1200) — mereka jadi counter-account otomatis
- Akun piutang/receivable/talangan/advance — termasuk ASSET dengan `default_category === 'EARN'` (trade receivable). Akun-akun ini memerlukan kontrol debit/kredit manual, sehingga hanya bisa digunakan via **Full Double-Entry** atau **Multi-line Journal**.

### 12.4 Template Transaksi (`transaction_templates`)

Template menyimpan pola transaksi yang sering dipakai agar bisa dimuat ulang. Tabel `transaction_templates`, API `src/lib/api/transactionTemplates.ts`, type `TransactionTemplate`.

**Dua jenis template:**

| Jenis | Kolom yang dipakai | Dibuat dari |
|-------|--------------------|-------------|
| Single-line | `debit_account_id` + `credit_account_id` + `default_amount` | Quick/single-line form (Journal Entry & `/transactions`) |
| Multi-baris | `journal_lines` JSONB `[{ account_id, debit_amount, credit_amount, description, sort_order }]` (migr 093) | Mode multi-baris di Journal Entry |

**Perilaku saat memuat (`applyTemplate` di `app/(dashboard)/transactions/journal-entry/page.tsx`):**
- Jika `journal_lines` ada (≥2 baris) → form otomatis masuk mode multi-baris dan **mengganti seluruh baris** dengan isi template. Baris tetap bisa di-edit / dihapus / ditambah sebelum disimpan (template = titik awal, bukan kunci).
- Jika tidak → perilaku single-line lama (set debit/kredit + jumlah default).

**Catatan UI:**
- "Simpan sebagai Template" & "Gunakan Template" tersedia di kedua mode (single-line & multi-baris) di Journal Entry. Saat menyimpan dari multi-baris, field single-line (`debit_account_id`/`credit_account_id`/`default_amount`) di-set NULL.
- Item template multi-baris di dropdown menampilkan badge "N baris".
- Form single-line di `/transactions` (`TransactionForm`) **menyaring** template multi-baris dari daftar karena tidak punya UI multi-baris.

---

## 13. Matching Principle & Inventory (COGS)

### 13.1 Overview

File: `src/lib/accounting/guidance/matchingPrincipleWarning.ts`

Setelah user mencatat transaksi EARN (penjualan), sistem mendeteksi apakah perlu entry tambahan untuk HPP (Harga Pokok Penjualan) sesuai Matching Principle.

### 13.0 InventoryPicker — Link Penjualan ke Stok

Saat mencatat transaksi EARN, user dapat memilih stok/inventory yang terjual via `InventoryPicker` component. Stok yang dipilih disimpan di `meta.sold_stock_ids` (JSONB) pada transaksi EARN.

```
TransactionDetailModal:
  → Baca meta.sold_stock_ids
  → Tampilkan "Persediaan yang Terjual" — daftar transaksi stok terkait
  → Jika sold_stock_ids ada dan terisi: banner matching principle TIDAK ditampilkan
  → Jika sold_stock_ids kosong/tidak ada: banner warning ditampilkan
```

**COGS vs Inventory di Income Statement:**

| Kondisi transaksi VAR | Perlakuan |
|----------------------|-----------|
| `debit_account.account_type === 'ASSET'` | **Inventory purchase** — TIDAK masuk COGS, TIDAK masuk Income Statement |
| `debit_account.account_type === 'EXPENSE'` | **COGS** — masuk VAR di Income Statement |

Logic ini diterapkan di `calculations.ts` (`calculateFinancialSummary`, `groupTransactionsByMonth`) dan `useIncomeStatement.ts`.

### 13.2 Trigger Conditions

Warning ditampilkan jika **semua** kondisi terpenuhi:
1. Transaksi kategori `EARN`
2. Transaksi double-entry dengan credit account = REVENUE
3. Credit account bukan inventory account
4. Business memiliki inventory account di CoA (menunjukkan bukan service business)

### 13.3 Detection Logic

```
isInventoryAccount(account):
  - account_type === 'ASSET'
  - default_category === 'VAR'
  - ATAU nama mengandung: persediaan, inventory, stok, barang, bahan

detectMatchingPrincipleWarning(transaction, allAccounts):
  → Cek trigger conditions
  → Cari inventory account di CoA
  → Cari COGS/expense account (keyword: cogs, hpp, harga pokok, cost of, biaya pokok)
  → Return warning dengan journal hint: "Debit: HPP | Credit: Persediaan"
```

### 13.4 Kapan TIDAK Ditampilkan

- Bukan transaksi EARN
- Bukan double-entry
- Credit account adalah inventory (sudah handle inventory)
- Tidak ada inventory account di CoA (service business)

---

## 14. Receivable Settlement (Pelunasan Piutang)

### 14.1 Overview

File: `src/lib/accounting/guidance/receivableSettlement.ts`

Ketika transaksi EARN mencatat piutang (Dr Piutang / Cr Pendapatan), piutang tersebut belum menghasilkan kas. Sistem menyediakan mekanisme pelunasan (settlement) yang menciptakan entry pembalik.

### 14.2 Deteksi Piutang

`isReceivableTransaction(transaction)` — **cek struktur multi-line DULU, baru double-entry single-line**:
```
1. Jika is_multi_line && journal_lines ada:
     return ada baris dengan debit_amount > 0 yang akunnya = receivable

2. Else jika is_double_entry:
     return isAnyReceivableAccount(debit_account)

3. Else → FALSE
```

> **Urutan cabang penting (Issue #25).** Transaksi multi-line punya `is_double_entry = TRUE`
> setelah diedit (RPC `update_multi_line_transaction` mem-promote-nya, lihat §3.2), **tapi**
> `debit_account`/`credit_account`-nya NULL karena akun tersimpan di `journal_lines`. Jika cabang
> `is_double_entry` dicek lebih dulu, detector membaca akun NULL → return FALSE → tombol pelunasan
> hilang setelah edit. Karena itu cabang `is_multi_line` **harus** dicek lebih dulu. Pola yang sama
> berlaku untuk `isTradeReceivableTransaction` dan `isPayableTransaction`.

Trade vs talangan (untuk `isTradeReceivableTransaction`, dipakai AR aging & invoice):
```
Trade receivable (piutang usaha) jika akun ASSET dan:
  - is_trade_receivable === true (flag-first), ATAU
  - default_category === 'EARN', ATAU nama mengandung "piutang usaha"/"receivable"
  - DAN nama TIDAK mengandung "talangan"/"advance"

Piutang Talangan (advance/FIN) → bukan trade receivable
  - default_category === 'FIN' atau nama mengandung "talangan"/"advance"
  - Kategori transaksi settlement: FIN (bukan EARN)
  - Tetap bisa dilunasi via isReceivableTransaction (ANY receivable)
```

### 14.2b Outstanding Amount (net, bukan gross)

`getOutstandingAmount(transaction)`:
```
1. Jika sudah lunas (settled_by_transaction_id) → 0
2. Jika ada meta.remaining_amount (partial) → remaining_amount
3. Else → getReceivableLineAmount(transaction)
```

`getReceivableLineAmount(transaction)` — **net piutang, bukan header amount**:
```
- Multi-line: Σ (debit_amount − credit_amount) pada baris akun receivable saja
              (fallback ke transaction.amount kalau tak ada baris receivable)
- Single double-entry: transaction.amount (baris piutang = seluruh amount)
```

> **Kenapa net, bukan header amount (Issue #26).** Pada penjualan OTA multi-line, `transaction.amount`
> = total debit = **gross revenue** (mis. 1.200.000), sedangkan yang menjadi piutang & akan masuk kas
> hanyalah **baris akun piutang** (net diterima, mis. 969.563) — baris beban komisi/biaya/pajak sudah
> memotong gross di muka. Settlement harus melunasi net, bukan gross.

### 14.3 Settlement Entry

`buildSettlementPrefill(original)` menghasilkan entry pelunasan dengan membalik debit/credit:

```
Original (pencatatan piutang):
  Dr Piutang (ASSET)  / Cr Pendapatan (REVENUE)

Settlement (pelunasan):
  Dr Kas/Bank (ASSET) / Cr Piutang (ASSET)
  category: EARN
  status: posted
  meta.settlement_of_transaction_id = original.id
```

Setelah settlement di-save, transaksi piutang asli ditandai:
```
meta.settled_by_transaction_id = settlement.id
```

### 14.4 Tracking di TransactionMeta

| Field | Deskripsi |
|-------|-----------|
| `meta.settled_by_transaction_id` | ID transaksi pelunasan (di piutang asli) |
| `meta.settlement_of_transaction_id` | ID piutang asli (di entry pelunasan) |
| `meta.sold_stock_ids` | ID stok yang terjual (di EARN) |
| `meta.tags` | Tag kategori bebas untuk filter |
| `meta.attachment` | Dokumen sumber (faktur, nota, kuitansi) — path, url, filename, size, mime_type |

### 14.5 Dampak ke Laporan

- **Balance Sheet**: Piutang asli menambah ASSET (piutang). Settlement memindahkan dari piutang ke kas — net ASSET tetap sama.
- **Cash Flow**: Piutang asli TIDAK muncul (non-cash). Settlement (Dr Kas / Cr Piutang) muncul sebagai **Operating (+)** karena counter-account piutang dikenali sebagai trade receivable (per IAS 7.14 sub-classification: `default_category='EARN'` atau nama mengandung "piutang"/"receivable").
- **Income Statement**: Revenue sudah diakui saat piutang dicatat. Settlement TIDAK menambah revenue lagi.

### 14.6 Dividend Settlement (Pelunasan Dividen)

File: `src/lib/accounting/guidance/dividendSettlement.ts`

Mirror dari receivable settlement, tapi untuk dividen yang di-declare (commitment) lalu dibayar terpisah.

**Penanda Akun (persistent flags di tabel `accounts`):**
- `is_dividend BOOLEAN` — menandai akun EQUITY sebagai Dividen / Prive / Drawing
- `is_dividend_payable BOOLEAN` — menandai akun LIABILITY sebagai Hutang Dividen (partial unique index: max 1 per bisnis)

User mengaktifkan flag ini lewat toggle di **AccountForm** (Chart of Accounts → Edit Akun).

**Dua Mode Pencatatan Dividen:**

| Mode | Jurnal | Kapan dipakai |
|------|--------|---------------|
| **Cashout langsung** | Dr Dividen / Cr Kas/Bank | Penarikan tunai langsung tanpa formal declaration |
| **Declare** (commitment) | Dr Dividen / Cr Hutang Dividen | RUPS putuskan bagi dividen tapi belum bayar |
| **Pay** (lunasi declaration) | Dr Hutang Dividen / Cr Kas/Bank | Bayar dividen yang sudah di-declare |

**Trigger Popup `DividendEntryModeModal`:**
- **QuickTransactionForm**: saat user pilih akun dengan `is_dividend=true` di dropdown kategori
- **Journal Entry (`/transactions/journal-entry`)**: saat user pilih akun dengan `is_dividend=true` sebagai Akun Debit (terutama via entry type `tarik_dividen`)

Kalau akun Hutang Dividen belum ada di CoA, opsi **Declare** disabled dengan instruksi user untuk membuat akun LIABILITY dan mengaktifkan toggle di Chart of Accounts.

**Detection di TransactionDetailModal:**
```
isDividendDeclaration(transaction) = true jika:
  - is_double_entry = true
  - debit_account.account_type = 'EQUITY' AND is_dividend = true
  - credit_account.account_type = 'LIABILITY' AND is_dividend_payable = true
```

Kalau true, render section "Pelunasan Dividen" dengan dua tombol:
- **Bayar Dividen Penuh** → `handleSettleDividend` → `Dr Hutang Dividen / Cr Bank`, mark settled via `meta.settled_by_transaction_id`
- **Bayar Sebagian** → `handlePartialSettleDividend` → push ke `meta.partial_settlements[]` + decrement `meta.remaining_amount`

**Reuse meta fields yang sama dengan receivable settlement:**
- `meta.settled_by_transaction_id`, `meta.settlement_of_transaction_id`
- `meta.partial_settlements[]`, `meta.remaining_amount` *(Catatan: jika `remaining_amount` tidak ada pada data legacy, sistem otomatis menghitung sisa tagihan secara real-time dari total `partial_settlements` baik di sisi client maupun server RPC).*

**Dampak ke Laporan:**
- **Cashout langsung**: Equity berkurang, Kas berkurang (1 langkah)
- **Declare**: Equity berkurang, Liability bertambah (Income Statement & Balance Sheet langsung kena)
- **Pay setelah declare**: Liability berkurang, Kas berkurang — Equity TIDAK kena lagi (sudah berkurang saat declare)

### 14.7 Soft Delete dan Settlement Meta Cleanup
Sejak migrasi `108_cleanup_deleted_settlements_meta`, apabila user menghapus (soft delete) transaksi pelunasan melalui UI atau API, sistem database secara otomatis membersihkan jejak pelunasan tersebut dari transaksi asalnya.
- Jika pelunasan penuh dihapus: `meta.settled_by_transaction_id` akan dicabut dari tagihan asal, mengubah statusnya kembali menjadi belum lunas.
- Jika pelunasan parsial dihapus: ID transaksi dihapus dari `meta.partial_settlements`, dan `meta.remaining_amount` pada tagihan asal dikembalikan sebesar nilai pelunasan yang dihapus.

⚠️ **Common pitfall yang dicegah**: Kalau user pakai pola lama (Dr Dividen / Cr Bank) untuk pay setelah declare, equity akan berkurang 2× dan Hutang Dividen tetap tertinggal di neraca selamanya. Flow declare → pay yang benar adalah `Dr Hutang Dividen / Cr Bank`.

### 14.7 FX Gain/Loss saat Settlement (Multi-Currency)

Sejak migrasi 079, pelunasan piutang/hutang dalam mata uang asing dilakukan via RPC `settle_transaction(p_original_id, p_settlement_data, p_actual_base_amount, p_settlement_amount)`. RPC menghitung selisih kurs antara saat piutang/hutang dicatat (kurs historis) dan saat dilunasi (kurs spot):

```
v_fx_gain_loss =
  v_actual_base_amount - v_settlement_amount   (piutang)
  v_settlement_amount - v_actual_base_amount   (hutang)
```

Hasil ditulis ke `transactions.fx_gain_loss_amount` (>0 gain, <0 loss). RPC otomatis menambahkan baris journal:

- `v_fx_gain_loss > 0` → tambah baris `Cr 4200 FX Gain` ke entry settlement
- `v_fx_gain_loss < 0` → tambah baris `Dr 5400 FX Loss` ke entry settlement

Kalau akun 4200/5400 belum ada di bisnis, RPC akan raise exception (akun seharusnya di-provision otomatis oleh migrasi 079 untuk semua bisnis baru maupun lama).

**Contoh piutang USD yang menguat saat dilunasi:**
```
Asli (1 Mar):     Dr Piutang USD 1.000 (Rp 15.500.000) / Cr Revenue (Rp 15.500.000)   @ kurs 15.500
Settlement (1 Apr): Dr Bank IDR 16.000.000 / Cr Piutang USD (Rp 15.500.000)            @ kurs 16.000
                    Cr 4200 FX Gain Rp 500.000
```

Hasil: revenue tetap di Rp 15.500.000 (sesuai accrual basis saat transaksi), gain kurs Rp 500.000 muncul sebagai REVENUE line FX Gain di income statement, bukan inflate revenue operasional.

---

## 15. Budget & Forecast Logic

### 15.1 Overview

Files:
- `src/lib/calculations.ts` (fungsi kalkulasi)
- `src/hooks/useBudget.ts` (hook)
- `src/lib/api/budgets.ts` (data access)

Budget memungkinkan user menetapkan target per akun per bulan, lalu membandingkan dengan realisasi (actuals) dari transaksi posted.

### 15.2 Budget Structure

```
Budget
├── id, name, status (draft|approved|locked)
├── start_date, end_date
└── BudgetLine[] (one per account per month)
    ├── account_id (REVENUE atau EXPENSE leaf account)
    ├── month (YYYY-MM-01)
    └── amount (target)
```

### 15.3 Actual Computation

`computeActualsByAccountAndMonth(transactions, accounts)`:

```
1. Filter hanya transaksi status = 'posted'
2. Untuk setiap transaksi:
   - Catat amount ke debit account+month dan credit account+month
3. Combine berdasarkan normal_balance:
   - DEBIT normal (ASSET, EXPENSE): actual = debits - credits
   - CREDIT normal (LIABILITY, EQUITY, REVENUE): actual = credits - debits
4. Return Map<"accountId:YYYY-MM", amount>
```

### 15.4 Budget vs Actual (Variance Analysis)

`calculateBudgetVsActual(budgetLines, transactions, accounts)`:

```
Untuk setiap budget line:
  actual = lookup dari actuals map

  Variance semantics:
    Revenue: variance = actual - budgeted  (positif = favorable)
    Expense: variance = budgeted - actual  (positif = favorable / under budget)

  variancePercent = (variance / budgeted) × 100
```

### 15.5 Summary KPIs

`calculateBudgetSummaryKPI(rows, budget)`:

```
Agregasi:
  totalBudgetedRevenue, totalActualRevenue
  totalBudgetedExpense, totalActualExpense

  revenueVariance = actualRevenue - budgetedRevenue
  expenseVariance = budgetedExpense - actualExpense

  burnRate = totalActualExpense / monthsElapsed
  budgetUtilization = totalActual / totalBudget × 100
```

### 15.6 Trend Projection

`projectBudgetTrend(budgetLines, transactions, accounts, projectionMonths)`:

```
1. Hitung trend factor = rata-rata (actual / budget) untuk bulan lampau
2. Untuk setiap bulan:
   - Past: projected = actual (sudah terjadi)
   - Current: blend actual progress dengan budget × trend factor
   - Future: projected = budget × trend factor
```

### 15.7 Relevant Accounts

Budget hanya untuk **leaf accounts** bertipe REVENUE atau EXPENSE (bukan parent accounts). Ini konsisten dengan prinsip bahwa budgeting dilakukan di level akun operasional.

---

## 16. Depreciation — Straight-Line (PSAK 16 / IAS 16)

### 16.1 Overview

File: `src/lib/accounting/depreciation.ts`

Aset tetap (CAPEX) didepresiasi menggunakan metode **straight-line** berdasarkan metadata yang disimpan di tabel `accounts`. Depreciation dihitung **on-the-fly** saat render laporan — BUKAN sebagai jurnal manual ke database.

### 16.2 Database Fields (Migration 026)

Kolom tambahan di tabel `accounts` (hanya relevan untuk ASSET + `default_category = 'CAPEX'`):

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `useful_life_months` | INTEGER | Masa manfaat dalam bulan |
| `residual_value` | NUMERIC (default 0) | Nilai residu setelah masa manfaat habis |
| `depreciation_method` | TEXT (default 'straight_line') | Metode penyusutan |
| `acquisition_date` | DATE | Tanggal perolehan aset |

### 16.3 Formula Straight-Line

```
monthlyDepreciation = (cost - residualValue) / usefulLifeMonths
effectiveReportDate = min(reportDate, today)   ← capped ke hari ini, tidak maju ke masa depan
monthsElapsed = (bulan dari acquisitionDate sampai effectiveReportDate) + 1   ← full-month convention
                 (capped di usefulLifeMonths)
accumulatedDepreciation = monthlyDepreciation × monthsElapsed
bookValue = cost - accumulatedDepreciation (min = residualValue)
```

**Penting**: `reportDate` di-cap ke hari ini (`today`) sehingga depresiasi bulan-bulan yang belum terjadi **tidak dihitung**. Jika filter periode = "Tahun Ini" (end date = 31 Des), hanya bulan Jan–Mei yang masuk (misalnya saat ini = Mei 2026).

**Konvensi full-month (audit 2026-06-11, ACC-H7)**: bulan akuisisi dihitung sebagai
**bulan ke-1** — aset langsung menyusut penuh di bulan perolehan. Konvensi ini identik
antara akumulasi (Neraca) dan beban periode (Laba Rugi, yang sejak awal memakai
`getMonthsElapsed + 1`). Sebelumnya akumulasi memakai bulan akuisisi = bulan 0, sehingga
IS dan Neraca selisih tepat 1 bulan depresiasi per aset dan net income tidak pernah
tie-out ke ΔLaba Ditahan selama ada aset tetap.

**Cost** dihitung dari total transaksi CAPEX yang mendebit akun tersebut (net debit balance).

### 16.4 Eligibility

Akun eligible untuk depreciation jika memenuhi SEMUA:
- `account_type === 'ASSET'`
- `default_category === 'CAPEX'`
- `is_active === true`
- `useful_life_months > 0` (terisi)
- `acquisition_date` terisi

Jika tidak eligible → depreciation = 0, backward compatible.

### 16.5 Dampak ke Laporan

**Balance Sheet** (`calculateBalanceSheet()`):
```
Aset Tetap:
  Nilai Perolehan (cost)                Rp XXX
  Akumulasi Penyusutan                  (Rp YYY)  ← contra-asset
  ──────────────────────────
  Nilai Buku Aset Tetap                Rp ZZZ

Total Assets menggunakan nilai buku (net), bukan cost.
Retained Earnings dikurangi akumulasi penyusutan.
→ Balance sheet tetap balanced: ΔAssets = ΔEquity (via retained earnings)
```

**Income Statement** (`useIncomeStatement` + `applyDepreciationToSummary()`):
```
  Operating Expenses (OPEX)
  Beban Penyusutan                      (Rp AAA)  ← periode saja
  ──────────────────────────
  = Operating Income (sudah dikurangi penyusutan)

periodDepreciation = monthlyDepreciation × jumlah bulan dalam periode laporan
netProfit = totalEarn - totalOpex - totalVar - totalTax - totalInterest - totalDepreciation
```

**Cash Flow** — TIDAK berubah. Depreciation adalah non-cash expense.

### 16.6 Suggested Useful Life

| Jenis Aset | Masa Manfaat | Sumber |
|------------|-------------|--------|
| Kendaraan | 96 bulan (8 tahun) | PSAK 16 / pajak |
| Peralatan Kantor | 48 bulan (4 tahun) | PSAK 16 / pajak |
| Bangunan | 240 bulan (20 tahun) | PSAK 16 / pajak |
| Furniture | 48 bulan (4 tahun) | PSAK 16 / pajak |
| Mesin | 96 bulan (8 tahun) | PSAK 16 / pajak |

### 16.7 UI

Form input depreciation settings tersedia di `AccountForm.tsx` — hanya muncul jika `account_type = 'ASSET'` dan `default_category = 'CAPEX'`. Fields:
- Tanggal Perolehan
- Masa Manfaat (bulan)
- Nilai Residu (Rp)

### 16.8 Fixed Asset Cost Source

`useIncomeStatement` dan `useScenarioModeling` membangun map biaya akun aset tetap via helper `buildFixedAssetCostMap(transactions)` di `src/lib/calculations.ts`. Helper ini memproses **legacy double-entry** (`debit_account` / `credit_account`) **DAN multi-line journal entries** (`journal_lines`) — sama seperti `calculateBalanceSheet`. Ini penting agar aset yang dibuat lewat journal entry multi-line tetap menghasilkan Beban Penyusutan di Income Statement.

---

## 17. Validation Layers

### 17.1 Three-Layer Validation

```
Layer 1: Client-side (TransactionValidator)
  → Instant feedback di form
  → Indonesian language messages
  → Warnings untuk unusual patterns

Layer 2: API-side (app/api/transactions/)
  → Double-entry account pair validation
  → Auth check & role check
  → Period lock check: transaksi di periode terkunci ditolak (HTTP 423)

Layer 3: Database (PostgreSQL Constraints & Triggers)
  → transactions_account_rules: context-aware per tipe transaksi
    - is_multi_line=true → debit/credit account HARUS NULL (pakai journal_lines)
    - is_double_entry=true → debit/credit account WAJIB terisi dan BERBEDA
    - legacy (keduanya false) → NULL diizinkan (backward compat)
  → journal_line_one_side_nonzero: tepat satu sisi > 0 per baris
  → trg_check_journal_balance (CONSTRAINT TRIGGER, DEFERRABLE INITIALLY DEFERRED):
    - Total debit = total credit per transaction_id (tolerance 0.01)
    - Minimal 2 baris per multi-line journal entry
    - Hanya enforce untuk is_multi_line=true
    - DEFERRABLE agar batch INSERT tidak gagal prematur (fire saat COMMIT)
  → FK constraints ke accounts table
  → RLS policies per business
```

### 17.1.1 Period Lock Enforcement

`businesses.closed_until_date DATE` menyimpan batas periode terkunci. Aturan:
- **POST** `/api/transactions`: tolak jika `date <= closed_until_date`
- **PUT** `/api/transactions/[id]`: tolak jika `transaction.date <= closed_until_date`
- **DELETE** `/api/transactions/[id]`: tolak jika `transaction.date <= closed_until_date`
- HTTP response status: **423 Locked**
- Error message: "Periode hingga {date} sudah dikunci..."

UI:
- Ikon kunci amber menggantikan tombol Edit/Hapus pada baris transaksi yang terkunci
- Badge "s/d YYYY-MM-DD" pada BusinessCard
- Tombol kunci (ikon gembok) di header BusinessCard → buka modal `PeriodLockManager`
- Hanya `business_manager` atau `both` yang dapat mengatur/membuka kunci periode

### 17.2 Client Validation Details

`TransactionValidator.validate()`:

| Check | Type | Message |
|-------|------|---------|
| amount ≤ 0 | Error | "Jumlah harus lebih dari 0" |
| debit = credit | Error | "Akun debit dan kredit tidak boleh sama" |
| Invalid combination | Error | "Kombinasi akun tidak valid" |
| Revenue di debit | Warning | "Mendebit pendapatan akan mengurangi..." |
| Expense di credit | Warning | "Mengkredit beban akan mengurangi..." |

### 17.3 Smart Warnings

Sistem memberikan warning kontekstual:
- **Capital sebagai Revenue**: "Jika ini setoran modal, gunakan akun Ekuitas"
- **Withdrawal sebagai Expense**: "Jika ini penarikan pribadi, gunakan akun Prive"
- **Revenue di-debit**: "Ini biasanya untuk koreksi atau retur penjualan"

### 17.4 Category Consistency Warnings

`validateCategoryConsistency()` di `transactionValidator.ts` mendeteksi ketidakcocokan antara category yang dipilih user dengan account type pair. Warning ditampilkan di UI journal entry (amber banner) tapi **tidak memblokir** transaksi.

| Account Type Pair | Expected Category | Warning jika salah |
|---|---|---|
| ASSET ← LIABILITY | FIN | "Transaksi pinjaman biasanya menggunakan FIN" |
| ASSET ← EQUITY | FIN | "Setoran modal biasanya menggunakan FIN" |
| ASSET ← REVENUE | EARN | "Pendapatan biasanya menggunakan EARN" |
| EXPENSE → ASSET | OPEX/VAR/TAX | "Pembayaran beban biasanya OPEX, VAR, atau TAX" |
| EXPENSE → LIABILITY | OPEX/VAR/TAX | "Beban terutang biasanya OPEX, VAR, atau TAX" |
| LIABILITY → ASSET | FIN | "Pembayaran hutang biasanya FIN" |
| EQUITY → ASSET | FIN | "Penarikan modal biasanya FIN" |
| ASSET → ASSET | CAPEX/VAR | "Pembelian aset biasanya CAPEX atau VAR" |

**PENTING**: Ini hanya warning, bukan error. Income statement tetap mengandalkan category as-is. Jika user mengabaikan warning dan salah pilih category, income statement akan terdampak tapi balance sheet tetap benar (karena balance sheet menggunakan account types, bukan categories).

### 17.5 Transaction Pattern Detection

15 pola transaksi yang dikenali dari keyword di nama transaksi (via `detectPatternFromName()` di `transactionPatterns.ts`):

| Pattern | Keywords | Debit | Credit |
|---------|----------|-------|--------|
| Suntik Modal | modal, setoran, investasi pemilik | ASSET | EQUITY |
| Terima Pendapatan | sewa, rental, pendapatan | ASSET | REVENUE |
| Terima Pinjaman | pinjaman, kredit, kpr | ASSET | LIABILITY |
| Bayar OPEX | listrik, gaji, internet, maintenance | EXPENSE | ASSET |
| Bayar Variable Cost | cleaning, supplies, komisi | EXPENSE | ASSET |
| Beli Aset | beli + furniture/komputer/ac/kendaraan | ASSET | ASSET |
| Bayar Hutang | cicilan, pelunasan, bayar hutang | LIABILITY | ASSET |
| Bayar Pajak | pajak, pph, pbb | EXPENSE | ASSET |
| Penarikan Prive/Dividen | prive, dividen, dividend, pribadi, penarikan | EQUITY | ASSET |
| Retur Pendapatan | (via account type match) | REVENUE | ASSET |
| Penggantian Biaya | (via account type match) | ASSET | EXPENSE |
| Beban Terutang | terutang, accrued, belum dibayar | EXPENSE | LIABILITY |
| Realisasi Pendapatan Dimuka | (via entry type selection) | LIABILITY | REVENUE |
| Pendapatan Diterima Dimuka | diterima dimuka, deposit, uang muka | ASSET | LIABILITY |
| Reklasifikasi Hutang | reklasifikasi, reclassif | LIABILITY | LIABILITY |

---

## 18. Category-to-Report Matrix (Cross-Category Summary)

Tabel ini memetakan setiap kategori transaksi — **termasuk sub-tipe** — ke dampaknya di setiap laporan keuangan. Informasi ini sebelumnya tersebar di Section 5-8 dan 12-13. Section ini menjadi referensi cepat satu halaman.

### 18.1 Master Matrix

| Kategori | Sub-tipe | Debit | Credit | Income Statement | Balance Sheet | Cash Flow |
|----------|----------|-------|--------|------------------|---------------|-----------|
| **EARN** | Pendapatan tunai | ASSET (Kas/Bank) | REVENUE | `totalEarn` → Revenue (top line) | +Cash, +Revenue → Retained Earnings | Operating (+) |
| **EARN** | Realisasi pendapatan dimuka | LIABILITY | REVENUE | `totalEarn` → Revenue | -Liability, +Revenue → Retained Earnings | Tidak ada cash movement |
| **EARN** | Pelunasan piutang (settlement) | ASSET (Kas/Bank) | ASSET (Piutang) | **TIDAK MASUK** (revenue sudah diakui saat piutang) | +Cash, -Piutang (tukar aset) | **Operating (+)** ← IAS 7.14: trade receivable |
| **EARN** | Retur pendapatan | REVENUE | ASSET (Kas/Bank) | Mengurangi `totalEarn` | -Cash, -Revenue → Retained Earnings | Operating (-) |
| **OPEX** | Bayar tunai | EXPENSE | ASSET (Kas/Bank) | `totalOpex` → Operating Expenses | -Cash, +Expenses → kurangi Retained Earnings | Operating (-) |
| **OPEX** | Beban akrual | EXPENSE | LIABILITY | `totalOpex` → Operating Expenses | +Liability, +Expenses → kurangi Retained Earnings | **Tidak masuk** (non-cash) |
| **OPEX** | Bayar hutang usaha (settlement) | LIABILITY (Hutang Usaha) | ASSET (Kas/Bank) | **TIDAK MASUK** (expense sudah diakui saat akrual) | -Cash, -Liability | **Operating (-)** ← IAS 7.14: trade payable |
| **VAR** | **HPP / COGS** (Dr EXPENSE) | EXPENSE | ASSET (Kas/Bank) | `totalVar` → Cost of Goods Sold | -Cash, +Expenses → kurangi Retained Earnings | Operating (-) |
| **VAR** | **Beli Persediaan** (Dr ASSET) | ASSET (Inventory) | ASSET (Kas/Bank) | **TIDAK MASUK** (tetap di neraca) | -Cash, +Inventory | Investing (-) |
| **CAPEX** | Beli aset tetap | ASSET (Fixed) | ASSET (Kas/Bank) | **TIDAK MASUK** | -Cash, +Fixed Assets (tukar aset, total sama) | Investing (-) |
| **DEPR** | Beban Penyusutan (on-the-fly) | — | — | `totalDepreciation` → Operating Expenses (di bawah OPEX) | -Fixed Assets (contra-asset), -Retained Earnings | **Tidak masuk** (non-cash expense) |
| **TAX** | Bayar pajak | EXPENSE | ASSET (Kas/Bank) | `totalTax` → Tax Expense | -Cash, +Expenses → kurangi Retained Earnings | Operating (-) |
| **FIN** | **Suntik Modal** (Cr EQUITY) | ASSET (Kas/Bank) | EQUITY | **TIDAK MASUK** | +Cash, +Equity (modal disetor) | Financing (+) |
| **FIN** | **Prive / Dividen** (Dr EQUITY) | EQUITY | ASSET (Kas/Bank) | **TIDAK MASUK** | -Cash, -Equity (penarikan pemilik) | Financing (-) |
| **FIN** | **Terima Pinjaman** (Cr LIABILITY) | ASSET (Kas/Bank) | LIABILITY | **TIDAK MASUK** | +Cash, +Liability | Financing (+) |
| **FIN** | **Bayar Pinjaman** (Dr LIABILITY) | LIABILITY | ASSET (Kas/Bank) | **TIDAK MASUK** | -Cash, -Liability | Financing (-) |
| **FIN** | **Beban Bunga** (Dr EXPENSE) | EXPENSE | ASSET / LIABILITY | `totalInterest` → Financing Costs | +Expenses → kurangi Retained Earnings | Operating (-) |
| **FIN** | **Piutang Talangan** (Dr ASSET, `default_category='FIN'`) | ASSET (Talangan) | ASSET (Kas/Bank) | **TIDAK MASUK** (bukan pendapatan) | -Cash, +Piutang Talangan (tukar aset) | **Financing (-)** |
| **FIN** | **Pelunasan Talangan** (Cr ASSET, `default_category='FIN'`) | ASSET (Kas/Bank) | ASSET (Talangan) | **TIDAK MASUK** | +Cash, -Piutang Talangan | **Financing (+)** |
| **FIN** | Reklasifikasi hutang | LIABILITY | LIABILITY | **TIDAK MASUK** | Net zero (pindah antar liability) | **Tidak masuk** (non-cash) |

> **Catatan deteksi trade receivable / operating payable** (untuk klasifikasi Cash Flow): Sejak migration 085, klasifikasi dipakai dari flag eksplisit `accounts.is_trade_receivable` (ASSET) dan `accounts.is_operating_payable` (LIABILITY), dengan fallback ke heuristic nama akun + `default_category`. Detail di [Section 8](#8-cash-flow-logic). Helper terpusat di [`src/lib/accounting/classification.ts`](../src/lib/accounting/classification.ts).

### 18.2 Kategori dengan Split (Sub-tipe)

Tiga kategori memiliki perilaku berbeda tergantung **tipe akun** yang di-debit/credit:

#### VAR Split — Inventory vs COGS

```
VAR + Dr ASSET (Persediaan)  → Pembelian stok → TIDAK masuk Income Statement
VAR + Dr EXPENSE (HPP)       → Harga Pokok Penjualan → MASUK Income Statement

Konversi: Saat penjualan (EARN), stok yang dipilih via InventoryPicker
          diubah dari Dr Persediaan (ASSET) → Dr HPP (EXPENSE)
          Dilacak via meta.sold_stock_ids
```

Deteksi di `calculateFinancialSummary()`:
```typescript
case 'VAR':
  if (t.is_double_entry && t.debit_account?.account_type === 'ASSET') {
    break; // Inventory purchase — skip from income statement
  }
  summary.totalVar += amount; // COGS — masuk income statement
```

#### FIN Split — Interest vs Non-Interest

```
FIN + Dr EXPENSE  → Beban bunga → MASUK Income Statement (totalInterest)
FIN + Dr/Cr lain  → Modal/Hutang/Prive → TIDAK masuk Income Statement
```

Deteksi di `calculateFinancialSummary()`:
```typescript
case 'FIN':
  summary.totalFin += amount; // Semua FIN → untuk Cash Flow
  if (t.is_double_entry && t.debit_account?.account_type === 'EXPENSE') {
    summary.totalInterest += amount; // Hanya bunga → untuk Income Statement
  }
```

**Dampak ke formula:**
```
netProfit = totalEarn - totalOpex - totalVar - totalTax - totalInterest - totalDepreciation
                                                          ↑ bukan totalFin
```

#### EQUITY Split — Modal vs Prive/Dividen

Di **Balance Sheet**, EQUITY di-track terpisah:

```
Cr EQUITY → totalEquityCredit (suntik modal masuk)
Dr EQUITY → totalEquityDebit  (prive/dividen keluar)

totalEquity = (totalEquityCredit - totalEquityDebit) + retainedEarnings
            = netEquityMovements + (totalRevenue - totalExpenses - accumulatedDepreciation)
```

Di **Quick Entry**, arah transaksi ditentukan dari **keyword nama akun**:

```
EQUITY + nama mengandung "prive" / "drawing" / "dividen" / "dividend"
  → Dr EQUITY / Cr Kas  → Uang KELUAR (penarikan pemilik)

EQUITY lainnya (modal, setoran, investasi, dsb)
  → Dr Kas / Cr EQUITY  → Uang MASUK (suntik modal)
```

Di **Cash Flow**, keduanya masuk bucket **Financing**:
```
Dr Kas / Cr EQUITY  → Financing (+)  — modal masuk
Dr EQUITY / Cr Kas  → Financing (-)  — prive keluar
```

### 18.3 Quick Entry — Perilaku Per Tipe Akun

| Tipe Akun Dipilih | Keyword Khusus | Resolusi | Label UI | Arah Kas | Kategori |
|---|---|---|---|---|---|
| REVENUE | — | Dr Kas / Cr Revenue | "Uang Masuk" | IN | EARN |
| EXPENSE | — | Dr Expense / Cr Kas | "Uang Keluar" | OUT | OPEX* |
| EXPENSE | `default_category='VAR'` | Dr Expense / Cr Kas | "Uang Keluar" | OUT | VAR |
| EXPENSE | `default_category='TAX'` | Dr Expense / Cr Kas | "Uang Keluar" | OUT | TAX |
| ASSET (non-kas) | — | Dr Asset / Cr Kas | "Beli Aset" | OUT | CAPEX |
| ASSET (non-kas) | `default_category='VAR'` | Dr Asset / Cr Kas | "Beli Aset" | OUT | VAR |
| LIABILITY | — | Dr Kas / Cr Liability | "Terima Pinjaman" | IN | FIN |
| EQUITY | `prive/drawing/dividen` | Dr Equity / Cr Kas | "Penarikan Prive" | OUT | FIN |
| EQUITY | lainnya | Dr Kas / Cr Equity | "Suntik Modal" | IN | FIN |

*\*EXPENSE tanpa `default_category` = OPEX (fallback default)*

### 18.4 Formula Ringkasan

```
┌─────────────────────────────────────────────────────────┐
│                   INCOME STATEMENT                       │
│                                                         │
│  Revenue (EARN)                                         │
│  - COGS (VAR, dr EXPENSE only)                          │
│  ─────────────────────────────                          │
│  = Gross Profit                                         │
│  - Operating Expenses (OPEX)                            │
│  - Beban Penyusutan (PSAK 16, on-the-fly)               │
│  ─────────────────────────────                          │
│  = Operating Income                                     │
│  - Interest (FIN, dr EXPENSE only)                      │
│  ─────────────────────────────                          │
│  = EBT (Earnings Before Tax)                            │
│  - Tax (TAX)                                            │
│  ─────────────────────────────                          │
│  = Net Income                                           │
│                                                         │
│  TIDAK MASUK: CAPEX, VAR(inventory), FIN(modal/hutang)  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    BALANCE SHEET                          │
│                                                         │
│  Assets = Cash + Inventory + Fixed Assets + Other        │
│  Liabilities = Hutang                                    │
│  Equity = (Modal - Prive) + Retained Earnings            │
│         = (ΣCr EQUITY - ΣDr EQUITY)                     │
│           + (Revenue - Expenses - Acc. Depreciation)     │
│                                                         │
│  CHECK: |Assets - (Liabilities + Equity)| < 0.01        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    CASH FLOW                              │
│                                                         │
│  Operating  = EARN - OPEX - VAR(cogs) - TAX - Interest   │
│             + Pelunasan Piutang (trade receivable)        │
│             - Bayar Hutang Usaha (trade payable)          │
│  Investing  = -CAPEX - VAR(inventory) ± aset non-cash    │
│  Financing  = +Modal + Pinjaman - Bayar Hutang Bank      │
│             - Prive                                      │
│  ─────────────────────────────                          │
│  Net Cash Flow = Operating + Investing + Financing       │
│  Closing = Opening + Net Cash Flow                       │
│                                                         │
│  Sub-classification (IAS 7 / PSAK 2):                    │
│    Counter ASSET → Operating jika piutang usaha          │
│                  → Investing jika lainnya                 │
│    Counter LIABILITY → Operating jika hutang usaha       │
│                      → Financing jika lainnya             │
└─────────────────────────────────────────────────────────┘
```

---

## 19. Audit Findings & Known Issues

### All Previously Reported Issues — RESOLVED

| Issue | Description | Status | Fixed |
|-------|-------------|--------|-------|
| #1 | CAPEX dalam Net Profit | RESOLVED | Net profit formula: `EARN - OPEX - VAR - TAX - totalInterest` |
| #2 | Label EBITDA Misleading | RESOLVED | Label diganti "OPERATING INCOME" |
| #3 | EBIT Includes CAPEX | RESOLVED | EBIT dihapus, Operating Income → EBT → Net Income |
| #4 | Legacy FIN Math.abs | RESOLVED | Menggunakan raw value, bukan Math.abs |
| #5 | Revenue Debit di Balance Sheet | RESOLVED | Handle REVENUE debit dan EXPENSE credit |
| #6 | detectCategory Priority Salah | RESOLVED | Cash/Bank accounts di-skip saat priority check |
| #7 | Legacy FIN selalu masuk totalInterest | RESOLVED | Hanya keyword "bunga"/"interest" yang masuk interest (via `isInterestKeyword`) |
| #8 | calculateInitialCapital range 1200 = Bank | RESOLVED | Diganti `default_category === 'CAPEX'` |
| #9 | detectCategory EXPENSE hardcode OPEX | RESOLVED | Deteksi kode akun: 52xx→VAR, 53xx→TAX, sisanya OPEX |
| #10 | Legacy FIN semua masuk totalLiabilities | RESOLVED | `classifyLegacyFin()` heuristik: equity/liability_in/liability_out/interest |
| #11 | Legacy FIN opening balance selalu +amount | RESOLVED | Opening balance menggunakan `classifyLegacyFin()` untuk arah cash |
| #7 | Fixed Asset Code Range Fragile | RESOLVED | Logic berbasis account_type, bukan hardcoded range |
| #8 | Cash Flow Tidak Double-Entry Aware | RESOLVED | Dual-mode: double-entry + category fallback |
| #9 | Inventory Purchase Masuk COGS | RESOLVED | VAR + debit ASSET = inventory, di-skip dari Income Statement |
| #10 | Account Code Keluar Range (e.g. 6000) | RESOLVED | Smart auto-code generation: selalu dalam range parent |
| #11 | RLS Infinite Recursion | RESOLVED | SECURITY DEFINER functions: `get_my_business_ids()`, `is_business_manager()` |
| #12 | Creator Bisnis Tidak Terlihat di Members | RESOLVED | `getBusinessMembers()` fetch `created_by` dari tabel `businesses` jika tidak ada di `user_business_roles` |
| #13 | Non-Creator Bisa Klik Edit Bisnis | RESOLVED | Tombol Edit/Archive/Restore hanya muncul jika `created_by === user.id` |
| #14 | Views bypass RLS (SECURITY DEFINER default) | RESOLVED | Migration 021: Recreate semua views dengan `security_invoker = true` |
| #15 | Cash Flow: Piutang usaha masuk Investing | RESOLVED | Sub-classification per IAS 7: trade receivable → Operating, trade payable → Operating |
| #16 | Tidak ada depreciation untuk aset tetap | RESOLVED | Straight-line depreciation (PSAK 16) on-the-fly — Section 16 |
| #17 | Cash Flow Opening Balance hanya pakai capital | RESOLVED | Multi-year aware: hitung dari semua cash movements sebelum startDate |
| #18 | Scenario Modeling baseline tidak include depreciation | RESOLVED | Baseline include periodDepreciation, constant di scenarios |
| #19 | Docs: Retained Earnings formula tidak include depreciation | RESOLVED | Code sudah benar, docs diupdate: `retainedEarnings = revenue - expenses - accumulatedDepreciation` |
| #20 | VAR-Inventory double-count di dashboard charts (Monitoring, ExpenseBreakdown, KPI sparkline, avgMonthlyExpense) | RESOLVED | Lihat detail di bawah |
| #21 | Label UI `is_stock` ambigu (stock = inventory atau saham?) + DB tidak proteksi flag salah lokasi | RESOLVED | Lihat detail di bawah |
| #22 | Trade Receivable/Payable detection via keyword heuristic (fragile) | RESOLVED | Migration 085 — flag `is_trade_receivable` & `is_operating_payable` di tabel `accounts`. Helper `src/lib/accounting/classification.ts` flag-first dengan heuristic fallback. Toggle eksplisit di AccountForm. |
| #23 | Closing entry manual merusak presentasi ekuitas Balance Sheet | RESOLVED | Lihat detail di bawah |
| #24 | `capital_investment` double-count di Neraca saat data legacy bercampur dgn transaksi modal otomatis | RESOLVED | Legacy branch hanya menyuntik `capital` bila ekuitas belum dibukukan dari double-entry/multi-line. Lihat detail di bawah |
| #25 | Tombol pelunasan (settlement) hilang setelah transaksi piutang/hutang multi-line diedit | RESOLVED | Detector `is*Transaction` mengecek cabang `is_double_entry` lebih dulu, padahal multi-line punya `is_double_entry=TRUE` + akun NULL. Urutan dibalik: cek `is_multi_line` dulu. Lihat detail di bawah |
| #26 | Outstanding/settlement amount piutang multi-line memakai header `amount` (gross), bukan baris piutang (net) | RESOLVED | Client: `getOutstandingAmount` hitung net debit baris receivable via `getReceivableLineAmount`. **Server (migr 100):** RPC `settle_transaction` kini hitung `v_outstanding` net dari `journal_lines` untuk multi-line — sebelumnya gross → settlement multi-line ditolak/over-book. Lihat detail di bawah |
| #27 | Batch fix audit 2026-06-11: IS tidak tie-out ke Neraca (retur, reimbursement, akrual, depresiasi off-by-one), chart bulanan double-count, settlement payable gross, salah pilih akun piutang penjualan campuran | RESOLVED | Lihat detail di bawah (ACC-H1–H7, ACC-M1, ACC-M11) + hardening keamanan migr 102 |

### Issue #27 — Batch fix audit menyeluruh 11 Juni 2026 (ACC-H1–H7 + ACC-M1/M11 + SEC)

**Sumber**: `docs/AUDIT_2026-06-11.md`. Tema utama: beberapa pola transaksi yang valid &
terdokumentasi membuat **Income Statement tidak tie-out dengan Neraca** tanpa memicu alarm
(Neraca tetap self-balancing). Semua fix di bawah dikerjakan 12 Juni 2026.

| ID Audit | Fix |
|----------|-----|
| ACC-H3 | Retur penjualan single double-entry (Dr Pendapatan / Cr Kas, kategori EARN) kini `totalEarn -= amount` (contra-revenue) di `calculateFinancialSummary` & `extractIncomeStatementLineItems`, bukan tertelan guard settlement |
| ACC-H4 | Reimbursement (Dr Kas / Cr Beban, kategori OPEX) kini mengurangi bucket beban (sesuai `resolveExpenseSection` akun yang dikredit), bukan menambah |
| ACC-M1 | Pelunasan beban/pajak akrual manual (Dr LIABILITY / Cr Kas, kategori OPEX/TAX) di-skip dari IS — beban sudah diakui saat akrual; restitusi pajak (Cr EXPENSE, kategori TAX) jadi contra |
| ACC-H5 | `groupTransactionsByMonth` case EARN kini pakai guard credit-REVENUE yang sama dengan summary — pelunasan piutang tidak lagi double-count revenue di chart/sparkline/proyeksi skenario |
| ACC-H6 | Baris bunga FIN multi-line di chart bulanan kini else-branch (hanya `interest`), tidak lagi additive ke opex/var/tax → netProfit bulanan tidak mengurangkan bunga 2× |
| ACC-M11 | Split COGS/OPEX bulanan multi-line pakai `resolveExpenseSection()` (hormati override `income_statement_section`) |
| ACC-H7 | Konvensi bulan depresiasi disamakan: akumulasi (Neraca) kini `getMonthsElapsed + 1` (bulan akuisisi = bulan 1, full-month), identik dengan beban periode (IS) — lihat Section 16.3 |
| ACC-H1 | Sisi payable dapat perlakuan #26: helper baru `getPayableLineAmount`/`getPayableOutstandingAmount` (net credit baris LIABILITY, support `remaining_amount`); dipakai AP aging & `buildPayableSettlementPrefill` — lihat Section 22.2 |
| ACC-H2 | `getReceivableAccountId`/`getSettlementCategory` kini filter `isAnyReceivableAccount`, bukan "baris debit ASSET pertama" — penjualan campuran (Dr Bank + Dr Piutang) tidak lagi membuat jurnal pelunasan Dr Bank / Cr Bank |
| SEC-H1/L1/L2 | Migr 102: `create/update_multi_line_transaction` kembali ke `SECURITY INVOKER` + `SET search_path = public` (regresi migr 098); helper RLS `get_my_business_ids`/`is_business_manager` di-pin search_path; write policy `financial_summary_cache` kini manager-only (`is_business_manager`) — investor tidak bisa poison cache (cache write client bersifat fire-and-forget jadi UI investor aman) |
| SEC-M1 | `/api/sync/push` kini menegakkan period-lock (`closed_until_date`) di jalur created/updated/deleted + whitelist field via `createTransactionSchema`/`updateTransactionSchema` (hindari mass-assignment) |
| SEC-M2 | Allowlist skema URL link omni-channel (http/https/tel/mailto) di Zod kedua route link + scheme-guard render `safeLinkUrl()` (`src/lib/utils/urlSafety.ts`) di `OmnichannelLinks`/`OmnichannelLinkCards` — netralkan stored XSS `javascript:`/`data:` di halaman publik `/[slug]` |

Temuan audit yang **masih OPEN** (Medium/Low): ACC-M2–M10, M12–M14, ACC-L1–L7,
SEC-L3–L8 — lihat `docs/AUDIT_2026-06-11.md` untuk status terkini.

### Issue #26 — Outstanding piutang multi-line salah ambil gross (header amount), bukan net (baris piutang)

**Gejala**: Pada penjualan via OTA (Booking.com) yang dicatat multi-line — Dr Piutang (net diterima)
+ Dr beban komisi/biaya/pajak / Cr Pendapatan (gross) — tombol pelunasan **mem-prefill amount =
gross** (mis. 1.200.000) padahal piutang riil & kas yang akan masuk hanya **net** (mis. 969.563).
Akibatnya settlement meng-overstate kas masuk di Bank dan meng-overclear Piutang Usaha (saldo
piutang bisa jadi negatif/understated). Income statement tidak terpengaruh (revenue & beban sudah
diakui penuh di transaksi asli; settlement hanya Dr Bank / Cr Piutang), tapi **Neraca & Cash Flow**
salah.

**Akar masalah**: `getOutstandingAmount()` me-return `transaction.amount`. Untuk transaksi
multi-line, `amount` = total debit header (= gross revenue), **bukan** nilai baris akun piutang.

**Fix**: Tambah `getReceivableLineAmount(transaction)` yang, untuk multi-line, menjumlahkan net
`debit_amount - credit_amount` pada baris-baris akun receivable saja (fallback ke header amount bila
tak ada baris receivable terdeteksi). `getOutstandingAmount()` memakai helper ini. Single double-entry
tidak berubah (baris piutang = seluruh amount). Semua konsumen (settlement prefill, AR aging, invoice
picker, detail modal) ikut benar karena lewat `getOutstandingAmount()`. File:
`src/lib/accounting/guidance/receivableSettlement.ts`. Test: `tests/unit/settlementDetection.test.ts`.

> **Koreksi data historis (Hillside Studio)**: 4 settlement OTA yang sudah terlanjur tercatat gross
> dikoreksi ke net (Salsa/Lina 443.000→366.361, Nicholas 520.000→430.040, Marsha 1.200.000→969.563).
> Transaksi pajak gabungan 3 order April (26.758) yang sebelumnya salah Cr ke Piutang Usaha diperbaiki
> menjadi Cr Bank (pajak dipotong di muka oleh Booking dari transfer). Hasil rekonsiliasi: saldo
> Piutang Usaha = 732.722 (sisa 1 order belum lunas), net Bank April = 1.136.004 ≈ mutasi bank riil
> 1.136.005 (selisih Rp1 pembulatan).

**Lanjutan — fix sisi server (migr 100, 11 Juni 2026)**: Fix di atas hanya menyentuh **client**.
RPC server `settle_transaction` (migr 079) masih menghitung `v_outstanding` dari
`COALESCE(meta->>'remaining_amount', v_original.amount)` — untuk multi-line, `v_original.amount` =
header (gross). Karena client mengirim outstanding **net** sebagai `p_outstanding_amount`, sync-check
`ABS(p_outstanding_amount - v_outstanding) > 0.01` **raise exception** → pelunasan piutang multi-line
(net≠gross) **mustahil** lewat tombol; bila `p_outstanding_amount` dikirim NULL, server melunasi di
**gross** (regresi ke bug #26 asli). Ditemukan saat audit menyeluruh 11 Juni 2026 (temuan ACC-C1).

**Fix**: Migration 100 (`100_fix_settle_transaction_multiline_net_outstanding.sql`) me-`CREATE OR
REPLACE` `settle_transaction` — body identik dengan migr 079 kecuali blok `v_outstanding`:
1. `meta.remaining_amount` ada → pakai itu (partial settlement, sama seperti client).
2. `is_multi_line` → `SUM(debit_amount - credit_amount)` baris akun PIUTANG dari `journal_lines`
   (kondisi "any receivable account" = replika `isAnyReceivableAccount()` di
   `src/lib/accounting/classification.ts`: `is_trade_receivable` OR `default_category ∈ {FIN,EARN}` OR
   nama match), fallback ke header amount bila tak ada baris piutang. **Kedua sumber kebenaran ini
   (SQL ↔ TS) wajib dijaga sinkron** — drift = sync-check menolak settlement valid lagi.
3. single double-entry → header amount (tak berubah).
Tetap `SECURITY INVOKER` + `SET search_path = public`. Catatan: sisi hutang (payable) belum dapat
perlakuan serupa (lihat temuan ACC-H1) dan FX gain/loss multi-line tetap di luar lingkup fix ini.

### Issue #25 — Tombol pelunasan hilang setelah edit transaksi multi-line

**Gejala**: Transaksi piutang usaha multi-line (mis. penjualan via OTA: Dr Piutang + beberapa
baris beban / Cr Pendapatan) menampilkan tombol **Pelunasan** saat baru dibuat, tetapi tombol
tersebut **hilang setelah transaksi diedit**.

**Akar masalah**: Inkonsistensi flag antar RPC pada `is_double_entry`:
- `create_multi_line_transaction` (migr 082) menyimpan multi-line dengan `is_double_entry = FALSE`.
- `update_multi_line_transaction` (migr 095) mem-promote/menulis ulang dengan `is_double_entry = TRUE`
  (dan `debit_account_id`/`credit_account_id` = NULL, karena akun ada di `journal_lines`).

Detector `isReceivableTransaction` / `isTradeReceivableTransaction` / `isPayableTransaction`
mengecek cabang `if (is_double_entry)` **lebih dulu**. Untuk multi-line pasca-edit, cabang ini
menang dan membaca `debit_account`/`credit_account` yang NULL → return `false` → bagian settlement
di `TransactionDetailModal` tidak dirender (`isReceivableTransaction(transaction) && onSettleReceivable`).

**Fix**: Balik urutan cabang di ketiga detector — cek `is_multi_line && journal_lines` **lebih dulu**,
baru fallback ke `is_double_entry` single-line. `is_multi_line` adalah diskriminator struktural yang
benar (selalu TRUE untuk jurnal multi-baris, terlepas dari nilai `is_double_entry`). Tidak ada
perubahan RPC/DB sehingga blast radius minimal. File:
`src/lib/accounting/guidance/receivableSettlement.ts`, `payableSettlement.ts`.
Regression test: `tests/unit/settlementDetection.test.ts`.

> **Catatan**: `isDividendDeclaration` (dividendSettlement.ts) hanya punya cabang single-line dan
> dividend declaration tidak dibuat sebagai multi-line, jadi tidak terdampak. Inkonsistensi flag
> `is_double_entry` antara create/update RPC dibiarkan apa adanya karena seluruh konsumen lain
> sudah memakai guard `&& !is_multi_line` (lihat `calculations.ts`, `useArApAging.ts`).

### Issue #24 — Capital double-count (legacy branch + auto "Modal Investasi Awal")

**Gejala**: Bisnis yang dibuat dengan `capital_investment > 0` otomatis dibuatkan transaksi
double-entry "Modal Investasi Awal" (Dr Kas / Cr Ekuitas) di `POST /api/businesses`. Jika
bisnis tersebut **juga** punya transaksi legacy (`is_double_entry=false AND is_multi_line=false`),
maka legacy branch di `calculateBalanceSheet` ikut menyuntik `capital` (dari `capital_investment`)
ke kas & ekuitas — padahal modal yang sama sudah dihitung di jalur double-entry. Akibatnya
**aset dan ekuitas overstated sebesar modal awal**. Karena double-count simetris di kedua sisi,
neraca tetap _balance_ (`|aset − (liab+ekuitas)| < 0.01`) sehingga tidak tertangkap balance check.

**Tingkat keparahan aktual**: latent. DB saat ini zero-legacy (semua transaksi double-entry /
multi-line), jadi legacy branch adalah dead code dari sisi data dan **tidak ada bisnis yang
terdampak**. Namun jalur tetap bisa terpicu di masa depan karena form `mode='full'` masih dapat
membuat transaksi legacy (tanpa pilih akun) dan `createTransactionSchema` masih `is_double_entry.default(false)`.

**Fix**: Legacy branch menghitung `capitalAlreadyBooked = totalEquityCredit > 0 || totalEquityDebit > 0`
(dievaluasi **setelah** loop double-entry + multi-line), lalu hanya menyuntik
`legacyCapital = capitalAlreadyBooked ? 0 : capital`. Ini menghilangkan double-count (Scenario:
ada auto-transaksi modal) **tanpa** menimbulkan under-count (Scenario: ada legacy txn tapi modal
belum pernah dibukukan sebagai jurnal). Aturan ini konsisten dengan fallback Section 6.3.

### Issue #23 — Closing entry manual merusak Balance Sheet (jurnal penutup dihapus)

**Gejala**: Sebelum klik "Tutup Buku", neraca menampilkan Laba Ditahan (mis. Rp20jt
hasil revenue − expense) dengan benar. Setelah menjalankan jurnal penutup di halaman
`/closing-entry`, baris Laba Ditahan jadi **0**, dan laba Rp20jt-nya nyasar: Modal
disetor membengkak sebesar pendapatan bruto dan muncul "Dividen" palsu sebesar total
beban. Total ekuitas tetap balance, tapi breakdown-nya ngaco secara akuntansi.

**Root cause**: ada **dua mekanisme retained earnings yang bertabrakan**:
- *Implisit/auto-calculate* — `calculateBalanceSheet` menurunkan RE dari `revenue −
  expense` dan TIDAK pernah membaca saldo akun Laba Ditahan.
- *Eksplisit/ledger* — jurnal penutup (`closingEntry.ts`) memindahkan saldo
  Revenue/Expense ke akun EQUITY ber-flag `is_retained_earnings`.

`calculateBalanceSheet` mengklasifikasi murni by `account_type`: credit EQUITY →
Modal, debit EQUITY → Prive. Jurnal penutup (Dr Revenue/Cr RE dan Dr RE/Cr Expense)
karena itu men-nol-kan revenue/expense (RE implisit → 0) sekaligus menumpuk laba ke
pos Modal & Prive. Income Statement (digerakkan `category`, closing entry ber-kategori
FIN) tidak ikut ter-nol → IS dan Neraca jadi tidak konsisten.

**Resolusi** (31 Mei 2026): pilih **satu** model = auto-calculate (pola
QuickBooks/Xero/Wave), pensiunkan jurnal penutup manual.
- Hapus halaman `/closing-entry` + link nav + `src/lib/accounting/closingEntry.ts`.
- `calculateBalanceSheet` mem-filter transaksi `meta.entry_type.id === 'closing_entry'`
  di awal fungsi → data closing entry historis menjadi harmless, neraca kembali benar.
- Period Lock (`closed_until_date`) tetap dipertahankan sebagai "soft close" yang valid.
- Akun Laba Ditahan di CoA + flag `is_retained_earnings` kini vestigial (lihat Section 6.4).

### Issue #20 — VAR-Inventory double-count: dashboard-wide

**Gejala**: Pada bisnis dengan inventory flow (F&B, retail), beberapa visualisasi dashboard menampilkan angka expense yang **inflated** karena pembelian inventory dihitung sebagai expense bersama dengan HPP recognition (double-count). Akibatnya:
- **MonitoringChart**: garis Expenses selalu di atas garis Revenue, terlihat seakan bisnis selalu rugi.
- **ExpenseBreakdownChart**: akun ASSET seperti "Persediaan Bahan Baku" muncul sebagai expense terbesar (padahal bukan expense, itu aset di balance sheet).
- **Sparkline KPI di dashboard**: tren bulanan expense membesar palsu.
- **avgMonthlyExpense**: jumlah bulan yang dihitung pembagi rata-rata jadi ikut salah (count bulan termasuk bulan yang cuma ada pembelian stok).

**Root cause**: VAR punya dua sub-tipe yang berbeda secara akuntansi (lihat [Section 18.2 — VAR Split](#var-split--inventory-vs-cogs)):
- **VAR + Debit ASSET** (kode 1310 Persediaan Bahan Baku) = pembelian persediaan → transfer kas ke aset, **bukan** expense.
- **VAR + Debit EXPENSE** (kode 52xx HPP) = pengakuan HPP saat barang terjual → expense riil di Income Statement.

`calculateFinancialSummary()` ([calculations.ts:216-219](../src/lib/calculations.ts#L216-L219)) dan `calculateMonthlyData()` ([calculations.ts:673-680](../src/lib/calculations.ts#L673-L680)) **sudah benar** (skip VAR + debit ASSET), tetapi banyak chart/aggregator di komponen UI ditulis ulang dengan pola `category === 'VAR'` tanpa memeriksa debit account type — terjadi drift kecil-kecil yang akumulasinya merusak banyak dashboard.

**Files yang diperbaiki** (semua menambahkan guard yang sama):
- [src/components/charts/MonitoringChart.tsx:114, 138-140](../src/components/charts/MonitoringChart.tsx#L114) — line chart Revenue vs Expenses
- [src/components/charts/ExpenseBreakdownChart.tsx:50](../src/components/charts/ExpenseBreakdownChart.tsx#L50) — donut chart Expense Breakdown
- [app/(dashboard)/dashboard/page.tsx:132](../app/\(dashboard\)/dashboard/page.tsx#L132) — sparkline KPI `monthlySeries`
- [app/(dashboard)/dashboard/page.tsx:290](../app/\(dashboard\)/dashboard/page.tsx#L290) — counter `expenseMonths` untuk `avgMonthlyExpense`

**Pattern fix** (konsisten di semua tempat):

```ts
// Skip pembelian inventory (VAR + debit ASSET) — bukan expense, masuk balance sheet
if (
  t.category === 'VAR' &&
  t.is_double_entry &&
  t.debit_account?.account_type === 'ASSET'
) return; // atau: continue / else-if-skip, tergantung struktur loop
```

**Verifikasi** (data Kopi Nusantara, Mei 2026):
- Expense breakdown sebelum: Rp 1.354jt (mengandung Rp 479jt pembelian inventory yang seharusnya tidak ada)
- Expense breakdown setelah: Rp 879jt = COGS Rp 419jt + OPEX Rp 455jt + TAX Rp 5jt → match dengan Income Statement.
- Margin ROI 79% (sebelumnya tampak "loss" di chart, padahal P&L sehat).

**Lesson**: Setiap kali ada chart/aggregator baru yang merangkum kategori VAR, **harus konsisten dengan `calculateFinancialSummary()`** — jangan ulangi pattern "sum semua VAR" tanpa membedakan debit account type. Audit periodik: `grep -rn "category === 'VAR'"` untuk menemukan drift baru.

### Issue #21 — Label UI `is_stock` ambigu + tidak ada proteksi flag salah lokasi

**Gejala**: Akun ASSET seperti "Persediaan Bahan Baku" bisa salah di-flag `is_stock=true` (lewat seed/SQL langsung). Akibatnya `calculateInvestedCapital()` menghitung pembelian persediaan sebagai *capital injection* atau *owner withdrawal*, sehingga ROI dan invested capital melenceng jauh.

Selain itu, label UI badge `"Stock"` di Chart of Accounts ambigu — "stock" di bahasa Inggris bermakna ganda: (a) saham/equity, (b) persediaan/inventory. Hal ini membingungkan pengguna karena akun Persediaan Bahan Baku (inventory) bisa terlihat seakan ditandai sebagai modal saham.

**Root cause**:
1. Kolom DB `accounts.is_stock` (Migration 074) **semantiknya adalah "share capital"** (modal disetor pemilik/investor), tetapi tidak ada CHECK constraint yang membatasi flag ini hanya untuk `account_type='EQUITY'`. Validasi hanya ada di UI (`app/(dashboard)/accounts/page.tsx`).
2. Label UI menggunakan kata `"Stock"` yang ambigu dengan istilah inventory di transaksi VAR.

**Fix**:

1. **Migration 075**: Tambahkan DB CHECK constraint
   ```sql
   ALTER TABLE accounts
     ADD CONSTRAINT is_stock_only_for_equity
     CHECK (is_stock = false OR account_type = 'EQUITY');
   ```
   Sebelumnya reset semua row yang salah (UPDATE `is_stock = false` untuk non-EQUITY).

2. **Rename label UI**:
   - Badge Chart of Accounts: `"Stock"` → `"Share"` ([app/(dashboard)/accounts/page.tsx:576](../app/\(dashboard\)/accounts/page.tsx#L576))
   - Toggle AccountForm: `"Akun Stock / Modal Pemilik"` → `"Akun Saham / Modal Pemilik"` ([src/components/accounts/AccountForm.tsx:545](../src/components/accounts/AccountForm.tsx#L545))
   - i18n key `stock` (yang dipakai TransactionDetailModal untuk badge inventory): `'Stock'` → `'Inventory'` (EN) / `'Persediaan'` (ID)

**Lesson**: Untuk semantik double-meaning seperti "stock", **lebih baik label UI tegas (share vs inventory)** dan **kolom DB diberi CHECK constraint** untuk mencegah data masuk ke kategori yang salah. Validasi di layer UI saja rentan di-bypass via SQL langsung, import, atau migrasi seed.

---

## 20. Data Flow Diagrams

### 20.1 Transaction Input to Financial Reports

```
┌────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│ Quick Form     │────→│ resolveQuick     │────→│                   │
│ (1 account)    │     │ Transaction()    │     │                   │
└────────────────┘     └──────────────────┘     │  createTransaction│
                                                 │  (src/lib/api/)  │
┌────────────────┐                               │                   │
│ Full Form      │──────────────────────────────→│  • Validate       │
│ (2 accounts)   │                               │  • Role check     │
└────────────────┘                               │  • Account verify │
                                                 └────────┬──────────┘
                                                          │
                                                 ┌────────▼──────────┐
                                                 │  Database         │
                                                 │  (transactions +  │
                                                 │   accounts join)  │
                                                 └────────┬──────────┘
                                                          │
                              ┌────────────┬──────────────┼───────────────┬────────────┐
                              │            │              │               │            │
                     ┌────────▼──────┐ ┌───▼───────┐ ┌───▼────────┐ ┌───▼──────┐ ┌───▼────────┐
                     │ Balance Sheet │ │ Income    │ │ Cash Flow  │ │ General  │ │ Trial      │
                     │              │ │ Statement │ │            │ │ Ledger   │ │ Balance    │
                     │ cumulative   │ │ period-   │ │ cash-      │ │ per-acct │ │ all-accts  │
                     │ up to date   │ │ filtered  │ │ based      │ │ filtered │ │ debit/cred │
                     └──────────────┘ └───────────┘ └────────────┘ └──────────┘ └────────────┘
                                                                                      │
                                                                              ┌───────▼────────┐
                                                                              │ Scenario       │
                                                                              │ Modeling       │
                                                                              │ (what-if)      │
                                                                              └────────────────┘
```

### 20.2 Balance Sheet Calculation Flow

```
All Transactions
      │
      ├──── is_double_entry? ────┐
      │         YES              │ NO (legacy)
      │                          │
      ▼                          ▼
Process per account type    calculateFinancialSummary()
      │                          │
      │  Debit:                  │  Cash = capital + operating - CAPEX + FIN
      │   ASSET    +amount       │  Property = CAPEX
      │   LIABILITY -amount      │  Liability = FIN
      │   EQUITY   +equityDebit  │  Equity = capital
      │   EXPENSE  +amount       │
      │   REVENUE  -amount       │
      │                          │
      │  Credit:                 │
      │   ASSET    -amount       │
      │   LIABILITY +amount      │
      │   EQUITY   +equityCredit │
      │   REVENUE  +amount       │
      │   EXPENSE  -amount       │
      │                          │
      └──────────┬───────────────┘
                 │
                 ▼
      retainedEarnings = revenue - expenses - accumulatedDepreciation
      totalEquity = (equityCredit - equityDebit) + retainedEarnings

      CHECK: |assets - (liabilities + equity)| < 0.01
```

### 20.3 General Ledger & Trial Balance Flow

```
All Accounts (sub-accounts only)
      │
      ├── For each account ──────────────────────────────────┐
      │                                                       │
      ▼                                                       ▼
calculateAccountLedger()                              Trial Balance
      │                                                       │
      │  Filter: txns where                                   │  For each account:
      │    debit_account_id = this                            │    ledger = calculateAccountLedger()
      │    OR credit_account_id = this                        │    closingBalance → debit/credit column
      │                                                       │    (based on normal_balance)
      │  Running balance:                                     │
      │    DEBIT-normal: bal += debit - credit                │  totalDebits = sum(all debit columns)
      │    CREDIT-normal: bal += credit - debit               │  totalCredits = sum(all credit columns)
      │                                                       │  isBalanced = |diff| < 0.01
      ▼                                                       ▼
General Ledger UI                                    Trial Balance UI
(per-account view)                                  (all-accounts table)
```

### 20.4 Quick Transaction Resolution

```
Selected Account Type?
       │
       ├── REVENUE ─────────→ Debit: Cash,  Credit: Selected  (IN)
       ├── LIABILITY ────────→ Debit: Cash,  Credit: Selected  (IN)
       ├── EQUITY (capital) ─→ Debit: Cash,  Credit: Selected  (IN)
       ├── EQUITY (prive) ──→ Debit: Selected, Credit: Cash   (OUT)
       ├── EXPENSE ─────────→ Debit: Selected, Credit: Cash   (OUT)
       └── ASSET (non-cash) → Debit: Selected, Credit: Cash   (OUT)
```

---

## 21. Business Members & Access Control

### 21.1 Tabel & Relasi

```
businesses          user_business_roles       profiles
─────────────       ───────────────────       ────────
id                  id                        id (= auth.users.id)
created_by ──┐      user_id ──────────────→  full_name
             │      business_id              avatar_url
             │      role: business_manager
             │             investor
             │             both
             │      joined_at
             └────→ (creator mungkin tidak ada di sini)
```

### 21.2 Member Visibility Rules

`getBusinessMembers(businessId)` di `src/lib/api/members.ts`:

```
1. Fetch semua rows dari user_business_roles WHERE business_id = X
2. Fetch created_by dari businesses WHERE id = X
3. Jika created_by TIDAK ada di user_business_roles:
   → Inject sebagai member virtual dengan role: business_manager + is_creator: true
4. Fetch profiles untuk semua user_ids
5. Return merged list
```

### 21.3 UX Flow

| Aksi | Behaviour |
|------|-----------|
| Single click BusinessCard | Set bisnis sebagai active |
| Double click BusinessCard | Navigate ke `/businesses/{id}/members` |
| Tombol Edit/Archive/Restore | Hanya tampil jika `created_by === user.id` |
| Tombol Undang Anggota | Hanya tampil untuk non-investor |

### 21.4 RLS Policy (Migration 011)

Menggunakan `SECURITY DEFINER` functions untuk menghindari infinite recursion:

```sql
-- Returns semua business_ids yang dimiliki current user
get_my_business_ids() → SETOF UUID

-- Returns true jika current user adalah manager/creator dari bisnis
is_business_manager(bid UUID) → BOOLEAN
```

Policy `user_business_roles FOR SELECT`:
```sql
USING (business_id IN (SELECT get_my_business_ids()))
```
→ Semua member dalam bisnis yang sama dapat saling melihat.

---

## Appendix A: Database Schema (Key Tables)

### accounts

```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY,
    business_id UUID REFERENCES businesses(id),
    account_code TEXT NOT NULL,         -- "1100", "4100", etc.
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL,          -- ASSET|LIABILITY|EQUITY|REVENUE|EXPENSE
    parent_account_id UUID,             -- NULL for main categories
    normal_balance TEXT NOT NULL,        -- DEBIT|CREDIT
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE,    -- TRUE = cannot be deleted
    sort_order INTEGER,
    default_category TEXT,              -- EARN|OPEX|VAR|CAPEX|TAX|FIN (optional)
    -- Depreciation fields (PSAK 16, Migration 026)
    useful_life_months INTEGER,
    residual_value NUMERIC DEFAULT 0,
    depreciation_method TEXT DEFAULT 'straight_line',
    acquisition_date DATE,
    UNIQUE(business_id, account_code)
);
```

### transactions

```sql
-- Key columns for double-entry:
debit_account_id UUID REFERENCES accounts(id),
credit_account_id UUID REFERENCES accounts(id),
is_double_entry BOOLEAN DEFAULT FALSE,
category TEXT NOT NULL,                 -- EARN|OPEX|VAR|CAPEX|TAX|FIN
status TEXT DEFAULT 'draft',            -- draft|posted (only posted masuk kalkulasi)
posted_at TIMESTAMPTZ,                 -- timestamp saat di-posting (NULL jika draft)

-- Soft delete:
deleted_at TIMESTAMPTZ,
deleted_by UUID,

-- Constraint (context-aware per tipe transaksi):
CONSTRAINT transactions_account_rules CHECK (
  CASE
    WHEN is_multi_line = true THEN
      debit_account_id IS NULL AND credit_account_id IS NULL
    WHEN is_double_entry = true THEN
      debit_account_id IS NOT NULL
      AND credit_account_id IS NOT NULL
      AND debit_account_id != credit_account_id
    ELSE true  -- legacy: NULL diizinkan
  END
)
```

### journal_lines

```sql
CREATE TABLE journal_lines (
    id UUID PRIMARY KEY,
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id),
    debit_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    credit_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Tepat satu sisi harus > 0 per baris:
    CONSTRAINT journal_line_one_side_nonzero CHECK (
        (debit_amount > 0 AND credit_amount = 0)
        OR (credit_amount > 0 AND debit_amount = 0)
    )
);

-- Balance check trigger (DEFERRABLE — fire saat COMMIT, bukan per-row):
-- Total debit = total credit per transaction_id (tolerance 0.01)
-- Minimal 2 baris per multi-line journal entry
CREATE CONSTRAINT TRIGGER trg_check_journal_balance
AFTER INSERT OR UPDATE OR DELETE ON journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_journal_lines_balance();
```

---

## Appendix B: Hooks Architecture

### Base Hook: useReportData

Semua report hooks extend `useReportData()`:

```
useReportData
├── activeBusiness (dari BusinessContext)
├── transactions[] (all posted txns for business)
├── filteredTransactions[] (by date range)
├── period: 'month' | 'quarter' | 'year' | 'custom'
├── startDate, endDate
├── handlePeriodChange()
└── showExportMenu, exportButtonRef
```

**Data Fetching**: Menggunakan TanStack Query (`@tanstack/react-query`) untuk caching:
- `queryKey: ['transactions', activeBusinessId]` — cached per bisnis
- Cache invalidation via `window.dispatchEvent(new Event('transaction-saved'))` → `queryClient.invalidateQueries()`
- Provider: `QueryProvider` di `src/components/providers/QueryProvider.tsx`
- `useTransactions` juga menggunakan TanStack Query dengan key yang sama

**Status Filter**: `useReportData` dan `useDashboard` keduanya memfilter hanya transaksi `status === 'posted'` sebelum kalkulasi.

### Specialized Hooks

| Hook | Extends | Adds |
|------|---------|------|
| `useIncomeStatement` | useReportData | summary, metrics, transactionsByCategory, export |
| `useBalanceSheet` | — (standalone) | asOfDate, balanceSheet, isBalanced, export |
| `useCashFlow` | useReportData | cashFlow, export |
| `useGeneralLedger` | useReportData | accounts, selectedAccount, ledger, allLedgers |
| `useTrialBalance` | useReportData | accounts, trialBalance |
| `useScenarioModeling` | useReportData | baseline, optimistic, pessimistic, custom, projections |
| `useBudget` | BusinessContext | budgets, varianceRows, summaryKPI, projections |
| `useDashboard` | BusinessContext | summary, roi, categoryCounts (independent) |

---

## 22. AR/AP Aging & Repayment History

### 22.1 Overview

File: `src/hooks/useArApAging.ts`

Halaman Piutang & Hutang (`/ar-ap`) menampilkan aging report dan riwayat pembayaran. Hook `useArApAging` menghitung tiga hal:
1. **AR Aging** — outstanding piutang per kontak, grouped by aging bucket
2. **AP Aging** — outstanding hutang per kontak, grouped by aging bucket
3. **Repayment History** — riwayat transaksi pembayaran hutang dan pelunasan piutang

### 22.2 Aging Summary (AR & AP)

Menggunakan `buildAgingSummary()` dengan filter dari `receivableSettlement.ts` dan `payableSettlement.ts`:

```
AR (Piutang): isReceivableTransaction()
  - is_double_entry = true
  - debit_account.account_type === 'ASSET'
  - default_category === 'EARN' ATAU nama mengandung "piutang usaha"/"receivable"
  - Exclude: talangan/advance (FIN)

AP (Hutang): isPayableTransaction()
  - is_double_entry = true
  - credit_account.account_type === 'LIABILITY'
  - nama mengandung "hutang"/"utang"/"payable"
```

Transaksi yang sudah settled (`meta.settled_by_transaction_id`) atau merupakan settlement entry (`meta.settlement_of_transaction_id`) diexclude dari aging.

**Nominal aging = net baris AR/AP, bukan gross header** (audit 2026-06-11, ACC-H1):
- AR memakai `getOutstandingAmount()` → net debit baris akun receivable
  (`getReceivableLineAmount`), dikurangi partial settlement (`meta.remaining_amount`)
- AP memakai `getPayableOutstandingAmount()` → net credit baris akun LIABILITY
  (`getPayableLineAmount`). Pembelian multi-line Dr Peralatan 10jt / Cr Kas 3jt +
  Cr Hutang 7jt masuk aging sebagai 7jt, bukan 10jt. `buildPayableSettlementPrefill`
  juga memakai outstanding net yang sama.

Aging buckets: Current (≤0 hari), 1-30, 31-60, 61-90, >90 hari. Dihitung dari selisih tanggal transaksi ke tanggal referensi (akhir periode).

### 22.3 Repayment History (Riwayat Pembayaran)

`buildRepaymentSummary()` mendeteksi transaksi pembayaran yang merupakan **counter-entry** dari piutang/hutang:

```
AP Repayment (Bisnis bayar hutang):
  - debit_account.account_type === 'LIABILITY'
  - Contoh: Dr Hutang Bank / Cr Kas → cicilan pinjaman

AR Collection (Pihak lain bayar piutang ke bisnis):
  - credit_account.account_type === 'ASSET'
  - credit_account harus receivable account (EARN / "piutang usaha")
  - Exclude: talangan/advance (FIN)
  - Contoh: Dr Kas / Cr Piutang Usaha → pelanggan bayar
```

### 22.4 Net Summary (Widget)

Widget summary card menampilkan **sisa** (net) bukan total mentah:

```
Sisa Piutang = Total AR Outstanding - Total AR Collected
Sisa Hutang  = Total AP Outstanding - Total AP Repaid
Posisi Bersih = Sisa Piutang - Sisa Hutang
```

### 22.5 Tipe Data

```typescript
interface RepaymentRow {
  id: string;
  date: string;
  contactName: string;
  contactId: string | null;
  contactType: ContactType | null;
  description: string;
  amount: number;
  type: 'ap' | 'ar';  // ap = bayar hutang, ar = terima piutang
}

interface RepaymentSummary {
  rows: RepaymentRow[];
  totalApRepaid: number;
  totalArCollected: number;
}
```

### 22.6 Contoh Skenario

```
Jenius pencairan: Dr Kas Rp 39.412.363 / Cr Flexi Cash (LIABILITY)
  → AP aging: +Rp 39.412.363

Jenius cicilan:   Dr Flexi Cash (LIABILITY) Rp 7.875.504 / Cr Bank
  → Repayment history: Bayar Hutang Rp 7.875.504
  → totalApRepaid: Rp 7.875.504

Widget:
  Sisa Hutang = 39.412.363 - 7.875.504 = Rp 31.536.859
```

---

## 23. Persistence Layer (Short-Term → Long-Term Memory)

> **Ditambahkan 10 April 2026** — Sebelumnya beberapa data penting hanya hidup
> di React state / localStorage dan hilang saat refresh. Berikut data yang
> sekarang di-persist ke database.

### 23.1 Import Batch History (Migration 038)

**Masalah sebelumnya:** Saat user bulk-import Excel/CSV via `TransactionImportModal`,
tidak ada jejak batch. Tidak bisa rollback, tidak bisa audit "siapa import apa kapan".

**Solusi:**
- Tabel `import_batches` menyimpan setiap operasi import: `file_name`, `file_size`,
  `import_mode` ('smart'/'full'), `total_rows`, `inserted_count`, `failed_count`,
  `status` ('pending'|'success'|'partial'|'failed'|'rolled_back'), `errors` (JSONB),
  `imported_by`, `imported_at`, `rolled_back_at`.
- Kolom baru `transactions.import_batch_id` (FK → `import_batches`) memberi linkage
  1-to-many antar batch dan transaksi hasil.
- API: `src/lib/api/importBatches.ts`
  - `createImportBatch()` — buat record saat user mulai import (status 'pending')
  - `finalizeImportBatch()` — update statistik & status setelah bulk insert selesai
  - `getImportBatches()` / `getImportBatchById()` — query riwayat & detail
  - `rollbackImportBatch()` — soft-delete semua transaksi dalam batch + set status 'rolled_back'
- Integrasi di `TransactionImportModal.tsx`: create batch sebelum insert, tag
  `import_batch_id` ke setiap `TransactionInsert`, finalize setelah result.
  Fire-and-forget — kegagalan tracking tidak blokir import utama.

**Dampak akuntansi:** Tidak ada. Ini pure infra: jurnal tetap dibuat dengan logic
double-entry yang sama. Hanya menambahkan jejak audit & kemampuan rollback.

### 23.2 Reconciliation Sessions (Migration 039)

**Masalah sebelumnya:** `useReconciliation.ts` menyimpan `bankBalance` (saldo dari
mutasi bank yang user ketik manual), `dateRange`, dan `selectedIds` hanya di React
state. Setiap refresh halaman, user harus ketik ulang saldo bank dan memilih ulang
transaksi yang mau di-match.

**Solusi:**
- Tabel `reconciliation_sessions`:
  - `business_id`, `account_id`, `account_code`, `period_start`, `period_end`
  - `bank_statement_balance` — saldo yang user ketik
  - `book_balance_snapshot`, `difference` — hasil kalkulasi saat disimpan
  - `status` ('in_progress'|'completed'|'discarded')
  - Unique partial index: hanya satu sesi 'in_progress' per
    `(business_id, account_id, period_start, period_end)` — supaya tidak ada
    duplikasi sesi aktif.
- Tabel pivot `reconciliation_session_matches` (`session_id`, `transaction_id`)
  — menyimpan progres parsial user (transaksi yang sudah dicontreng tapi belum
  di-commit ke flag `transactions.is_reconciled`).
- API: `src/lib/api/reconciliationSessions.ts`
  - `getActiveReconciliationSession()` — restore sesi saat hook mount
  - `upsertActiveReconciliationSession()` — auto-save saldo bank (debounced 800ms)
  - `saveSessionMatches()` — simpan progres parsial
  - `completeReconciliationSession()` — finalize sesi
- Integrasi di `useReconciliation.ts`:
  - `useEffect` restore session saat `businessId` / `dateRange` berubah
  - `useEffect` debounced auto-save saldo bank dengan 800ms delay
  - Export baru: `saveProgress`, `finalizeSession`, `activeSession`, `sessionLoading`

**Dampak akuntansi:** Tidak ada. Flag `transactions.is_reconciled` (Migration 033)
masih final state-nya. Sesi hanya track "progress sementara" selama user kerjakan.

### 23.3 Financial Summary Cache (Migration 040)

**Masalah sebelumnya:** Setiap kali `useDashboard`, `useIncomeStatement`,
`useBalanceSheet`, `useCashFlow` mount, mereka recompute dari raw transactions via
`calculations.ts`. Dengan 10.000+ transaksi, setiap navigasi = recompute penuh.
Tidak ada snapshot historis — laporan kemarin tidak bisa di-load dari cache.

**Solusi:**
- Tabel `financial_summary_cache`:
  - `business_id`, `cache_type` ('summary'|'income_statement'|'balance_sheet'|'cash_flow'|'dashboard')
  - `period_start`, `period_end` (NULL = all-time)
  - `payload` JSONB — hasil kalkulasi (shape tergantung `cache_type`)
  - `transaction_count` — jumlah baris input saat compute
  - `cache_version` — snapshot dari `business_transaction_versions.transaction_version`
  - `is_stale` — flag invalidasi
- Tabel `business_transaction_versions`: counter monotonik per business.
  Di-bump setiap insert/update/delete `transactions` lewat trigger
  `trg_bump_transaction_version`. Trigger juga set `is_stale = TRUE` pada
  semua cache business tsb.
- Function `bump_business_transaction_version()` dibuat `SECURITY DEFINER`
  supaya bisa bypass RLS saat bump counter.
- API: `src/lib/api/financialCache.ts`
  - `getFinancialCache()` — cek cache, return null kalau `is_stale` atau
    `cache_version` tidak match dengan `getBusinessTransactionVersion()`
  - `upsertFinancialCache()` — delete-then-insert dengan version terkini
  - `invalidateAllFinancialCache()` — paksa hapus (manual refresh)
- Integrasi:
  - `useDashboard.ts`: paralel fetch cache + transactions. Write-through setelah
    compute. Hydrate initial render dari cache kalau transactions belum loaded
    — field baru `isHydratedFromCache`, `cacheComputedAt` untuk UI indikator.
  - `useIncomeStatement.ts`: write-through cache setelah `summary` + `metrics`
    selesai dikalkulasi. Di-key oleh `(businessId, period_start, period_end)`.

**Dampak akuntansi:** Kalkulasi di `calculations.ts` TIDAK berubah sama sekali.
Cache hanya snapshot hasil — bukan sumber kebenaran. Saat stale (setelah insert
transaksi baru), cache di-invalidate otomatis lewat trigger → hook recompute
dari raw transactions → write-through cache baru.

**Invariant yang dijaga:**
1. Cache selalu cocok dengan `transaction_version` saat compute.
2. Setiap perubahan `transactions` pasti meng-invalidate cache.
3. Consumer cek `is_stale` DAN version equality sebelum pakai cache.
4. Write-through bersifat fire-and-forget — kegagalan persist tidak mempengaruhi UI.

### 23.4 Migrasi Database Baru

| Migration | Deskripsi |
|-----------|-----------|
| `038_import_batches.sql` | Tabel `import_batches` + kolom `transactions.import_batch_id` + RLS |
| `039_reconciliation_sessions.sql` | Tabel `reconciliation_sessions` + `reconciliation_session_matches` + RLS |
| `040_financial_summary_cache.sql` | Tabel `financial_summary_cache` + `business_transaction_versions` + trigger version-bump + RLS |

Semua tabel mengikuti pola RLS existing (`get_my_business_ids()`, role check
`business_manager`/`both`/`superadmin`).

---

## 24. Invoice dari Transaksi Piutang (Reverse Flow)

### 24.1 Konsep & Filosofi

Berbeda dengan accounting platform standar (Xero, QuickBooks) yang alurnya
**Invoice → Piutang** (invoice memicu jurnal otomatis), Katalis Ventura
memakai **pipeline tunggal lewat add-transaction** untuk semua entry. Fitur
"Buat Invoice dari Transaksi" adalah reverse flow:

```
Transaksi piutang (Dr Piutang Usaha / Cr Pendapatan)
    └── User pilih 1+ transaksi
          └── Generate Invoice yang merangkum mereka
                └── Invoice = dokumen penagihan formal (PDF, kirim ke customer)
```

**Filosofi**: User awam non-accountant familiar dengan satu pintu masuk
(Add Transaction). Invoice menjadi *view* formal di atas transaksi yang
sudah ada — bukan source of truth-nya.

### 24.2 Schema (Migration 086)

```sql
CREATE TABLE invoice_transactions (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  linked_amount NUMERIC NOT NULL DEFAULT 0,  -- snapshot saat link dibuat
  created_at TIMESTAMPTZ,
  created_by UUID,
  UNIQUE(transaction_id)  -- 1 transaksi → max 1 invoice
);
```

Constraint `UNIQUE(transaction_id)` mencegah double-billing. Kolom lama
`invoices.transaction_id` di tabel `invoices` dipertahankan untuk data
legacy tapi tidak dipakai di fitur ini.

### 24.3 Helper Layer (`src/lib/accounting/guidance/invoiceFromTransaction.ts`)

```typescript
// Aturan invoiceable:
isInvoiceable(transaction, linkedIds) →
  !isSettlementEntry(t) AND
  !isSettled(t) AND
  isTradeReceivableTransaction(t) AND  // pakai flag is_trade_receivable (Migr 085)
  !linkedIds.has(t.id) AND
  getOutstandingAmount(t) > 0

// Multi-customer guard:
validateSameCustomer(transactions) → { ok, error?, customers? }
  Group by contact_id (priority) atau name.toLowerCase().trim()
  Return error jika >1 distinct customer

// Prefill builder:
buildInvoicePrefill({ transactions, settings, today }) → InvoiceFormData
  customer_name: dari transaksi pertama (caller harus sudah validateSameCustomer)
  invoice_date: today
  due_date: today + defaultDueDays (default 7)
  line_items: 1 baris per transaksi
    item_name: description || name || `Tagihan ${date}`
    quantity: 1
    unit_price: getOutstandingAmount(t)  // sisa piutang, bukan original
```

### 24.4 Three Entry Points

| Entry Point | Lokasi | Cocok Untuk |
|-------------|--------|-------------|
| **A. Tombol kontekstual** | TransactionDetailModal | Single transaksi — user buka detail piutang lalu klik "Buat Invoice dari Transaksi Ini" |
| **B. Bulk action** | TransactionList (multi-select) | Beberapa transaksi piutang dari customer yang sama digabung jadi 1 invoice |
| **C. Picker modal** | Halaman /invoices | User mulai dari halaman invoice → tombol "Buat dari Transaksi" → modal picker dengan filter customer/search |

Ketiganya menuju ke modal yang sama (`CreateInvoiceFromTransactionsModal`)
yang membuka `InvoiceForm` dengan `prefillData` untuk review/edit
sebelum final create.

### 24.5 Flow End-to-End

```
1. User klik entry point (A/B/C)
2. Hook useInvoiceFromTransactions:
   - canInvoiceTransactions(selection) → null | error message
   - Kalau error → toast.error, stop
3. CreateInvoiceFromTransactionsModal opens dengan prefillData
4. User review/edit fields → submit
5. createInvoiceFromTransactions API:
   a. INSERT into invoices (payment_status='unpaid', meta.generated_from_transactions=true)
   b. INSERT line items
   c. INSERT junction rows (with rollback on error)
6. Refresh linkedTransactionIds → badge "INV" muncul di TransactionList
```

### 24.6 Status Invoice

Invoice yang dibuat dari transaksi langsung status `'unpaid'` (bukan
`'draft'`) karena transaksi sumber sudah merepresentasikan piutang yang
sah. User bisa mark-as-paid via flow standar di halaman /invoices.

### 24.7 Multi-Customer Block

Sistem **menolak** invoice yang mencampur transaksi dari customer berbeda.
Detected via:
1. `contact_id` (priority — kalau di-set semua transaksi harus sama)
2. `name.trim().toLowerCase()` (fallback untuk transaksi tanpa contact)

Picker modal di /invoices punya extra safety: customer filter **otomatis
dikunci** setelah transaksi pertama dipilih.

### 24.8 Partial Settlement Handling

Transaksi piutang yang sudah dilunasi sebagian (partial settled) tetap
bisa di-invoice — line item pakai `getOutstandingAmount()` (sisa piutang),
bukan amount asli. Snapshot ini disimpan di `invoice_transactions.linked_amount`
agar invoice stabil meskipun outstanding berubah lagi setelahnya.

---

## 25. Bank Statement Import & OCR (Migration 092)

Fitur upload mutasi bank (PDF / image) untuk mempercepat rekonsiliasi.
Mengubah `/reconciliation` dari murni "centang manual berdasar saldo akhir"
menjadi punya sumber data bank yang bisa di-cocokkan ke ledger.

### 25.1 Skema

**`bank_statement_imports`** — satu baris per file mutasi yang di-upload.
- `business_id`, `account_id` (CoA kas/bank, mis. 1200 BCA)
- `source` ('csv'|'xlsx'|'pdf_ocr'|'image_ocr'|'manual')
- `bank_code` ('BCA'|'MANDIRI'|'BRI'|'BNI'|'GENERIC')
- `period_start`, `period_end`
- `opening_balance`, `closing_balance`, `total_credit`, `total_debit` —
  diambil dari summary file untuk validasi rekonsiliasi
- `raw_file_hash` — SHA-256, link ke `ocr_scan_cache` agar parse ulang gratis
- `raw_text` — snapshot teks OCR (untuk debugging / re-parse)
- `status` ('parsed'|'reviewed'|'committed'|'failed'|'discarded')

**`bank_transactions`** — baris mutasi (hasil parse).
- `posted_at`, `value_date`, `description`, `amount` (+ masuk / − keluar)
- `running_balance`, `reference_code`, `counterparty_name`
- `raw_row` JSONB — baris asli untuk debugging
- `match_status` ('unmatched'|'auto_matched'|'manual_matched'|'ignored'|'created_new')
- `matched_transaction_id` → `transactions.id`
- `dedup_hash` — SHA-256 dari `posted_at + amount + description + counterparty + ref_code`
- UNIQUE(`account_id`, `dedup_hash`) — re-upload file sama tidak duplikat

### 25.2 OCR Pipeline (Reuse dari Receipt Scanner)

Modul `src/lib/ocr/` di-refactor agar bisa dipakai dua use case:
- **Struk** (single receipt) — `scanReceipt()`
- **Bank statement** (tabel multi-baris) — `scanBankStatement()` + `parseBankStatement()`

**Provider struk (`scanReceipt`) — urutan prioritas:**
1. **Gemini** (`geminiOcr`, model `gemini-2.5-flash`) — multimodal: kirim gambar →
   JSON `OcrParsed` terstruktur langsung (vendor, total, date, category, line_items,
   charges) tanpa regex. Paling akurat untuk struk Indonesia (paham konteks,
   dd/mm, diskon, PPN), gratis (free tier). Butuh `GEMINI_API_KEY`.
2. **Fallback** ke Vision/OCR.space (raw text) + `parseReceipt()` (regex) bila
   Gemini quota habis (`OCR_LIMITS.gemini`), API key tidak di-set, atau error.

`parseGeminiJson(rawText)` memparse JSON Gemini → `OcrParsed`, lalu memperkaya
keyword via fungsi rule-based di `parser.ts` (`extractKeywords`,
`extractFallbackKeywords`, `extractLineItemKeywords`) supaya matcher CoA
(`matcher.ts`) tetap dapat sinyal yang sama seperti path lama.

**Provider bank statement** — `runOcr(buffer, { mimeType, preference })`:
- `preference: 'auto'` → Vision dulu, fallback OCR.space (cocok untuk image)
- `preference: 'ocr_space_only'` → langsung OCR.space (wajib untuk PDF multi-page;
  Vision sync endpoint hanya support image)

Cache `ocr_scan_cache` shared antar use case (key = SHA-256 file hash). Untuk
provider `gemini`, kolom `raw_text` berisi JSON Gemini → cache hit di-re-parse
pakai `parseGeminiJson()`; untuk provider lain `raw_text` = teks mentah OCR →
re-parse pakai `parseReceipt()`/`parseBankStatement()`. Parser di-re-run tiap
hit supaya improvement parser langsung kepakai tanpa invalidate cache.

### 25.3 Parser per-Bank

`src/lib/bankStatements/parsers/`:
- `bca.ts` — state machine yang kumpulkan blok multi-line per transaksi:
  - Detect type: `TRSF E-BANKING DB/CR`, `BI-FAST DB/CR`, `KR OTOMATIS`,
    `BIAYA ADM`, dll
  - Extract: posted_at + value_date ("TANGGAL :DD/MM"), reference code
    (FTSCY / BIF / LLG-bank), amount, saldo, counterparty (heuristic
    UPPERCASE multi-token tanpa blacklist)
  - Direction: suffix DB → debit (amount negatif), CR atau default → kredit
  - Parse footer summary (SALDO AWAL/AKHIR, MUTASI CR/DB)
- `generic.ts` — heuristic minimal untuk bank yang belum punya parser khusus

`parseBankStatement(rawText, bankCode)` di `index.ts` route ke parser yang tepat.

### 25.4 Validation Layer

Setelah parse, `validateStatement()` cek:
- `sum(credit) ≈ total_credit` (toleransi Rp 1)
- `sum(debit) ≈ total_debit`
- `opening_balance + sum(credit) − sum(debit) ≈ closing_balance`

Hasilnya `parsed.validation.warnings[]` ditampilkan di preview modal sebelum
user commit. Tidak hard-block — user tetap bisa commit meski ada warning
(beberapa edge case bank statement format tidak selalu match).

### 25.5 API Routes

- `POST /api/bank-statements/parse` — multipart upload, return parsed result
  TANPA simpan ke DB. Auth: butuh role `business_manager`/`both`/`superadmin`.
- `POST /api/bank-statements/commit` — terima parsed result yang sudah di-review,
  insert ke `bank_statement_imports` + `bank_transactions`. Upsert dengan
  `onConflict: 'account_id,dedup_hash'` + `ignoreDuplicates: true` — dedup
  natural lewat constraint, return jumlah inserted vs skipped.

### 25.6 UI

`/reconciliation` dapat tombol "Import Mutasi" di header. Buka modal 3-step:
1. **Form**: pilih akun kas/bank, pilih bank, upload file (PDF/image, max 10 MB)
2. **Preview**: 4 summary cards + warnings + tabel rows dengan amount color-coded
3. **Success**: ringkasan inserted/skipped, fire event `bank-statement-imported`

### 25.7 CSV/XLSX Import

Selain PDF/image OCR, file CSV dan XLSX juga bisa di-upload langsung tanpa OCR:
- `parseCsvExcelStatement(buffer)` di `src/lib/bankStatements/parsers/csvExcel.ts`
- Pakai library `xlsx` server-side (sama yang dipakai import transaksi)
- Auto-detect kolom: Tanggal/Date, Keterangan/Description, Debit, Kredit,
  Saldo/Balance, Reference, Counterparty (case-insensitive, banyak variasi
  Indonesia + English)
- Support 2 format kolom amount: **(a)** dua kolom Debit+Kredit terpisah,
  **(b)** satu kolom Mutasi/Amount + kolom Type ('DB'|'CR') atau suffix di value
- Number parsing handle format Indonesia ("1.234.567,89") vs English ("1,234,567.89")
- Date parsing handle Excel serial number, ISO, DD/MM/YYYY

Orchestrator `scanBankStatement()` route otomatis berdasar MIME + extension:
- `.pdf` → OCR.space → parseBankStatement(text, bankCode)
- `.jpg/.png` → Vision/OCR.space → parseBankStatement(text, bankCode)
- `.csv/.xlsx/.xls` → parseCsvExcelStatement(buffer) langsung

### 25.8 Side-by-Side Matching (Phase B)

Halaman `/reconciliation` punya mode toggle di header:
- **Saldo** (default) — view existing centang manual berdasar saldo akhir
- **Cocokkan Mutasi** — side-by-side bank vs ledger

Komponen `SideBySideMatcher.tsx`:
- Kolom kiri: `bank_transactions` (unmatched + matched section terpisah)
- Kolom kanan: `transactions` yang `is_reconciled = false` (cash/bank only)
- Interaksi:
  1. User klik bank line → highlighted (indigo)
  2. Sistem auto-highlight ledger tx yang `|amount| ≈ |bank.amount|` (toleransi
     Rp 1) dengan background amber
  3. User klik salah satu ledger tx → button "Cocokkan" enabled
  4. Klik "Cocokkan" → POST match endpoint
- Bank line yang sudah matched ditampilkan dengan `LinkIcon` + tombol unmatch

Hook `useBankTransactions({ businessId, accountId, from, to })`:
- Fetch dari `/api/bank-transactions`
- Listen event `bank-statement-imported` untuk auto-refresh setelah import
- Expose `match(bankId, txId)` dan `unmatch(bankId)`

### 25.9 API Match/Unmatch

- `GET /api/bank-transactions?business_id=&account_id=&match_status=&from=&to=&limit=`
  → list bank lines.
- `POST /api/bank-transactions/[id]/match` body `{ transaction_id }`
  → set `match_status='manual_matched'`, `matched_transaction_id`, `match_confidence=1.0`.
  Juga set `transactions.is_reconciled=true` kalau belum.
- `POST /api/bank-transactions/[id]/unmatch`
  → reset bank line + cek apakah ledger tx masih ter-link ke bank line lain.
  Kalau tidak → un-reconcile transaksi ledger.

### 25.10 Belum Selesai (Future Phase)

- **Auto-match engine** — saat user commit import, jalan auto-pair berdasarkan
  amount exact + date window ± 3 hari + fuzzy description/counterparty. Set
  `match_status='auto_matched'` saat confidence ≥ 0.9.
- **Create-from-bank** — generate `transactions` baru dari bank line yang
  belum ada di book (open `TransactionForm` pre-filled).
- **Parser Mandiri / BRI / BNI** — saat ini fallback ke generic.
- **API agregator** (Brick / Ayoconnect) — fase 3, butuh kontrak B2B.

---

## 23. Statement of Changes in Equity (SCE) & Rekonsiliasi Dividen

> Laporan ke-4 (PSAK/IFRS 4-statement model). Fungsi: `calculateStatementOfChangesInEquity()` di `src/lib/calculations.ts`; hook `useStatementOfChangesInEquity.ts`; halaman `/statement-of-changes-in-equity`; export `exportSCEToPDF/Excel`.

### 23.1 Tujuan & Data Model

SCE melaporkan perubahan ekuitas selama periode, **per komponen**: Modal tiap pemilik, Laba Ditahan, dan distribusi Dividen. Kolom: **Saldo Awal | Penambahan | Pengurangan | Saldo Akhir**.

Migrasi **094** menambah 3 kolom di `accounts`:

| Kolom | Berlaku untuk | Fungsi |
|-------|---------------|--------|
| `profit_share_pct` | `is_stock` | Hak atas laba (%) pemilik, **lepas dari % modal**. NULL = fallback ke % modal (cap table). |
| `owner_stock_account_id` | `is_dividend` | FK ke akun stock pemiliknya — untuk rekonsiliasi dividen per pemilik. |
| `contact_id` | `is_stock` | FK ke `business_contacts` — integrasi data nama/HP/email pemilik. |

> **Kenapa terpisah dari cap table?** Banyak bisnis keluarga/partnership menyetorkan modal tidak proporsional dengan kesepakatan bagi hasil. Contoh **Hillside Studio**: Papah modal 98.26%, Imam 1.74%, tapi hak laba **50:50**. `profit_share_pct` merekam kesepakatan ini; cap table tetap merekam realitas modal.

### 23.2 Logika Periode (basis seperti Income Statement)

```
openingDate = startDate - 1 hari
openingTxns = transaksi s/d openingDate (cumulative)
closingTxns = transaksi s/d endDate (cumulative)
periodTxns  = transaksi dalam [startDate, endDate]

retainedOpening = calculateBalanceSheet(openingTxns).equity.retainedEarnings
retainedClosing = calculateBalanceSheet(closingTxns).equity.retainedEarnings
netIncome       = retainedClosing - retainedOpening   // RE auto-calculate, dividen TIDAK menyentuh RE
```

**Per pemilik (akun is_stock):**
```
capitalOpening   = net kontribusi (calculateCapTable di openingTxns)
capitalAdditions = sum credit ke akun stock dalam periode
capitalWithdrawals = sum debit ke akun stock dalam periode (rare)
capitalClosing   = capitalOpening + additions - withdrawals
capitalSharePct  = capitalClosing / totalClosingCapital × 100   // % modal disetor (cap table)
profitSharePct   = profit_share_pct (eksplisit) ATAU fallback capitalSharePct  // hak laba
```

> **Dua persentase yang berbeda — penting jangan tertukar:**
> - Tabel **Rincian Perubahan Ekuitas** menampilkan badge **`capitalSharePct`** (% modal disetor). Kolom ini murni akuntansi: berapa modal yang disetor/ditarik tiap pemilik. Sesuai PSAK/IFRS, kolom mutasi ekuitas memakai komposisi modal, bukan hak laba.
> - Tabel **Rekonsiliasi Dividen** menampilkan **`profitSharePct`** (hak laba). Inilah dasar perhitungan `entitled = profitSharePct × netIncome`.
> - Contoh Hillside: badge Rincian = "Modal 98.26%" (Papah) / "Modal 1.74%" (Imam); badge/kolom Rekonsiliasi = "Hak 50%" untuk keduanya.
Daftar pemilik = gabungan akun stock yang punya saldo/mutasi **plus** semua akun `is_stock` di CoA (pemilik dengan hak laba tetap muncul walau belum ada mutasi).

### 23.3 Rekonsiliasi Dividen (Hak vs Aktual)

```
profitSharePct = profit_share_pct (eksplisit) ATAU fallback (capitalClosing / totalCapital × 100)
entitled = profitSharePct / 100 × netIncome              // hak dividen
actual   = sum debit akun is_dividend yang owner_stock_account_id = akun stock ini, dalam periode
variance = entitled - actual                              // + = belum dibagikan penuh; - (merah) = over-distribusi
```

`accumulateDividendsByOwner()` mengelompokkan debit akun `is_dividend` per `owner_stock_account_id` (akun tanpa mapping → key `'unassigned'`).

### 23.4 Tie-out ke Neraca

```
cumulativeDividendDrawings = sum debit akun is_dividend (non-stock) s/d endDate
sceClosingEquity = totalClosingCapital + retainedClosing - cumulativeDividendDrawings
isReconciled = |sceClosingEquity - balanceSheet.equity.totalEquity| < 1
```

> Dividen mendebit akun EQUITY ber-`is_dividend` (bukan `is_stock`), sehingga **tidak** ikut `totalClosingCapital` (yang hanya menjumlah akun stock via cap table) tapi **mengurangi** equity di neraca. Karena itu dikurangkan eksplisit di tie-out.

**Nuansa akuntansi penting:** dividen/prive **tidak** masuk Income Statement dan **tidak** menyentuh Retained Earnings di model auto-calculate ini — ia langsung mengurangi equity di neraca. `netIncome` periode murni = revenue − expense, tidak terpengaruh besarnya dividen.

---

## 26. AXION Agent (AI Assistant Keuangan)

> Branding UI: **AXION Agent**. FAB bulat kanan-bawah (icon Bot) di seluruh
> halaman dashboard, menggantikan FAB Quick Entry lama (Quick Entry pindah ke
> tombol header).
>
> **Kemampuan:**
> - **Opsi A — Analitik (read-only)**: tanya tren/profit/beban (mode "Tanya")
> - **Opsi B — Aksi tulis**:
>   - **Catat transaksi** via natural language (mode "Catat") → preview → simpan
>   - **Impor XLS/CSV** dengan lampiran file di chat
>   - **Smart Import AI-assist** di halaman `/transactions` (Import Transaksi)

### 26.1 Arsitektur

```
User (chat panel)
  → POST /api/ai/chat (streaming SSE)
  → buildFinancialContext() inject konteks keuangan ringkas
  → provider chain: Gemini → Groq → (rule-based di caller)
  → stream balik ke AIChatPanel (+ header X-AI-Model)
```

| Komponen | File |
|----------|------|
| Provider abstraction | `src/lib/ai/provider.ts` |
| System prompts terpusat | `src/lib/ai/prompts.ts` |
| Chat analitik (streaming) | `app/api/ai/chat/route.ts` |
| Catat transaksi (Opsi B) | `app/api/ai/parse-transaction/route.ts` |
| Smart Import assist (Opsi B) | `app/api/ai/smart-import-assist/route.ts` |
| Context builder (testable) | `src/lib/ai/financialContext.ts` |
| Chat panel UI | `src/components/ai/AIChatPanel.tsx` |
| FAB launcher | `src/components/ai/AIChatFAB.tsx` + dipakai via `FloatingQuickAdd.tsx` |
| Unit test | `tests/unit/aiFinancialContext.test.ts` |

### 26.1c Reasoning model + thinking UI

Mode "Tanya" (chat analitik) pakai dua Groq model berbeda peran:
- **GROQ_CHAT_MODEL** = `deepseek-r1-distill-llama-70b` (streaming/chat) — reasoning lebih
  dalam untuk analisis keuangan, audit, proyeksi.
- **GROQ_PARSE_MODEL** = `llama-3.3-70b-versatile` (`generateText`) — cepat untuk parse
  transaksi & smart import, tidak butuh chain-of-thought.

**Prioritas R1 selektif (`preferReasoning`)**: `needsReasoning()` (`src/lib/ai/intent.ts`,
keyword-based, ringan) mendeteksi pertanyaan audit/proyeksi/analisis-mendalam dari pesan
user terakhir. Kalau true → `streamText` mencoba **Groq R1 dulu** baru Gemini fallback
(+ maxTokens 2048 utk ruang thinking). Pertanyaan analitik biasa → Gemini dulu (default).
Unit test: `tests/unit/aiIntent.test.ts`.

**Thinking tokens ditampilkan, bukan dibuang.** `StreamChunk` punya `kind:'thinking'|'answer'`:
- Groq R1: teks dalam `<think>...</think>` di-tag `thinking`, sisanya `answer`
  (state machine `buildGroqStream` tahan partial tag spt `<thi` supaya tidak bocor).
- Gemini: part dgn `thought:true` → `thinking`, sisanya `answer`.
- Chat route teruskan `{text, kind}` per SSE chunk.
- UI (`ThinkingAccordion` di AIChatPanel): reasoning tampil di accordion collapsible —
  auto-buka saat sedang berpikir ("Sedang menganalisis…"), auto-tutup begitu jawaban
  final mulai mengalir. User bisa expand/collapse manual.

### 26.1b Provider Chain (multi-provider fallback)

`src/lib/ai/provider.ts` menyediakan 2 fungsi yang menyembunyikan perbedaan API
tiap provider:
- `generateText(systemPrompt, messages, opts)` → non-streaming (parser, import assist)
- `streamText(systemPrompt, messages, opts)` → streaming SSE (chat analitik)

**Urutan chain (= prioritas):**
1. **Gemini** `gemini-2.5-flash-lite` (`GEMINI_API_KEY`) — kualitas terbaik, JSON
   native, tapi free tier RPD sangat ketat (~20-500/hari).
2. **Groq** `llama-3.3-70b-versatile` (`GROQ_API_KEY`) — OpenAI-compatible, free
   tier lebih longgar, akurasi klasifikasi 6-kategori terverifikasi baik.
3. **Rule-based** (di caller) — `parseTransactionMessage` / `smartResolveTransaction`
   saat semua provider AI gagal.

Format request berbeda dinormalisasi di provider.ts:
- Gemini: `system_instruction` + `contents[].parts[].text`, SSE
  `candidates[].content.parts[].text`
- Groq (OpenAI): `messages[]` (role system/user), SSE `choices[].delta.content`

**Tambah provider baru**: tulis `xxxGenerate`/`xxxStream` + entry di chain
`generateText`/`streamText`. Prompt sudah terpusat (`prompts.ts`) jadi reusable.

**UI indicator**: route chat kirim header `X-AI-Provider` & `X-AI-Model`;
`AIChatPanel` menampilkan badge model aktif (mis. "Gemini 2.5 Flash Lite" atau
"Llama 3.3 70B") di sub-header setelah pesan pertama.

**Claude via Vertex AI (opsi manual)**:
- Semua pemanggilan Claude manual memakai `claude-sonnet-4-6` di region `us-east5`;
  tidak ada fallback ke Sonnet 4.5 atau Haiku.
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` wajib berisi service-account JSON lengkap
  dalam satu baris. Status provider hanya mengaktifkan opsi Claude bila JSON valid.
- Model Claude harus diaktifkan lebih dulu di Vertex AI Model Garden dan service
  account perlu izin `aiplatform.endpoints.predict`.
- Chat memakai adaptive thinking + effort `medium` dan tidak mengirim `temperature`.
- Kegagalan Claude manual dinormalisasi menjadi pesan actionable (kredensial, IAM,
  model belum aktif, rate limit), bukan disamarkan sebagai `503` generik.
- Panel selalu refresh status Claude saat dibuka dan callback kirim mengikuti provider
  terbaru yang dipilih user.

> **Prinsip AI = enhancement, bukan dependency**: setiap fitur AI punya fallback
> berlapis (provider lain → rule-based). Kalau semua provider habis quota / error /
> API key kosong, fitur TETAP jalan. Free tier Gemini di akun dev sangat ketat
> (RPD bisa ~20), jadi Groq + rule-based wajib ada.

### 26.2 Konteks Keuangan yang Diinject

`buildFinancialContext(businessName, sector, transactions, accounts, today)`
menghasilkan blok teks ringkas (~1-2KB, di-guard < 4KB di test) berisi:

1. **Laba rugi per bulan (6 bulan terakhir)** — tiap bulan dihitung via
   `computeSummary()`
2. **Ringkasan all-time** — Revenue, HPP, Laba Kotor, OpEx, Depresiasi, Pajak,
   Bunga, Laba Bersih, margin
3. **Neraca all-time** — Total Aset/Liabilitas/Ekuitas, Kas & Bank
4. **5 transaksi terbesar** (3 bulan terakhir)

**Privasi/token**: transaksi mentah TIDAK dikirim ke Gemini — hanya hasil
agregat. Fetch DB di server, kalkulasi di server, kirim ringkasan saja.

### 26.3 Konsistensi dengan Income Statement (KRITIS)

`computeSummary()` **WAJIB** mereplikasi PERSIS pipeline `useIncomeStatement`:

```
calculateFinancialSummary(txns)
  → calculateDepreciationSummary(accounts, costMap, end, start)
  → applyDepreciationToSummary(base, periodDepreciation)
```

**Kenapa kritis**: `calculateFinancialSummary` sendiri set `totalDepreciation = 0`
dan `netProfit`-nya BELUM dikurangi depresiasi (lihat Section 7 & 16). Halaman
laporan menambah langkah `applyDepreciationToSummary`; AI Agent HARUS melakukan
hal yang sama, kalau tidak `netProfit` overstated sebesar depresiasi periode.

Query transaksi di route handler memakai JOIN penuh
(`debit_account`, `credit_account`, `journal_lines.account`) + filter
`status IS NULL OR status = 'posted'` — identik dengan `getTransactions` +
`useReportData`, supaya klasifikasi double-entry & angka match laporan.

> **Audit trail**: bug awal AI Agent (Juni 2026) — net profit tidak kurangi
> depresiasi (selisih persis = depresiasi periode). Diperbaiki + ditambah
> regression test di `aiFinancialContext.test.ts`. Lihat juga Issue terkait
> di Section 19.

### 26.4 Opsi B — Aksi Tulis (Catat & Impor)

**Mode toggle di chat panel**: "Tanya" (analitik, default) vs "Catat" (input).

**1. Catat transaksi via natural language** (`/api/ai/parse-transaction`):
- Gemini extract `name + amount + date + category_hint` (no streaming, hemat token,
  konteks keuangan TIDAK diinject — cukup teks user).
- `smartResolveTransaction()` resolve kategori + akun debit/kredit dari nama.
- Fallback: `parseTransactionMessage` untuk input lengkap dan
  `parseIncompleteTransactionMessage` untuk deskripsi yang hanya kurang nominal.
- **Interaktif (needs_amount)**: kalau user menyebut transaksi tapi LUPA nominal
  (mis. "bayar listrik"), `extractTransactionFromText()` return `status:'needs_amount'`
  (nama + category_hint, amount=0) — bukan error. Endpoint balas `{status:'needs_amount',
  pending, message:"Oke, *X*. Berapa nominalnya?"}`. Frontend simpan `pendingTx` lalu
  pesan berikutnya (mis. "500rb") digabung jadi `"<nama> 500rb"` + bawa `category_hint`
  ke parse ulang. `pendingTx` di-reset saat reset/ganti mode. Lihat Section 26.6.
- UI: `DraftCard` (nama, nominal, kategori, Dr/Cr, tanggal) → Simpan/Batal →
  `POST /api/transactions` (posted) → fire `transaction-saved`.
- Hanya `business_manager`/`both` (investor read-only, dicek di endpoint).

**2. Impor XLS/CSV via lampiran chat**:
- Mode Catat → tombol Paperclip → pilih `.xlsx/.xls/.csv`.
- Parse **client-side** (`parseExcelFile` + `validateRowsSmart` +
  `smartResolveTransaction`) — engine sama dgn halaman Import. Baris yang akun
  tak ter-resolve / amount invalid di-skip.
- UI: `ImportPreviewCard` (siap/total/error) → konfirmasi → `createTransactionsBulk`.

**3. Smart Import AI-assist** (`/api/ai/smart-import-assist`):
- Di `TransactionImportModal` tab Smart Import: setelah rule-based resolve,
  baris `confidence: 'low'` (max 50) dikirim batch ke Gemini untuk klasifikasi
  kategori → re-resolve akun → confidence naik low→medium, `resolve_source='ai_assist'`,
  badge "AI" di tabel preview.
- AI tidak tersedia → endpoint return suggestions kosong, hasil rule-based dipakai.

### 26.5 Telegram (Tersambung)

Bot Telegram (`src/lib/telegram/`) kini memakai AXION Agent, reuse logic yang
sama dgn chat web (non-streaming karena Telegram tidak mendukung SSE):

**1. Input transaksi (teks biasa)** — `handleTransactionMessage`:
- Upgrade dari regex murni ke `extractTransactionFromText()` (shared helper di
  `src/lib/ai/parseTransaction.ts`): provider chain Gemini→Groq → fallback regex.
- Kategori final di-resolve via `smartResolveTransaction`, lalu konfirmasi
  pending (alur lama tetap: balas YA/TIDAK, koreksi OPEX/VAR).

**2. Analitik (`/tanya <pertanyaan>`, alias `/ask`)** — `handleTanyaCommand`:
- Reuse `buildFinancialContext` + `CHAT_SYSTEM_PROMPT` + `generateText`
  (provider chain). Fetch transaksi join relasi + accounts (sama dgn /api/ai/chat).
- `toTelegramMarkdown()` konversi `**bold**` (web) → Telegram legacy Markdown,
  dikirim tanpa parse_mode untuk hindari error parsing karakter spesial.

**Shared helper** `extractTransactionFromText()` dipakai web (`/api/ai/parse-transaction`)
DAN Telegram — satu sumber kebenaran untuk ekstraksi transaksi natural language.

**Interaktif di Telegram**: kalau extract balik `status:'needs_amount'`, bot simpan
`pending_transaction = {_type:'needs_amount', name, category}` (TTL 5 menit) lalu balas
"Oke, *X*. Berapa nominalnya?". Pesan angka berikutnya digabung `"<name> <angka>"` dan
di-extract ulang dengan `category` dibawa sbg hint — konsisten dgn flow web.

### 26.6 Interaktif: AI tanya nominal kalau user lupa

Tujuan: chat tidak buntu saat user mengetik transaksi tanpa nominal. Flow lintas web
& Telegram, satu sumber kebenaran di `extractTransactionFromText()`:

1. Prompt parser (`PARSE_SYSTEM_PROMPT`) izinkan `"amount": null` — AI WAJIB tetap return
   `name` + `category_hint` walau nominal tak disebut, JANGAN mengarang.
2. Helper return tiga keadaan: `'complete'` (nama+nominal valid), `'needs_amount'`
   (nama ada, amount=0), atau `null` (nama pun tak terbaca → tetap error generik).
3. Caller (web `pendingTx` / Telegram `pending_transaction`) menyimpan nama+hint; web
   juga membawa tanggal yang sudah terdeteksi. Jawaban nominal berikutnya digabung tanpa
   meminta user mengetik ulang deskripsi.
4. `category_hint` dibawa ke `smartResolveTransaction` di turn kedua supaya klasifikasi
   yang sudah dikenali di turn pertama tidak hilang.

Catatan: regex fallback lengkap (`parseTransactionMessage`) hanya cocok bila nominal
terdeteksi. Untuk deskripsi transaksi yang jelas tanpa nominal, fallback
`parseIncompleteTransactionMessage` tetap dapat menghasilkan `needs_amount` saat seluruh
provider AI tidak tersedia.

### 26.7 Channel Import Agent (halaman `/agent`)

Halaman terpisah `/agent` (`app/(dashboard)/agent/page.tsx`) — bukan chatbot, tapi
importer revenue per-channel. User pilih channel + upload CSV → `POST
/api/agent/import-csv` stream progress via SSE → transaksi `posted` langsung masuk.
Parser **deterministik** (tanpa LLM); akun dicocokkan oleh `accountResolver.ts`.

**Channel yang didukung:**

| Channel | Parser | Jurnal per unit | Catatan |
|---------|--------|-----------------|---------|
| `airbnb` | `airbnbParser.ts` | 3-baris **per booking**: Dr Bank (paidout) + Dr Komisi Platform (service fee) / Cr Pendapatan Sewa (gross) | Net settlement (`Paid out`) tersedia di CSV |
| `tiktok_tokopedia` | `tiktokTokopediaParser.ts` | 2-baris **per order**: Dr Kas/Bank / Cr Pendapatan Penjualan (= Σ SKU Subtotal After Discount) | TikTok Shop & Tokopedia berbagi satu ekspor Seller Center (merger); dibedakan kolom `Purchase Channel` |

**Nuansa TikTok/Tokopedia (penting):**
- **1 order = banyak baris (1 baris per SKU).** Kolom level-order (`Order Amount`,
  ongkir, fee) BERULANG identik di tiap baris → parser dedupe per `Order ID`. Revenue
  = **Σ `SKU Subtotal After Discount`** semua SKU; multi-SKU digabung jadi **satu**
  transaksi (rincian SKU disimpan di `meta.line_items`).
- **Bukan settlement.** Ekspor ini order kotor — komisi platform & ongkir yang
  disubsidi platform TIDAK ada/bukan uang seller. Maka pendapatan = subtotal net
  saja; ongkir/diskon/fee disimpan di `meta` untuk audit, **tidak** jadi baris jurnal
  (mencegah pendapatan palsu).
- **Tanggal** = `Paid Time` (cash basis), fallback `Created Time`.
- **Filter** = hanya `Order Status = Selesai`; non-selesai (Dibatalkan/refund) dilewati.
  `SKU ID` (numerik) dipakai sebagai identitas produk yang stabil — `Seller SKU`
  berubah antar periode untuk produk yang sama.
- **Idempotency** = sebelum insert, route query Order ID yang sudah ada
  (`meta->>import_source = 'tiktok_tokopedia_csv'`, `meta->>order_id`) → duplikat
  dilewati. (Importer Airbnb belum punya proteksi ini.)
- **Quirk file** ditangani parser: BOM UTF-8, trailing TAB di sel, field ber-kutip
  multi-baris (alamat).

Insert via RPC atomik `create_multi_line_transaction` (migr 082) — balance check,
RLS, period-lock, account-ownership divalidasi di server. Account resolver memilih
revenue (4100/4000 atau `default_category=EARN`) + Kas/Bank (1200/1100 atau
`is_cash_equivalent`); bila tidak yakin → SSE `needsAccountConfirmation` minta user
pilih manual.

**Instruksi tambahan (opsional) — `instructionInterpreter.ts`:**
Field teks bebas di UI (khusus channel marketplace) diterjemahkan LLM (**Gemini
Vertex**, `generateTextGeminiVertex`) menjadi `ImportInstructionConfig`. PENTING:
instruksi HANYA mengatur **perilaku impor**, TIDAK PERNAH mengubah perhitungan
angka (nominal tetap deterministik dari parser). Bila Vertex tak tersedia →
fallback rule-based, impor tetap jalan. Config yang didukung:
- `status`: `posted` (default) / `draft` — "jadikan draft" / "review dulu".
- `debitMode`: `bank` (default) / `receivable` — bila user menyebut dana **belum
  cair / masih di saldo marketplace / catat sebagai piutang**, sisi debit memakai
  akun **Piutang Usaha** (`resolveReceivableAccount`: flag `is_trade_receivable` →
  kode 1130/1140 → keyword) alih-alih Kas/Bank. Jurnal jadi **Dr Piutang Usaha · Cr
  Pendapatan**; dana dilunasi ke bank nanti via fitur pelunasan piutang (Section
  14.2) saat impor laporan pencairan. Bila akun piutang tak ada → fallback Bank +
  warning. (Mencerminkan realita: order "Selesai" ≠ kas sudah masuk rekening —
  marketplace menahan dana di saldo penjual lalu mencairkan batch.)
- `channelFilter`: `tiktok` / `tokopedia` — impor satu channel saja.
- `dateFrom`/`dateTo`: filter rentang tanggal (mis. "hanya bulan Mei").
- `bankAccountHint`: kata kunci akun kas/bank tertentu (mis. "pakai BCA").
`debit_mode` disimpan di `meta` tiap transaksi untuk audit.

---

## 27. Katalog Produk/Jasa (Catalog Items)

Master data terpusat per bisnis untuk daftar produk/jasa yang dijual. Dipakai
sebagai sumber **picker** saat entry transaksi pendapatan, mengisi nominal,
deskripsi, dan akun pendapatan otomatis. **Harga saja** — belum ada stock tracking.

**Migrasi 099 — tabel `catalog_items`:**

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `name` | TEXT | unik per bisnis (case-insensitive, hanya yang `deleted_at IS NULL`) |
| `item_type` | TEXT | `'product'` \| `'service'` |
| `default_price` | NUMERIC ≥ 0 | harga jual default |
| `unit` | TEXT NULL | satuan (pcs, jam, malam) |
| `revenue_account_id` | UUID FK→accounts (ON DELETE SET NULL) | akun pendapatan default; dikredit saat dijual |
| `sku` | TEXT NULL | **disiapkan untuk fase matching import — belum dipakai** |
| `is_active` | BOOLEAN | nonaktif = tidak muncul di picker |

- **RLS**: SELECT semua anggota bisnis (investor read-only); INSERT/UPDATE/DELETE
  hanya `business_manager`/`both`/`superadmin` — sama pola `business_contacts`.
- **Soft-delete**: `deleteCatalogItem` set `deleted_at` (bukan hard-delete) agar
  histori transaksi tidak terganggu. Trigger audit (`log_audit_trail`) + `updated_by`.
- **API**: `src/lib/api/catalog.ts` — client-side Supabase (RLS enforced), join
  `revenue_account`. **Tidak ada route handler** (tidak butuh, semua via RLS).

**Halaman `/catalog`** (`app/(dashboard)/catalog/page.tsx`, menu sidebar manager-only,
ikon `PackageOpen`): grid kartu item + CRUD via `CatalogItemForm`. Dropdown akun
pendapatan difilter `account_type === 'REVENUE' && is_active`.

**Picker — `CatalogItemPicker.tsx`** (grid kotak-kotak item), 2 mode:

| Mode | Dipakai di | Perilaku |
|------|-----------|----------|
| `single` | `QuickTransactionForm` | Muncul saat akun **REVENUE** dipilih (`isRevenueSelected`). Klik 1 item → isi `amount` + `name`; bila item punya `revenue_account_id` beda, pindah `selectedAccountId` ke akun itu. |
| `multi` | `MultiLineJournalForm` | Tombol "Tambah dari Katalog" muncul saat `category === 'EARN'`. Keranjang qty per item → "Terapkan" generate baris jurnal. |

**Generasi jurnal multi-line dari katalog** (`applyCatalogLines`):
- 1 baris **Debit** penampung (akun kas/bank/piutang **kosong** — user pilih sendiri,
  karena marketplace bisa Piutang bukan kas), `debit_amount` = Σ semua item.
- 1 baris **Credit** per item ke `revenue_account_id`-nya, `credit_amount` = qty ×
  harga, deskripsi = nama item (`×qty` bila > 1).
- Deskripsi transaksi auto-terisi bila masih kosong (nama item / "N item dari katalog").

> Channel penjualan (`sales_channel`) tetap **field terpisah** di transaksi — satu item
> katalog bisa dijual di banyak channel (lihat [[project_axion_agent_channels]]).
> **Fase berikutnya** (belum): auto-match `sku` dengan import TikTok/Tokopedia,
> stock/inventory tracking, laporan penjualan per-item.

---

## Appendix C: Glossary

| Term | Arti |
|------|------|
| Normal Balance | Sisi yang menambah saldo akun (DEBIT untuk Asset/Expense, CREDIT untuk Liability/Equity/Revenue) |
| Double-Entry | Setiap transaksi dicatat di minimal 2 akun: satu debit, satu credit |
| Chart of Accounts (CoA) | Daftar semua akun yang digunakan untuk mencatat transaksi |
| Retained Earnings | Akumulasi laba/rugi yang belum dibagikan (Revenue - Expenses) |
| CAPEX | Capital Expenditure - pengeluaran untuk membeli aset tetap |
| OPEX | Operating Expense - biaya operasional rutin |
| COGS / VAR | Cost of Goods Sold / Variable Cost - biaya yang berubah sesuai volume |
| Prive | Penarikan modal oleh pemilik untuk keperluan pribadi |
| RLS | Row Level Security - PostgreSQL feature untuk access control per-row |
| totalInterest | Subset dari FIN: hanya yang debit ke EXPENSE (bunga/biaya keuangan) |
| totalFin | Semua transaksi FIN termasuk equity/liability movements |
| Matching Principle | Prinsip akuntansi: beban dicatat pada periode yang sama dengan pendapatan terkait |
| Contra Account | Account dengan saldo berlawanan dari normal balance-nya |

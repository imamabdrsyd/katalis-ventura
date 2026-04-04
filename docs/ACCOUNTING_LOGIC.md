# Accounting Logic Documentation

> **Live Documentation** - Dokumen ini menjelaskan seluruh logic akuntansi di Katalis Ventura.
> Terakhir diaudit: 27 Maret 2026 | Terakhir diupdate: 4 April 2026 | AR/AP Aging & Repayment: 29 Maret 2026

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
└── 4xxx [User-defined sub-accounts]

5000 Expenses     (Normal Balance: DEBIT)
├── 5100 Operating Expenses    (default_category: OPEX)
├── 5200 Variable Cost (COGS)  (default_category: VAR)
├── 5300 Tax Expenses          (default_category: TAX)
└── 5xxx [User-defined sub-accounts]
```

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

Lihat `database/migrations/001_add_double_entry_bookkeeping.sql`, `012_fix_accounts_rls_and_function.sql`, dan `016_ensure_equity_subaccount.sql` (definisi terbaru — menambah 3100 Owner's Capital sebagai system account + backfill bisnis lama).

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
- `REVENUE → EQUITY` (closing entry — belum didukung)
- `EQUITY → EXPENSE` (closing entry — belum didukung)

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
              │  • Audit log trigger     │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │  Reports Recalculated   │
              │  (client-side, on fetch)│
              └─────────────────────────┘
```

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

### 5.4 Monthly Grouping

`groupTransactionsByMonth()` mengelompokkan transaksi per bulan dan menghitung per-month:
- earn, opex, var, capex, tax, fin, interest, netProfit
- Interest mengikuti logic yang sama (hanya FIN expense)
- Digunakan oleh Scenario Modeling untuk proyeksi

---

## 6. Balance Sheet Logic

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
netFinCash = equityIn + liabilityIn - cashOut
operatingCash = EARN - OPEX - VAR - TAX
closingCash = capital + operatingCash - CAPEX + netFinCash

totalCash          = closingCash
totalFixedAssets    = CAPEX
totalAssets         = closingCash + CAPEX
totalLiabilities    = legacyFinLiability (hanya pinjaman masuk)
totalEquityCredit  += capital + legacyFinEquityIn
totalEquityDebit   += legacyFinEquityOut (prive/cicilan)
```

### 6.2 Asset Classification (Double-Entry)

Untuk double-entry transactions, asset di-classify berdasarkan:
- **Cash**: Account codes `1100` (Cash) dan `1200` (Bank)
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

### 6.4 Retained Earnings

```
retainedEarnings = totalRevenue - totalExpenses - accumulatedDepreciation
totalEquity = netEquityMovements + retainedEarnings
```

> Depreciation dihitung on-the-fly (Section 16), bukan dari jurnal.
> Harus dikurangkan dari retained earnings agar sisi Equity turun seimbang
> dengan sisi Assets yang sudah menggunakan nilai buku (cost - depreciation).

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

**PENTING:** Financing Costs hanya menampilkan `totalInterest` (FIN yang debit EXPENSE account), bukan semua FIN. FIN yang menyentuh LIABILITY/EQUITY (loan received, capital injection, loan repayment) TIDAK masuk income statement.

CAPEX tidak muncul langsung di income statement. Namun, aset tetap yang memiliki setting depreciation akan memunculkan **Beban Penyusutan** di income statement (lihat Section 16). CAPEX tetap muncul di Cash Flow Statement (investing activities).

### 7.2 Margin Calculations

```
Gross Margin     = (grossProfit / totalEarn) × 100
Operating Margin = (operatingIncome / totalEarn) × 100
Net Margin       = (netProfit / totalEarn) × 100
```

### 7.3 Period Filtering

Income Statement menggunakan `filterTransactionsByDateRange()` → menunjukkan transaksi **dalam** periode tertentu (bukan kumulatif).

### 7.4 Export

- PDF via `jsPDF` + `jspdf-autotable`
- Excel via `xlsx` library

---

## 8. Cash Flow Logic

### 8.1 Dual-Mode Cash Flow Calculation

Cash flow menggunakan dual-mode: double-entry aware untuk transaksi baru, category-based fallback untuk legacy.

**A. Double-Entry Transactions** — Track actual cash movement:
```
Cash account codes: 1100 (Cash), 1200 (Bank)

Untuk setiap transaksi yang menyentuh Cash/Bank:

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

Transaksi non-cash (tidak menyentuh 1100/1200) → diabaikan
Bank transfer (kedua sisi cash) → net zero, diabaikan
```

**Sub-classification per IAS 7 / PSAK 2:**

Counter ASSET dianggap **trade receivable** (→ Operating) jika:
- `default_category === 'EARN'`, ATAU
- `account_name` mengandung "piutang usaha" atau "receivable"

Counter ASSET dianggap **advance/talangan** (→ Financing) jika:
- `default_category === 'FIN'`, ATAU
- `account_name` mengandung "talangan" atau "advance"

Semua ASSET lainnya (fixed asset, inventory, dll) → **Investing**.

Counter LIABILITY dianggap **operating payable** (→ Operating) jika:
- `default_category` = `OPEX`, `VAR`, atau `TAX`, ATAU
- `account_name` mengandung "hutang usaha", "utang usaha", "payable", atau "accrued"

Semua LIABILITY lainnya (pinjaman bank, hutang jangka panjang) → **Financing**.

Counter EQUITY → selalu **Financing** (tidak ada sub-classification).

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
Priority: Bank (1200) → Cash (1100) → first active ASSET sub-account
```

### 12.3 Account Filtering untuk Quick Add

`getQuickAddAccounts()` mengecualikan:
- Parent accounts (tanpa parent_account_id)
- Inactive accounts
- Cash (1100) dan Bank (1200) — karena mereka jadi counter-account otomatis
- Akun piutang/receivable/talangan/advance — termasuk ASSET dengan `default_category === 'EARN'` (trade receivable). Akun-akun ini memerlukan kontrol debit/kredit manual, sehingga hanya bisa digunakan via **Full Double-Entry** atau **Multi-line Journal**.

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

`isReceivableTransaction(transaction)`:
```
Trade receivable (piutang usaha) terdeteksi jika:
  1. is_double_entry = true
  2. debit_account.account_type === 'ASSET'
  3. debit_account.default_category !== 'FIN' (bukan talangan)
  4. account_name TIDAK mengandung "talangan" atau "advance"
  5. debit_account.default_category === 'EARN'
     ATAU account_name mengandung "piutang usaha" atau "receivable"

Piutang Talangan (advance/FIN) → return FALSE
  - default_category === 'FIN' atau nama mengandung "talangan"/"advance"
  - Talangan bukan piutang usaha, tidak butuh banner pelunasan
  - Kategori transaksi: FIN (bukan EARN)
```

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
monthsElapsed = bulan dari acquisitionDate sampai reportDate (capped di usefulLifeMonths)
accumulatedDepreciation = monthlyDepreciation × monthsElapsed
bookValue = cost - accumulatedDepreciation (min = residualValue)
```

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
| `useBalanceSheet` | useReportData | balanceSheet, isBalanced, export |
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

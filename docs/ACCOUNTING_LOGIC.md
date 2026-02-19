# Accounting Logic Documentation

> **Live Documentation** - Dokumen ini menjelaskan seluruh logic akuntansi di Katalis Ventura.
> Terakhir diaudit: 19 Februari 2026 | Terakhir diupdate: 19 Februari 2026

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
14. [Validation Layers](#14-validation-layers)
15. [Audit Findings & Known Issues](#15-audit-findings--known-issues)
16. [Data Flow Diagrams](#16-data-flow-diagrams)
17. [Business Members & Access Control](#17-business-members--access-control)

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
| `src/lib/accounting/guidance/transactionPatterns.ts` | 11 pola transaksi + keyword detection |
| `src/lib/accounting/guidance/suggestions.ts` | Smart account suggestion service |
| `src/lib/accounting/guidance/matchingPrincipleWarning.ts` | Matching principle (EARN → HPP) warning |
| `src/lib/calculations.ts` | Semua financial calculations |
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

Lihat `database/migrations/001_add_double_entry_bookkeeping.sql` dan `012_fix_accounts_rls_and_function.sql`.

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

### 3.2 Prinsip Accounting Equation

Setiap transaksi double-entry **harus** menjaga:

```
Assets = Liabilities + Equity + (Revenue - Expenses)
```

Sistem memvalidasi ini di `useBalanceSheet.ts` dengan tolerance `< 0.01`.

### 3.3 Kombinasi yang DITOLAK

Semua kombinasi di luar 10 valid combinations akan ditolak oleh `TransactionValidator`. Contoh yang tidak valid:
- `EXPENSE → REVENUE` (tidak ada artinya secara akuntansi)
- `REVENUE → LIABILITY` (tidak ada artinya)
- `EXPENSE → LIABILITY` (seharusnya lewat asset dulu)
- `EXPENSE → EQUITY` (tidak ada artinya)

---

## 4. Transaction Lifecycle

### 4.1 Dua Mode Input

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

### 4.3 Flow: Full Transaction Lifecycle

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
  ASSET←REVENUE    = EARN
  ASSET←LIABILITY  = FIN  (loan received)
  ASSET←EQUITY     = FIN  (capital injection)
  EXPENSE→ASSET    = OPEX (default expense)
  ASSET→ASSET      = CAPEX (asset purchase, unless default_category set)
  EQUITY→ASSET     = FIN  (owner withdrawal)
  LIABILITY→ASSET  = FIN  (loan payment)
  Fallback         = OPEX
```

### 5.3 Financial Summary

`calculateFinancialSummary()` di `calculations.ts`:

```
grossProfit    = totalEarn - totalVar
netProfit      = totalEarn - totalOpex - totalVar - totalTax - totalInterest
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
```
openingCash = capital (dari business settings)
operatingCash = EARN - OPEX - VAR - TAX
closingCash = capital + operatingCash - CAPEX + FIN

totalCash     = closingCash
totalProperty = CAPEX
totalAssets   = closingCash + CAPEX
totalLiabilities = FIN
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
retainedEarnings = totalRevenue - totalExpenses
totalEquity = netEquityMovements + retainedEarnings
```

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
= Operating Income
─ Financing Costs (totalInterest, bukan totalFin)
─────────────────────────
= EBT (Earnings Before Tax)
─ Tax (TAX)
─────────────────────────
= Net Income
```

**PENTING:** Financing Costs hanya menampilkan `totalInterest` (FIN yang debit EXPENSE account), bukan semua FIN. FIN yang menyentuh LIABILITY/EQUITY (loan received, capital injection, loan repayment) TIDAK masuk income statement.

CAPEX tidak muncul di income statement. CAPEX hanya ada di Cash Flow Statement (investing activities). Sistem ini tidak menerapkan depreciation.

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
  Counter = REVENUE/EXPENSE → Operating  (+amount)
  Counter = ASSET (non-cash) → Investing (+amount)
  Counter = LIABILITY/EQUITY → Financing (+amount)

Cash KELUAR (credit cash):
  Counter = REVENUE/EXPENSE → Operating  (-amount)
  Counter = ASSET (non-cash) → Investing (-amount)
  Counter = LIABILITY/EQUITY → Financing (-amount)

Transaksi non-cash (tidak menyentuh 1100/1200) → diabaikan
Bank transfer (kedua sisi cash) → net zero, diabaikan
```

**B. Legacy Transactions** — Category-based fallback:
```
Operating  = EARN - OPEX - VAR - TAX
Investing  = -CAPEX
Financing  = FIN
```

**Hasil akhir:**
```
Net Cash Flow = Operating + Investing + Financing
Opening Balance = capital (dari business settings)
Closing Balance = Opening + Net Cash Flow
```

---

## 9. General Ledger Logic

### 9.1 Overview

File: `src/hooks/useGeneralLedger.ts`

General Ledger (Buku Besar) menampilkan per-account ledger dengan running balance. Hanya memproses double-entry transactions.

### 9.2 Account Ledger Calculation

`calculateAccountLedger(account, transactions)`:

```
1. Filter transaksi yang menyentuh account ini
   (debit_account_id === account.id ATAU credit_account_id === account.id)

2. Sort ascending by date, then by created_at

3. Untuk setiap transaksi:
   - Tentukan apakah account ini di sisi debit atau credit
   - Hitung running balance berdasarkan normal balance rule:
     DEBIT-normal (ASSET, EXPENSE):  balance += debit - credit
     CREDIT-normal (LIABILITY, EQUITY, REVENUE): balance += credit - debit

4. Return: entries[], totalDebits, totalCredits, closingBalance, legacyCount
```

### 9.3 Account Filtering

- Hanya sub-accounts (parent_account_id != null) yang ditampilkan
- Filter berdasarkan account type: ALL, ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
- allLedgers: Summary semua accounts yang di-filter

### 9.4 Legacy Transaction Handling

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

Baseline dihitung dari transaksi aktual dalam periode yang dipilih:

```
baseline = {
  revenue:         calculateFinancialSummary().totalEarn,
  cogs:            calculateFinancialSummary().totalVar,
  grossProfit:     grossProfit,
  opex:            totalOpex,
  operatingIncome: calculateIncomeStatementMetrics().operatingIncome,
  interest:        totalInterest,
  ebt:             ebt,
  tax:             totalTax,
  netIncome:       netProfit,
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
  operatingIncome = grossProfit - opex
  interest        = baseline.interest × (1 + interestGrowth/100)
  ebt             = operatingIncome - interest
  tax             = taxRate > 0 ? max(0, ebt × taxRate/100) : baseline.tax
  netIncome       = ebt - tax
```

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
  • EQUITY "prive"/"drawing"  → Penarikan pemilik
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

## 14. Validation Layers

### 14.1 Three-Layer Validation

```
Layer 1: Client-side (TransactionValidator)
  → Instant feedback di form
  → Indonesian language messages
  → Warnings untuk unusual patterns

Layer 2: API-side (src/lib/api/transactions.ts)
  → Double-entry account pair validation
  → Auth check & role check

Layer 3: Database (PostgreSQL Constraints)
  → check_different_accounts: debit ≠ credit
  → FK constraints ke accounts table
  → RLS policies per business
```

### 14.2 Client Validation Details

`TransactionValidator.validate()`:

| Check | Type | Message |
|-------|------|---------|
| amount ≤ 0 | Error | "Jumlah harus lebih dari 0" |
| debit = credit | Error | "Akun debit dan kredit tidak boleh sama" |
| Invalid combination | Error | "Kombinasi akun tidak valid" |
| Revenue di debit | Warning | "Mendebit pendapatan akan mengurangi..." |
| Expense di credit | Warning | "Mengkredit beban akan mengurangi..." |

### 14.3 Smart Warnings

Sistem memberikan warning kontekstual:
- **Capital sebagai Revenue**: "Jika ini setoran modal, gunakan akun Ekuitas"
- **Withdrawal sebagai Expense**: "Jika ini penarikan pribadi, gunakan akun Prive"
- **Revenue di-debit**: "Ini biasanya untuk koreksi atau retur penjualan"

### 14.4 Transaction Pattern Detection

11 pola transaksi yang dikenali dari keyword di nama transaksi:

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
| Penarikan Prive | prive, pribadi, penarikan | EQUITY | ASSET |
| Retur Pendapatan | (via account type match) | REVENUE | ASSET |
| Penggantian Biaya | (via account type match) | ASSET | EXPENSE |

---

## 15. Audit Findings & Known Issues

### All Previously Reported Issues — RESOLVED

| Issue | Description | Status | Fixed |
|-------|-------------|--------|-------|
| #1 | CAPEX dalam Net Profit | RESOLVED | Net profit formula: `EARN - OPEX - VAR - TAX - totalInterest` |
| #2 | Label EBITDA Misleading | RESOLVED | Label diganti "OPERATING INCOME" |
| #3 | EBIT Includes CAPEX | RESOLVED | EBIT dihapus, Operating Income → EBT → Net Income |
| #4 | Legacy FIN Math.abs | RESOLVED | Menggunakan raw value, bukan Math.abs |
| #5 | Revenue Debit di Balance Sheet | RESOLVED | Handle REVENUE debit dan EXPENSE credit |
| #6 | detectCategory Priority Salah | RESOLVED | Cash/Bank accounts di-skip saat priority check |
| #7 | Fixed Asset Code Range Fragile | RESOLVED | Logic berbasis account_type, bukan hardcoded range |
| #8 | Cash Flow Tidak Double-Entry Aware | RESOLVED | Dual-mode: double-entry + category fallback |
| #9 | Inventory Purchase Masuk COGS | RESOLVED | VAR + debit ASSET = inventory, di-skip dari Income Statement |
| #10 | Account Code Keluar Range (e.g. 6000) | RESOLVED | Smart auto-code generation: selalu dalam range parent |
| #11 | RLS Infinite Recursion | RESOLVED | SECURITY DEFINER functions: `get_my_business_ids()`, `is_business_manager()` |
| #12 | Creator Bisnis Tidak Terlihat di Members | RESOLVED | `getBusinessMembers()` fetch `created_by` dari tabel `businesses` jika tidak ada di `user_business_roles` |
| #13 | Non-Creator Bisa Klik Edit Bisnis | RESOLVED | Tombol Edit/Archive/Restore hanya muncul jika `created_by === user.id` |

---

## 16. Data Flow Diagrams

### 16.1 Transaction Input to Financial Reports

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

### 16.2 Balance Sheet Calculation Flow

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
      retainedEarnings = revenue - expenses
      totalEquity = (equityCredit - equityDebit) + retainedEarnings

      CHECK: |assets - (liabilities + equity)| < 0.01
```

### 16.3 General Ledger & Trial Balance Flow

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

### 16.4 Quick Transaction Resolution

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

## 17. Business Members & Access Control

### 17.1 Tabel & Relasi

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

### 17.2 Member Visibility Rules

`getBusinessMembers(businessId)` di `src/lib/api/members.ts`:

```
1. Fetch semua rows dari user_business_roles WHERE business_id = X
2. Fetch created_by dari businesses WHERE id = X
3. Jika created_by TIDAK ada di user_business_roles:
   → Inject sebagai member virtual dengan role: business_manager + is_creator: true
4. Fetch profiles untuk semua user_ids
5. Return merged list
```

### 17.3 UX Flow

| Aksi | Behaviour |
|------|-----------|
| Single click BusinessCard | Set bisnis sebagai active |
| Double click BusinessCard | Navigate ke `/businesses/{id}/members` |
| Tombol Edit/Archive/Restore | Hanya tampil jika `created_by === user.id` |
| Tombol Undang Anggota | Hanya tampil untuk non-investor |

### 17.4 RLS Policy (Migration 011)

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

-- Soft delete:
deleted_at TIMESTAMPTZ,
deleted_by UUID,

-- Constraint:
CHECK (debit_account_id IS NULL OR credit_account_id IS NULL
       OR debit_account_id != credit_account_id)
```

---

## Appendix B: Hooks Architecture

### Base Hook: useReportData

Semua report hooks extend `useReportData()`:

```
useReportData
├── activeBusiness (dari BusinessContext)
├── transactions[] (all txns for business)
├── filteredTransactions[] (by date range)
├── period: 'month' | 'quarter' | 'year' | 'custom'
├── startDate, endDate
├── handlePeriodChange()
└── showExportMenu, exportButtonRef
```

### Specialized Hooks

| Hook | Extends | Adds |
|------|---------|------|
| `useIncomeStatement` | useReportData | summary, metrics, transactionsByCategory, export |
| `useBalanceSheet` | useReportData | balanceSheet, isBalanced, export |
| `useCashFlow` | useReportData | cashFlow, export |
| `useGeneralLedger` | useReportData | accounts, selectedAccount, ledger, allLedgers |
| `useTrialBalance` | useReportData | accounts, trialBalance |
| `useScenarioModeling` | useReportData | baseline, optimistic, pessimistic, custom, projections |
| `useDashboard` | BusinessContext | summary, roi, categoryCounts (independent) |

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

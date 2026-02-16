# Accounting Logic Documentation

> **Live Documentation** - Dokumen ini menjelaskan seluruh logic akuntansi di Katalis Ventura.
> Terakhir diaudit: 16 Februari 2026

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
9. [Quick Transaction Resolver](#9-quick-transaction-resolver)
10. [Validation Layers](#10-validation-layers)
11. [Audit Findings & Known Issues](#11-audit-findings--known-issues)
12. [Data Flow Diagrams](#12-data-flow-diagrams)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI LAYER                                 │
│  TransactionForm.tsx  │  QuickTransactionForm.tsx  │  Reports   │
└──────────┬────────────┴──────────────┬─────────────┴────┬───────┘
           │                           │                  │
┌──────────▼───────────────────────────▼──────────────────▼────────┐
│                     MODEL LAYER (src/lib/)                       │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐  │
│  │ accounting/          │  │ calculations.ts                  │  │
│  │  ├── constants.ts    │  │  ├── calculateFinancialSummary() │  │
│  │  ├── types.ts        │  │  ├── calculateBalanceSheet()     │  │
│  │  ├── validators/     │  │  ├── calculateCashFlow()         │  │
│  │  │   └── tx.ts       │  │  ├── calculateIncomeStatement()  │  │
│  │  └── guidance/       │  │  └── calculateROI()              │  │
│  │      ├── patterns.ts │  └──────────────────────────────────┘  │
│  │      └── suggest.ts  │                                        │
│  └──────────────────────┘  ┌──────────────────────────────────┐  │
│                            │ utils/                           │  │
│                            │  ├── transactionHelpers.ts       │  │
│                            │  └── quickTransactionHelper.ts   │  │
│                            └──────────────────────────────────┘  │
└──────────┬───────────────────────────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────────────────┐
│                     API LAYER (app/api/)                         │
│  ┌─────────────────────────┐  ┌───────────────────────────────┐  │
│  │ /api/transactions       │  │ /api/transactions/[id]        │  │
│  │  POST (create)          │  │  PUT (update)                 │  │
│  │  GET  (list)            │  │  DELETE (soft-delete)         │  │
│  └─────────────────────────┘  └───────────────────────────────┘  │
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
| `src/lib/calculations.ts` | Semua financial calculations |
| `src/lib/utils/transactionHelpers.ts` | Category detection, account filtering |
| `src/lib/utils/quickTransactionHelper.ts` | Single-account to double-entry resolver |
| `src/lib/validations.ts` | Zod schemas untuk API validation |
| `src/types/index.ts` | Core TypeScript types |

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

Setiap business baru otomatis mendapat Chart of Accounts lengkap via PostgreSQL trigger `business_create_accounts`. Lihat `database/migrations/001_add_double_entry_bookkeeping.sql`.

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
              │  API: POST /transactions │
              │  • Zod schema validation │
              │  • Auth check            │
              │  • Role check (manager)  │
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
Priority 1: debitAccount.default_category (jika ada)
Priority 2: creditAccount.default_category (jika ada)
Priority 3: Account type-based detection:
  ASSET←REVENUE    = EARN
  ASSET←LIABILITY  = FIN  (loan received)
  EXPENSE→ASSET    = OPEX (default expense)
  ASSET→ASSET      = CAPEX (asset purchase)
  EQUITY→ASSET     = FIN  (owner withdrawal)
  LIABILITY→ASSET  = FIN  (loan payment)
  Fallback         = OPEX
```

### 5.3 Financial Summary

`calculateFinancialSummary()` menjumlah per category:

```
grossProfit = totalEarn - totalVar
netProfit   = totalEarn - totalOpex - totalVar - totalTax - totalFin
```

CAPEX tidak masuk net profit karena bukan expense (beli aset). CAPEX hanya muncul di Cash Flow Statement (investing activities).

---

## 6. Balance Sheet Logic

### 6.1 Dual-Mode Processing

`calculateBalanceSheet()` memproses dua jenis transaksi:

**A. Double-Entry Transactions** (is_double_entry = true)
```
Untuk setiap transaksi:
  Debit side:
    ASSET    → totalAssets += amount
    LIABILITY → totalLiabilities -= amount  (mengurangi hutang)
    EQUITY   → totalEquity -= amount        (withdrawal)
    EXPENSE  → totalExpenses += amount

  Credit side:
    ASSET    → totalAssets -= amount
    LIABILITY → totalLiabilities += amount  (menambah hutang)
    EQUITY   → totalEquity += amount        (capital injection)
    REVENUE  → totalRevenue += amount
```

**B. Legacy Transactions** (is_double_entry = false)
```
openingCash = capital (dari business settings)
operatingCash = EARN - OPEX - VAR - TAX
closingCash = capital + operatingCash - CAPEX + FIN

totalCash     = closingCash
totalProperty = CAPEX
totalAssets   = closingCash + CAPEX
totalLiabilities = |FIN|
```

### 6.2 Cash vs Property Tracking

Untuk double-entry transactions:
- **Cash**: Account codes `1100` (Cash) dan `1200` (Bank)
- **Property**: Account codes `1201`-`1299` (Fixed Assets range, Bank `1200` excluded)
- **Total Assets**: Sum of all ASSET debit - all ASSET credit

### 6.3 Retained Earnings

```
retainedEarnings = totalRevenue - totalExpenses
totalEquity = equity (dari transaksi) + retainedEarnings
```

### 6.4 Balance Check

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
─ Financing Costs (FIN)
─────────────────────────
= EBT (Earnings Before Tax)
─ Tax (TAX)
─────────────────────────
= Net Income
```

CAPEX tidak muncul di income statement. CAPEX hanya ada di Cash Flow Statement (investing activities). Sistem ini tidak menerapkan depreciation, sehingga tidak ada line item EBIT.

### 7.2 Margin Calculations

```
Gross Margin     = (grossProfit / totalEarn) × 100
Operating Margin = (operatingIncome / totalEarn) × 100
Net Margin       = (netProfit / totalEarn) × 100
```

### 7.3 Period Filtering

Income Statement menggunakan `filterTransactionsByDateRange()` → menunjukkan transaksi **dalam** periode tertentu (bukan kumulatif).

---

## 8. Cash Flow Logic

### 8.1 Dual-Mode Cash Flow Calculation

Cash flow menggunakan dual-mode: double-entry aware untuk transaksi baru, category-based fallback untuk legacy.

**A. Double-Entry Transactions** — Track actual cash movement:
```
Untuk setiap transaksi yang menyentuh Cash (1100) atau Bank (1200):

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

## 9. Quick Transaction Resolver

### 9.1 Bagaimana Sistem Menentukan Debit/Credit

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

### 9.2 Default Cash Account Selection

```
Priority: Bank (1200) → Cash (1100) → first active ASSET sub-account
```

### 9.3 Account Filtering untuk Quick Add

`getQuickAddAccounts()` mengecualikan:
- Parent accounts (tanpa parent_account_id)
- Inactive accounts
- Cash (1100) dan Bank (1200) — karena mereka jadi counter-account otomatis

---

## 10. Validation Layers

### 10.1 Three-Layer Validation

```
Layer 1: Client-side (TransactionValidator)
  → Instant feedback di form
  → Indonesian language messages
  → Warnings untuk unusual patterns

Layer 2: API-side (Zod Schemas)
  → Server-side enforcement
  → Double-entry account pair validation
  → Amount limits (max 100B IDR)

Layer 3: Database (PostgreSQL Constraints)
  → check_different_accounts: debit ≠ credit
  → FK constraints ke accounts table
  → RLS policies per business
```

### 10.2 Client Validation Details

`TransactionValidator.validate()`:

| Check | Type | Message |
|-------|------|---------|
| amount ≤ 0 | Error | "Jumlah harus lebih dari 0" |
| debit = credit | Error | "Akun debit dan kredit tidak boleh sama" |
| Invalid combination | Error | "Kombinasi akun tidak valid" |
| Revenue di debit | Warning | "Mendebit pendapatan akan mengurangi..." |
| Expense di credit | Warning | "Mengkredit beban akan mengurangi..." |

### 10.3 Smart Warnings

Sistem memberikan warning kontekstual:
- **Capital sebagai Revenue**: "Jika ini setoran modal, gunakan akun Ekuitas"
- **Withdrawal sebagai Expense**: "Jika ini penarikan pribadi, gunakan akun Prive"
- **Revenue di-debit**: "Ini biasanya untuk koreksi atau retur penjualan"

### 10.4 Transaction Pattern Detection

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

## 11. Audit Findings & Known Issues

### RESOLVED Issues (Fixed 16 Feb 2026)

#### ~~Issue #1: CAPEX dalam Net Profit~~ → RESOLVED

CAPEX telah dihapus dari formula net profit. Formula sekarang: `netProfit = EARN - OPEX - VAR - TAX - FIN`. CAPEX hanya muncul di Cash Flow Statement (investing activities). Income statement sekarang mengikuti struktur PSAK/IFRS.

#### ~~Issue #2: Label EBITDA Misleading~~ → RESOLVED

Label "OPERATING INCOME (EBITDA)" diganti menjadi "OPERATING INCOME". EBIT line dihapus karena tidak relevan (tidak ada depreciation).

#### ~~Issue #3: EBIT Includes CAPEX~~ → RESOLVED

EBIT dihapus dari `IncomeStatementMetrics` dan seluruh UI. Income statement sekarang: Operating Income → EBT (setelah financing) → Net Income (setelah tax).

#### ~~Issue #4: Legacy FIN Math.abs~~ → RESOLVED

`Math.abs(summary.totalFin)` diganti dengan `summary.totalFin`. FIN positif = loan received (liability naik), FIN negatif = loan payment (liability turun).

#### ~~Issue #8: Cash Flow Tidak Double-Entry Aware~~ → RESOLVED

`calculateCashFlow()` sekarang dual-mode: double-entry transactions di-classify berdasarkan actual cash movement melalui accounts Cash (1100) / Bank (1200), legacy transactions tetap category-based fallback.

---

### 11.5 Issue #5: Revenue Debit Tidak Dikurangi di Balance Sheet — ✅ RESOLVED

**Severity: MEDIUM** → **Fixed**
**File:** `src/lib/calculations.ts`

**Problem:** Debit switch tidak handle REVENUE, credit switch tidak handle EXPENSE.
**Fix:** Ditambahkan `case 'REVENUE': totalRevenue -= amount` di debit side dan `case 'EXPENSE': totalExpenses -= amount` di credit side. Retained earnings sekarang akurat untuk retur/koreksi.

---

### 11.6 Issue #6: detectCategory Priority Bisa Salah — ✅ RESOLVED

**Severity: LOW** → **Fixed**
**File:** `src/lib/utils/transactionHelpers.ts`

**Problem:** `debitAccount.default_category` dicek duluan, bisa override akun non-cash yang lebih spesifik.
**Fix:** Cash/Bank accounts (1100, 1200) sekarang di-skip saat priority check. Non-cash account's `default_category` selalu diprioritaskan.

---

### 11.7 Issue #7: Fixed Asset Code Range Fragile — ✅ RESOLVED

**Severity: LOW** → **Fixed**
**File:** `src/lib/calculations.ts`

**Problem:** Hardcoded `1201-1299` range untuk fixed assets.
**Fix:** Diganti dengan logic "any ASSET account that is not Cash (1100) or Bank (1200)". Sekarang support user-created asset accounts (1300 Fixed Assets, 1400 Vehicles, 1500 Inventory, dsb).

---

## 12. Data Flow Diagrams

### 12.1 Transaction Input to Financial Reports

```
┌────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│ Quick Form     │────→│ resolveQuick     │────→│                   │
│ (1 account)    │     │ Transaction()    │     │                   │
└────────────────┘     └──────────────────┘     │  POST /api/       │
                                                 │  transactions     │
┌────────────────┐                               │                   │
│ Full Form      │──────────────────────────────→│  • Zod validate   │
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
                                          ┌───────────────┼───────────────┐
                                          │               │               │
                                 ┌────────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
                                 │ Balance Sheet  │ │ Income      │ │ Cash Flow  │
                                 │               │ │ Statement   │ │            │
                                 │ cumulative    │ │ period-     │ │ category-  │
                                 │ up to date    │ │ filtered    │ │ based      │
                                 └───────────────┘ └─────────────┘ └────────────┘
```

### 12.2 Balance Sheet Calculation Flow

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
      │   LIABILITY -amount      │  Liability = |FIN|
      │   EQUITY   -amount       │  Equity = capital
      │   EXPENSE  +amount       │
      │                          │
      │  Credit:                 │
      │   ASSET    -amount       │
      │   LIABILITY +amount      │
      │   EQUITY   +amount       │
      │   REVENUE  +amount       │
      │                          │
      └──────────┬───────────────┘
                 │
                 ▼
      retainedEarnings = revenue - expenses
      totalEquity = equity + retainedEarnings

      CHECK: |assets - (liabilities + equity)| < 0.01
```

### 12.3 Quick Transaction Resolution

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

-- Constraint:
CHECK (debit_account_id IS NULL OR credit_account_id IS NULL
       OR debit_account_id != credit_account_id)
```

---

## Appendix B: Glossary

| Term | Arti |
|------|------|
| Normal Balance | Sisi yang menambah saldo akun (DEBIT untuk Asset/Expense, CREDIT untuk Liability/Equity/Revenue) |
| Double-Entry | Setiap transaksi dicatat di minimal 2 akun: satu debit, satu credit |
| Chart of Accounts (CoA) | Daftar semua akun yang digunakan untuk mencatat transaksi |
| Retained Earnings | Akumulasi laba/rugi yang belum dibagikan |
| CAPEX | Capital Expenditure - pengeluaran untuk membeli aset tetap |
| OPEX | Operating Expense - biaya operasional rutin |
| COGS / VAR | Cost of Goods Sold / Variable Cost - biaya yang berubah sesuai volume |
| Prive | Penarikan modal oleh pemilik untuk keperluan pribadi |
| RLS | Row Level Security - PostgreSQL feature untuk access control per-row |

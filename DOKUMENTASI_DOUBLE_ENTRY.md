# Dokumentasi Implementasi: Double-Entry Bookkeeping (Debit/Credit)

## 📋 Daftar Isi

1. [Overview](#overview)
2. [Cara Kerja Double-Entry Bookkeeping](#cara-kerja-double-entry-bookkeeping)
3. [Arsitektur Sistem](#arsitektur-sistem)
4. [Database Schema](#database-schema)
5. [Alur Kerja Transaksi](#alur-kerja-transaksi)
6. [API Documentation](#api-documentation)
7. [Panduan Penggunaan](#panduan-penggunaan)
8. [Backward Compatibility](#backward-compatibility)
9. [Referensi Dokumen Lain](#referensi-dokumen-lain)

---

## Overview

### Apa itu Double-Entry Bookkeeping?

Double-Entry Bookkeeping adalah sistem pencatatan akuntansi yang mencatat setiap transaksi keuangan ke dalam **dua akun berbeda**: satu akun di-**debit**, satu akun di-**kredit**. Sistem ini memastikan bahwa setiap transaksi selalu seimbang (balanced).

**Prinsip Dasar:**
```
Total Debit = Total Kredit
```

### Mengapa Perlu Double-Entry?

**Sebelum (Single-Entry):**
- Transaksi hanya dicatat dengan kategori (EARN, OPEX, dll) dan account text field
- Sulit tracking saldo per akun (contoh: berapa saldo BCA saat ini?)
- Tidak bisa reconcile dengan bank statement
- Laporan keuangan kurang detail

**Sesudah (Double-Entry):**
- ✅ Tracking saldo per akun secara akurat
- ✅ Bank reconciliation mungkin dilakukan
- ✅ Trial balance otomatis (validasi debit = kredit)
- ✅ Laporan keuangan lebih profesional
- ✅ Tetap backward compatible dengan data lama

### Filosofi Implementasi

1. **Simple First**: Tetap gunakan kategori (EARN, OPEX, dll) untuk kemudahan user
2. **Smart Defaults**: Sistem otomatis suggest akun debit/kredit berdasarkan kategori
3. **Backward Compatible**: Data transaksi lama tetap berfungsi tanpa perubahan
4. **Progressive Enhancement**: User bisa pilih format lama (simple) atau baru (double-entry)

---

## Cara Kerja Double-Entry Bookkeeping

### Konsep Dasar: Debit vs Credit

**Debit (Dr)** = Sisi Kiri
**Credit (Cr)** = Sisi Kanan

| Tipe Akun | Debit (+) | Credit (-) | Normal Balance |
|-----------|-----------|------------|----------------|
| **ASSET** (Aset) | Bertambah | Berkurang | Debit |
| **LIABILITY** (Liabilitas) | Berkurang | Bertambah | Credit |
| **EQUITY** (Modal) | Berkurang | Bertambah | Credit |
| **REVENUE** (Pendapatan) | Berkurang | Bertambah | Credit |
| **EXPENSE** (Beban) | Bertambah | Berkurang | Debit |

### Cara Mengingat (Mnemonik)

**"DEALER"**
- **D**ebit: **E**xpense (Beban), **A**sset (Aset), **L**oss (Kerugian)
- Cr**E**dit: **E**quity (Modal), **R**evenue (Pendapatan)

**"A-L-E-R-E"**
- **A**sset = Debit normal
- **L**iability = Credit normal
- **E**quity = Credit normal
- **R**evenue = Credit normal
- **E**xpense = Debit normal

### Contoh Transaksi Praktis

#### Contoh 1: Terima Pendapatan Sewa Rp 5.000.000 via BCA

**Analisis:**
- Uang masuk ke bank (ASSET bertambah) → **Debit**
- Pendapatan sewa bertambah (REVENUE bertambah) → **Credit**

**Journal Entry:**
```
Debit:  1120 - Bank BCA             Rp 5.000.000
Credit: 4100 - Rental Income        Rp 5.000.000
Deskripsi: Terima pembayaran sewa dari Customer A
```

**Yang Terjadi:**
- ✅ Saldo Bank BCA bertambah Rp 5.000.000
- ✅ Pendapatan sewa bertambah Rp 5.000.000
- ✅ Total Debit (5 juta) = Total Credit (5 juta) → Seimbang!

---

#### Contoh 2: Bayar Listrik Rp 800.000 dari Bank BCA

**Analisis:**
- Beban listrik bertambah (EXPENSE bertambah) → **Debit**
- Uang keluar dari bank (ASSET berkurang) → **Credit**

**Journal Entry:**
```
Debit:  5110 - Utilities - Electricity   Rp 800.000
Credit: 1120 - Bank BCA                  Rp 800.000
Deskripsi: Pembayaran listrik bulan Januari
```

**Yang Terjadi:**
- ✅ Beban listrik bertambah Rp 800.000
- ✅ Saldo Bank BCA berkurang Rp 800.000
- ✅ Total Debit (800 ribu) = Total Credit (800 ribu) → Seimbang!

---

#### Contoh 3: Beli Furniture Rp 10.000.000 dengan Bank Transfer

**Analisis:**
- Furniture (ASSET) bertambah → **Debit**
- Uang keluar dari bank (ASSET berkurang) → **Credit**

**Journal Entry:**
```
Debit:  1220 - Furniture & Fixtures    Rp 10.000.000
Credit: 1120 - Bank BCA                Rp 10.000.000
Deskripsi: Pembelian kursi dan meja untuk property
```

**Yang Terjadi:**
- ✅ Aset furniture bertambah Rp 10 juta
- ✅ Saldo Bank BCA berkurang Rp 10 juta
- ✅ Total aset tetap sama (hanya pindah dari cash ke furniture)

---

#### Contoh 4: Owner Tarik Dana (Drawings) Rp 2.000.000

**Analisis:**
- Owner drawings bertambah (EQUITY berkurang) → **Debit**
- Uang keluar dari bank (ASSET berkurang) → **Credit**

**Journal Entry:**
```
Debit:  3300 - Owner Drawings    Rp 2.000.000
Credit: 1120 - Bank BCA          Rp 2.000.000
Deskripsi: Penarikan dana untuk keperluan pribadi pemilik
```

**Yang Terjadi:**
- ✅ Modal pemilik berkurang Rp 2 juta
- ✅ Saldo Bank BCA berkurang Rp 2 juta
- ✅ Equity berkurang, tapi aset juga berkurang (net worth berkurang)

---

### Visualisasi T-Account

**T-Account** adalah cara visual untuk memahami debit/credit:

```
        Bank BCA (1120)
    ────────────────────────
    Debit    |    Credit
    ────────────────────────
     5.000.000 |      800.000  (Bayar listrik)
              | 10.000.000  (Beli furniture)
              |  2.000.000  (Owner withdrawal)
    ────────────────────────
Saldo: -7.800.000 (net berkurang)
```

```
    Rental Income (4100)
    ────────────────────────
    Debit    |    Credit
    ────────────────────────
             |   5.000.000  (Terima sewa)
    ────────────────────────
Saldo: +5.000.000 (pendapatan)
```

---

## Arsitektur Sistem

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     User Interface                      │
│  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │ Transaction Form │  │ Excel Import Modal       │   │
│  └────────┬─────────┘  └────────┬─────────────────┘   │
│           │                     │                       │
└───────────┼─────────────────────┼───────────────────────┘
            │                     │
            ▼                     ▼
┌─────────────────────────────────────────────────────────┐
│                   API Layer                             │
│  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │ transactions.ts  │  │ accounts.ts              │   │
│  └────────┬─────────┘  └────────┬─────────────────┘   │
└───────────┼─────────────────────┼───────────────────────┘
            │                     │
            ▼                     ▼
┌─────────────────────────────────────────────────────────┐
│                 Supabase Database                       │
│  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │  transactions    │  │  accounts                │   │
│  │  - id            │  │  - id                    │   │
│  │  - category      │  │  - account_code          │   │
│  │  - amount        │  │  - account_name          │   │
│  │  - account (old) │  │  - account_type          │   │
│  │  - debit_id (NEW)│  │  - normal_balance        │   │
│  │  - credit_id(NEW)│  │  - is_system             │   │
│  └──────────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
Page: /transactions
│
├── TransactionsList
│   ├── TransactionCard (per item)
│   └── TransactionDetailModal
│       └── TransactionForm (edit mode)
│
├── TransactionForm (add modal)
│   ├── CategoryDropdown
│   ├── AccountDropdown (Debit) ⭐ NEW
│   ├── AccountDropdown (Credit) ⭐ NEW
│   └── Form Fields (name, description, amount, etc)
│
└── TransactionImportModal
    ├── TemplateDownloader
    ├── FileUploader
    ├── ValidationPreview
    └── ImportProgress
```

### Data Flow

#### Create Transaction (Manual Entry)

```
1. User opens form
   └→ Form fetches accounts from API
       └→ getAccounts(businessId)
           └→ SELECT * FROM accounts WHERE business_id = ?

2. User selects category (e.g., "EARN")
   └→ Form auto-suggests:
       - Debit: 1120 (Bank BCA)
       - Credit: 4100 (Rental Income)

3. User fills in amount, name, description

4. User clicks "Tambah Transaksi"
   └→ Form validation:
       ✓ Debit account ≠ Credit account
       ✓ If debit/credit filled, both must be filled
       ✓ Amount > 0

5. Submit to API
   └→ createTransaction({
       category: "EARN",
       amount: 5000000,
       debit_account_id: "uuid-1120",
       credit_account_id: "uuid-4100",
       is_double_entry: true,
       ...
   })

6. Database insert
   └→ INSERT INTO transactions (...)

7. UI refreshes
   └→ Transaction list reloads
```

#### Import from Excel

```
1. User downloads template
   └→ Template has 8 columns:
       Date | Category | Name | Description | Amount | Account | Debit | Credit

2. User fills Excel with account codes
   Example:
   - Debit: 1120
   - Credit: 4100

3. User uploads file
   └→ Parse Excel (excelParser.ts)
       └→ Extract rows to ParsedRow[]

4. Validate data (excelValidator.ts)
   └→ Check: Account codes exist in database
   └→ Check: Debit ≠ Credit
   └→ Check: Both filled or both empty
   └→ Show preview with errors

5. User clicks "Import"
   └→ createTransactionsBulk([...])
       └→ Batch insert (100 rows per batch)
       └→ Progress updates

6. Success message
   └→ Transaction list reloads
```

---

## Database Schema

### Tabel: `accounts`

**Purpose:** Master data untuk Chart of Accounts (daftar semua akun)

```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY,
    business_id UUID REFERENCES businesses(id),
    account_code TEXT NOT NULL,           -- "1120", "4100", dll
    account_name TEXT NOT NULL,           -- "Bank BCA", "Rental Income"
    account_type TEXT CHECK (account_type IN (
        'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'
    )),
    parent_account_id UUID REFERENCES accounts(id),
    normal_balance TEXT CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE,      -- System account tidak bisa dihapus
    sort_order INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(business_id, account_code)
);
```

**Indexes:**
```sql
CREATE INDEX idx_accounts_business_id ON accounts(business_id);
CREATE INDEX idx_accounts_code ON accounts(business_id, account_code);
CREATE INDEX idx_accounts_type ON accounts(account_type);
```

**Default Accounts:** Setiap business baru otomatis mendapat 40 default accounts:
- 10 Asset accounts (1xxx)
- 6 Liability accounts (2xxx)
- 3 Equity accounts (3xxx)
- 3 Revenue accounts (4xxx)
- 18 Expense accounts (5xxx)

Lihat detail lengkap di: [ACCOUNT_CODES_REFERENCE.md](./ACCOUNT_CODES_REFERENCE.md)

---

### Tabel: `transactions` (Updated)

**Purpose:** Data transaksi keuangan

**Kolom Baru:**
```sql
ALTER TABLE transactions
    ADD COLUMN debit_account_id UUID REFERENCES accounts(id),
    ADD COLUMN credit_account_id UUID REFERENCES accounts(id),
    ADD COLUMN is_double_entry BOOLEAN DEFAULT FALSE,
    ADD COLUMN notes TEXT;
```

**Full Schema:**
```sql
CREATE TABLE transactions (
    -- Existing columns (backward compatible)
    id UUID PRIMARY KEY,
    business_id UUID REFERENCES businesses(id),
    date DATE NOT NULL,
    category TEXT CHECK (category IN ('EARN','OPEX','VAR','CAPEX','TAX','FIN')),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    account TEXT,                        -- ⚠️ Legacy field (still used)
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,

    -- NEW: Double-entry columns
    debit_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    credit_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    is_double_entry BOOLEAN DEFAULT FALSE,
    notes TEXT
);
```

**Constraints:**
```sql
-- Debit dan credit harus berbeda
ALTER TABLE transactions
    ADD CONSTRAINT check_different_accounts
    CHECK (
        debit_account_id IS NULL OR
        credit_account_id IS NULL OR
        debit_account_id != credit_account_id
    );
```

**Query dengan Join:**
```sql
SELECT
    t.*,
    da.account_code as debit_code,
    da.account_name as debit_name,
    ca.account_code as credit_code,
    ca.account_name as credit_name
FROM transactions t
LEFT JOIN accounts da ON t.debit_account_id = da.id
LEFT JOIN accounts ca ON t.credit_account_id = ca.id
WHERE t.business_id = ?
ORDER BY t.date DESC;
```

---

### Row Level Security (RLS)

**Accounts Table:**
```sql
-- User hanya bisa lihat accounts dari business mereka
CREATE POLICY "Users can view accounts for their businesses"
    ON accounts FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM user_business_roles
            WHERE user_id = auth.uid()
        )
    );

-- Manager bisa manage accounts
CREATE POLICY "Managers can manage accounts"
    ON accounts FOR ALL
    USING (
        business_id IN (
            SELECT business_id FROM user_business_roles
            WHERE user_id = auth.uid()
            AND role IN ('business_manager', 'both')
        )
    );
```

---

## Alur Kerja Transaksi

### Skenario 1: Transaksi Manual (Double-Entry Format)

**User Story:** Saya ingin mencatat penerimaan sewa Rp 5.000.000 via BCA

**Flow:**

1. **Buka Form Transaksi**
   - Click button "+ Tambah Transaksi"
   - Form modal muncul

2. **Pilih Kategori**
   - Select: "Pendapatan (EARN)"
   - Sistem auto-suggest:
     - 💡 Debit: 1120 - Bank BCA
     - 💡 Credit: 4100 - Rental Income
     - Hint: "Uang masuk ke bank → Pendapatan"

3. **Pilih Akun Debit**
   - Click dropdown "Uang Keluar Dari / Beban"
   - Search "BCA" atau scroll
   - Akun tersuggest ditandai dengan label biru "Saran"
   - Select: "1120 - Bank BCA"

4. **Pilih Akun Credit**
   - Click dropdown "Uang Masuk Ke / Pendapatan"
   - Akun tersuggest: "4100 - Rental Income"
   - Select: "4100 - Rental Income"

5. **Isi Data Lainnya**
   - Nama: "Customer A"
   - Deskripsi: "Pembayaran sewa bulan Februari"
   - Jumlah: 5.000.000 (auto-formatted: "5.000.000")
   - Tanggal: 2025-02-01

6. **Submit**
   - Click "Tambah Transaksi"
   - Validasi passed ✓
   - Transaction created:
     ```json
     {
       "category": "EARN",
       "amount": 5000000,
       "debit_account_id": "uuid-1120",
       "credit_account_id": "uuid-4100",
       "is_double_entry": true,
       "account": "BCA"  // Auto-filled for legacy compat
     }
     ```

7. **Result**
   - Modal closes
   - Transaction list refresh
   - New transaction appears with:
     - Debit: 1120 - Bank BCA
     - Credit: 4100 - Rental Income

---

### Skenario 2: Transaksi Legacy (Backward Compatible)

**User Story:** Saya ingin pakai format lama (tanpa debit/credit)

**Flow:**

1. Buka form transaksi
2. Pilih kategori: "OPEX"
3. **Skip debit/credit dropdowns** (biarkan kosong)
4. Isi nama, deskripsi, jumlah
5. Isi field **"Akun"** (legacy field di bawah): "Cash"
6. Submit

**Result:**
```json
{
  "category": "OPEX",
  "amount": 500000,
  "account": "Cash",
  "is_double_entry": false,
  "debit_account_id": null,
  "credit_account_id": null
}
```

**Kenapa Legacy Format Masih Didukung?**
- ✅ Data transaksi lama tetap berfungsi
- ✅ User yang belum paham double-entry tetap bisa pakai
- ✅ Tidak ada breaking changes
- ✅ Migrasi bertahap (user belajar pelan-pelan)

---

### Skenario 3: Import Excel (Bulk)

**User Story:** Saya punya 100 transaksi di Excel, ingin import sekaligus

**Preparation:**
1. Download template dari button "📥 Download Template"
2. Buka Excel, sheet "Account Codes" untuk lihat kode akun
3. Isi sheet "Data" dengan format:

| Date | Category | Name | Description | Amount | Account | Debit | Credit |
|------|----------|------|-------------|--------|---------|-------|--------|
| 2025-02-01 | EARN | Customer A | Rent Feb | 5000000 | BCA | 1120 | 4100 |
| 2025-02-02 | OPEX | PLN | Electricity | 800000 | BCA | 5110 | 1120 |
| 2025-02-03 | VAR | Cleaning Co | Clean service | 500000 | Cash | 5210 | 1110 |

**Import Flow:**

1. **Upload File**
   - Click "Import Excel" button
   - Drag & drop atau choose file
   - File: `transactions_feb_2025.xlsx`

2. **Parsing & Validation**
   - System parses Excel → 100 rows found
   - Validates each row:
     - ✓ Account code "1120" exists
     - ✓ Account code "4100" exists
     - ✓ Debit ≠ Credit
     - ✗ Row 50: Account code "9999" not found → Error
   - Shows preview table with:
     - Valid rows: 99 (green)
     - Invalid rows: 1 (red with error message)

3. **Fix Errors**
   - User sees: "Row 50: Account code '9999' not found"
   - User closes modal, fixes Excel
   - Re-upload → 100 valid rows

4. **Execute Import**
   - Click "Import 100 Transactions"
   - Progress bar shows:
     - "Importing... 25/100 (25%)"
     - "Importing... 50/100 (50%)"
     - "Importing... 100/100 (100%)"
   - Success message: "Successfully imported 100 transactions!"

5. **Result**
   - Transaction list shows all 100 new transactions
   - Mixed format: Some double-entry, some legacy
   - All categorized correctly

---

## API Documentation

### Accounts API

**File:** `/src/lib/api/accounts.ts`

#### `getAccounts(businessId: string): Promise<Account[]>`

Get all active accounts for a business.

**Request:**
```typescript
const accounts = await getAccounts('business-uuid-123');
```

**Response:**
```typescript
[
  {
    id: 'account-uuid-1',
    business_id: 'business-uuid-123',
    account_code: '1120',
    account_name: 'Bank - BCA',
    account_type: 'ASSET',
    normal_balance: 'DEBIT',
    is_active: true,
    is_system: true,
    sort_order: 112,
    description: 'Rekening Bank BCA',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z'
  },
  // ... 39 more accounts
]
```

**Usage:**
- Form transaksi untuk populate dropdowns
- Excel import untuk validasi account codes

---

#### `getAccountByCode(businessId: string, code: string): Promise<Account | null>`

Get specific account by code.

**Request:**
```typescript
const account = await getAccountByCode('business-uuid-123', '1120');
```

**Response:**
```typescript
{
  id: 'account-uuid-1',
  account_code: '1120',
  account_name: 'Bank - BCA',
  // ... other fields
}
```

**Returns:** `null` if not found

---

#### `createAccount(account: Omit<Account, 'id' | 'created_at' | 'updated_at'>): Promise<Account>`

Create custom account.

**Request:**
```typescript
const newAccount = await createAccount({
  business_id: 'business-uuid-123',
  account_code: '1123',
  account_name: 'Bank - BRI',
  account_type: 'ASSET',
  normal_balance: 'DEBIT',
  is_active: true,
  is_system: false,
  sort_order: 115,
  description: 'Rekening Bank BRI'
});
```

**Response:**
```typescript
{
  id: 'new-account-uuid',
  account_code: '1123',
  account_name: 'Bank - BRI',
  // ... other fields
}
```

---

#### `updateAccount(id: string, updates: Partial<Account>): Promise<Account>`

Update account details.

**Request:**
```typescript
const updated = await updateAccount('account-uuid-1', {
  account_name: 'Bank BCA - Tabungan',
  description: 'Rekening tabungan BCA'
});
```

---

#### `deactivateAccount(id: string): Promise<void>`

Soft delete account (set `is_active = false`).

**Request:**
```typescript
await deactivateAccount('account-uuid-1');
```

**Note:** System accounts (`is_system = true`) cannot be deactivated.

---

### Transactions API

**File:** `/src/lib/api/transactions.ts`

#### `getTransactions(businessId: string): Promise<Transaction[]>`

Get all transactions with account joins.

**Request:**
```typescript
const transactions = await getTransactions('business-uuid-123');
```

**Response:**
```typescript
[
  {
    id: 'trans-uuid-1',
    business_id: 'business-uuid-123',
    date: '2025-02-01',
    category: 'EARN',
    name: 'Customer A',
    description: 'Rent payment',
    amount: 5000000,
    account: 'BCA',
    is_double_entry: true,
    debit_account_id: 'account-uuid-1120',
    credit_account_id: 'account-uuid-4100',
    // Joined data:
    debit_account: {
      id: 'account-uuid-1120',
      account_code: '1120',
      account_name: 'Bank - BCA',
      // ...
    },
    credit_account: {
      id: 'account-uuid-4100',
      account_code: '4100',
      account_name: 'Rental Income',
      // ...
    }
  }
]
```

---

#### `createTransaction(transaction: TransactionInsert): Promise<Transaction>`

Create single transaction.

**Request (Double-Entry):**
```typescript
const transaction = await createTransaction({
  business_id: 'business-uuid-123',
  date: '2025-02-01',
  category: 'EARN',
  name: 'Customer A',
  description: 'Rent payment',
  amount: 5000000,
  account: 'BCA',
  debit_account_id: 'account-uuid-1120',
  credit_account_id: 'account-uuid-4100',
  is_double_entry: true,
  created_by: 'user-uuid-1'
});
```

**Request (Legacy):**
```typescript
const transaction = await createTransaction({
  business_id: 'business-uuid-123',
  date: '2025-02-01',
  category: 'OPEX',
  name: 'Vendor B',
  description: 'Electricity',
  amount: 500000,
  account: 'Cash',
  created_by: 'user-uuid-1'
  // No debit/credit fields
});
```

---

#### `createTransactionsBulk(transactions: TransactionInsert[], onProgress?: (current, total) => void): Promise<BulkImportResult>`

Bulk import transactions with progress callback.

**Request:**
```typescript
const result = await createTransactionsBulk(
  [
    { /* transaction 1 */ },
    { /* transaction 2 */ },
    // ... 100 transactions
  ],
  (current, total) => {
    console.log(`Importing ${current}/${total}`);
  }
);
```

**Response:**
```typescript
{
  success: true,
  inserted: 100,
  failed: 0,
  errors: [],
  data: [ /* inserted transactions */ ]
}
```

**Batch Size:** 100 rows per batch for optimal performance.

---

#### `updateTransaction(id: string, updates: TransactionUpdate): Promise<Transaction>`

Update existing transaction.

**Request:**
```typescript
const updated = await updateTransaction('trans-uuid-1', {
  amount: 5500000,
  description: 'Updated description',
  credit_account_id: 'different-account-uuid'
});
```

---

#### `deleteTransaction(id: string): Promise<void>`

Delete transaction (hard delete).

**Request:**
```typescript
await deleteTransaction('trans-uuid-1');
```

---

## Panduan Penggunaan

### Untuk User: Cara Pakai Double-Entry

#### Step 1: Pahami Kategori dan Akun yang Cocok

| Kategori | Contoh Transaksi | Debit (Uang Keluar/Beban) | Credit (Uang Masuk/Pendapatan) |
|----------|------------------|---------------------------|-------------------------------|
| **EARN** | Terima sewa | 1120 (Bank BCA) | 4100 (Rental Income) |
| **OPEX** | Bayar listrik | 5110 (Utilities) | 1120 (Bank BCA) |
| **VAR** | Bayar cleaning | 5210 (Cleaning) | 1120 (Bank BCA) |
| **CAPEX** | Beli furniture | 1220 (Furniture) | 1120 (Bank BCA) |
| **TAX** | Bayar pajak | 5310 (Income Tax) | 1120 (Bank BCA) |
| **FIN** | Tarik dana owner | 3300 (Owner Drawings) | 1120 (Bank BCA) |

**Catatan:** Sistem akan auto-suggest akun di atas saat user pilih kategori. User bisa override kalau perlu.

---

#### Step 2: Buat Transaksi Manual

1. Click "+ Tambah Transaksi"
2. Pilih **Kategori** (contoh: EARN)
3. Lihat hint suggestion: "💡 Uang masuk ke bank → Pendapatan"
4. Pilih **Akun Debit** (yang disarankan: 1120 - Bank BCA)
5. Pilih **Akun Kredit** (yang disarankan: 4100 - Rental Income)
6. Isi **Jumlah**: 5.000.000 (auto-format dengan titik)
7. Isi **Nama**: Customer/Vendor terkait
8. Isi **Deskripsi**: Detail transaksi
9. Click "Tambah Transaksi"

**Tips:**
- Kalau pakai suggestion, tinggal klik → cepat!
- Kalau beda akun, bisa search di dropdown
- Kalau bingung, pakai format lama aja (skip debit/credit)

---

#### Step 3: Import Excel (Bulk)

**Preparation:**
1. Click "Import Excel"
2. Click "📥 Download Template"
3. Buka Excel → Sheet "Account Codes" untuk lihat semua kode akun
4. Isi sheet "Data":

```
Date       | Category | Name      | Description | Amount  | Account | Debit | Credit
2025-02-01 | EARN     | Customer  | Rent        | 5000000 | BCA     | 1120  | 4100
2025-02-05 | OPEX     | PLN       | Electricity | 800000  | BCA     | 5110  | 1120
```

**Import:**
1. Save Excel
2. Drag & drop ke import modal
3. Tunggu validasi (hijau = OK, merah = error)
4. Click "Import X Transactions"
5. Tunggu progress bar selesai
6. Done!

**Common Errors:**
- "Account code '9999' not found" → Kode akun salah, cek di sheet "Account Codes"
- "Debit and credit must be different" → Debit dan credit sama, ganti salah satu
- "Both debit and credit must be filled" → Isi debit tapi credit kosong (atau sebaliknya)

---

### Untuk Developer: Integration Guide

#### Get Accounts untuk Dropdown

```typescript
import { getAccounts } from '@/lib/api/accounts';
import { useState, useEffect } from 'react';

function TransactionForm({ businessId }) {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const data = await getAccounts(businessId);
        setAccounts(data);
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      }
    }
    fetchAccounts();
  }, [businessId]);

  return (
    <AccountDropdown
      accounts={accounts}
      value={debitAccountId}
      onChange={setDebitAccountId}
    />
  );
}
```

---

#### Create Transaction dengan Double-Entry

```typescript
import { createTransaction } from '@/lib/api/transactions';

async function handleSubmit(formData) {
  try {
    const transaction = await createTransaction({
      business_id: businessId,
      date: formData.date,
      category: formData.category,
      name: formData.name,
      description: formData.description,
      amount: formData.amount,
      account: formData.account || 'Double-entry',  // Legacy compat
      debit_account_id: formData.debit_account_id,
      credit_account_id: formData.credit_account_id,
      is_double_entry: true,
      created_by: userId
    });

    console.log('Transaction created:', transaction);
  } catch (error) {
    console.error('Failed to create transaction:', error);
  }
}
```

---

#### Validate Account Codes (Excel Import)

```typescript
import { getAccounts } from '@/lib/api/accounts';

async function validateAccountCode(code: string, businessId: string) {
  const accounts = await getAccounts(businessId);
  const exists = accounts.some(acc => acc.account_code === code);

  if (!exists) {
    throw new Error(`Account code "${code}" not found`);
  }

  return accounts.find(acc => acc.account_code === code);
}

// Usage
try {
  const debitAccount = await validateAccountCode('1120', businessId);
  console.log('Valid account:', debitAccount.account_name);
} catch (error) {
  console.error(error.message);
}
```

---

## Backward Compatibility

### How Legacy Transactions Work

**Legacy Transaction (Before Migration):**
```json
{
  "id": "old-trans-1",
  "category": "EARN",
  "amount": 1000000,
  "account": "BCA",              // Free-text field
  "is_double_entry": false,
  "debit_account_id": null,
  "credit_account_id": null
}
```

**Display Logic:**
```typescript
function TransactionDetail({ transaction }) {
  if (transaction.is_double_entry) {
    // Show debit/credit accounts
    return (
      <div>
        <p>Debit: {transaction.debit_account?.account_code} - {transaction.debit_account?.account_name}</p>
        <p>Credit: {transaction.credit_account?.account_code} - {transaction.credit_account?.account_name}</p>
      </div>
    );
  } else {
    // Show legacy account field
    return <p>Account: {transaction.account}</p>;
  }
}
```

---

### Financial Calculations (Mixed Format)

**Challenge:** Calculate totals when some transactions are double-entry, some are legacy.

**Solution:** Use category-based calculations for backward compatibility.

```typescript
function calculateRevenue(transactions: Transaction[]): number {
  // Works for both formats
  return transactions
    .filter(t => t.category === 'EARN')
    .reduce((sum, t) => sum + t.amount, 0);
}

function calculateExpenses(transactions: Transaction[]): number {
  // Works for both formats
  return transactions
    .filter(t => ['OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'].includes(t.category))
    .reduce((sum, t) => sum + t.amount, 0);
}
```

**Future Enhancement:** Account-based calculations for double-entry transactions:

```typescript
function getAccountBalance(accountId: string, transactions: Transaction[]): number {
  let balance = 0;

  transactions.forEach(t => {
    if (!t.is_double_entry) return; // Skip legacy

    if (t.debit_account_id === accountId) {
      // Debit increases: Asset, Expense
      // Debit decreases: Liability, Equity, Revenue
      const account = t.debit_account;
      if (['ASSET', 'EXPENSE'].includes(account.account_type)) {
        balance += t.amount;
      } else {
        balance -= t.amount;
      }
    }

    if (t.credit_account_id === accountId) {
      // Credit increases: Liability, Equity, Revenue
      // Credit decreases: Asset, Expense
      const account = t.credit_account;
      if (['LIABILITY', 'EQUITY', 'REVENUE'].includes(account.account_type)) {
        balance += t.amount;
      } else {
        balance -= t.amount;
      }
    }
  });

  return balance;
}
```

---

### Migration Path for Existing Data

**Current State:**
- ✅ 240 accounts created (40 per business × 6 businesses)
- ✅ Double-entry columns added to transactions table
- ✅ Existing transactions have `is_double_entry = false`

**Future (Optional):** Convert legacy transactions to double-entry

```sql
-- Example: Convert EARN transactions to double-entry
UPDATE transactions t
SET
    is_double_entry = TRUE,
    debit_account_id = (
        SELECT id FROM accounts
        WHERE business_id = t.business_id
        AND account_code = '1120'  -- Bank BCA
    ),
    credit_account_id = (
        SELECT id FROM accounts
        WHERE business_id = t.business_id
        AND account_code = '4100'  -- Rental Income
    )
WHERE t.category = 'EARN'
AND t.is_double_entry = FALSE
AND t.account ILIKE '%BCA%';  -- Only if account mentions BCA
```

**⚠️ Warning:** Only do this if user understands double-entry. Otherwise, leave legacy transactions as-is.

---

## Referensi Dokumen Lain

### 1. [ACCOUNT_CODES_REFERENCE.md](./ACCOUNT_CODES_REFERENCE.md)

**Isi:**
- Daftar lengkap 40+ account codes
- Penjelasan setiap akun dalam Bahasa Indonesia
- Common transaction patterns
- Quick tips untuk debit/credit

**Kapan Pakai:** User perlu referensi kode akun saat create transaksi atau import Excel.

---

### 2. [TESTING_GUIDE.md](./TESTING_GUIDE.md)

**Isi:**
- End-to-end testing guide
- Manual UI testing steps
- Excel import testing scenarios
- Backward compatibility testing
- Validation testing
- Checklist untuk QA

**Kapan Pakai:** Developer/QA perlu test semua fitur double-entry sebelum production.

---

### 3. Database Migration File

**File:** `/database/migrations/001_add_double_entry_bookkeeping.sql`

**Isi:**
- CREATE TABLE accounts
- ALTER TABLE transactions (add double-entry columns)
- CREATE default accounts function
- CREATE trigger untuk auto-create accounts
- RLS policies

**Kapan Pakai:** Setup database baru atau review schema.

---

## FAQ (Frequently Asked Questions)

### Q1: Apakah harus pakai double-entry?

**A:** Tidak wajib. User bisa pilih:
- **Opsi 1:** Pakai double-entry (isi debit/credit) → Tracking lebih detail
- **Opsi 2:** Pakai format lama (isi account text field) → Lebih simple

Kedua format bisa coexist dalam satu sistem.

---

### Q2: Bagaimana kalau salah pilih akun debit/credit?

**A:** Bisa edit transaksi:
1. Click transaksi yang mau diedit
2. Click "Edit"
3. Ganti akun debit/credit
4. Save

Transaksi akan terupdate, saldo akun akan disesuaikan.

---

### Q3: Bagaimana cara menambah akun custom (tidak ada di 40 default)?

**A:** Saat ini belum ada UI untuk manage accounts. Workaround:
- Gunakan 40 default accounts yang sudah ada
- Atau request developer untuk add via SQL:

```sql
INSERT INTO accounts (business_id, account_code, account_name, account_type, normal_balance)
VALUES ('your-business-id', '1140', 'Bank Permata', 'ASSET', 'DEBIT');
```

**Future:** Akan ada UI untuk add/edit custom accounts.

---

### Q4: Kenapa total debit harus sama dengan total credit?

**A:** Ini prinsip dasar double-entry bookkeeping. Setiap transaksi affect 2 akun dengan nilai sama:
- Kalau debit Rp 100.000 → credit juga Rp 100.000
- Total debit - total credit = 0 (balanced)

Kalau tidak balance, ada error dalam pencatatan.

---

### Q5: Bagaimana melihat saldo per akun (contoh: saldo BCA)?

**A:** Saat ini belum ada report khusus. Workaround via SQL:

```sql
SELECT
    COALESCE(SUM(CASE WHEN debit_account_id = 'uuid-1120' THEN amount ELSE 0 END), 0) AS total_debit,
    COALESCE(SUM(CASE WHEN credit_account_id = 'uuid-1120' THEN amount ELSE 0 END), 0) AS total_credit
FROM transactions
WHERE business_id = 'your-business-id'
AND is_double_entry = TRUE;

-- Saldo = total_debit - total_credit (untuk ASSET account)
```

**Future:** Account balance report akan ditambahkan.

---

### Q6: Apakah bisa pakai Excel format lama (tanpa kolom Debit/Credit)?

**A:** Bisa! Format lama tetap didukung:

```
Date       | Category | Name | Description | Amount  | Account
2025-02-01 | EARN     | Cust | Rent        | 5000000 | BCA
```

Biarkan kolom Debit dan Credit kosong, transaksi akan dibuat sebagai legacy format.

---

### Q7: Bagaimana kalau import Excel ada error?

**A:** System akan show validation errors di preview table:
- Row dengan error ditandai merah
- Hover untuk lihat error message
- Fix Excel file, re-upload
- Jangan proceed kalau masih ada error

Common errors:
- Invalid account code → Cek sheet "Account Codes"
- Debit = Credit → Ganti salah satu
- Missing required field → Isi semua kolom wajib

---

## Kesimpulan

### Keuntungan Double-Entry Bookkeeping

**Untuk User:**
1. ✅ **Tracking Detail:** Tahu persis saldo setiap akun (BCA, OVO, Cash, dll)
2. ✅ **Bank Reconciliation:** Bisa match dengan bank statement
3. ✅ **Professional Reports:** Laporan keuangan lebih lengkap dan akurat
4. ✅ **Audit Trail:** Mudah audit karena setiap transaksi punya jejak lengkap
5. ✅ **Backward Compatible:** Data lama tetap berfungsi, tidak ada data loss

**Untuk Developer:**
1. ✅ **Standard Practice:** Mengikuti standar akuntansi internasional
2. ✅ **Extensible:** Mudah tambah fitur (trial balance, bank recon, dll)
3. ✅ **Data Integrity:** Constraint di database ensure data valid
4. ✅ **Scalable:** Support multi-currency, multi-business di masa depan

---

### Roadmap

**Current (MVP) - DONE ✅:**
- ✅ Accounts table with 40 default accounts
- ✅ Double-entry columns in transactions
- ✅ Smart suggestions based on category
- ✅ Excel import with account code validation
- ✅ Backward compatible with legacy transactions

**Near Future:**
- Account management UI (add/edit custom accounts)
- Account balance report
- Trial balance report
- Transaction history per account

**Long Term:**
- Bank reconciliation
- Multi-currency support
- Automated closing entries
- Consolidated financial statements
- Mobile app with OCR for receipts

---

## Support & Contact

**Issues/Bugs:**
- GitHub Issues: (project repository)
- Email: (support email)

**Documentation:**
- This file: `DOKUMENTASI_DOUBLE_ENTRY.md`
- Account codes: `ACCOUNT_CODES_REFERENCE.md`
- Testing guide: `TESTING_GUIDE.md`

**Developer Notes:**
- Database migration: `/database/migrations/001_add_double_entry_bookkeeping.sql`
- API: `/src/lib/api/accounts.ts`, `/src/lib/api/transactions.ts`
- Components: `/src/components/transactions/`, `/src/components/accounts/`

---

**Terakhir diupdate:** 2025-02-02
**Versi:** 1.0.0
**Status:** Production Ready ✅

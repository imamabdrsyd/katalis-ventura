# Audit Accounting Logic — Katalis Ventura

**Tanggal audit**: 27 Maret 2026
**Auditor**: Claude Opus 4.6
**Scope**: Seluruh logic akuntansi (calculations, constants, patterns, helpers, hooks, depreciation, validations, API)

---

## A. Yang Sudah SOLID

1. **Double-entry engine** — Persamaan dasar (Dr = Cr) dijaga konsisten. Runtime assertion di `calculateBalanceSheet` sudah ada.
2. **Normal balance rules** di `src/lib/accounting/constants.ts` — benar sesuai standar (ASSET/EXPENSE = DEBIT normal, LIABILITY/EQUITY/REVENUE = CREDIT normal).
3. **Cash flow classification** mengikuti IAS 7/PSAK 2 — sudah membedakan operating payable vs financing liability.
4. **Depreciation** menggunakan straight-line sesuai PSAK 16, dihitung on-the-fly dari metadata akun.
5. **Inventory vs COGS distinction** — VAR yang debit ASSET tetap di neraca, baru masuk income statement saat dijual.
6. **Trial balance** menangani contra balances (saldo negatif ditampilkan di kolom berlawanan).
7. **Draft/posted workflow** — hanya transaksi `posted` yang masuk laporan keuangan.

---

## B. TEMUAN BUG / RISIKO

### Bug 1: Legacy FIN selalu masuk `totalInterest` — overstates interest expense
- **File**: `src/lib/calculations.ts` (baris 90-92)
- **Kode bermasalah**:
  ```ts
  if (!t.is_double_entry) {
    summary.totalInterest += amount; // BUG: semua legacy FIN = interest
  }
  ```
- **Masalah**: Legacy FIN bisa berupa pinjaman diterima, injeksi modal, atau bayar hutang — bukan semua interest. Ini menyebabkan net profit dihitung terlalu rendah untuk bisnis yang masih punya transaksi legacy FIN.
- **Solusi**: Tambah heuristik — cek `t.description` atau `t.name` untuk keyword "bunga"/"interest", sisanya jangan masuk interest.
- **Status**: [x] FIXED

### Bug 2: `calculateInitialCapital` mendeteksi fixed asset dengan range `1200-1299`
- **File**: `src/lib/calculations.ts` (baris 253)
- **Kode bermasalah**:
  ```ts
  return accountCode >= '1200' && accountCode < '1300';
  ```
- **Masalah**: Kode `1200` adalah **Bank**, bukan aset tetap. Aset tetap seharusnya kode `1300+`. Ini bisa salah menghitung initial capital.
- **Solusi**: Gunakan `default_category === 'CAPEX'` yang lebih akurat dan tidak bergantung pada kode akun.
- **Status**: [x] FIXED

### Bug 3: `detectCategory` — EXPENSE + ASSET selalu return `'OPEX'`
- **File**: `src/lib/utils/transactionHelpers.ts` (baris 65)
- **Kode bermasalah**:
  ```ts
  if (debitType === 'EXPENSE') return 'OPEX';
  ```
- **Masalah**: Beban pajak (5300) dan HPP (5200) juga Dr EXPENSE / Cr ASSET, tapi seharusnya return `TAX` dan `VAR`. Saat ini hanya fallback ke OPEX kecuali akun punya `default_category`.
- **Solusi**: Tambah deteksi berdasar kode akun: `5200` → `VAR`, `5300` → `TAX`, sisanya → `OPEX`.
- **Status**: [x] FIXED

### Bug 4: Legacy balance sheet fallback memperlakukan semua FIN sebagai liabilitas
- **File**: `src/lib/calculations.ts` (baris 419)
- **Kode bermasalah**:
  ```ts
  totalLiabilities += summary.totalFin;
  ```
- **Masalah**: FIN bisa mencakup injeksi modal (equity), bayar hutang (mengurangi liability), atau bunga (expense). Menjumlahkan semua ke liabilitas salah secara akuntansi.
- **Status**: [x] FIXED — `classifyLegacyFin()` heuristik keyword classify FIN ke equity/liability_in/liability_out/interest. Balance sheet sekarang memisahkan legacy FIN ke `legacyFinLiability`, `legacyFinEquityIn`, `legacyFinEquityOut`, `legacyFinCashOut`.

### Bug 5: Opening balance legacy FIN selalu positif (+amount)
- **File**: `src/lib/calculations.ts` (baris 632)
- **Kode bermasalah**:
  ```ts
  case 'FIN':
    opening += amount; break;
  ```
- **Masalah**: FIN bisa keluar (bayar cicilan, prive). Tanpa akun double-entry, semua FIN dianggap cash masuk. Ini bisa overstate opening balance.
- **Status**: [x] FIXED — Opening balance sekarang menggunakan `classifyLegacyFin()`: equity/liability_in → +amount (cash in), liability_out/interest → -amount (cash out).

---

## C. SARAN IMPROVEMENT OPERASIONAL

### 1. Recurring Transactions (Transaksi Berulang)
- **Prioritas**: TINGGI
- **Manfaat**: Gaji, sewa, listrik, cicilan — 60-70% transaksi UKM itu repetitif setiap bulan.
- **Status**: [x] SELESAI
  - DB: `recurring_transactions` table + RLS (`database/migrations/027_recurring_transactions.sql`)
  - API: `src/lib/api/recurring.ts` (CRUD + auto-generate due drafts)
  - Type: `RecurringTransaction`, `RecurringFrequency`, `RecurringStatus` di `src/types/index.ts`
  - Hook: `src/hooks/useRecurringTransactions.ts` (client-triggered generation, deduplicated per day via sessionStorage)
  - UI: toggle "Jadikan Berulang" di TransactionForm (frequency picker + interval + end date), tab "Berulang" di halaman transaksi dengan RecurringList (pause/resume/stop/delete)
  - Auto-generate: triggered on dashboard + transactions page load

### 2. Multi-line Journal Entry
- **Prioritas**: TINGGI
- **Manfaat**: Saat ini 1 transaksi = 1 debit + 1 credit. Banyak kasus nyata butuh multi-line:
  - Bayar gaji 5 karyawan sekaligus (5 debit, 1 credit)
  - Terima pembayaran + PPN (1 debit, 2 credit: revenue + pajak)
  - Beli aset dengan DP + hutang (1 debit, 2 credit: kas + hutang)
- **Implementasi**: Tambah tabel `journal_lines` (account_id, debit_amount, credit_amount) yang FK ke `transactions`.
- **Status**: [x] SELESAI
  - DB: `journal_lines` table + `is_multi_line` column di transactions (`database/migrations/028_multi_line_journal_entries.sql`), RLS policies per operasi (SELECT/INSERT/UPDATE/DELETE)
  - Types: `JournalLine`, `JournalLineInput` di `src/types/index.ts`, `is_multi_line` + `journal_lines?` di Transaction interface
  - Validasi: `journalLineSchema`, `createMultiLineTransactionSchema` di `src/lib/validations.ts` (balanced debit=credit, min 2 lines, one-side-nonzero per line)
  - API lib: `createMultiLineTransaction()`, `updateMultiLineTransaction()` di `src/lib/api/transactions.ts`; semua `getTransactions*` query join `journal_lines(*, account:accounts(*))`
  - API route: POST multi-line branch di `app/api/transactions/route.ts` (role check, period lock, account ownership verification, insert header + lines)
  - Kalkulasi: `calculateFinancialSummary`, `calculateBalanceSheet`, `calculateCashFlow`, `calculateOpeningBalance`, `groupTransactionsByMonth` di `src/lib/calculations.ts` — semua handle `is_multi_line` path (iterasi journal_lines per baris, classify per account_type)
  - UI: `src/components/transactions/MultiLineJournalForm.tsx` (tabel dinamis debit/kredit, validasi seimbang, running total), tombol "Multi-Baris" + modal di halaman transaksi

### 3. Piutang & Hutang Tracking (AR/AP)
- **Prioritas**: TINGGI
- **Manfaat**: Saat ini tidak ada mekanisme melacak siapa yang masih berhutang / siapa yang kita hutangi. Sangat penting untuk cash flow management.
- **Status**: [x] SELESAI
  - DB: `business_contacts` table + `contact_id` FK di transactions (`migrations/027_business_contacts.sql`, `migrations/032_ar_ap_contact_id.sql`)
  - Contact CRUD: `src/lib/api/contacts.ts` (get, search, create, update, delete, getContactTransactions)
  - Contact UI: `src/components/business/ContactList.tsx` (panel kontak + riwayat transaksi), `src/components/transactions/ContactAutocomplete.tsx` (autocomplete di form)
  - AR detection: `src/lib/accounting/guidance/receivableSettlement.ts` (isReceivableTransaction, isSettled, buildSettlementPrefill)
  - AP detection: `src/lib/accounting/guidance/payableSettlement.ts` (isPayableTransaction, isPayableSettled, buildPayableSettlementPrefill)
  - Aging hook: `src/hooks/useArApAging.ts` (kalkulasi aging bucket current/30/60/90/90+, grouping per kontak)
  - Aging page: `app/(dashboard)/ar-ap/page.tsx` (summary cards + aging table AR/AP dengan tab)
  - Sidebar: link "Piutang & Hutang" di section ACCOUNTING
  - Types: `Contact`, `ContactType`, `AgingBucket`, `AgingRow`, `ArApSummary` di `src/types/index.ts`

### 4. Bank Reconciliation
- **Prioritas**: SEDANG
- **Manfaat**: User bisa mencocokkan saldo buku dengan saldo bank. Ini standar fitur bookkeeping.
- **Status**: [x] DONE
  - DB: migration 033 (`is_reconciled`, `reconciled_at`, `reconciled_by` di transactions)
  - Hook: `src/hooks/useReconciliation.ts` (filter kas/bank, saldo buku, select + reconcile/unreconcile)
  - Halaman: `app/(dashboard)/reconciliation/page.tsx` (saldo buku vs saldo bank, selisih, checklist transaksi)
  - Sidebar: link "Rekonsiliasi Bank" di section ACCOUNTING
  - Types: `is_reconciled`, `reconciled_at`, `reconciled_by` di Transaction interface

### 5. Closing Period / Lock Period
- **Prioritas**: SEDANG
- **Manfaat**: Mencegah user mengubah transaksi di periode yang sudah ditutup (misal sudah lapor pajak).
- **Implementasi**: Tambah `closed_until_date` di tabel `businesses`. Transaksi sebelum tanggal ini tidak bisa di-edit/delete.
- **Status**: [x] DONE (migration 028, enforced di POST/PUT/DELETE API, UI di halaman Businesses)

### 6. Multi-currency Support
- **Prioritas**: RENDAH (untuk saat ini)
- **Manfaat**: Bisnis yang deal dengan supplier/customer luar negeri butuh track mata uang asing + rate konversi.
- **Status**: [ ] BELUM

### 7. Template Transaksi yang Bisa Disimpan
- **Prioritas**: TINGGI
- **Manfaat**: User bisa simpan pola transaksi yang sering dilakukan (misal "Bayar Gaji Bulanan") lalu tinggal klik + ubah tanggal/jumlah. Lebih cepat dari Quick Entry.
- **Status**: [x] SELESAI
  - DB: `transaction_templates` table + RLS (`database/migrations/027_transaction_templates.sql`)
  - API: `src/lib/api/transactionTemplates.ts` (get, create, delete)
  - Type: `TransactionTemplate` di `src/types/index.ts`
  - UI: template selector dropdown di atas form (saat buat baru), tombol "Simpan sebagai Template" di bawah form, hapus template via ikon trash

### 8. Validasi Akun Server-side yang Lebih Ketat
- **Prioritas**: SEDANG
- **Manfaat**: Saat ini Zod schema tidak validate apakah `debit_account_id` dan `credit_account_id` benar-benar exist dan milik business yang sama. Validasi hanya cek format UUID.
- **Solusi**: Tambah server-side check di route handler yang query kedua akun sebelum insert.
- **Status**: [x] DONE — POST sudah ada validasi (line 219-242), PUT sekarang juga validasi ownership akun sebelum update.

### 9. Automatic Closing Entry (Jurnal Penutup)
- **Prioritas**: SEDANG
- **Manfaat**: Di akhir tahun buku, akun pendapatan & beban harus ditutup ke Laba Ditahan. Saat ini ini dilakukan implisit via `retainedEarnings` di balance sheet calculation, tapi tidak ada jurnal eksplisit. Untuk audit trail yang bersih, sebaiknya ada fitur "Tutup Buku" yang generate closing entries otomatis.
- **Status**: [x] DONE
  - Utility: `src/lib/accounting/closingEntry.ts` (`previewClosingEntries`, `executeClosingEntries`)
  - Logic: hitung net balance per akun Revenue & Expense → generate Dr Revenue / Cr Laba Ditahan + Dr Laba Ditahan / Cr Expense
  - Halaman: `app/(dashboard)/closing-entry/page.tsx` (pilih periode → preview → execute dengan konfirmasi)
  - Sidebar: link "Tutup Buku" di section ACCOUNTING
  - Cari akun Laba Ditahan via kode 3200 atau nama "laba ditahan"/"retained earnings"

### 10. Deteksi Keyword yang Lebih Smart
- **Prioritas**: SEDANG
- **File**: `src/lib/accounting/guidance/transactionPatterns.ts`
- **Masalah**: `detectPatternFromName` pakai if-else chain yang rigid. Keyword "bayar sewa" salah detect ke `pay_opex` padahal bisa jadi "bayar sewa dari tenant" (revenue).
- **Solusi**: Tambah context awareness — kalau ada keyword "terima" + "sewa" → revenue, kalau "bayar" + "sewa" → expense.
- **Status**: [x] DONE — Ditambahkan early context check: "terima sewa"/"pendapatan sewa" → revenue. Juga "bayar pinjaman" → pay_loan (bukan receive_loan).

---

## D. RINGKASAN PRIORITAS

| # | Item | Impact | Effort | Prioritas |
|---|------|--------|--------|-----------|
| 1 | ~~Fix `calculateInitialCapital` range 1200~~ | Bug fix | Kecil | **DONE** |
| 2 | ~~Fix legacy FIN → interest overstated~~ | Bug fix | Kecil | **DONE** |
| 3 | ~~Fix `detectCategory` EXPENSE hardcode OPEX~~ | Bug fix | Kecil | **DONE** |
| 4 | ~~Fix legacy FIN balance sheet → classify per keyword~~ | Bug fix | Sedang | **DONE** |
| 5 | ~~Fix legacy FIN opening balance → cash direction~~ | Bug fix | Kecil | **DONE** |
| 6 | ~~Recurring transactions~~ | Operasional | Sedang | **DONE** |
| 7 | ~~Template transaksi~~ | Operasional | Kecil | **DONE** |
| 8 | ~~AR/AP tracking~~ | Operasional | Besar | **DONE** |
| 9 | ~~Multi-line journal entry~~ | Kelengkapan | Besar | **DONE** |
| 10 | ~~Period locking~~ | Data integrity | Sedang | **DONE** |
| 11 | ~~Validasi akun server-side~~ | Data integrity | Kecil | **DONE** |
| 12 | ~~Deteksi keyword context-aware~~ | UX | Kecil | **DONE** |
| 13 | ~~Bank reconciliation~~ | Operasional | Sedang | **DONE** |
| 14 | ~~Automatic closing entry~~ | Kelengkapan | Sedang | **DONE** |

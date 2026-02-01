# Run Migration Locally

## Migration 003: Add Loan Receivable Account

### Langkah-langkah:

1. **Buka Supabase Local Dashboard** atau **Supabase Cloud Dashboard**
   - Local: http://localhost:54323 (jika menggunakan Supabase local)
   - Cloud: https://supabase.com/dashboard

2. **Pilih SQL Editor**

3. **Copy dan Run Migration 003:**
   - Buka file: `/database/migrations/003_add_loan_receivable_account.sql`
   - Copy seluruh isi file
   - Paste di SQL Editor
   - Click **Run**

4. **Verify Migration:**
   ```sql
   SELECT * FROM accounts WHERE account_code = '1140';
   ```

   Seharusnya muncul akun "Piutang (Loan Receivable)" untuk semua business.

---

## Perubahan yang dilakukan:

### 1. ✅ Tambah Akun Piutang (Code: 1140)
- **Account Code**: 1140
- **Account Name**: Piutang (Loan Receivable)
- **Account Type**: ASSET
- **Normal Balance**: DEBIT
- **Description**: Piutang usaha dan pinjaman

### 2. ✅ Ganti Label "Earnings" → "Revenue"
- File: `src/lib/calculations.ts`
- Perubahan label kategori EARN dari "Earnings" menjadi "Revenue"

---

## Cara Menggunakan Akun Piutang:

### Contoh: Zizah hutang 7 juta

**Saat memberi pinjaman:**
- Kategori: FIN
- Nama: Zizah
- Deskripsi: Pinjaman ke Zizah
- Jumlah: 7.000.000
- Debit: 1140 - Piutang (Loan Receivable)
- Credit: 1120 - Bank BCA

**Saat menerima pembayaran:**
- Kategori: EARN
- Nama: Zizah
- Deskripsi: Pelunasan piutang dari Zizah
- Jumlah: 7.000.000
- Debit: 1120 - Bank BCA
- Credit: 1140 - Piutang (Loan Receivable)

---

## Test Aplikasi Lokal:

```bash
# 1. Pastikan database sudah di-migrate
# 2. Run development server
npm run dev

# 3. Buka http://localhost:3000
# 4. Coba tambah transaksi dengan akun Piutang
```

---

## Notes:

- Migration ini akan menambahkan akun Piutang ke SEMUA businesses yang ada
- Function `create_default_accounts` sudah di-update untuk include akun Piutang
- Akun Piutang akan otomatis dibuat untuk business baru

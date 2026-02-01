# Double-Entry Bookkeeping - End-to-End Testing Guide

## ✅ Migration Status
- ✅ Database migration completed successfully
- ✅ 6 businesses migrated with 240 total accounts (40 accounts per business)
- ✅ All code components implemented and integrated

---

## Test Plan Overview

### Phase 1: Verify Database Setup ✅ COMPLETED
- [x] Migration ran successfully
- [x] Accounts table created
- [x] Default accounts created for all businesses (40 per business)
- [x] Double-entry columns added to transactions table
- [x] Row Level Security (RLS) policies applied

### Phase 2: Manual UI Testing (Transaction Form)
Test creating transactions using the web interface

### Phase 3: Excel Import Testing
Test bulk import with both legacy and double-entry formats

### Phase 4: Backward Compatibility Testing
Verify existing transactions still work correctly

---

## Phase 2: Manual UI Testing

### Test 2.1: Create Double-Entry Transaction (Revenue)
**Goal:** Test that the form properly shows account suggestions and creates a double-entry transaction

**Steps:**
1. Navigate to `/transactions` page
2. Click "**+ Tambah Transaksi**" button
3. Fill in the form:
   - **Tanggal**: Today's date
   - **Kategori**: Select "**Pendapatan (EARN)**"
   - **Observe**: The hint should show "💡 Uang masuk ke bank → Pendapatan"
   - **Akun Debit**: Click and verify the dropdown shows:
     - Searchable list of accounts
     - Grouped by type (Aset, Liabilitas, etc.)
     - **Suggested account highlighted**: "1120 - Bank BCA" (in blue with "Saran" tag)
   - Select "**1120 - Bank BCA**"
   - **Akun Kredit**: Click and verify:
     - Suggested account: "4100 - Rental Income"
   - Select "**4100 - Rental Income**"
   - **Nama**: "Test Customer A"
   - **Deskripsi**: "Payment for January rental"
   - **Jumlah**: 5000000
   - **Catatan (optional)**: "Test transaction for double-entry"
4. Click "**Tambah Transaksi**"

**Expected Results:**
- ✅ Transaction created successfully
- ✅ Form closes and transaction list refreshes
- ✅ New transaction appears in the list
- ✅ Click on the transaction to view details:
  - Should show debit account: "1120 - Bank BCA"
  - Should show credit account: "4100 - Rental Income"
  - Should show notes field

**Database Verification (Optional):**
Run this query in Supabase SQL Editor:
```sql
SELECT
  id,
  date,
  category,
  name,
  amount,
  account,
  is_double_entry,
  debit_account_id,
  credit_account_id,
  notes
FROM transactions
WHERE name = 'Test Customer A'
ORDER BY created_at DESC
LIMIT 1;
```

Expected:
- `is_double_entry` = `true`
- `debit_account_id` = UUID (not null)
- `credit_account_id` = UUID (not null)

---

### Test 2.2: Create Double-Entry Transaction (Expense)
**Goal:** Test expense category with different accounts

**Steps:**
1. Click "**+ Tambah Transaksi**"
2. Fill in:
   - **Kategori**: "**Beban Operasional (OPEX)**"
   - **Observe**: Hint should show "💡 Bayar beban operasional dari bank"
   - **Akun Debit**: Select "**5110 - Utilities - Electricity**"
   - **Akun Kredit**: Select "**1120 - Bank BCA**"
   - **Nama**: "PLN"
   - **Deskripsi**: "Electricity bill January 2025"
   - **Jumlah**: 800000
3. Submit

**Expected Results:**
- ✅ Transaction created successfully
- ✅ Debit account: 5110 (Utilities)
- ✅ Credit account: 1120 (Bank)

---

### Test 2.3: Create Legacy Transaction (Backward Compatible)
**Goal:** Verify old format still works (no debit/credit accounts)

**Steps:**
1. Click "**+ Tambah Transaksi**"
2. Fill in:
   - **Kategori**: "**Beban Variabel (VAR)**"
   - **Leave Akun Debit and Akun Kredit EMPTY** (don't select anything)
   - **Nama**: "Cleaning Service"
   - **Deskripsi**: "Monthly cleaning"
   - **Jumlah**: 300000
   - **Akun** (legacy field at bottom): "Cash"
3. Submit

**Expected Results:**
- ✅ Transaction created successfully
- ✅ `is_double_entry` = `false`
- ✅ `account` = "Cash" (legacy field)
- ✅ `debit_account_id` and `credit_account_id` are NULL

---

### Test 2.4: Validation Testing
**Goal:** Verify form validation works correctly

**Test 2.4a: Same Debit and Credit Account**
1. Try to create transaction with:
   - Debit Account: "1120 - Bank BCA"
   - Credit Account: "1120 - Bank BCA" (same)
2. Expected: ✅ Error message: "Akun debit dan kredit harus berbeda"

**Test 2.4b: Only Debit Filled, Credit Empty**
1. Try to create transaction with:
   - Debit Account: "1120 - Bank BCA"
   - Credit Account: (empty)
2. Expected: ✅ Error message: "Akun kredit harus diisi"

**Test 2.4c: Only Credit Filled, Debit Empty**
1. Try to create transaction with:
   - Debit Account: (empty)
   - Credit Account: "4100 - Rental Income"
2. Expected: ✅ Error message: "Akun debit harus diisi"

---

### Test 2.5: Quick Add Buttons
**Goal:** Test the "+ Earn" and "+ Spend" quick add buttons

**Test "+ Earn" Button:**
1. Click "**+ Earn**" button (green button in toolbar)
2. Expected:
   - ✅ Modal opens with title "Tambah Pemasukan"
   - ✅ Category is pre-selected to "EARN"
   - ✅ Only "EARN" category available
   - ✅ Suggested accounts: Debit=1120, Credit=4100

**Test "+ Spend" Button:**
1. Click "**+ Spend**" button (red button in toolbar)
2. Expected:
   - ✅ Modal opens with title "Tambah Pengeluaran"
   - ✅ Category is pre-selected to "OPEX"
   - ✅ Only "OPEX" and "VAR" categories available
   - ✅ Suggested accounts shown for OPEX

---

### Test 2.6: Edit Transaction
**Goal:** Verify editing transactions works with double-entry fields

**Steps:**
1. Click on a transaction in the list
2. Click "Edit" button in the detail modal
3. Modify:
   - Change debit account to different account
   - Change amount
   - Update notes
4. Save

**Expected Results:**
- ✅ Transaction updated successfully
- ✅ Changes reflected in transaction list
- ✅ Debit/credit accounts updated correctly

---

## Phase 3: Excel Import Testing

### Test 3.1: Download Template
**Goal:** Verify the new Excel template has the correct format

**Steps:**
1. Click "**Import Excel**" button
2. In the import modal, click "**📥 Download Template**"
3. Open the downloaded Excel file

**Expected Results:**
- ✅ File downloaded as `Transaction_Import_Template.xlsx`
- ✅ Contains 4 sheets:
  1. **Data** - Main sheet for entering transactions
  2. **Instructions** - Usage guide (in Bahasa Indonesia)
  3. **Categories** - List of valid categories
  4. **Account Codes** - NEW: Complete list of 40+ account codes organized by type
- ✅ **Data Sheet** has 8 columns:
  1. Date
  2. Category
  3. Name
  4. Description
  5. Amount
  6. Account (legacy)
  7. **Debit Account** (NEW)
  8. **Credit Account** (NEW)
- ✅ Sample data rows show both legacy and double-entry formats
- ✅ **Account Codes Sheet** shows all accounts with:
  - Account Code (e.g., "1120")
  - Account Name (e.g., "Bank - BCA")
  - Type (e.g., "ASSET")
  - Description (in Bahasa Indonesia)

---

### Test 3.2: Import with Double-Entry Format
**Goal:** Test importing transactions with debit/credit account codes

**Steps:**
1. Open the downloaded template
2. Go to "**Account Codes**" sheet and find the account codes:
   - Bank BCA = **1120**
   - Rental Income = **4100**
   - Utilities - Electricity = **5110**
3. In "**Data**" sheet, add these rows:

| Date | Category | Name | Description | Amount | Account | Debit Account | Credit Account |
|------|----------|------|-------------|--------|---------|---------------|----------------|
| 2025-02-01 | EARN | Customer A | February rent | 5000000 | BCA | 1120 | 4100 |
| 2025-02-02 | EARN | Customer B | February rent | 4500000 | BCA | 1120 | 4100 |
| 2025-02-05 | OPEX | PLN | Electricity | 800000 | BCA | 5110 | 1120 |
| 2025-02-10 | VAR | Cleaning Co | Monthly cleaning | 500000 | Cash | 5210 | 1120 |

4. Save the file
5. In the import modal:
   - Click "**Choose File**" or drag & drop
   - Select your Excel file
6. Wait for validation to complete

**Expected Results:**
- ✅ File parsed successfully
- ✅ Shows: "4 valid rows, 0 errors"
- ✅ Preview table displays:
  - All 4 transactions
  - **Debit Account** and **Credit Account** columns visible
  - Account codes shown (1120, 4100, 5110, 5210)
- ✅ No validation errors
7. Click "**Import X Transactions**"
8. Wait for import to complete

**Expected Results:**
- ✅ Success message: "Successfully imported 4 transactions!"
- ✅ Modal closes automatically
- ✅ Transaction list refreshes
- ✅ All 4 transactions appear in the list
- ✅ Click on each transaction to verify:
  - Debit/credit accounts populated correctly
  - `is_double_entry` = true

---

### Test 3.3: Import with Legacy Format (Backward Compatible)
**Goal:** Verify old template format still works

**Steps:**
1. Open template
2. Add these rows (WITHOUT debit/credit accounts):

| Date | Category | Name | Description | Amount | Account | Debit Account | Credit Account |
|------|----------|------|-------------|--------|---------|---------------|----------------|
| 2025-02-15 | EARN | Customer C | Service fee | 1000000 | OVO | | |
| 2025-02-16 | OPEX | Internet Provider | Monthly internet | 400000 | Cash | | |

3. Import the file

**Expected Results:**
- ✅ 2 valid rows, 0 errors
- ✅ Import successful
- ✅ Transactions created with:
  - `is_double_entry` = false
  - `account` = "OVO" / "Cash"
  - `debit_account_id` and `credit_account_id` = NULL

---

### Test 3.4: Import with Mixed Formats
**Goal:** Verify both formats can coexist in one import

**Steps:**
1. Create Excel with mix of legacy and double-entry:

| Date | Category | Name | Description | Amount | Account | Debit Account | Credit Account |
|------|----------|------|-------------|--------|---------|---------------|----------------|
| 2025-02-20 | EARN | Customer D | Rent | 6000000 | BCA | 1120 | 4100 |
| 2025-02-21 | OPEX | Water Bill | PDAM | 200000 | Cash | | |
| 2025-02-22 | VAR | Guest Amenities | Toiletries | 150000 | GoPay | 5220 | 1131 |

2. Import

**Expected Results:**
- ✅ All 3 transactions imported successfully
- ✅ Row 1 and 3: double-entry format
- ✅ Row 2: legacy format

---

### Test 3.5: Validation Error Handling
**Goal:** Test that invalid data is caught by validation

**Test 3.5a: Invalid Account Code**
1. Add row with invalid account code:
   - Debit Account: "9999" (doesn't exist)
   - Credit Account: "4100"
2. Import

**Expected:**
- ✅ Validation error: "Account code '9999' not found"
- ✅ Row marked as invalid
- ✅ Cannot proceed with import until fixed

**Test 3.5b: Same Debit and Credit**
1. Add row with:
   - Debit Account: "1120"
   - Credit Account: "1120" (same)
2. Import

**Expected:**
- ✅ Validation error: "Debit and credit accounts must be different"

**Test 3.5c: Only One Account Filled**
1. Add row with:
   - Debit Account: "1120"
   - Credit Account: (empty)
2. Import

**Expected:**
- ✅ Validation error: "If using double-entry, both debit and credit must be filled"

---

## Phase 4: Backward Compatibility Testing

### Test 4.1: View Old Transactions
**Goal:** Verify existing transactions (created before migration) still display correctly

**Steps:**
1. Navigate to transactions page
2. Filter by date range to show old transactions (before today)
3. Click on an old transaction

**Expected Results:**
- ✅ Old transactions display correctly
- ✅ Show legacy "Account" field (e.g., "BCA", "Cash")
- ✅ Debit/credit accounts are empty/not shown
- ✅ No errors or crashes

---

### Test 4.2: Edit Old Transaction
**Goal:** Verify you can edit old transactions without breaking them

**Steps:**
1. Click on an old (legacy) transaction
2. Click "Edit"
3. Modify the description or amount (don't touch account fields)
4. Save

**Expected Results:**
- ✅ Transaction updated successfully
- ✅ Still shows as legacy format (is_double_entry = false)
- ✅ Account field unchanged

---

### Test 4.3: Reports and Calculations
**Goal:** Verify financial calculations still work with mixed transaction types

**Steps:**
1. Navigate to dashboard or financial statements
2. Check that totals calculate correctly

**Expected Results:**
- ✅ Total revenue includes both legacy and double-entry EARN transactions
- ✅ Total expenses includes both legacy and double-entry expense transactions
- ✅ Net income calculation correct

---

## Test Results Summary

### ✅ Checklist

#### Database & Migration
- [ ] Migration completed without errors
- [ ] 40 accounts created per business
- [ ] RLS policies working (users can only see their own business accounts)

#### UI - Transaction Form
- [ ] Form loads accounts successfully
- [ ] Account dropdown shows all accounts grouped by type
- [ ] Search functionality works in account dropdown
- [ ] Category suggestions appear and are correct
- [ ] Can create double-entry transaction
- [ ] Can create legacy transaction (backward compatible)
- [ ] Validation errors display correctly
- [ ] Quick add buttons work (+ Earn, + Spend)
- [ ] Can edit transactions
- [ ] Can view transaction details with debit/credit accounts

#### Excel Import
- [ ] Template downloads successfully
- [ ] Template has 8 columns (including Debit/Credit)
- [ ] Template has 4 sheets (Data, Instructions, Categories, Account Codes)
- [ ] Can import double-entry format
- [ ] Can import legacy format
- [ ] Can import mixed formats
- [ ] Validation catches invalid account codes
- [ ] Validation catches duplicate debit/credit
- [ ] Validation catches incomplete pairs
- [ ] Import progress shows correctly
- [ ] Success message displays

#### Backward Compatibility
- [ ] Old transactions display correctly
- [ ] Can edit old transactions
- [ ] Reports calculate correctly with mixed formats
- [ ] No breaking changes to existing data

---

## Common Issues & Troubleshooting

### Issue: Accounts not loading in dropdown
**Check:**
1. Open browser DevTools → Network tab
2. Look for `/api` calls
3. Check if `getAccounts()` API call succeeded
4. Verify RLS policies allow user to view accounts

**Solution:** Verify user has proper role assignment in `user_business_roles` table

### Issue: Transaction not saving
**Check:**
1. Browser console for errors
2. Verify businessId and userId are present
3. Check that form validation passed

### Issue: Import validation fails
**Check:**
1. Account codes in Excel match exactly with database (case-sensitive)
2. All required columns present
3. Date format is valid (YYYY-MM-DD or DD/MM/YYYY)
4. Category values are valid (EARN, OPEX, VAR, CAPEX, TAX, FIN)

---

## Performance Benchmarks

Expected performance:
- **Account loading**: < 500ms
- **Form submission**: < 1s
- **Excel parsing (100 rows)**: < 2s
- **Import (100 transactions)**: < 5s
- **Import (1000 transactions)**: < 30s

---

## Next Steps After Testing

Once all tests pass:
1. ✅ Mark "Test end-to-end functionality" as completed
2. 📝 Document any issues found
3. 🎉 Feature ready for production use!

### Future Enhancements (Optional)
- Trial Balance Report
- Bank Reconciliation
- Account Hierarchy (parent-child accounts)
- Automated Closing Entries
- Multi-Currency Support

---

**Testing completed by:** _________________

**Date:** _________________

**All tests passed:** ☐ Yes  ☐ No (see notes below)

**Notes:**

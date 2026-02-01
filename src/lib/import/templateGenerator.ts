import * as XLSX from 'xlsx';

/**
 * Generate Excel template for transaction import
 */
export function generateExcelTemplate(): Blob {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Template with sample data
  const templateData = [
    // Header row
    ['Date', 'Category', 'Name', 'Description', 'Amount', 'Account', 'Debit Account', 'Credit Account'],
    // Sample row 1: Double-entry format (new style)
    ['2025-01-02', 'EARN', 'Customer A', '4 nights rental at Property X', 1312005, 'BCA', '1120', '4100'],
    // Sample row 2: Legacy format (old style - backward compatible)
    ['2025-01-15', 'OPEX', 'Vendor B', 'Monthly electricity bill', 500000, 'Cash', '', ''],
    // Empty rows for user to fill
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
  ];

  const templateSheet = XLSX.utils.aoa_to_sheet(templateData);

  // Set column widths for better readability
  templateSheet['!cols'] = [
    { wch: 12 }, // Date
    { wch: 10 }, // Category
    { wch: 20 }, // Name
    { wch: 35 }, // Description
    { wch: 15 }, // Amount
    { wch: 15 }, // Account (legacy)
    { wch: 15 }, // Debit Account (NEW)
    { wch: 15 }, // Credit Account (NEW)
  ];

  XLSX.utils.book_append_sheet(workbook, templateSheet, 'Transactions');

  // Sheet 2: Instructions
  const instructionsData = [
    ['IMPORT INSTRUCTIONS - DOUBLE-ENTRY BOOKKEEPING'],
    [''],
    ['How to use this template:'],
    ['1. Fill in your transaction data starting from row 4 (after the sample rows)'],
    ['2. You can delete the sample rows (rows 2-3) if you want'],
    ['3. Choose between DOUBLE-ENTRY or LEGACY format (see below)'],
    ['4. Save the file and upload it to Katalis Ventura'],
    [''],
    ['NEW: DOUBLE-ENTRY BOOKKEEPING SUPPORT'],
    ['  This template now supports double-entry bookkeeping with account codes!'],
    [''],
    ['TWO WAYS TO IMPORT:'],
    [''],
    ['  OPTION 1: Double-Entry Format (RECOMMENDED)'],
    ['    - Fill in BOTH "Debit Account" and "Credit Account" columns with account codes'],
    ['    - Example: Revenue transaction → Debit: 1120 (Bank BCA), Credit: 4100 (Rental Income)'],
    ['    - This provides better tracking and accurate financial reports'],
    [''],
    ['  OPTION 2: Legacy Format (Backward Compatible)'],
    ['    - Leave "Debit Account" and "Credit Account" empty'],
    ['    - Fill only the "Account" column (old format)'],
    ['    - Example: BCA, Cash, OVO, etc.'],
    [''],
    ['COLUMN DESCRIPTIONS:'],
    [''],
    ['Date:'],
    ['  - Format: YYYY-MM-DD (e.g., 2025-01-02)'],
    ['  - Must be a valid date'],
    ['  - Cannot be more than 1 year in the future'],
    [''],
    ['Category:'],
    ['  - Must be one of: EARN, OPEX, VAR, CAPEX, TAX, FIN'],
    ['  - EARN = Earnings/Revenue (Pendapatan)'],
    ['  - OPEX = Operating Expenses (Beban Operasional)'],
    ['  - VAR = Variable Costs (Biaya Variabel)'],
    ['  - CAPEX = Capital Expenditure (Belanja Modal)'],
    ['  - TAX = Taxes (Pajak)'],
    ['  - FIN = Financing/Withdrawals (Pembiayaan/Penarikan Dana)'],
    [''],
    ['Name:'],
    ['  - Customer name (for EARN) or Vendor name (for expenses)'],
    ['  - Required field, cannot be empty'],
    [''],
    ['Description:'],
    ['  - Detailed description of the transaction'],
    ['  - Required field, cannot be empty'],
    [''],
    ['Amount:'],
    ['  - Transaction amount in Rupiah'],
    ['  - Must be a positive number (greater than 0)'],
    ['  - Do not include currency symbols (Rp, $, etc.)'],
    ['  - Example: 1312005 or 1,312,005'],
    [''],
    ['Account (Legacy):'],
    ['  - Payment method or account used (old format)'],
    ['  - Examples: BCA, Cash, OVO, GoPay, Mandiri, etc.'],
    ['  - Required for legacy format, optional for double-entry'],
    [''],
    ['Debit Account (NEW):'],
    ['  - Account code for debit entry (4-digit code)'],
    ['  - Example: 1120 = Bank BCA, 5110 = Utilities Expense'],
    ['  - Must fill BOTH debit and credit if using double-entry'],
    ['  - See "Account Codes" sheet for complete list'],
    [''],
    ['Credit Account (NEW):'],
    ['  - Account code for credit entry (4-digit code)'],
    ['  - Example: 4100 = Rental Income, 1120 = Bank BCA'],
    ['  - Must fill BOTH debit and credit if using double-entry'],
    ['  - See "Account Codes" sheet for complete list'],
    [''],
    ['DOUBLE-ENTRY EXAMPLES:'],
    [''],
    ['  1. Receive rental payment Rp 1,000,000 to BCA:'],
    ['     Debit: 1120 (Bank BCA) → money IN to bank'],
    ['     Credit: 4100 (Rental Income) → revenue increases'],
    [''],
    ['  2. Pay electricity bill Rp 500,000 from BCA:'],
    ['     Debit: 5110 (Utilities - Electricity) → expense increases'],
    ['     Credit: 1120 (Bank BCA) → money OUT from bank'],
    [''],
    ['  3. Buy furniture Rp 10,000,000:'],
    ['     Debit: 1220 (Furniture & Fixtures) → asset increases'],
    ['     Credit: 1120 (Bank BCA) → money OUT from bank'],
    [''],
    ['VALIDATION RULES:'],
    ['  - Debit account must be different from credit account'],
    ['  - If you fill debit, you must also fill credit (and vice versa)'],
    ['  - Account codes must exist in your chart of accounts'],
    ['  - Category is still required (used for reporting)'],
    [''],
    ['TIPS:'],
    ['  - You can copy-paste data from other Excel files'],
    ['  - Maximum 5000 rows per import'],
    ['  - All rows will be validated before import'],
    ['  - If there are errors, you will get a detailed error report'],
    ['  - Start with legacy format if you are not familiar with double-entry'],
  ];

  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);

  // Set column width for instructions
  instructionsSheet['!cols'] = [{ wch: 80 }];

  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

  // Sheet 3: Category Reference
  const categoryData = [
    ['CATEGORY REFERENCE'],
    [''],
    ['Category', 'English Name', 'Indonesian Name', 'Examples'],
    ['EARN', 'Earnings/Revenue', 'Pendapatan', 'Rental income, sales, service fees'],
    ['OPEX', 'Operating Expenses', 'Beban Operasional', 'Utilities, salaries, maintenance, rent'],
    ['VAR', 'Variable Costs', 'Biaya Variabel', 'Cleaning supplies, guest amenities, commissions'],
    ['CAPEX', 'Capital Expenditure', 'Belanja Modal', 'Property improvements, equipment, furniture'],
    ['TAX', 'Taxes', 'Pajak', 'Income tax, property tax, VAT'],
    ['FIN', 'Financing', 'Pembiayaan', 'Loan payments, owner withdrawals, dividends'],
  ];

  const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);

  // Set column widths
  categorySheet['!cols'] = [
    { wch: 10 }, // Category
    { wch: 20 }, // English Name
    { wch: 20 }, // Indonesian Name
    { wch: 50 }, // Examples
  ];

  XLSX.utils.book_append_sheet(workbook, categorySheet, 'Category Guide');

  // Sheet 4: Account Codes Reference (NEW)
  const accountCodesData = [
    ['ACCOUNT CODES REFERENCE'],
    [''],
    ['Use these account codes for Debit Account and Credit Account columns'],
    [''],
    ['ASSETS (1000-1999)'],
    ['Code', 'Account Name', 'Description'],
    ['1110', 'Cash', 'Kas tunai'],
    ['1120', 'Bank - BCA', 'Rekening Bank BCA'],
    ['1121', 'Bank - Mandiri', 'Rekening Bank Mandiri'],
    ['1122', 'Bank - BNI', 'Rekening Bank BNI'],
    ['1130', 'E-Wallet - OVO', 'E-wallet OVO'],
    ['1131', 'E-Wallet - GoPay', 'E-wallet GoPay'],
    ['1132', 'E-Wallet - Dana', 'E-wallet Dana'],
    ['1210', 'Property - Building', 'Properti sewa'],
    ['1220', 'Furniture & Fixtures', 'Furniture dan perlengkapan'],
    ['1230', 'Equipment', 'Peralatan'],
    [''],
    ['LIABILITIES (2000-2999)'],
    ['Code', 'Account Name', 'Description'],
    ['2110', 'Accounts Payable', 'Hutang usaha'],
    ['2120', 'Utilities Payable', 'Hutang utilitas'],
    ['2210', 'Loan Payable', 'Pinjaman bank'],
    [''],
    ['EQUITY (3000-3999)'],
    ['Code', 'Account Name', 'Description'],
    ['3100', 'Capital', 'Modal pemilik'],
    ['3200', 'Retained Earnings', 'Laba ditahan'],
    ['3300', 'Owner Drawings', 'Penarikan pemilik'],
    [''],
    ['REVENUE (4000-4999)'],
    ['Code', 'Account Name', 'Description'],
    ['4100', 'Rental Income', 'Pendapatan sewa'],
    ['4200', 'Service Fees', 'Biaya layanan'],
    ['4300', 'Other Income', 'Pendapatan lain-lain'],
    [''],
    ['EXPENSES (5000-5999)'],
    ['Code', 'Account Name', 'Category', 'Description'],
    ['5110', 'Utilities - Electricity', 'OPEX', 'Listrik'],
    ['5111', 'Utilities - Water', 'OPEX', 'Air'],
    ['5112', 'Utilities - Gas', 'OPEX', 'Gas'],
    ['5113', 'Internet & Phone', 'OPEX', 'Internet dan telepon'],
    ['5120', 'Property Maintenance', 'OPEX', 'Pemeliharaan properti'],
    ['5130', 'Insurance', 'OPEX', 'Asuransi'],
    ['5140', 'Management Fees', 'OPEX', 'Biaya manajemen'],
    ['5150', 'Marketing & Advertising', 'OPEX', 'Pemasaran dan iklan'],
    ['5210', 'Cleaning Services', 'VAR', 'Biaya kebersihan'],
    ['5220', 'Guest Amenities', 'VAR', 'Amenitas tamu'],
    ['5230', 'Laundry', 'VAR', 'Laundry'],
    ['5240', 'Platform Commission', 'VAR', 'Komisi platform'],
    ['5310', 'Income Tax', 'TAX', 'Pajak penghasilan'],
    ['5320', 'Property Tax', 'TAX', 'Pajak bumi bangunan (PBB)'],
    ['5330', 'VAT', 'TAX', 'PPN'],
    ['5410', 'Interest Expense', 'FIN', 'Bunga pinjaman'],
    [''],
    ['COMMON TRANSACTION PATTERNS:'],
    [''],
    ['Transaction Type', 'Debit Account', 'Credit Account', 'Example'],
    ['Receive rental payment', '1120 (Bank)', '4100 (Rental Income)', 'Guest pays rent to BCA'],
    ['Pay electricity bill', '5110 (Utilities)', '1120 (Bank)', 'Pay PLN from BCA'],
    ['Pay cleaning service', '5210 (Cleaning)', '1110 (Cash)', 'Pay cleaner in cash'],
    ['Buy furniture', '1220 (Furniture)', '1120 (Bank)', 'Buy sofa with BCA'],
    ['Owner withdrawal', '3300 (Drawings)', '1120 (Bank)', 'Owner takes profit'],
    ['Pay property tax', '5320 (Property Tax)', '1120 (Bank)', 'Pay PBB'],
  ];

  const accountCodesSheet = XLSX.utils.aoa_to_sheet(accountCodesData);

  // Set column widths
  accountCodesSheet['!cols'] = [
    { wch: 15 }, // Code/Transaction Type
    { wch: 30 }, // Account Name/Debit
    { wch: 30 }, // Category/Credit
    { wch: 40 }, // Description/Example
  ];

  XLSX.utils.book_append_sheet(workbook, accountCodesSheet, 'Account Codes');

  // Convert workbook to binary
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

  // Create Blob
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return blob;
}

/**
 * Download the Excel template
 */
export function downloadTemplate(): void {
  const blob = generateExcelTemplate();
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `Transaction_Import_Template_${new Date().toISOString().split('T')[0]}.xlsx`;
  link.click();

  // Clean up
  URL.revokeObjectURL(url);
}

/**
 * Generate error report CSV
 */
export function generateErrorReport(errors: Array<{ row: number; column: string; message: string; originalValue?: any; suggestion?: string }>): Blob {
  const csvRows: string[] = [];

  // Header
  csvRows.push('Row,Column,Error,Original Value,Suggested Fix');

  // Data rows
  errors.forEach((error) => {
    const row = [
      error.row,
      error.column,
      `"${error.message.replace(/"/g, '""')}"`, // Escape quotes
      error.originalValue !== undefined ? `"${String(error.originalValue).replace(/"/g, '""')}"` : '',
      error.suggestion ? `"${error.suggestion}"` : '',
    ];

    csvRows.push(row.join(','));
  });

  const csvContent = csvRows.join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  return blob;
}

/**
 * Download error report
 */
export function downloadErrorReport(errors: Array<{ row: number; column: string; message: string; originalValue?: any; suggestion?: string }>): void {
  const blob = generateErrorReport(errors);
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `Import_Errors_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();

  // Clean up
  URL.revokeObjectURL(url);
}

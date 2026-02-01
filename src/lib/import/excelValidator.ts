import { TransactionCategory, Account } from '@/types';
import { ParsedRow, RowValidation, ValidationError, ValidationResult } from './types';
import { parseDate } from './excelParser';

const VALID_CATEGORIES: TransactionCategory[] = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

const MAX_ROWS = 5000;
const MAX_FIELD_LENGTH = 500;

/**
 * Validate all rows from parsed Excel data
 */
export function validateRows(rows: ParsedRow[], accounts?: Account[]): ValidationResult {
  // Check total rows limit
  if (rows.length === 0) {
    return {
      isValid: false,
      validRows: [],
      invalidRows: [],
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
    };
  }

  if (rows.length > MAX_ROWS) {
    return {
      isValid: false,
      validRows: [],
      invalidRows: [],
      totalRows: rows.length,
      validCount: 0,
      errorCount: 1,
    };
  }

  const validRows: RowValidation[] = [];
  const invalidRows: RowValidation[] = [];

  rows.forEach((row, index) => {
    const validation = validateRow(row, index, accounts);

    if (validation.valid) {
      validRows.push(validation);
    } else {
      invalidRows.push(validation);
    }
  });

  return {
    isValid: invalidRows.length === 0,
    validRows,
    invalidRows,
    totalRows: rows.length,
    validCount: validRows.length,
    errorCount: invalidRows.length,
  };
}

/**
 * Validate a single row
 */
export function validateRow(row: ParsedRow, index: number, accounts?: Account[]): RowValidation {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const rowNumber = index + 2; // Excel row (1-indexed + header row)

  // Validate Date
  const dateValidation = validateDateField(row.date, rowNumber);
  if (dateValidation) errors.push(dateValidation);

  // Validate Category
  const categoryValidation = validateCategoryField(row.category, rowNumber);
  if (categoryValidation) errors.push(categoryValidation);

  // Validate Name
  const nameValidation = validateRequiredField(row.name, 'name', rowNumber);
  if (nameValidation) errors.push(nameValidation);

  // Validate Description
  const descriptionValidation = validateRequiredField(row.description, 'description', rowNumber);
  if (descriptionValidation) errors.push(descriptionValidation);

  // Validate Amount
  const amountValidation = validateAmountField(row.amount, rowNumber);
  if (amountValidation) errors.push(amountValidation);

  // NEW: Validate double-entry accounts (debit/credit)
  const hasDebit = row.debit_account && row.debit_account.trim() !== '';
  const hasCredit = row.credit_account && row.credit_account.trim() !== '';

  // If using double-entry format, validate accounts
  if (hasDebit || hasCredit) {
    // Both must be filled
    const pairValidation = validateDebitCreditPair(row.debit_account, row.credit_account, rowNumber);
    if (pairValidation) errors.push(pairValidation);

    // Debit != Credit
    const differentValidation = validateDebitCreditDifferent(row.debit_account, row.credit_account, rowNumber);
    if (differentValidation) errors.push(differentValidation);

    // Validate account codes exist (if accounts provided)
    if (accounts) {
      const debitCodeValidation = validateAccountCode(row.debit_account, accounts, 'debit_account', rowNumber);
      if (debitCodeValidation) errors.push(debitCodeValidation);

      const creditCodeValidation = validateAccountCode(row.credit_account, accounts, 'credit_account', rowNumber);
      if (creditCodeValidation) errors.push(creditCodeValidation);
    }
  } else {
    // Legacy format: Account field is required
    const accountValidation = validateRequiredField(row.account, 'account', rowNumber);
    if (accountValidation) errors.push(accountValidation);
  }

  // Check field lengths
  const lengthWarnings = validateFieldLengths(row, rowNumber);
  warnings.push(...lengthWarnings);

  return {
    row: rowNumber,
    valid: errors.length === 0,
    errors,
    warnings,
    data: row,
  };
}

/**
 * Validate date field
 */
function validateDateField(value: any, row: number): ValidationError | null {
  if (!value || value === '') {
    return {
      row,
      column: 'date',
      message: 'Date is required',
      severity: 'error',
      originalValue: value,
    };
  }

  const date = parseDate(value);
  if (!date || isNaN(date.getTime())) {
    return {
      row,
      column: 'date',
      message: 'Invalid date format. Use YYYY-MM-DD (e.g., 2025-01-02)',
      severity: 'error',
      originalValue: value,
    };
  }

  // Check if date is too far in the future (more than 1 year)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  if (date > oneYearFromNow) {
    return {
      row,
      column: 'date',
      message: 'Date cannot be more than 1 year in the future',
      severity: 'error',
      originalValue: value,
    };
  }

  // Check if date is too far in the past (more than 10 years)
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

  if (date < tenYearsAgo) {
    return {
      row,
      column: 'date',
      message: 'Date cannot be more than 10 years in the past',
      severity: 'error',
      originalValue: value,
    };
  }

  return null;
}

/**
 * Validate category field
 */
function validateCategoryField(value: any, row: number): ValidationError | null {
  if (!value || value === '') {
    return {
      row,
      column: 'category',
      message: 'Category is required',
      severity: 'error',
      originalValue: value,
    };
  }

  const category = String(value).toUpperCase().trim();

  if (!VALID_CATEGORIES.includes(category as TransactionCategory)) {
    const suggestion = suggestCategory(category);

    return {
      row,
      column: 'category',
      message: suggestion
        ? `Invalid category. Did you mean "${suggestion}"?`
        : `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      severity: 'error',
      originalValue: value,
      suggestion,
    };
  }

  return null;
}

/**
 * Validate amount field
 */
function validateAmountField(value: any, row: number): ValidationError | null {
  if (value === null || value === undefined || value === '') {
    return {
      row,
      column: 'amount',
      message: 'Amount is required',
      severity: 'error',
      originalValue: value,
    };
  }

  // Try to parse the amount (handle currency formatting)
  const amount = sanitizeAmount(value);

  if (isNaN(amount)) {
    return {
      row,
      column: 'amount',
      message: 'Amount must be a valid number',
      severity: 'error',
      originalValue: value,
    };
  }

  if (amount <= 0) {
    return {
      row,
      column: 'amount',
      message: 'Amount must be greater than 0',
      severity: 'error',
      originalValue: value,
    };
  }

  if (amount > 1e12) {
    return {
      row,
      column: 'amount',
      message: 'Amount is too large (max 1 trillion)',
      severity: 'error',
      originalValue: value,
    };
  }

  return null;
}

/**
 * Validate required field
 */
function validateRequiredField(value: any, fieldName: string, row: number): ValidationError | null {
  if (!value || String(value).trim() === '') {
    return {
      row,
      column: fieldName,
      message: `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`,
      severity: 'error',
      originalValue: value,
    };
  }

  return null;
}

/**
 * Validate field lengths
 */
function validateFieldLengths(row: ParsedRow, rowNumber: number): ValidationError[] {
  const warnings: ValidationError[] = [];

  const fields = ['name', 'description', 'account'];

  fields.forEach((field) => {
    const value = row[field as keyof ParsedRow];
    if (value && String(value).length > MAX_FIELD_LENGTH) {
      warnings.push({
        row: rowNumber,
        column: field,
        message: `${field} is too long (max ${MAX_FIELD_LENGTH} characters). It will be truncated.`,
        severity: 'warning',
        originalValue: value,
      });
    }
  });

  return warnings;
}

/**
 * Suggest category correction based on common variations
 */
function suggestCategory(input: string): string | undefined {
  const suggestions: Record<string, TransactionCategory> = {
    earning: 'EARN',
    earnings: 'EARN',
    revenue: 'EARN',
    income: 'EARN',
    pendapatan: 'EARN',
    pemasukan: 'EARN',
    operating: 'OPEX',
    expense: 'OPEX',
    expenses: 'OPEX',
    operational: 'OPEX',
    operasional: 'OPEX',
    beban: 'OPEX',
    variable: 'VAR',
    variabel: 'VAR',
    capital: 'CAPEX',
    kapitalisasi: 'CAPEX',
    investasi: 'CAPEX',
    tax: 'TAX',
    taxes: 'TAX',
    pajak: 'TAX',
    financing: 'FIN',
    finance: 'FIN',
    pembiayaan: 'FIN',
    pinjaman: 'FIN',
  };

  const normalized = input.toLowerCase().trim();
  return suggestions[normalized];
}

/**
 * Sanitize amount (remove currency symbols and formatting)
 */
export function sanitizeAmount(value: any): number {
  if (typeof value === 'number') {
    return value;
  }

  // Remove currency symbols and formatting
  const cleaned = String(value)
    .replace(/[Rp$€£¥,\s]/g, '') // Remove currency symbols and commas
    .replace(/\./g, ''); // Remove thousand separators (for Indonesian format)

  return parseFloat(cleaned);
}

/**
 * Sanitize text (remove XSS, limit length)
 */
export function sanitizeText(value: string): string {
  return value
    .trim()
    .replace(/[<>]/g, '') // Remove potential XSS
    .replace(/[\r\n]+/g, ' ') // Replace newlines with space
    .substring(0, MAX_FIELD_LENGTH); // Limit length
}

/**
 * Check if rows have required columns
 */
export function validateColumns(rows: ParsedRow[]): { valid: boolean; missing: string[] } {
  if (rows.length === 0) {
    return { valid: false, missing: ['No data found'] };
  }

  const requiredColumns = ['date', 'category', 'name', 'description', 'amount', 'account'];
  const firstRow = rows[0];
  const missing: string[] = [];

  requiredColumns.forEach((col) => {
    if (!(col in firstRow)) {
      missing.push(col);
    }
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Validate account code exists in chart of accounts
 */
export function validateAccountCode(
  accountCode: string | undefined,
  accounts: Account[],
  fieldName: string,
  row: number
): ValidationError | null {
  if (!accountCode || accountCode.trim() === '') {
    return null; // Optional field
  }

  const code = accountCode.trim();
  const exists = accounts.some(acc => acc.account_code === code && acc.is_active);

  if (!exists) {
    return {
      row,
      column: fieldName,
      message: `Account code "${code}" not found in chart of accounts`,
      severity: 'error',
      originalValue: accountCode,
      suggestion: 'Check the Account Codes sheet in the template for valid codes',
    };
  }

  return null;
}

/**
 * Validate debit and credit accounts are different
 */
export function validateDebitCreditDifferent(
  debitCode: string | undefined,
  creditCode: string | undefined,
  row: number
): ValidationError | null {
  if (!debitCode || !creditCode) {
    return null; // Skip if either is empty
  }

  const debit = debitCode.trim();
  const credit = creditCode.trim();

  if (debit === credit) {
    return {
      row,
      column: 'debit_account',
      message: 'Debit and credit accounts must be different',
      severity: 'error',
      originalValue: debit,
    };
  }

  return null;
}

/**
 * Validate both debit and credit are filled together (or both empty)
 */
export function validateDebitCreditPair(
  debitCode: string | undefined,
  creditCode: string | undefined,
  row: number
): ValidationError | null {
  const hasDebit = debitCode && debitCode.trim() !== '';
  const hasCredit = creditCode && creditCode.trim() !== '';

  // Either both filled or both empty
  if (hasDebit !== hasCredit) {
    return {
      row,
      column: hasDebit ? 'credit_account' : 'debit_account',
      message: 'For double-entry, both debit and credit accounts must be filled',
      severity: 'error',
      originalValue: hasDebit ? creditCode : debitCode,
      suggestion: 'Fill both accounts or leave both empty to use legacy format',
    };
  }

  return null;
}

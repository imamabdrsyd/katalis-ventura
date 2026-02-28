// Import-specific type definitions for Excel import functionality

export interface ParsedRow {
  date: string;
  category: string;
  name: string;
  description: string;
  amount: number | string;
  account: string;
  debit_account?: string;  // NEW: Optional debit account code
  credit_account?: string; // NEW: Optional credit account code
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
  severity: 'error' | 'warning';
  originalValue?: any;
  suggestion?: string;
}

export interface RowValidation {
  row: number;
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  data: ParsedRow;
}

export interface ValidationResult {
  isValid: boolean;
  validRows: RowValidation[];
  invalidRows: RowValidation[];
  totalRows: number;
  validCount: number;
  errorCount: number;
}

export interface SmartResolvedRow extends ParsedRow {
  _smart: {
    confidence: 'high' | 'medium' | 'low';
    pattern_id: string | null;
    resolve_source: string;
    user_edited: boolean;
  };
}

export type ImportMode = 'full' | 'smart';

export interface BulkImportResult {
  success: boolean;
  inserted: number;
  failed: number;
  errors: string[];
  partialData?: any[];
}

export interface ImportProgress {
  stage: 'idle' | 'uploading' | 'parsing' | 'validating' | 'previewing' | 'importing' | 'success' | 'error';
  current: number;
  total: number;
  percentage: number;
  message: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Download, Sparkles, Table2, ChevronDown } from 'lucide-react';
import { parseExcelFile, validateFile, detectImportMode } from '@/lib/import/excelParser';
import { validateRows, validateRowsSmart, sanitizeAmount, sanitizeText } from '@/lib/import/excelValidator';
import { downloadTemplate, downloadSmartTemplate, downloadErrorReport } from '@/lib/import/templateGenerator';
import { smartResolveTransaction, type SmartResolveResult } from '@/lib/import/smartResolver';
import { createTransactionsBulk, type TransactionInsert } from '@/lib/api/transactions';
import { getAccounts } from '@/lib/api/accounts';
import type { ParsedRow, ValidationResult, ImportProgress, SmartResolvedRow, ImportMode } from '@/lib/import/types';
import type { Account, TransactionCategory } from '@/types';
import { parseDate } from '@/lib/import/excelParser';
import { formatCurrency } from '@/lib/utils';

const CATEGORIES: TransactionCategory[] = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  EARN: 'Pendapatan',
  OPEX: 'Beban Ops',
  VAR: 'HPP/Variabel',
  CAPEX: 'Belanja Modal',
  TAX: 'Pajak',
  FIN: 'Pembiayaan',
};

const CONFIDENCE_STYLES = {
  high: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
  medium: 'bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400',
  low: 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400',
};

const CONFIDENCE_LABELS = {
  high: 'Auto',
  medium: 'Review',
  low: 'Manual',
};

interface TransactionImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  userId: string;
  onImportComplete: (importedAt?: string) => void;
}

export default function TransactionImportModal({
  isOpen,
  onClose,
  businessId,
  userId,
  onImportComplete,
}: TransactionImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress>({
    stage: 'idle',
    current: 0,
    total: 0,
    percentage: 0,
    message: 'Choose an Excel file to import',
  });
  const [importing, setImporting] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [importMode, setImportMode] = useState<ImportMode>('smart');
  const [smartRows, setSmartRows] = useState<SmartResolvedRow[]>([]);
  const [showFilter, setShowFilter] = useState<'all' | 'review'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch accounts when modal opens
  useEffect(() => {
    if (isOpen) {
      async function fetchAccounts() {
        try {
          const data = await getAccounts(businessId);
          setAccounts(data);
        } catch (error) {
          console.error('Failed to fetch accounts:', error);
        } finally {
          setLoadingAccounts(false);
        }
      }

      fetchAccounts();
    } else {
      setLoadingAccounts(true);
      setAccounts([]);
    }
  }, [isOpen, businessId]);

  if (!isOpen) return null;

  const handleFileSelect = async (selectedFile: File) => {
    setFile(null);
    setParsedData([]);
    setValidationResult(null);
    setSmartRows([]);

    setProgress({
      stage: 'uploading',
      current: 0,
      total: 0,
      percentage: 0,
      message: 'Validating file...',
    });

    const fileValidation = validateFile(selectedFile);
    if (!fileValidation.valid) {
      setProgress({
        stage: 'error',
        current: 0,
        total: 0,
        percentage: 0,
        message: fileValidation.error || 'Invalid file',
      });
      return;
    }

    setFile(selectedFile);

    try {
      setProgress({
        stage: 'parsing',
        current: 0,
        total: 0,
        percentage: 30,
        message: 'Reading Excel file...',
      });

      const data = await parseExcelFile(selectedFile);

      if (data.length === 0) {
        setProgress({
          stage: 'error',
          current: 0,
          total: 0,
          percentage: 0,
          message: 'No data found in Excel file',
        });
        return;
      }

      setParsedData(data);

      // Auto-detect mode
      const detectedMode = detectImportMode(data);
      setImportMode(detectedMode);

      setProgress({
        stage: 'validating',
        current: 0,
        total: data.length,
        percentage: 60,
        message: `Validating ${data.length} rows...`,
      });

      if (detectedMode === 'smart') {
        // Smart mode: validate minimal fields, then auto-resolve
        const validation = validateRowsSmart(data);
        setValidationResult(validation);

        if (validation.validCount > 0) {
          setProgress({
            stage: 'validating',
            current: 0,
            total: validation.validCount,
            percentage: 80,
            message: 'Auto-detecting categories & accounts...',
          });

          // Auto-resolve each valid row
          const resolved: SmartResolvedRow[] = validation.validRows.map((row) => {
            const result = smartResolveTransaction(row.data.description, accounts);
            return {
              ...row.data,
              category: result.category,
              name: result.name,
              debit_account: result.debit_account_code,
              credit_account: result.credit_account_code,
              _smart: {
                confidence: result.confidence,
                pattern_id: result.pattern_id,
                resolve_source: result.resolve_source,
                user_edited: false,
              },
            };
          });

          setSmartRows(resolved);
        }

        setProgress({
          stage: 'previewing',
          current: validation.validCount,
          total: validation.totalRows,
          percentage: 100,
          message: `${validation.validCount} rows ready, ${validation.errorCount} errors`,
        });
      } else {
        // Full mode: existing validation
        const validation = validateRows(data, accounts);
        setValidationResult(validation);

        setProgress({
          stage: 'previewing',
          current: validation.validCount,
          total: validation.totalRows,
          percentage: 100,
          message: `${validation.validCount} valid rows, ${validation.errorCount} errors`,
        });
      }
    } catch (error) {
      setProgress({
        stage: 'error',
        current: 0,
        total: 0,
        percentage: 0,
        message: error instanceof Error ? error.message : 'Failed to parse file',
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Update a smart resolved row field
  const updateSmartRow = (index: number, field: keyof SmartResolvedRow, value: string) => {
    setSmartRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[index] };

      if (field === 'category') {
        row.category = value;
      } else if (field === 'name') {
        row.name = value;
      } else if (field === 'debit_account') {
        row.debit_account = value;
      } else if (field === 'credit_account') {
        row.credit_account = value;
      }

      row._smart = { ...row._smart, user_edited: true };
      updated[index] = row;
      return updated;
    });
  };

  const handleImport = async () => {
    if (importMode === 'smart') {
      await handleSmartImport();
    } else {
      await handleFullImport();
    }
  };

  const handleSmartImport = async () => {
    if (smartRows.length === 0) return;

    setImporting(true);
    const importedAt = new Date().toISOString();

    try {
      setProgress({
        stage: 'importing',
        current: 0,
        total: smartRows.length,
        percentage: 0,
        message: 'Importing transactions...',
      });

      const transactions: TransactionInsert[] = smartRows.map((row) => {
        const date = parseDate(row.date);
        const dateStr = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        const debitCode = row.debit_account?.trim();
        const creditCode = row.credit_account?.trim();

        const debitAccount = debitCode ? accounts.find((acc) => acc.account_code === debitCode) : undefined;
        const creditAccount = creditCode ? accounts.find((acc) => acc.account_code === creditCode) : undefined;

        const isDoubleEntry = !!(debitAccount && creditAccount);

        const transaction: TransactionInsert = {
          business_id: businessId,
          created_by: userId,
          date: dateStr,
          category: (row.category || 'OPEX').toUpperCase().trim() as TransactionCategory,
          name: sanitizeText(String(row.name || row.description.slice(0, 50))),
          description: sanitizeText(String(row.description)),
          amount: sanitizeAmount(row.amount),
          account: isDoubleEntry ? (debitAccount?.account_name || '') : '',
        };

        if (isDoubleEntry) {
          transaction.debit_account_id = debitAccount!.id;
          transaction.credit_account_id = creditAccount!.id;
          transaction.is_double_entry = true;
        }

        return transaction;
      });

      const result = await createTransactionsBulk(transactions, (current, total) => {
        setProgress({
          stage: 'importing',
          current,
          total,
          percentage: Math.round((current / total) * 100),
          message: `Importing row ${current}/${total}...`,
        });
      });

      if (result.success) {
        setProgress({
          stage: 'success',
          current: result.inserted,
          total: result.inserted,
          percentage: 100,
          message: `Berhasil import ${result.inserted} transaksi!`,
        });

        setTimeout(() => {
          onImportComplete(importedAt);
          handleClose();
        }, 2000);
      } else {
        setProgress({
          stage: 'error',
          current: 0,
          total: 0,
          percentage: 0,
          message: `Import failed: ${result.errors.join(', ')}`,
        });
        setImporting(false);
      }
    } catch (error) {
      setProgress({
        stage: 'error',
        current: 0,
        total: 0,
        percentage: 0,
        message: error instanceof Error ? error.message : 'Import failed',
      });
      setImporting(false);
    }
  };

  const handleFullImport = async () => {
    if (!validationResult || validationResult.validCount === 0) return;

    setImporting(true);
    const importedAt = new Date().toISOString();

    try {
      setProgress({
        stage: 'importing',
        current: 0,
        total: validationResult.validCount,
        percentage: 0,
        message: 'Importing transactions...',
      });

      const transactions: TransactionInsert[] = validationResult.validRows.map((row) => {
        const date = parseDate(row.data.date);
        const dateStr = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        const debitCode = row.data.debit_account?.trim();
        const creditCode = row.data.credit_account?.trim();

        const debitAccount = debitCode ? accounts.find((acc) => acc.account_code === debitCode) : undefined;
        const creditAccount = creditCode ? accounts.find((acc) => acc.account_code === creditCode) : undefined;

        const isDoubleEntry = !!(debitAccount && creditAccount);

        const transaction: TransactionInsert = {
          business_id: businessId,
          created_by: userId,
          date: dateStr,
          category: row.data.category.toUpperCase().trim() as TransactionCategory,
          name: sanitizeText(String(row.data.name)),
          description: sanitizeText(String(row.data.description)),
          amount: sanitizeAmount(row.data.amount),
          account: sanitizeText(String(row.data.account)),
        };

        if (isDoubleEntry) {
          transaction.debit_account_id = debitAccount!.id;
          transaction.credit_account_id = creditAccount!.id;
          transaction.is_double_entry = true;
        }

        return transaction;
      });

      const result = await createTransactionsBulk(transactions, (current, total) => {
        setProgress({
          stage: 'importing',
          current,
          total,
          percentage: Math.round((current / total) * 100),
          message: `Importing row ${current}/${total}...`,
        });
      });

      if (result.success) {
        setProgress({
          stage: 'success',
          current: result.inserted,
          total: result.inserted,
          percentage: 100,
          message: `Berhasil import ${result.inserted} transaksi!`,
        });

        setTimeout(() => {
          onImportComplete(importedAt);
          handleClose();
        }, 2000);
      } else {
        setProgress({
          stage: 'error',
          current: 0,
          total: 0,
          percentage: 0,
          message: `Import failed: ${result.errors.join(', ')}`,
        });
        setImporting(false);
      }
    } catch (error) {
      setProgress({
        stage: 'error',
        current: 0,
        total: 0,
        percentage: 0,
        message: error instanceof Error ? error.message : 'Import failed',
      });
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    if (importMode === 'smart') {
      downloadSmartTemplate();
    } else {
      downloadTemplate();
    }
  };

  const handleDownloadErrors = () => {
    if (!validationResult) return;

    const errors = validationResult.invalidRows.flatMap((row) =>
      row.errors.map((err) => ({
        row: err.row,
        column: err.column,
        message: err.message,
        originalValue: err.originalValue,
        suggestion: err.suggestion,
      }))
    );

    downloadErrorReport(errors);
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setValidationResult(null);
    setSmartRows([]);
    setProgress({
      stage: 'idle',
      current: 0,
      total: 0,
      percentage: 0,
      message: 'Choose an Excel file to import',
    });
    setImporting(false);
    setImportMode('smart');
    setShowFilter('all');
    onClose();
  };

  const filteredSmartRows = showFilter === 'review'
    ? smartRows.filter((r) => r._smart.confidence !== 'high')
    : smartRows;

  const reviewCount = smartRows.filter((r) => r._smart.confidence !== 'high').length;

  const importCount = importMode === 'smart' ? smartRows.length : (validationResult?.validCount || 0);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Import Transaksi dari Excel</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={importing}
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Mode Toggle */}
          {progress.stage === 'idle' || progress.stage === 'error' ? (
            <div className="flex gap-2">
              <button
                onClick={() => setImportMode('smart')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  importMode === 'smart'
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                Smart Import (3 kolom)
              </button>
              <button
                onClick={() => setImportMode('full')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  importMode === 'full'
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Table2 className="h-4 w-4" />
                Import Lengkap
              </button>
            </div>
          ) : null}

          {/* Template Download */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex items-start gap-3 flex-1">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    {importMode === 'smart' ? 'Template Smart Import' : 'Template Import Lengkap'}
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    {importMode === 'smart'
                      ? 'Cukup isi 3 kolom: Deskripsi, Tanggal, Nominal — sisanya otomatis'
                      : 'Download template Excel dengan semua kolom untuk import manual'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="px-4 py-2 rounded-lg flex items-center justify-center gap-2 w-full sm:w-auto whitespace-nowrap shadow-md font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Download Template</span>
              </button>
            </div>
          </div>

          {/* File Upload */}
          {progress.stage === 'idle' || progress.stage === 'error' ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
            >
              <Upload className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                Drop file Excel di sini atau klik untuk pilih file
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Format: .xlsx, .xls, .csv (max 5MB, 5000 rows)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) handleFileSelect(selectedFile);
                }}
                className="hidden"
              />
            </div>
          ) : null}

          {/* Error Message */}
          {progress.stage === 'error' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-100">Error</h3>
                  <p className="text-sm text-red-500 dark:text-red-300 mt-1">{progress.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Progress */}
          {(progress.stage === 'parsing' || progress.stage === 'validating' || progress.stage === 'importing') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {progress.message}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{progress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Smart Mode Preview */}
          {importMode === 'smart' && smartRows.length > 0 && progress.stage === 'previewing' && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{smartRows.length}</div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">Total Rows</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {smartRows.filter((r) => r._smart.confidence === 'high').length}
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">Auto-detected</div>
                </div>
                <div className={`border rounded-lg p-3 text-center ${reviewCount > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'}`}>
                  <div className={`text-xl font-bold ${reviewCount > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {reviewCount}
                  </div>
                  <div className={`text-xs ${reviewCount > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    Perlu Review
                  </div>
                </div>
              </div>

              {/* Validation Errors */}
              {validationResult && validationResult.errorCount > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                        {validationResult.errorCount} baris tidak valid (dilewati)
                      </h3>
                      <div className="max-h-24 overflow-y-auto space-y-1">
                        {validationResult.invalidRows.slice(0, 5).map((row) => (
                          <div key={row.row} className="text-sm text-red-700 dark:text-red-300">
                            <span className="font-medium">Row {row.row}:</span>{' '}
                            {row.errors.map((e) => e.message).join(', ')}
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={handleDownloadErrors}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs flex items-center gap-1.5 flex-shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Errors
                    </button>
                  </div>
                </div>
              )}

              {/* Filter */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Tampilkan:</span>
                <button
                  onClick={() => setShowFilter('all')}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    showFilter === 'all'
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Semua ({smartRows.length})
                </button>
                {reviewCount > 0 && (
                  <button
                    onClick={() => setShowFilter('review')}
                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                      showFilter === 'review'
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    Perlu Review ({reviewCount})
                  </button>
                )}
              </div>

              {/* Smart Preview Table */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 w-8">#</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Tanggal</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 min-w-[120px] sm:min-w-[200px]">Deskripsi</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Nominal</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-primary-500" />
                            Kategori
                          </span>
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-primary-500" />
                            Debit
                          </span>
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-primary-500" />
                            Kredit
                          </span>
                        </th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-400 w-16">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredSmartRows.map((row, idx) => {
                        const realIndex = showFilter === 'review'
                          ? smartRows.findIndex((r) => r === row)
                          : idx;
                        return (
                          <tr key={realIndex} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="px-3 py-2 text-gray-400 dark:text-gray-500 text-xs">{realIndex + 1}</td>
                            <td className="px-3 py-2 text-gray-900 dark:text-gray-100 whitespace-nowrap">{row.date}</td>
                            <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                              <div className="max-w-[250px] truncate" title={row.description}>
                                {row.description}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100 whitespace-nowrap font-medium">
                              {formatCurrency(sanitizeAmount(row.amount))}
                            </td>
                            {/* Category (editable) */}
                            <td className="px-3 py-2">
                              <select
                                value={row.category}
                                onChange={(e) => updateSmartRow(realIndex, 'category', e.target.value)}
                                className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded px-2 py-1 text-xs font-medium text-primary-700 dark:text-primary-300 cursor-pointer"
                              >
                                {CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>{cat} — {CATEGORY_LABELS[cat]}</option>
                                ))}
                              </select>
                            </td>
                            {/* Debit Account (editable) */}
                            <td className="px-3 py-2">
                              <select
                                value={row.debit_account || ''}
                                onChange={(e) => updateSmartRow(realIndex, 'debit_account', e.target.value)}
                                className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded px-2 py-1 text-xs max-w-[140px] cursor-pointer"
                              >
                                <option value="">—</option>
                                {accounts.filter((a) => a.is_active).map((acc) => (
                                  <option key={acc.id} value={acc.account_code}>
                                    {acc.account_code} {acc.account_name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            {/* Credit Account (editable) */}
                            <td className="px-3 py-2">
                              <select
                                value={row.credit_account || ''}
                                onChange={(e) => updateSmartRow(realIndex, 'credit_account', e.target.value)}
                                className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded px-2 py-1 text-xs max-w-[140px] cursor-pointer"
                              >
                                <option value="">—</option>
                                {accounts.filter((a) => a.is_active).map((acc) => (
                                  <option key={acc.id} value={acc.account_code}>
                                    {acc.account_code} {acc.account_name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            {/* Confidence */}
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${CONFIDENCE_STYLES[row._smart.confidence]}`}
                                title={row._smart.resolve_source}
                              >
                                {row._smart.user_edited ? 'Edited' : CONFIDENCE_LABELS[row._smart.confidence]}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filteredSmartRows.length === 0 && (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                    Tidak ada baris yang perlu direview
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Full Mode Preview */}
          {importMode === 'full' && validationResult && progress.stage === 'previewing' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                    <div>
                      <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                        {validationResult.validCount}
                      </div>
                      <div className="text-sm text-green-700 dark:text-green-300">Valid Rows</div>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
                    <div>
                      <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                        {validationResult.errorCount}
                      </div>
                      <div className="text-sm text-red-500 dark:text-red-300">Errors</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Details */}
              {validationResult.errorCount > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                        {validationResult.errorCount} baris memiliki error
                      </h3>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {validationResult.invalidRows.slice(0, 10).map((row) => (
                          <div key={row.row} className="text-sm text-yellow-800 dark:text-yellow-200">
                            <span className="font-medium">Row {row.row}:</span>{' '}
                            {row.errors.map((e) => e.message).join(', ')}
                          </div>
                        ))}
                        {validationResult.invalidRows.length > 10 && (
                          <div className="text-sm text-yellow-700 dark:text-yellow-300 italic">
                            ... dan {validationResult.invalidRows.length - 10} error lainnya
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleDownloadErrors}
                      className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm flex items-center gap-2 flex-shrink-0"
                    >
                      <Download className="h-4 w-4" />
                      Download Errors
                    </button>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {validationResult.validCount > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                    Preview (10 baris pertama)
                  </h3>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Date</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Category</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Name</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Description</th>
                            <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Amount</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Account</th>
                            {validationResult.validRows.some((r) => r.data.debit_account || r.data.credit_account) && (
                              <>
                                <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Debit</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Credit</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {validationResult.validRows.slice(0, 10).map((row, idx) => {
                            const showDoubleEntry = validationResult.validRows.some(
                              (r) => r.data.debit_account || r.data.credit_account
                            );
                            return (
                              <tr key={idx} className="bg-white dark:bg-gray-800">
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.data.date}</td>
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.data.category}</td>
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.data.name}</td>
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.data.description}</td>
                                <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">
                                  {sanitizeAmount(row.data.amount).toLocaleString('id-ID')}
                                </td>
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.data.account}</td>
                                {showDoubleEntry && (
                                  <>
                                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.data.debit_account || '-'}</td>
                                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.data.credit_account || '-'}</td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success Message */}
          {progress.stage === 'success' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
              <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">
                Import Berhasil!
              </h3>
              <p className="text-green-700 dark:text-green-300">{progress.message}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {progress.stage === 'previewing' && importCount > 0 && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {importMode === 'smart' && (
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary-500" />
                  Smart Import — {smartRows.filter((r) => r._smart.confidence === 'high').length} auto-detected
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={importing}
              >
                Batal
              </button>
              <button
                onClick={handleImport}
                disabled={importCount === 0 || importing}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {importing ? 'Importing...' : `Import ${importCount} Transaksi`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

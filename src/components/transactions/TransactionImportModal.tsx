'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { parseExcelFile, validateFile } from '@/lib/import/excelParser';
import { validateRows, sanitizeAmount, sanitizeText } from '@/lib/import/excelValidator';
import { downloadTemplate, downloadErrorReport } from '@/lib/import/templateGenerator';
import { createTransactionsBulk, type TransactionInsert } from '@/lib/api/transactions';
import { getAccounts } from '@/lib/api/accounts';
import type { ParsedRow, ValidationResult, ImportProgress } from '@/lib/import/types';
import type { Account } from '@/types';
import { parseDate } from '@/lib/import/excelParser';

interface TransactionImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  userId: string;
  onImportComplete: () => void;
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
      // Reset when modal closes
      setLoadingAccounts(true);
      setAccounts([]);
    }
  }, [isOpen, businessId]);

  if (!isOpen) return null;

  const handleFileSelect = async (selectedFile: File) => {
    // Reset state
    setFile(null);
    setParsedData([]);
    setValidationResult(null);

    setProgress({
      stage: 'uploading',
      current: 0,
      total: 0,
      percentage: 0,
      message: 'Validating file...',
    });

    // Validate file
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

    // Parse file
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

      // Validate data
      setProgress({
        stage: 'validating',
        current: 0,
        total: data.length,
        percentage: 60,
        message: `Validating ${data.length} rows...`,
      });

      const validation = validateRows(data, accounts);
      setValidationResult(validation);

      // Show results
      setProgress({
        stage: 'previewing',
        current: validation.validCount,
        total: validation.totalRows,
        percentage: 100,
        message: `${validation.validCount} valid rows, ${validation.errorCount} errors`,
      });
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

  const handleImport = async () => {
    if (!validationResult || validationResult.validCount === 0) return;

    setImporting(true);

    try {
      setProgress({
        stage: 'importing',
        current: 0,
        total: validationResult.validCount,
        percentage: 0,
        message: 'Importing transactions...',
      });

      // Prepare transactions for import
      const transactions: TransactionInsert[] = validationResult.validRows.map((row) => {
        const date = parseDate(row.data.date);
        const dateStr = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        // Look up account IDs from account codes
        const debitCode = row.data.debit_account?.trim();
        const creditCode = row.data.credit_account?.trim();

        const debitAccount = debitCode ? accounts.find(acc => acc.account_code === debitCode) : undefined;
        const creditAccount = creditCode ? accounts.find(acc => acc.account_code === creditCode) : undefined;

        const isDoubleEntry = !!(debitAccount && creditAccount);

        const transaction: TransactionInsert = {
          business_id: businessId,
          created_by: userId,
          date: dateStr,
          category: row.data.category.toUpperCase().trim() as any,
          name: sanitizeText(String(row.data.name)),
          description: sanitizeText(String(row.data.description)),
          amount: sanitizeAmount(row.data.amount),
          account: sanitizeText(String(row.data.account)),
        };

        // Add double-entry fields if applicable
        if (isDoubleEntry) {
          transaction.debit_account_id = debitAccount!.id;
          transaction.credit_account_id = creditAccount!.id;
          transaction.is_double_entry = true;
        }

        return transaction;
      });

      // Bulk import with progress
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
          message: `Successfully imported ${result.inserted} transactions!`,
        });

        // Wait a bit to show success message
        setTimeout(() => {
          onImportComplete();
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
    downloadTemplate();
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
    setProgress({
      stage: 'idle',
      current: 0,
      total: 0,
      percentage: 0,
      message: 'Choose an Excel file to import',
    });
    setImporting(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
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
          {/* Template Download */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex items-start gap-3 flex-1">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    Belum punya template?
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Download template Excel untuk mempermudah import data transaksi Anda
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="px-4 py-2 rounded-lg flex items-center justify-center gap-2 w-full sm:w-auto whitespace-nowrap shadow-md font-semibold"
                style={{
                  backgroundColor: '#2563eb',
                  color: '#FFFFFF',
                  border: '1px solid #2563eb',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1d4ed8';
                  e.currentTarget.style.borderColor = '#1d4ed8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                  e.currentTarget.style.borderColor = '#2563eb';
                }}
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
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-100">Error</h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">{progress.message}</p>
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

          {/* Validation Summary */}
          {validationResult && progress.stage === 'previewing' && (
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
                    <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                    <div>
                      <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                        {validationResult.errorCount}
                      </div>
                      <div className="text-sm text-red-700 dark:text-red-300">Errors</div>
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
                            <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                              Date
                            </th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                              Category
                            </th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                              Name
                            </th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                              Description
                            </th>
                            <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                              Amount
                            </th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                              Account
                            </th>
                            {/* Show debit/credit columns if data has them */}
                            {validationResult.validRows.some(r => r.data.debit_account || r.data.credit_account) && (
                              <>
                                <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                                  Debit
                                </th>
                                <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                                  Credit
                                </th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {validationResult.validRows.slice(0, 10).map((row, idx) => {
                            const showDoubleEntry = validationResult.validRows.some(r => r.data.debit_account || r.data.credit_account);
                            return (
                              <tr key={idx} className="bg-white dark:bg-gray-800">
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                                  {row.data.date}
                                </td>
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                                  {row.data.category}
                                </td>
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                                  {row.data.name}
                                </td>
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                                  {row.data.description}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">
                                  {sanitizeAmount(row.data.amount).toLocaleString('id-ID')}
                                </td>
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                                  {row.data.account}
                                </td>
                                {showDoubleEntry && (
                                  <>
                                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                                      {row.data.debit_account || '-'}
                                    </td>
                                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                                      {row.data.credit_account || '-'}
                                    </td>
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
        {validationResult && progress.stage === 'previewing' && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={importing}
            >
              Batal
            </button>
            <button
              onClick={handleImport}
              disabled={validationResult.validCount === 0 || importing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? 'Importing...' : `Import ${validationResult.validCount} Transaksi`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

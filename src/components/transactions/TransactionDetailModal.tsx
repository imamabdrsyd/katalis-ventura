'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import type { Transaction, Account, AuditLog } from '@/types';
import type { TransactionFormData } from '@/components/transactions/TransactionForm';
import { CATEGORY_LABELS } from '@/lib/calculations';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { getProfileName } from '@/lib/api/profiles';
import { getRecordAuditHistory, getFieldChanges, formatFieldName, formatAuditValue } from '@/lib/api/audit';
import { detectMatchingPrincipleWarning } from '@/lib/accounting/guidance';
import { AlertTriangle, X } from 'lucide-react';

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  accounts?: Account[];
  allTransactions?: Transaction[];
  onCreateFollowUp?: (prefillData: Partial<TransactionFormData>) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  EARN: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  OPEX: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
  VAR: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  CAPEX: 'bg-blue-100 dark:bg-blue-900/100 text-blue-700 dark:text-blue-700',
  TAX: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
  FIN: 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300',
};

const STOCK_COLOR = 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300';

function isInventoryTransaction(transaction: Transaction): boolean {
  const debitCode = transaction.debit_account?.account_code || '';
  const debitName = transaction.debit_account?.account_name?.toLowerCase() || '';
  return transaction.category === 'VAR' && (
    debitCode.startsWith('13') ||
    debitName.includes('inventory') ||
    debitName.includes('persediaan')
  );
}

// Helper function to format account display based on transaction type
function getAccountDisplay(transaction: Transaction): string {
  // For double-entry transactions
  if (transaction.is_double_entry && (transaction.debit_account || transaction.credit_account)) {
    if (transaction.category === 'EARN') {
      // For earnings, money comes into the bank (debit account)
      const accountName = transaction.debit_account?.account_name || 'Unknown';
      return `Masuk ke ${accountName}`;
    } else {
      // For expenses, money goes out from the bank (credit account)
      const accountName = transaction.credit_account?.account_name || 'Unknown';
      return `Keluar dari ${accountName}`;
    }
  }

  // For legacy transactions
  if (transaction.category === 'EARN') {
    return `Masuk ke ${transaction.account}`;
  } else {
    return `Keluar dari ${transaction.account}`;
  }
}

export function TransactionDetailModal({
  transaction,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  accounts,
  allTransactions,
  onCreateFollowUp,
}: TransactionDetailModalProps) {
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [loadingCreator, setLoadingCreator] = useState(false);
  const [updaterName, setUpdaterName] = useState<string | null>(null);
  const [loadingUpdater, setLoadingUpdater] = useState(false);
  const [auditHistory, setAuditHistory] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [showAuditHistory, setShowAuditHistory] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // Reset dismiss state when transaction changes
  useEffect(() => {
    setWarningDismissed(false);
  }, [transaction?.id]);

  // Matching Principle warning detection
  const matchingWarning = useMemo(() => {
    if (!transaction || !accounts || accounts.length === 0) return null;
    return detectMatchingPrincipleWarning(transaction, accounts);
  }, [transaction, accounts]);

  // Look up sold stock transactions from meta.sold_stock_ids
  const soldStockTransactions = useMemo(() => {
    if (!transaction?.meta?.sold_stock_ids || !allTransactions) return [];
    const soldIds = new Set(transaction.meta.sold_stock_ids);
    return allTransactions.filter((t) => soldIds.has(t.id));
  }, [transaction?.meta?.sold_stock_ids, allTransactions]);

  // Only show warning if EARN transaction has no sold stock linked (user skipped InventoryPicker)
  const showWarning = matchingWarning && !warningDismissed && !!onCreateFollowUp
    && (!transaction?.meta?.sold_stock_ids || transaction.meta.sold_stock_ids.length === 0);

  const handleCreateCOGSEntry = useCallback(() => {
    if (!matchingWarning || !transaction || !onCreateFollowUp) return;

    const prefillData: Partial<TransactionFormData> = {
      category: 'VAR' as const,
      date: transaction.date,
      name: `COGS untuk: ${transaction.name}`,
      description: `HPP untuk transaksi: ${transaction.name}`,
      debit_account_id: matchingWarning.cogsAccount?.id,
      credit_account_id: matchingWarning.inventoryAccount.id,
      is_double_entry: true,
      amount: 0,
      account: '',
    };

    onCreateFollowUp(prefillData);
  }, [matchingWarning, transaction, onCreateFollowUp]);

  useEffect(() => {
    if (transaction?.created_by) {
      setLoadingCreator(true);
      getProfileName(transaction.created_by)
        .then((name) => setCreatorName(name))
        .finally(() => setLoadingCreator(false));
    }
  }, [transaction?.created_by]);

  // Fetch updated_by user name
  useEffect(() => {
    if (transaction?.updated_by && transaction.updated_by !== transaction.created_by) {
      setLoadingUpdater(true);
      getProfileName(transaction.updated_by)
        .then((name) => setUpdaterName(name))
        .finally(() => setLoadingUpdater(false));
    } else {
      setUpdaterName(null);
    }
  }, [transaction?.updated_by, transaction?.created_by]);

  // Fetch audit history
  useEffect(() => {
    if (transaction?.id && showAuditHistory) {
      setLoadingAudit(true);
      getRecordAuditHistory('transactions', transaction.id)
        .then((history) => setAuditHistory(history))
        .catch((error) => {
          console.error('Failed to load audit history:', error);
          setAuditHistory([]);
        })
        .finally(() => setLoadingAudit(false));
    }
  }, [transaction?.id, showAuditHistory]);

  if (!transaction) return null;

  const showActions = onEdit || onDelete;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detail Transaksi">
      <div className="space-y-6">
        {/* Matching Principle Warning Banner */}
        {showWarning && matchingWarning && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    {matchingWarning.title}
                  </p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    {matchingWarning.body}
                  </p>
                  <div className="mt-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/40 rounded-md font-mono text-xs text-amber-800 dark:text-amber-200">
                    {matchingWarning.journalHint}
                  </div>
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 italic">
                    Jumlah HPP mungkin berbeda dari nilai penjualan. Isi jumlah yang tepat pada form berikutnya.
                  </p>
                  <button
                    onClick={handleCreateCOGSEntry}
                    className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Buat Entry COGS
                  </button>
                </div>
              </div>
              <button
                onClick={() => setWarningDismissed(true)}
                className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-800 transition-colors flex-shrink-0"
                aria-label="Abaikan peringatan ini"
              >
                <X className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              </button>
            </div>
          </div>
        )}

        {/* Header with Category Badge and Amount */}
        <div className="flex items-start justify-between">
          {isInventoryTransaction(transaction) ? (
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${STOCK_COLOR}`}>
              Stock
            </span>
          ) : (
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${CATEGORY_COLORS[transaction.category]}`}
            >
              {CATEGORY_LABELS[transaction.category]}
            </span>
          )}
          <div className="text-left">
            <p className={`text-2xl font-bold ${
              transaction.category === 'EARN'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-gray-900 dark:text-gray-100'
            }`}>
              {formatCurrency(transaction.amount)}
            </p>
          </div>
        </div>

        {/* Main Info */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Nama
            </label>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {transaction.name}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Deskripsi
            </label>
            <p className="mt-1 text-gray-700 dark:text-gray-300">
              {transaction.description}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Tanggal
            </label>
            <p className="mt-1 text-gray-900 dark:text-gray-100">
              {formatDate(transaction.date)}
            </p>
          </div>

          {/* Chart of Account - Show both Debit and Credit for double-entry */}
          {transaction.is_double_entry && (transaction.debit_account || transaction.credit_account) ? (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Debit
                </label>
                <p className="mt-1 text-gray-900 dark:text-gray-100 font-medium">
                  {transaction.debit_account?.account_code} - {transaction.debit_account?.account_name || 'Unknown'}
                </p>
                {transaction.debit_account?.account_type && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {transaction.debit_account.account_type}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Credit
                </label>
                <p className="mt-1 text-gray-900 dark:text-gray-100 font-medium">
                  {transaction.credit_account?.account_code} - {transaction.credit_account?.account_name || 'Unknown'}
                </p>
                {transaction.credit_account?.account_type && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {transaction.credit_account.account_type}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Chart of Account
              </label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">
                {getAccountDisplay(transaction)}
              </p>
            </div>
          )}
        </div>

        {/* Sold Stock Info */}
        {soldStockTransactions.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Persediaan yang Terjual
            </h4>
            <div className="space-y-2">
              {soldStockTransactions.map((stock) => (
                <div
                  key={stock.id}
                  className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {stock.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(stock.date)}
                      {stock.debit_account && (
                        <span className="ml-2">
                          {stock.debit_account.account_code} - {stock.debit_account.account_name}
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 ml-3 flex-shrink-0">
                    {formatCurrency(stock.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Informasi Tambahan
          </h4>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">ID Transaksi</span>
              <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">
                {transaction.id.slice(0, 8)}...
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Dibuat oleh</span>
              <span className="text-gray-700 dark:text-gray-300">
                {loadingCreator ? (
                  <span className="text-gray-400 dark:text-gray-500">Memuat...</span>
                ) : creatorName ? (
                  creatorName
                ) : (
                  <span className="font-mono text-xs">{transaction.created_by.slice(0, 8)}...</span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Dibuat pada</span>
              <span className="text-gray-700 dark:text-gray-300">
                {formatDateTime(transaction.created_at)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Terakhir diupdate</span>
              <span className="text-gray-700 dark:text-gray-300">
                {formatDateTime(transaction.updated_at)}
              </span>
            </div>
            {transaction.updated_by && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Diupdate oleh</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {loadingUpdater ? (
                    <span className="text-gray-400 dark:text-gray-500">Memuat...</span>
                  ) : updaterName ? (
                    updaterName
                  ) : (
                    <span className="font-mono text-xs">{transaction.updated_by.slice(0, 8)}...</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Audit History Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            onClick={() => setShowAuditHistory(!showAuditHistory)}
            className="w-full flex items-center justify-between text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Riwayat Perubahan
            </span>
            <svg
              className={`w-5 h-5 transition-transform ${showAuditHistory ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAuditHistory && (
            <div className="mt-4 space-y-3">
              {loadingAudit ? (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  Memuat riwayat...
                </div>
              ) : auditHistory.length === 0 ? (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  Tidak ada riwayat perubahan
                </div>
              ) : (
                <div className="space-y-4">
                  {auditHistory.map((log) => {
                    const changes = getFieldChanges(log);
                    const operationLabel = {
                      INSERT: 'Dibuat',
                      UPDATE: 'Diupdate',
                      DELETE: 'Dihapus',
                    }[log.operation];
                    const operationColor = {
                      INSERT: 'text-emerald-600 dark:text-emerald-400',
                      UPDATE: 'text-blue-600 dark:text-blue-400',
                      DELETE: 'text-red-600 dark:text-red-400',
                    }[log.operation];

                    return (
                      <div
                        key={log.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className={`font-semibold ${operationColor}`}>
                              {operationLabel}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs ml-2">
                              {formatDateTime(log.changed_at)}
                            </span>
                          </div>
                          {log.changed_by_name && (
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              oleh {log.changed_by_name}
                            </span>
                          )}
                        </div>

                        {changes.length > 0 && (
                          <div className="space-y-2 mt-3">
                            {changes.map((change) => (
                              <div
                                key={change.field}
                                className="text-sm border-l-2 border-gray-300 dark:border-gray-600 pl-3"
                              >
                                <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  {formatFieldName(change.field)}
                                </div>
                                <div className="flex items-start gap-2 text-xs">
                                  {change.oldValue !== null && (
                                    <div className="flex-1">
                                      <span className="text-red-600 dark:text-red-400 font-semibold">
                                        Sebelum:
                                      </span>
                                      <div className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-700 dark:text-red-300 font-mono">
                                        {formatAuditValue(change.oldValue)}
                                      </div>
                                    </div>
                                  )}
                                  {change.newValue !== null && (
                                    <div className="flex-1">
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                        Sesudah:
                                      </span>
                                      <div className="mt-1 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded text-emerald-700 dark:text-emerald-300 font-mono">
                                        {formatAuditValue(change.newValue)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {showActions && (
          <div className="flex gap-3 pt-2">
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(transaction);
                }}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => {
                  onClose();
                  onDelete(transaction);
                }}
                className="btn-danger flex-1 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Hapus
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

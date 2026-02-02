'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import type { Transaction } from '@/types';
import { CATEGORY_LABELS } from '@/lib/calculations';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { getProfileName } from '@/lib/api/profiles';

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  EARN: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  OPEX: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
  VAR: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  CAPEX: 'bg-blue-100 dark:bg-blue-900/100 text-blue-700 dark:text-blue-700',
  TAX: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
  FIN: 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300',
};

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
}: TransactionDetailModalProps) {
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [loadingCreator, setLoadingCreator] = useState(false);

  useEffect(() => {
    if (transaction?.created_by) {
      setLoadingCreator(true);
      getProfileName(transaction.created_by)
        .then((name) => setCreatorName(name))
        .finally(() => setLoadingCreator(false));
    }
  }, [transaction?.created_by]);

  if (!transaction) return null;

  const showActions = onEdit || onDelete;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detail Transaksi">
      <div className="space-y-6">
        {/* Header with Category Badge and Amount */}
        <div className="flex items-start justify-between">
          <span
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${CATEGORY_COLORS[transaction.category]}`}
          >
            {CATEGORY_LABELS[transaction.category]}
          </span>
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
                  Debit (Keluar Dari)
                </label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
                  {transaction.debit_account?.account_code} - {transaction.debit_account?.account_name || 'Unknown'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Credit (Masuk Ke)
                </label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
                  {transaction.credit_account?.account_code} - {transaction.credit_account?.account_name || 'Unknown'}
                </p>
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
          </div>
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

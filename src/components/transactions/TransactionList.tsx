'use client';

import type { Transaction, TransactionCategory } from '@/types';
import { CATEGORY_LABELS } from '@/lib/calculations';
import { formatCurrency, formatDate } from '@/lib/utils';

interface TransactionListProps {
  transactions: Transaction[];
  loading: boolean;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
}

const BADGE_CLASSES: Record<TransactionCategory, string> = {
  EARN: 'bg-emerald-50 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
  OPEX: 'bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400',
  VAR: 'bg-amber-50 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
  CAPEX: 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20',
  TAX: 'bg-purple-50 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
  FIN: 'bg-pink-50 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400',
};

export function TransactionList({
  transactions,
  loading,
  onEdit,
  onDelete,
}: TransactionListProps) {
  const showActions = onEdit || onDelete;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 dark:text-gray-400">Memuat transaksi...</p>
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">📋</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Belum ada transaksi</h3>
        <p className="text-gray-500 dark:text-gray-400">Mulai dengan menambahkan transaksi pertama Anda</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-4 px-4 text-sm font-normal text-gray-500 dark:text-gray-400">Tanggal</th>
            <th className="text-left py-4 px-4 text-sm font-normal text-gray-500 dark:text-gray-400">Kategori</th>
            <th className="text-left py-4 px-4 text-sm font-normal text-gray-500 dark:text-gray-400">Deskripsi</th>
            <th className="text-left py-4 px-4 text-sm font-normal text-gray-500 dark:text-gray-400">Jumlah</th>
            <th className="text-left py-4 px-4 text-sm font-normal text-gray-500 dark:text-gray-400">Akun</th>
            {showActions && (
              <th className="text-right py-4 px-4 text-sm font-normal text-gray-500 dark:text-gray-400">Aksi</th>
            )}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr
              key={transaction.id}
              className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <td className="py-4 px-4 text-sm text-gray-700 dark:text-gray-300">
                {formatDate(transaction.date)}
              </td>
              <td className="py-4 px-4">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${BADGE_CLASSES[transaction.category]}`}
                >
                  {CATEGORY_LABELS[transaction.category]}
                </span>
              </td>
              <td className="py-4 px-4 text-sm text-gray-700 dark:text-gray-300">
                {transaction.description}
              </td>
              <td className="py-4 px-4 text-sm text-gray-900 dark:text-gray-100">
                {formatCurrency(transaction.amount)}
              </td>
              <td className="py-4 px-4 text-sm text-gray-700 dark:text-gray-300">{transaction.account}</td>
              {showActions && (
                <td className="py-4 px-4">
                  <div className="flex items-center justify-end gap-2">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(transaction)}
                        className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        title="Edit"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(transaction)}
                        className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        title="Hapus"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

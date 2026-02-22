'use client';

import type { Transaction, TransactionCategory } from '@/types';
import { formatCurrency, formatDateShort } from '@/lib/utils';

interface TransactionListProps {
  transactions: Transaction[];
  loading: boolean;
  onRowClick?: (transaction: Transaction) => void;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
}

const BADGE_CLASSES: Record<TransactionCategory, string> = {
  EARN: 'bg-emerald-50 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
  OPEX: 'bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400',
  VAR: 'bg-amber-50 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
  CAPEX: 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20',
  TAX: 'bg-purple-50 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
  FIN: 'bg-pink-50 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400',
};

const STOCK_BADGE_CLASS = 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400';

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

export function TransactionList({
  transactions,
  loading,
  onRowClick,
  onEdit,
  onDelete,
  selectMode,
  selectedIds,
  onToggleSelect,
  onSelectAll,
}: TransactionListProps) {
  const showActions = (onEdit || onDelete) && !selectMode;
  const allSelected = selectMode && transactions.length > 0 && transactions.every((t) => selectedIds?.has(t.id));
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
      <table className="w-full table-fixed min-w-[800px]">
        <colgroup>
          {selectMode && <col className="w-8" />}
          <col className="w-10" />
          <col className="w-20" />
          <col className="w-36" />
          <col className="w-48" />
          <col className="w-24" />
          <col className="w-32" />
          <col className="w-40" />
          {(onEdit || onDelete) && !selectMode && <col className="w-20" />}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-white dark:bg-gray-800">
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {selectMode && (
              <th className="py-3 px-2 md:py-4">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onSelectAll?.()}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
            )}
            <th className="text-left py-3 px-2 md:py-4 text-sm font-normal text-gray-500 dark:text-gray-400">No</th>
            <th className="text-left py-3 pl-1 pr-2 md:py-4 md:pl-2 md:pr-4 text-sm font-normal text-gray-500 dark:text-gray-400">Kategori</th>
            <th className="text-left py-3 px-2 md:py-4 text-sm font-normal text-gray-500 dark:text-gray-400">Subjek</th>
            <th className="text-left py-3 px-2 md:py-4 md:px-4 text-sm font-normal text-gray-500 dark:text-gray-400">Deskripsi</th>
            <th className="text-left py-3 px-2 md:py-4 md:px-4 text-sm font-normal text-gray-500 dark:text-gray-400">Tanggal</th>
            <th className="text-left py-3 px-2 md:py-4 md:px-4 text-sm font-normal text-gray-500 dark:text-gray-400">Jumlah</th>
            <th className="text-left py-3 px-2 md:py-4 md:px-4 text-sm font-normal text-gray-500 dark:text-gray-400">Chart of Account</th>
            {showActions && (
              <th className="text-left py-3 px-2 md:py-4 md:px-4 text-sm font-normal text-gray-500 dark:text-gray-400">Aksi</th>
            )}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction, index) => (
            <tr
              key={transaction.id}
              onClick={() => selectMode ? onToggleSelect?.(transaction.id) : onRowClick?.(transaction)}
              className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                selectMode
                  ? `cursor-pointer ${selectedIds?.has(transaction.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`
                  : onRowClick ? 'cursor-pointer' : ''
              }`}
            >
              {selectMode && (
                <td className="py-3 px-2 md:py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds?.has(transaction.id) ?? false}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleSelect?.(transaction.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                  />
                </td>
              )}
              <td className="py-3 px-2 md:py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {index + 1}
              </td>
              <td className="py-3 pl-1 pr-2 md:py-4 md:pl-2 md:pr-4">
                {isInventoryTransaction(transaction) ? (
                  <span className={`inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs font-semibold ${STOCK_BADGE_CLASS}`}>
                    STOCK
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs font-semibold ${BADGE_CLASSES[transaction.category]}`}
                  >
                    {transaction.category}
                  </span>
                )}
              </td>
              <td className="py-3 px-2 md:py-4 text-sm font-medium text-gray-800 dark:text-gray-200 break-words">
                {transaction.name}
              </td>
              <td className="py-3 px-2 md:py-4 md:px-4 text-sm text-gray-700 dark:text-gray-300 break-words">
                {transaction.description}
              </td>
              <td className="py-3 px-2 md:py-4 md:px-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {formatDateShort(transaction.date)}
              </td>
              <td className={`py-3 px-2 md:py-4 md:px-4 text-sm font-medium whitespace-nowrap ${
                transaction.category === 'EARN'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : transaction.category === 'OPEX' || transaction.category === 'VAR' || transaction.category === 'TAX'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-gray-300'
              }`}>
                {formatCurrency(transaction.amount)}
              </td>
              <td className="py-3 px-2 md:py-4 md:px-4 text-sm text-gray-700 dark:text-gray-300 break-words">{getAccountDisplay(transaction)}</td>
              {showActions && (
                <td className="py-3 px-2 md:py-4 md:px-4">
                  <div className="flex items-center justify-start gap-1 md:gap-2">
                    {onEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(transaction);
                        }}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(transaction);
                        }}
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

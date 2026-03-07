'use client';

import { useState, useRef, useEffect } from 'react';
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
  highlightAfter?: string | null;
  highlightIds?: Set<string>;
  categoryFilter?: '' | TransactionCategory;
  onCategoryFilterChange?: (category: '' | TransactionCategory) => void;
  dateRange?: { start: string; end: string };
  onDateRangeChange?: (range: { start: string; end: string }) => void;
  onEnterSelectMode?: () => void;
}

const CATEGORIES: TransactionCategory[] = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

const BADGE_CLASSES: Record<TransactionCategory, string> = {
  EARN: 'bg-emerald-50 dark:bg-emerald-900/50 text-emerald-500 dark:text-emerald-400',
  OPEX: 'bg-red-50 dark:bg-red-900/50 text-red-500 dark:text-red-400',
  VAR: 'bg-amber-50 dark:bg-amber-900/50 text-amber-500 dark:text-amber-400',
  CAPEX: 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20',
  TAX: 'bg-purple-50 dark:bg-purple-900/50 text-purple-500 dark:text-purple-400',
  FIN: 'bg-pink-50 dark:bg-pink-900/50 text-pink-500 dark:text-pink-400',
};

const STOCK_BADGE_CLASS = 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400';

function getMonthKey(date: string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}`;
}


function isInventoryTransaction(transaction: Transaction): boolean {
  const debitCode = transaction.debit_account?.account_code || '';
  const debitName = transaction.debit_account?.account_name?.toLowerCase() || '';
  return transaction.category === 'VAR' && (
    debitCode.startsWith('13') ||
    debitName.includes('inventory') ||
    debitName.includes('persediaan')
  );
}

// Get the "Subjek" to display in the list row
// EARN → customer/partner name (transaction.name)
// FIN touching Equity (3xxx debit) → debit sub-account name
// FIN other → transaction.name
// STOCK → description (keterangan input)
// Expenses → sub-account name (debit account) if double-entry, else transaction.name
function getRowSubject(transaction: Transaction): string {
  if (transaction.category === 'EARN') {
    return transaction.name;
  }
  if (transaction.category === 'FIN') {
    const debitCode = transaction.debit_account?.account_code || '';
    if (debitCode.startsWith('3') && transaction.debit_account) {
      return transaction.debit_account.account_name;
    }
    return transaction.name;
  }
  if (isInventoryTransaction(transaction)) {
    return transaction.description || '';
  }
  if (transaction.is_double_entry && transaction.debit_account) {
    return transaction.debit_account.account_name;
  }
  return transaction.name;
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
  highlightAfter,
  highlightIds,
  categoryFilter,
  onCategoryFilterChange,
  dateRange,
  onDateRangeChange,
  onEnterSelectMode,
}: TransactionListProps) {
  const showActions = (onEdit || onDelete || onEnterSelectMode) && !selectMode;
  const allSelected = selectMode && transactions.length > 0 && transactions.every((t) => selectedIds?.has(t.id));

  // Category filter dropdown state
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Date filter dropdown state
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  // Per-row kebab menu state
  const [kebabOpenId, setKebabOpenId] = useState<string | null>(null);
  const kebabRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setShowDateDropdown(false);
      }
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setKebabOpenId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <div>
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
          {showActions && <col className="w-14" />}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {selectMode && (
              <th className="py-3 px-2 md:py-4">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onSelectAll?.()}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-500 focus:ring-indigo-500"
                />
              </th>
            )}
            <th className="text-left py-3 px-2 md:py-4 text-sm font-normal text-gray-500 dark:text-gray-400">No</th>

            {/* Kategori header with filter dropdown */}
            <th className="text-left py-3 pl-1 pr-2 md:py-4 md:pl-2 md:pr-4 text-sm font-normal text-gray-500 dark:text-gray-400">
              <div className="relative" ref={categoryDropdownRef}>
                <button
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className={`flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors ${categoryFilter ? 'text-indigo-500 dark:text-indigo-400 font-medium' : ''}`}
                >
                  {categoryFilter || 'Kategori'}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showCategoryDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[140px] z-20">
                    <button
                      onClick={() => { onCategoryFilterChange?.(''); setShowCategoryDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${!categoryFilter ? 'text-indigo-500 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                    >
                      Semua
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { onCategoryFilterChange?.(cat); setShowCategoryDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${categoryFilter === cat ? 'text-indigo-500 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                      >
                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${BADGE_CLASSES[cat].split(' ')[0]}`}></span>
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </th>

            <th className="text-left py-3 px-2 md:py-4 text-sm font-normal text-gray-500 dark:text-gray-400">Subjek</th>
            <th className="text-left py-3 px-2 md:py-4 md:px-4 text-sm font-normal text-gray-500 dark:text-gray-400">Keterangan</th>

            {/* Tanggal header with date filter dropdown */}
            <th className="text-left py-3 px-2 md:py-4 md:px-4 text-sm font-normal text-gray-500 dark:text-gray-400">
              <div className="relative" ref={dateDropdownRef}>
                <button
                  onClick={() => setShowDateDropdown(!showDateDropdown)}
                  className={`flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors ${dateRange?.start || dateRange?.end ? 'text-indigo-500 dark:text-indigo-400 font-medium' : ''}`}
                >
                  Tanggal
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showDateDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[220px] z-20">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Dari</label>
                    <input
                      type="date"
                      value={dateRange?.start || ''}
                      onChange={(e) => onDateRangeChange?.({ start: e.target.value, end: dateRange?.end || '' })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 mb-2"
                    />
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Sampai</label>
                    <input
                      type="date"
                      value={dateRange?.end || ''}
                      onChange={(e) => onDateRangeChange?.({ start: dateRange?.start || '', end: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 mb-2"
                    />
                    {(dateRange?.start || dateRange?.end) && (
                      <button
                        onClick={() => { onDateRangeChange?.({ start: '', end: '' }); setShowDateDropdown(false); }}
                        className="w-full text-center text-xs text-red-500 hover:text-red-600 py-1"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}
              </div>
            </th>

            <th className="text-left py-3 px-2 md:py-4 md:px-4 text-sm font-normal text-gray-500 dark:text-gray-400">Jumlah</th>
            <th className="text-left py-3 px-2 md:py-4 md:px-4 text-sm font-normal text-gray-500 dark:text-gray-400">Chart of Account</th>
            {showActions && (
              <th className="text-left py-3 px-2 md:py-4 md:px-4 text-sm font-normal text-gray-500 dark:text-gray-400">Aksi</th>
            )}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction, index) => {
            const isNewMonth = index > 0 && getMonthKey(transaction.date) !== getMonthKey(transactions[index - 1].date);
            const isHighlighted = highlightAfter && transaction.created_at && transaction.created_at >= highlightAfter;
            const isIdHighlighted = highlightIds?.has(transaction.id);
            return (
              <tr
                key={transaction.id}
                onClick={() => selectMode ? onToggleSelect?.(transaction.id) : onRowClick?.(transaction)}
                className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  isNewMonth ? 'border-t-2 border-t-gray-300 dark:border-t-gray-500' : ''
                } ${
                  selectMode
                    ? `cursor-pointer ${selectedIds?.has(transaction.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`
                    : onRowClick ? 'cursor-pointer' : ''
                } ${
                  isHighlighted ? 'animate-import-highlight' : ''
                } ${
                  isIdHighlighted ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-400 dark:border-l-blue-500' : ''
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
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-500 focus:ring-indigo-500"
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
                {getRowSubject(transaction)}
              </td>
              <td className="py-3 px-2 md:py-4 md:px-4 text-sm text-gray-700 dark:text-gray-300 break-words">
                {isInventoryTransaction(transaction) ? transaction.name : transaction.description}
              </td>
              <td className="py-3 px-2 md:py-4 md:px-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {formatDateShort(transaction.date)}
              </td>
              <td className={`py-3 px-2 md:py-4 md:px-4 text-sm font-medium whitespace-nowrap ${
                transaction.category === 'EARN'
                  ? 'text-emerald-500 dark:text-emerald-400'
                  : transaction.category === 'OPEX' || transaction.category === 'VAR' || transaction.category === 'TAX'
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-gray-900 dark:text-gray-300'
              }`}>
                {formatCurrency(transaction.amount)}
              </td>
              <td className="py-3 px-2 md:py-4 md:px-4 text-sm text-gray-700 dark:text-gray-300 break-words">{getAccountDisplay(transaction)}</td>
              {showActions && (
                <td className="py-3 px-2 md:py-4 md:px-4">
                  <div className="relative" ref={kebabOpenId === transaction.id ? kebabRef : undefined}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setKebabOpenId(kebabOpenId === transaction.id ? null : transaction.id);
                      }}
                      className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      title="Menu"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                      </svg>
                    </button>
                    {kebabOpenId === transaction.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[140px] z-20">
                        {onEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setKebabOpenId(null);
                              onEdit(transaction);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setKebabOpenId(null);
                              onDelete(transaction);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Hapus
                          </button>
                        )}
                        {onEnterSelectMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setKebabOpenId(null);
                              onEnterSelectMode();
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            Pilih
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

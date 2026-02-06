'use client';

import { useState, useMemo } from 'react';
import type { Account, AccountType } from '@/types';
import { filterAccountsByMode, filterExpensesByCategory, type FilterMode, type ExpenseFilter } from '@/lib/utils/transactionHelpers';

interface AccountDropdownProps {
  label: string;
  accounts: Account[];
  value?: string;
  onChange: (accountId: string, accountCode: string) => void;
  placeholder?: string;
  suggestedCode?: string;
  error?: string;
  required?: boolean;
  filterMode?: FilterMode;
  showQuickTabs?: boolean;
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Aset',
  LIABILITY: 'Liabilitas',
  EQUITY: 'Ekuitas',
  REVENUE: 'Pendapatan',
  EXPENSE: 'Beban',
};

export function AccountDropdown({
  label,
  accounts,
  value,
  onChange,
  placeholder = 'Pilih akun',
  suggestedCode,
  error,
  required = false,
  filterMode,
  showQuickTabs = false,
}: AccountDropdownProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [expenseFilter, setExpenseFilter] = useState<ExpenseFilter>('ALL');

  // Apply filtering based on mode
  const filteredAccounts = useMemo(() => {
    let filtered = filterAccountsByMode(accounts, filterMode || null);

    // Further filter expenses by quick tabs if enabled
    if (showQuickTabs && filterMode === 'out-destination' && expenseFilter !== 'ALL') {
      filtered = filterExpensesByCategory(filtered, expenseFilter);
    }

    return filtered;
  }, [accounts, filterMode, expenseFilter, showQuickTabs]);

  // Group accounts by type
  const groupedAccounts = useMemo(() => {
    const groups: Record<AccountType, Account[]> = {
      ASSET: [],
      LIABILITY: [],
      EQUITY: [],
      REVENUE: [],
      EXPENSE: [],
    };

    filteredAccounts.forEach((account) => {
      if (account.is_active) {
        groups[account.account_type].push(account);
      }
    });

    return groups;
  }, [filteredAccounts]);

  // Filter accounts based on search
  const filteredGroupedAccounts = useMemo(() => {
    if (!searchTerm.trim()) return groupedAccounts;

    const filtered: Record<AccountType, Account[]> = {
      ASSET: [],
      LIABILITY: [],
      EQUITY: [],
      REVENUE: [],
      EXPENSE: [],
    };

    Object.entries(groupedAccounts).forEach(([type, accs]) => {
      filtered[type as AccountType] = accs.filter(
        (acc) =>
          acc.account_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          acc.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          acc.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    return filtered;
  }, [groupedAccounts, searchTerm]);

  // Get selected account
  const selectedAccount = filteredAccounts.find((acc) => acc.id === value);

  // Get suggested account
  const suggestedAccount = suggestedCode
    ? filteredAccounts.find((acc) => acc.account_code === suggestedCode)
    : undefined;

  const handleSelectAccount = (account: Account) => {
    onChange(account.id, account.account_code);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative">
      <label className="label">
        {label} {required && '*'}
      </label>

      {/* Selected value or placeholder */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`input w-full text-left flex justify-between items-center ${error ? 'border-red-500 dark:border-red-400' : ''}`}
      >
        <span className={selectedAccount ? '' : 'text-gray-400 dark:text-gray-500'}>
          {selectedAccount
            ? `${selectedAccount.account_code} - ${selectedAccount.account_name}`
            : placeholder}
        </span>
        <svg
          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Suggestion hint */}
      {!selectedAccount && suggestedAccount && (
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          Saran: {suggestedAccount.account_code} - {suggestedAccount.account_name}
        </p>
      )}

      {/* Error message */}
      {error && <p className="text-sm text-red-500 dark:text-red-400 mt-1">{error}</p>}

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-hidden">
          {/* Quick filter tabs for expenses */}
          {showQuickTabs && filterMode === 'out-destination' && (
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setExpenseFilter('ALL')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    expenseFilter === 'ALL'
                      ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseFilter('OPEX')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    expenseFilter === 'OPEX'
                      ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  OPEX
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseFilter('VAR')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    expenseFilter === 'VAR'
                      ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  VAR
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseFilter('TAX')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    expenseFilter === 'TAX'
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  TAX
                </button>
              </div>
            </div>
          )}

          {/* Search input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <input
              type="text"
              placeholder="Cari akun..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Accounts list */}
          <div className="overflow-y-auto max-h-80">
            {Object.entries(filteredGroupedAccounts).map(([type, accs]) => {
              if (accs.length === 0) return null;

              return (
                <div key={type}>
                  {/* Group header */}
                  <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                    {ACCOUNT_TYPE_LABELS[type as AccountType]}
                  </div>

                  {/* Accounts in this group */}
                  {accs.map((account) => {
                    const isSuggested = account.account_code === suggestedCode;
                    const isSelected = account.id === value;

                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => handleSelectAccount(account)}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          isSelected
                            ? 'bg-blue-100 dark:bg-blue-900/30'
                            : isSuggested
                            ? 'bg-blue-50 dark:bg-blue-900/20'
                            : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-semibold text-gray-700 dark:text-gray-200">
                                {account.account_code}
                              </span>
                              {isSuggested && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                                  Saran
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-900 dark:text-gray-100">
                              {account.account_name}
                            </div>
                            {account.description && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {account.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {/* No results */}
            {Object.values(filteredGroupedAccounts).every((accs) => accs.length === 0) && (
              <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                Tidak ada akun yang cocok
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false);
            setSearchTerm('');
          }}
        />
      )}
    </div>
  );
}

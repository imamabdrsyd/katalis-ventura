'use client';

import { useState, useMemo } from 'react';
import type { Account } from '@/types';
import { filterAccountsByMode, type FilterMode } from '@/lib/utils/transactionHelpers';
import { buildAccountTree, type AccountTreeNode } from '@/lib/api/accounts';

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
}

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
}: AccountDropdownProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Apply filtering based on mode
  const filteredAccounts = useMemo(() => {
    return filterAccountsByMode(accounts, filterMode || null);
  }, [accounts, filterMode]);

  // Build tree for hierarchical display
  const accountTree = useMemo(() => {
    return buildAccountTree(filteredAccounts);
  }, [filteredAccounts]);

  // Filter accounts based on search
  const filteredTree = useMemo(() => {
    if (!searchTerm.trim()) return accountTree;

    const query = searchTerm.toLowerCase();
    // Filter: keep parents that have matching children
    return accountTree
      .map(parent => ({
        ...parent,
        children: parent.children.filter(
          child =>
            child.account_code.toLowerCase().includes(query) ||
            child.account_name.toLowerCase().includes(query) ||
            child.description?.toLowerCase().includes(query)
        ),
      }))
      .filter(parent => parent.children.length > 0);
  }, [accountTree, searchTerm]);

  // Get selected account
  const selectedAccount = accounts.find(acc => acc.id === value);

  // Get suggested account
  const suggestedAccount = suggestedCode
    ? accounts.find(acc => acc.account_code === suggestedCode)
    : undefined;

  const handleSelectAccount = (account: Account | AccountTreeNode) => {
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

          {/* Accounts list - hierarchical */}
          <div className="overflow-y-auto max-h-80">
            {filteredTree.map(parent => (
              <div key={parent.id}>
                {/* Parent group header */}
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  {parent.account_code} - {parent.account_name}
                </div>

                {/* Sub-accounts */}
                {parent.children.map(child => {
                  const isSuggested = child.account_code === suggestedCode;
                  const isSelected = child.id === value;

                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => handleSelectAccount(child)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        isSelected
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : isSuggested
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pl-3">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-300 dark:text-gray-600">|--</span>
                            <span className="font-mono text-sm font-semibold text-gray-700 dark:text-gray-200">
                              {child.account_code}
                            </span>
                            {isSuggested && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                                Saran
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-900 dark:text-gray-100 pl-7">
                            {child.account_name}
                          </div>
                          {child.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 pl-7">
                              {child.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}

            {/* No results */}
            {filteredTree.length === 0 && (
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

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
  /** Optional sub-filter applied to selectable accounts (children).
   *  Parent accounts matching this filter but having no children will be shown as selectable items. */
  subFilter?: (acc: Account) => boolean;
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
  subFilter,
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

  // When subFilter is provided, parent accounts that match but have no matching
  // children should be promoted to selectable "leaf" items under a synthetic group.
  // This handles cases like "1400 - Piutang Talangan" which is a parent with no sub-accounts yet.
  const { displayTree, promotedParents } = useMemo(() => {
    if (!subFilter) return { displayTree: accountTree, promotedParents: [] as AccountTreeNode[] };

    const promoted: AccountTreeNode[] = [];
    const filtered = accountTree
      .map(parent => {
        const matchingChildren = parent.children.filter(child => subFilter(child));
        if (matchingChildren.length > 0) {
          return { ...parent, children: matchingChildren };
        }
        // Parent itself matches but has no matching children → promote to selectable
        if (subFilter(parent)) {
          promoted.push(parent);
        }
        return null;
      })
      .filter((n): n is AccountTreeNode => n !== null);

    return { displayTree: filtered, promotedParents: promoted };
  }, [accountTree, subFilter]);

  // Filter accounts based on search
  const filteredTree = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const filterNodes = (nodes: AccountTreeNode[]) => {
      if (!query) return nodes;
      return nodes
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
    };

    const mainFiltered = filterNodes(displayTree);

    // Also filter promoted parents by search
    const promotedFiltered = !query
      ? promotedParents
      : promotedParents.filter(
          p =>
            p.account_code.toLowerCase().includes(query) ||
            p.account_name.toLowerCase().includes(query) ||
            p.description?.toLowerCase().includes(query)
        );

    return { tree: mainFiltered, promoted: promotedFiltered };
  }, [displayTree, promotedParents, searchTerm]);

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
            {/* Promoted parents (parent accounts with no sub-accounts that match subFilter) */}
            {filteredTree.promoted.map(parent => {
              const isSelected = parent.id === value;
              return (
                <button
                  key={parent.id}
                  type="button"
                  onClick={() => handleSelectAccount(parent)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {parent.account_code}
                    </span>
                    <span className="text-sm text-gray-900 dark:text-gray-100">
                      {parent.account_name}
                    </span>
                  </div>
                  {parent.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {parent.description}
                    </div>
                  )}
                </button>
              );
            })}

            {/* Tree: parent headers with selectable children */}
            {filteredTree.tree.map(parent => (
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
            {filteredTree.tree.length === 0 && filteredTree.promoted.length === 0 && (
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

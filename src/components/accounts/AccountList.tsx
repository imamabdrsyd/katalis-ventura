'use client';

import type { Account, AccountType } from '@/types';
import { Pencil, Lock, CheckCircle2, XCircle } from 'lucide-react';

interface AccountListProps {
  accounts: Account[];
  loading: boolean;
  accountType: AccountType;
  onEdit?: (account: Account) => void;
  onDeactivate?: (account: Account) => void;
  onActivate?: (account: Account) => void;
  showInactive?: boolean;
}

const TYPE_BADGES: Record<AccountType, string> = {
  ASSET: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  LIABILITY: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
  EQUITY: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
  REVENUE: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  EXPENSE: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
};

const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expense',
};

export function AccountList({
  accounts,
  loading,
  accountType,
  onEdit,
  onDeactivate,
  onActivate,
  showInactive = false,
}: AccountListProps) {
  // Filter and sort accounts
  const filteredAccounts = accounts
    .filter((acc) => acc.account_type === accountType)
    .filter((acc) => showInactive || acc.is_active)
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.account_code.localeCompare(b.account_code);
    });

  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 dark:border-gray-700">
            <tr className="text-left">
              <th className="pb-3 font-semibold text-gray-700 dark:text-gray-300">Code</th>
              <th className="pb-3 font-semibold text-gray-700 dark:text-gray-300">Account Name</th>
              <th className="pb-3 font-semibold text-gray-700 dark:text-gray-300">Type</th>
              <th className="pb-3 font-semibold text-gray-700 dark:text-gray-300">Balance</th>
              <th className="pb-3 font-semibold text-gray-700 dark:text-gray-300">Status</th>
              <th className="pb-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map((i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-3">
                  <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </td>
                <td className="py-3">
                  <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </td>
                <td className="py-3">
                  <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </td>
                <td className="py-3">
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </td>
                <td className="py-3">
                  <div className="h-5 w-14 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </td>
                <td className="py-3">
                  <div className="flex justify-end gap-2">
                    <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (filteredAccounts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>No {TYPE_LABELS[accountType].toLowerCase()} accounts yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 dark:border-gray-700">
          <tr className="text-left">
            <th className="pb-3 font-semibold text-gray-700 dark:text-gray-300">Code</th>
            <th className="pb-3 font-semibold text-gray-700 dark:text-gray-300">Account Name</th>
            <th className="pb-3 font-semibold text-gray-700 dark:text-gray-300">Type</th>
            <th className="pb-3 font-semibold text-gray-700 dark:text-gray-300">Balance</th>
            <th className="pb-3 font-semibold text-gray-700 dark:text-gray-300">Status</th>
            <th className="pb-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredAccounts.map((account) => {
            const isSystem = account.is_system;
            const isInactive = !account.is_active;
            const canEdit = onEdit && !isSystem;
            const canToggle = (onDeactivate && !isSystem && account.is_active) || (onActivate && !account.is_active);

            return (
              <tr
                key={account.id}
                className={`border-b border-gray-100 dark:border-gray-800 ${
                  isInactive ? 'opacity-50' : ''
                }`}
              >
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                      {account.account_code}
                    </span>
                    {isSystem && (
                      <span title="System account">
                        <Lock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 text-gray-700 dark:text-gray-300">
                  {account.account_name}
                </td>
                <td className="py-3">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      TYPE_BADGES[account.account_type]
                    }`}
                  >
                    {TYPE_LABELS[account.account_type]}
                  </span>
                </td>
                <td className="py-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${
                      account.normal_balance === 'DEBIT'
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                        : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {account.normal_balance}
                  </span>
                </td>
                <td className="py-3">
                  {account.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                      <CheckCircle2 className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      <XCircle className="w-3 h-3" />
                      Inactive
                    </span>
                  )}
                </td>
                <td className="py-3">
                  <div className="flex justify-end gap-2">
                    {canEdit && (
                      <button
                        onClick={() => onEdit(account)}
                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                        title="Edit account"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {canToggle && account.is_active && onDeactivate && (
                      <button
                        onClick={() => onDeactivate(account)}
                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Deactivate account"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    {canToggle && !account.is_active && onActivate && (
                      <button
                        onClick={() => onActivate(account)}
                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                        title="Activate account"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    {isSystem && (
                      <div className="p-1.5 text-gray-300 dark:text-gray-600" title="System accounts cannot be modified">
                        <Lock className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

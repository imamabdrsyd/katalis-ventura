'use client';

import { useState, useEffect, useMemo } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import type { Account, AccountType } from '@/types';
import * as accountsApi from '@/lib/api/accounts';
import { AccountList } from '@/components/accounts/AccountList';
import { AccountForm, type AccountFormData } from '@/components/accounts/AccountForm';
import { AccountDeleteModal } from '@/components/accounts/AccountDeleteModal';
import { Plus, Search, ChevronDown, ChevronRight } from 'lucide-react';

const ACCOUNT_TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expenses',
};

// Helper: group accounts by type
function groupAccountsByType(accounts: Account[]): Record<AccountType, Account[]> {
  const groups: Record<AccountType, Account[]> = {
    ASSET: [],
    LIABILITY: [],
    EQUITY: [],
    REVENUE: [],
    EXPENSE: [],
  };

  accounts.forEach((account) => {
    groups[account.account_type].push(account);
  });

  // Sort within each group
  Object.keys(groups).forEach((type) => {
    groups[type as AccountType].sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.account_code.localeCompare(b.account_code);
    });
  });

  return groups;
}

export default function AccountsPage() {
  const { activeBusiness, userRole } = useBusinessContext();
  const businessId = activeBusiness?.id;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<Account | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<AccountType | ''>('');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<AccountType>>(
    new Set(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])
  );

  const canManageAccounts = userRole === 'business_manager' || userRole === 'both';

  // Fetch accounts
  useEffect(() => {
    async function fetchAccounts() {
      if (!businessId) return;

      setLoading(true);
      setError(null);

      try {
        const data = await accountsApi.getAccounts(businessId);
        setAccounts(data);
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
        setError('Failed to load accounts. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchAccounts();
  }, [businessId]);

  // Filter and group accounts
  const filteredAndGroupedAccounts = useMemo(() => {
    let filtered = accounts;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (acc) =>
          acc.account_code.toLowerCase().includes(query) ||
          acc.account_name.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (filterType) {
      filtered = filtered.filter((acc) => acc.account_type === filterType);
    }

    // Apply inactive filter
    if (!showInactive) {
      filtered = filtered.filter((acc) => acc.is_active);
    }

    return groupAccountsByType(filtered);
  }, [accounts, searchQuery, filterType, showInactive]);

  // Get existing codes for validation
  const existingCodes = useMemo(() => {
    return accounts.map((acc) => acc.account_code);
  }, [accounts]);

  // Toggle group expansion
  const toggleGroup = (type: AccountType) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Handle add account
  const handleAddAccount = async (data: AccountFormData) => {
    if (!businessId) return;

    setSaving(true);
    try {
      await accountsApi.createAccount({
        business_id: businessId,
        account_code: data.account_code,
        account_name: data.account_name,
        account_type: data.account_type,
        normal_balance: data.normal_balance,
        is_active: true,
        is_system: false,
        sort_order: data.sort_order,
        description: data.description,
      });

      // Refresh accounts
      const updatedAccounts = await accountsApi.getAccounts(businessId);
      setAccounts(updatedAccounts);
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to create account:', err);
      alert('Failed to create account. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle edit account
  const handleEditAccount = async (data: AccountFormData) => {
    if (!businessId || !editAccount) return;

    setSaving(true);
    try {
      await accountsApi.updateAccount(editAccount.id, {
        account_name: data.account_name,
        normal_balance: data.normal_balance,
        description: data.description,
      });

      // Refresh accounts
      const updatedAccounts = await accountsApi.getAccounts(businessId);
      setAccounts(updatedAccounts);
      setEditAccount(null);
    } catch (err) {
      console.error('Failed to update account:', err);
      alert('Failed to update account. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle deactivate account
  const handleDeactivate = async () => {
    if (!businessId || !deleteAccount) return;

    setSaving(true);
    try {
      await accountsApi.deactivateAccount(deleteAccount.id);

      // Refresh accounts
      const updatedAccounts = await accountsApi.getAccounts(businessId);
      setAccounts(updatedAccounts);
      setDeleteAccount(null);
    } catch (err) {
      console.error('Failed to deactivate account:', err);
      alert('Failed to deactivate account. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle activate account
  const handleActivate = async (account: Account) => {
    if (!businessId) return;

    setSaving(true);
    try {
      await accountsApi.updateAccount(account.id, { is_active: true });

      // Refresh accounts
      const updatedAccounts = await accountsApi.getAccounts(businessId);
      setAccounts(updatedAccounts);
    } catch (err) {
      console.error('Failed to activate account:', err);
      alert('Failed to activate account. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!businessId) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Please select a business to view accounts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Chart of Accounts
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage your account codes for double-entry bookkeeping
            </p>
          </div>
          {canManageAccounts && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code or name..."
              className="input pl-10 w-full"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as AccountType | '')}
            className="input md:w-48"
          >
            <option value="">All Types</option>
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>

          {/* Show Inactive Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Show inactive</span>
          </label>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Grouped Accounts */}
      <div className="space-y-4">
        {ACCOUNT_TYPES.map((type) => {
          const groupAccounts = filteredAndGroupedAccounts[type];
          const isExpanded = expandedGroups.has(type);
          const activeCount = groupAccounts.filter((acc) => acc.is_active).length;
          const inactiveCount = groupAccounts.length - activeCount;

          return (
            <div
              key={type}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(type)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  )}
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {TYPE_LABELS[type]}
                  </h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({activeCount} active{inactiveCount > 0 && `, ${inactiveCount} inactive`})
                  </span>
                </div>
              </button>

              {/* Group Content */}
              {isExpanded && (
                <div className="px-4 pb-4">
                  <AccountList
                    accounts={groupAccounts}
                    loading={loading}
                    accountType={type}
                    onEdit={canManageAccounts ? setEditAccount : undefined}
                    onDeactivate={canManageAccounts ? setDeleteAccount : undefined}
                    onActivate={canManageAccounts ? handleActivate : undefined}
                    showInactive={showInactive}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <AccountForm
              onSubmit={handleAddAccount}
              onCancel={() => setShowAddModal(false)}
              loading={saving}
              businessId={businessId}
              existingCodes={existingCodes}
            />
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {editAccount && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <AccountForm
              account={editAccount}
              onSubmit={handleEditAccount}
              onCancel={() => setEditAccount(null)}
              loading={saving}
              businessId={businessId}
              existingCodes={existingCodes}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AccountDeleteModal
        isOpen={!!deleteAccount}
        onClose={() => setDeleteAccount(null)}
        onConfirm={handleDeactivate}
        loading={saving}
        account={deleteAccount}
      />
    </div>
  );
}

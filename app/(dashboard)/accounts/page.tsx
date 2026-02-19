'use client';

import { useState, useEffect, useMemo } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import type { Account, AccountType } from '@/types';
import * as accountsApi from '@/lib/api/accounts';
import type { AccountTreeNode } from '@/lib/api/accounts';
import { AccountForm, type AccountFormData } from '@/components/accounts/AccountForm';
import { AccountDeleteModal } from '@/components/accounts/AccountDeleteModal';
import { Plus, Search, ChevronDown, ChevronRight, Lock, Pencil, XCircle, CheckCircle2 } from 'lucide-react';

const TYPE_COLORS: Record<AccountType, string> = {
  ASSET: 'from-blue-500 to-blue-600',
  LIABILITY: 'from-amber-500 to-amber-600',
  EQUITY: 'from-purple-500 to-purple-600',
  REVENUE: 'from-green-500 to-green-600',
  EXPENSE: 'from-red-500 to-red-600',
};

export default function AccountsPage() {
  const { activeBusiness, userRole } = useBusinessContext();
  const businessId = activeBusiness?.id;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [preselectedParentId, setPreselectedParentId] = useState<string | null>(null);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<Account | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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
        // Auto-expand all main accounts
        const mainIds = data.filter(a => !a.parent_account_id).map(a => a.id);
        setExpandedGroups(new Set(mainIds));
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
        setError('Failed to load accounts. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchAccounts();
  }, [businessId]);

  // Build account tree
  const accountTree = useMemo(() => {
    let filtered = accounts;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        acc =>
          acc.account_code.toLowerCase().includes(query) ||
          acc.account_name.toLowerCase().includes(query)
      );
    }

    if (!showInactive) {
      filtered = filtered.filter(acc => acc.is_active);
    }

    return accountsApi.buildAccountTree(filtered);
  }, [accounts, searchQuery, showInactive]);

  // Get parent accounts for the form
  const parentAccounts = useMemo(() => {
    return accounts.filter(a => !a.parent_account_id && a.is_active);
  }, [accounts]);

  // Get existing codes for validation
  const existingCodes = useMemo(() => {
    return accounts.map(acc => acc.account_code);
  }, [accounts]);

  // Toggle group expansion
  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
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
        parent_account_id: data.parent_account_id || undefined,
        is_active: true,
        is_system: false,
        sort_order: data.sort_order,
        description: data.description,
        default_category: data.default_category,
      });

      const updatedAccounts = await accountsApi.getAccounts(businessId);
      setAccounts(updatedAccounts);
      setShowAddModal(false);
      setPreselectedParentId(null);
    } catch (err) {
      console.error('Failed to create account:', err);
      alert('Gagal membuat akun. Silakan coba lagi.');
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
        default_category: data.default_category,
      });

      const updatedAccounts = await accountsApi.getAccounts(businessId);
      setAccounts(updatedAccounts);
      setEditAccount(null);
    } catch (err) {
      console.error('Failed to update account:', err);
      alert('Gagal mengupdate akun. Silakan coba lagi.');
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

      const updatedAccounts = await accountsApi.getAccounts(businessId);
      setAccounts(updatedAccounts);
      setDeleteAccount(null);
    } catch (err) {
      console.error('Failed to deactivate account:', err);
      alert('Gagal menonaktifkan akun. Silakan coba lagi.');
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

      const updatedAccounts = await accountsApi.getAccounts(businessId);
      setAccounts(updatedAccounts);
    } catch (err) {
      console.error('Failed to activate account:', err);
      alert('Gagal mengaktifkan akun. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  // Handle add sub-account under a specific parent
  const handleAddSubAccount = (parentId: string) => {
    setPreselectedParentId(parentId);
    setShowAddModal(true);
  };

  if (!businessId) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Pilih bisnis untuk melihat akun.</p>
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
              5 kategori utama, tambah sub-akun sesuai kebutuhan bisnis Anda
            </p>
          </div>
          {canManageAccounts && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Tambah Akun
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari kode atau nama akun..."
              className="input pl-10 w-full"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Tampilkan nonaktif</span>
          </label>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Account Tree */}
      {!loading && (
        <div className="space-y-4">
          {accountTree.map(parent => (
            <ParentAccountCard
              key={parent.id}
              parent={parent}
              isExpanded={expandedGroups.has(parent.id)}
              onToggle={() => toggleGroup(parent.id)}
              onAddSub={() => handleAddSubAccount(parent.id)}
              onEdit={canManageAccounts ? setEditAccount : undefined}
              onDeactivate={canManageAccounts ? setDeleteAccount : undefined}
              onActivate={canManageAccounts ? handleActivate : undefined}
              canManage={canManageAccounts}
              showInactive={showInactive}
            />
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => {
            setShowAddModal(false);
            setPreselectedParentId(null);
          }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <AccountForm
              onSubmit={handleAddAccount}
              onCancel={() => {
                setShowAddModal(false);
                setPreselectedParentId(null);
              }}
              loading={saving}
              businessId={businessId}
              existingCodes={existingCodes}
              parentAccounts={parentAccounts}
              parentAccountId={preselectedParentId || undefined}
            />
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {editAccount && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setEditAccount(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <AccountForm
              account={editAccount}
              onSubmit={handleEditAccount}
              onCancel={() => setEditAccount(null)}
              loading={saving}
              businessId={businessId}
              existingCodes={existingCodes}
              parentAccounts={parentAccounts}
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

// Parent Account Card Component
function ParentAccountCard({
  parent,
  isExpanded,
  onToggle,
  onAddSub,
  onEdit,
  onDeactivate,
  onActivate,
  canManage,
  showInactive,
}: {
  parent: AccountTreeNode;
  isExpanded: boolean;
  onToggle: () => void;
  onAddSub: () => void;
  onEdit?: (account: Account) => void;
  onDeactivate?: (account: Account) => void;
  onActivate?: (account: Account) => void;
  canManage: boolean;
  showInactive: boolean;
}) {
  const activeChildren = parent.children.filter(c => c.is_active);
  const inactiveChildren = parent.children.filter(c => !c.is_active);
  const displayChildren = showInactive ? parent.children : activeChildren;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Parent Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${TYPE_COLORS[parent.account_type]} flex items-center justify-center`}>
            <span className="text-white font-bold text-sm">{parent.account_code}</span>
          </div>
          <div className="text-left">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {parent.account_name}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {activeChildren.length} sub-akun{inactiveChildren.length > 0 && showInactive ? `, ${inactiveChildren.length} nonaktif` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span title="Akun sistem"><Lock className="w-4 h-4 text-gray-300 dark:text-gray-600" /></span>
        </div>
      </button>

      {/* Children */}
      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          {displayChildren.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {displayChildren.map(child => (
                <SubAccountRow
                  key={child.id}
                  account={child}
                  onEdit={onEdit}
                  onDeactivate={onDeactivate}
                  onActivate={onActivate}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-gray-400 dark:text-gray-500 text-sm">
              Belum ada sub-akun
            </div>
          )}

          {/* Add Sub-Account Button */}
          {canManage && (
            <div className="p-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSub();
                }}
                className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Tambah sub-akun di {parent.account_name}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Sub-Account Row Component
function SubAccountRow({
  account,
  onEdit,
  onDeactivate,
  onActivate,
}: {
  account: AccountTreeNode;
  onEdit?: (account: Account) => void;
  onDeactivate?: (account: Account) => void;
  onActivate?: (account: Account) => void;
}) {
  const isSystem = account.is_system;
  const isInactive = !account.is_active;
  const canEdit = onEdit && !isSystem;
  const canToggle = (onDeactivate && !isSystem && account.is_active) || (onActivate && !account.is_active);

  return (
    <div className={`flex items-center justify-between px-4 py-3 ${isInactive ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="text-gray-300 dark:text-gray-600 pl-2">|--</span>
        <span className="font-mono text-sm font-semibold text-gray-700 dark:text-gray-200">
          {account.account_code}
        </span>
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {account.account_name}
        </span>
        {isSystem && (
          <span title="Akun sistem"><Lock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" /></span>
        )}
        {isInactive && (
          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">
            Nonaktif
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Normal Balance Badge */}
        <span className={`text-xs px-2 py-0.5 rounded ${
          account.normal_balance === 'DEBIT'
            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
            : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
        }`}>
          {account.normal_balance}
        </span>

        {canEdit && (
          <button
            onClick={() => onEdit(account)}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        {canToggle && account.is_active && onDeactivate && (
          <button
            onClick={() => onDeactivate(account)}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
            title="Nonaktifkan"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
        {canToggle && !account.is_active && onActivate && (
          <button
            onClick={() => onActivate(account)}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
            title="Aktifkan"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
        )}
        {isSystem && !canEdit && (
          <div className="p-1.5 text-gray-300 dark:text-gray-600" title="Akun sistem tidak bisa diubah">
            <Lock className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}

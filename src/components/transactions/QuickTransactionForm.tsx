'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Account, AccountType } from '@/types';
import type { TransactionFormData } from './TransactionForm';
import { getAccounts } from '@/lib/api/accounts';
import { useParams } from 'next/navigation';
import {
  resolveQuickTransaction,
  getQuickAddAccounts,
  getFlowLabel,
  getFlowDirection,
  findDefaultCashAccount,
} from '@/lib/utils/quickTransactionHelper';
import { getStockTransactions } from '@/lib/utils/inventoryHelper';
import { InventoryPicker } from './InventoryPicker';
import { ChevronDown, StickyNote, Zap, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { CurrencyInputWithCalculator } from '@/components/ui/CurrencyInputWithCalculator';

import type { Transaction } from '@/types';

interface QuickTransactionFormProps {
  onSubmit: (data: TransactionFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  businessId?: string;
  /** All transactions for detecting stock items */
  transactions?: Transaction[];
  /** Callback to convert stock transactions to COGS */
  onConvertStockToCOGS?: (transactionIds: string[]) => Promise<void>;
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Aset',
  LIABILITY: 'Liabilitas',
  EQUITY: 'Ekuitas',
  REVENUE: 'Pendapatan',
  EXPENSE: 'Beban',
};

const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  ASSET: 'text-blue-600 dark:text-blue-400',
  LIABILITY: 'text-amber-600 dark:text-amber-400',
  EQUITY: 'text-purple-600 dark:text-purple-400',
  REVENUE: 'text-emerald-600 dark:text-emerald-400',
  EXPENSE: 'text-red-600 dark:text-red-400',
};

export function QuickTransactionForm({
  onSubmit,
  onCancel,
  loading = false,
  businessId: businessIdProp,
  transactions: allTransactions = [],
  onConvertStockToCOGS,
}: QuickTransactionFormProps) {
  const params = useParams();
  const businessId = businessIdProp || (params?.businessId as string);

  // Form state
  const [amount, setAmount] = useState(0);
  const [displayAmount, setDisplayAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Inventory selection state
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);

  // Data state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch accounts
  useEffect(() => {
    async function fetchAccounts() {
      if (!businessId) return;
      try {
        const data = await getAccounts(businessId);
        setAccounts(data);
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      } finally {
        setLoadingAccounts(false);
      }
    }
    fetchAccounts();
  }, [businessId]);

  // Filtered accounts for dropdown (exclude cash/bank)
  const quickAccounts = useMemo(() => getQuickAddAccounts(accounts), [accounts]);

  // Group accounts by type
  const groupedAccounts = useMemo(() => {
    const groups: Record<AccountType, Account[]> = {
      REVENUE: [],
      EXPENSE: [],
      ASSET: [],
      LIABILITY: [],
      EQUITY: [],
    };

    const filtered = searchTerm.trim()
      ? quickAccounts.filter(
          (acc) =>
            acc.account_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.description?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : quickAccounts;

    filtered.forEach((acc) => {
      groups[acc.account_type].push(acc);
    });

    return groups;
  }, [quickAccounts, searchTerm]);

  // Selected account object
  const selectedAccount = useMemo(
    () => accounts.find((acc) => acc.id === selectedAccountId) || null,
    [accounts, selectedAccountId]
  );

  // Default cash/bank account
  const cashAccount = useMemo(() => findDefaultCashAccount(accounts), [accounts]);

  // Flow preview
  const flowDirection = selectedAccount ? getFlowDirection(selectedAccount) : null;
  const flowLabel = selectedAccount ? getFlowLabel(selectedAccount) : null;

  // Detect if this is a revenue/sales transaction and show inventory picker
  const isRevenueSelected = selectedAccount?.account_type === 'REVENUE';
  const stockTransactions = useMemo(
    () => (isRevenueSelected ? getStockTransactions(allTransactions) : []),
    [isRevenueSelected, allTransactions]
  );
  const showInventoryPicker = isRevenueSelected && stockTransactions.length > 0 && !!onConvertStockToCOGS;

  const handleToggleStock = (transactionId: string) => {
    setSelectedStockIds((prev) =>
      prev.includes(transactionId)
        ? prev.filter((id) => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  // Handle account selection
  const handleSelectAccount = (account: Account) => {
    setSelectedAccountId(account.id);
    setSelectedStockIds([]); // Reset inventory selection when account changes
    setDropdownOpen(false);
    setSearchTerm('');
    if (errors.selectedAccountId) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.selectedAccountId;
        return next;
      });
    }
  };

  // Validate
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (amount <= 0) newErrors.amount = 'Jumlah harus lebih dari 0';
    if (!selectedAccountId) newErrors.selectedAccountId = 'Kategori harus dipilih';
    if (!name.trim()) newErrors.name = 'Nama harus diisi';
    if (!date) newErrors.date = 'Tanggal harus diisi';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const result = resolveQuickTransaction(
      { amount, selectedAccountId, name, date, notes },
      accounts
    );

    if ('error' in result) {
      setErrors({ submit: result.error });
      return;
    }

    // Convert selected stock transactions to COGS
    if (selectedStockIds.length > 0 && onConvertStockToCOGS) {
      try {
        await onConvertStockToCOGS(selectedStockIds);
      } catch (err: any) {
        setErrors({ submit: err.message || 'Gagal mengkonversi persediaan ke HPP' });
        return;
      }
    }

    // Attach sold stock IDs to meta if any were selected
    const formData = result as TransactionFormData;
    if (selectedStockIds.length > 0) {
      formData.meta = { sold_stock_ids: selectedStockIds };
    }

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Submit error */}
      {errors.submit && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{errors.submit}</p>
        </div>
      )}

      {/* 1. JUMLAH (Rp) */}
      <CurrencyInputWithCalculator
        label="Jumlah (Rp)"
        value={amount}
        displayValue={displayAmount}
        onChange={(numeric, formatted) => {
          setDisplayAmount(formatted);
          setAmount(numeric);
          if (errors.amount) setErrors(prev => { const n = { ...prev }; delete n.amount; return n; });
        }}
        inputClassName="text-2xl font-bold"
        colorVariant={flowDirection === 'in' ? 'green' : flowDirection === 'out' ? 'red' : 'default'}
        error={errors.amount}
        autoFocus
      />

      {/* 2. KATEGORI (Account Dropdown) */}
      <div className="relative">
        <label className="label text-base font-semibold">Kategori</label>

        {/* Dropdown trigger */}
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={`input w-full text-left flex justify-between items-center ${
            errors.selectedAccountId ? 'border-red-500 dark:border-red-400' : ''
          } ${dropdownOpen ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20' : ''}`}
        >
          {selectedAccount ? (
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                  ACCOUNT_TYPE_COLORS[selectedAccount.account_type]
                } bg-gray-100 dark:bg-gray-700`}
              >
                {selectedAccount.account_code}
              </span>
              <span className="truncate">{selectedAccount.account_name}</span>
            </div>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">Pilih kategori akun...</span>
          )}
          <ChevronDown
            className={`w-5 h-5 flex-shrink-0 transition-transform ${
              dropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {errors.selectedAccountId && !dropdownOpen && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.selectedAccountId}</p>
        )}

        {/* Absolute dropdown panel */}
        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => {
                setDropdownOpen(false);
                setSearchTerm('');
              }}
            />
            <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-80 overflow-hidden">
              {/* Search */}
              <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                <input
                  type="text"
                  placeholder="Cari kode atau nama akun..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:bg-white dark:focus:bg-gray-600 outline-none"
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              </div>

              {/* Grouped account list */}
              <div className="overflow-y-auto max-h-64">
                {(Object.entries(groupedAccounts) as [AccountType, Account[]][]).map(
                  ([type, accs]) => {
                    if (accs.length === 0) return null;
                    return (
                      <div key={type}>
                        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold uppercase tracking-wide sticky top-0">
                          <span className={ACCOUNT_TYPE_COLORS[type]}>
                            {ACCOUNT_TYPE_LABELS[type]}
                          </span>
                        </div>
                        {accs.map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => handleSelectAccount(account)}
                            className={`w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors ${
                              account.id === selectedAccountId
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-indigo-500'
                                : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                {account.account_code}
                              </span>
                              <span className="text-sm text-gray-900 dark:text-gray-100">
                                {account.account_name}
                              </span>
                            </div>
                            {account.description && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 pl-14">
                                {account.description}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    );
                  }
                )}

                {/* No results */}
                {Object.values(groupedAccounts).every((accs) => accs.length === 0) && (
                  <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                    Tidak ada akun yang cocok
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Flow preview badge */}
        {selectedAccount && cashAccount && (
          <div
            className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              flowDirection === 'in'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
            }`}
          >
            {flowDirection === 'in' ? (
              <ArrowDownLeft className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ArrowUpRight className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="font-medium">{flowLabel}</span>
            <span className="text-xs opacity-75">
              {flowDirection === 'in'
                ? `${selectedAccount.account_name} → ${cashAccount.account_name}`
                : `${cashAccount.account_name} → ${selectedAccount.account_name}`}
            </span>
          </div>
        )}
      </div>

      {/* Inventory Picker - shown when revenue account selected and stock exists */}
      {showInventoryPicker && (
        <InventoryPicker
          stockTransactions={stockTransactions}
          selectedIds={selectedStockIds}
          onToggle={handleToggleStock}
        />
      )}

      {/* 3. NAMA */}
      <div>
        <label className="label text-base font-semibold">
          {flowDirection === 'in' ? 'Nama (Pemberi)' : flowDirection === 'out' ? 'Nama (Penerima)' : 'Nama'}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) {
              setErrors((prev) => {
                const next = { ...prev };
                delete next.name;
                return next;
              });
            }
          }}
          className="input"
          placeholder={
            flowDirection === 'in'
              ? 'Siapa yang membayar? (Customer)'
              : flowDirection === 'out'
              ? 'Dibayar ke siapa? (Vendor)'
              : 'Customer / Vendor'
          }
        />
        {errors.name && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.name}</p>
        )}
      </div>

      {/* 4. TANGGAL */}
      <div>
        <label className="label text-base font-semibold">Tanggal</label>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            if (errors.date) {
              setErrors((prev) => {
                const next = { ...prev };
                delete next.date;
                return next;
              });
            }
          }}
          className="input"
        />
        {errors.date && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.date}</p>
        )}
      </div>

      {/* 5. NOTES (Expandable) */}
      <div>
        {!showNotes ? (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <StickyNote className="w-4 h-4" />
            <span>+ Tambah catatan</span>
          </button>
        ) : (
          <div>
            <label className="label text-sm text-gray-500 dark:text-gray-400">Notes (opsional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
              rows={2}
              placeholder="Penjelasan singkat..."
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary flex-1"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary flex-1 flex items-center justify-center gap-2"
          disabled={loading || loadingAccounts}
        >
          {loading ? (
            'Menyimpan...'
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Save
            </>
          )}
        </button>
      </div>
    </form>
  );
}

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useBusinessContext } from '@/context/BusinessContext';
import { getAccounts } from '@/lib/api/accounts';
import { createTransaction } from '@/lib/api/transactions';
import { getTransactions } from '@/lib/api/transactions';
import { detectCategory } from '@/lib/utils/transactionHelpers';
import { findDefaultCashAccount } from '@/lib/utils/quickTransactionHelper';
import { getStockTransactions, findCogsAccount } from '@/lib/utils/inventoryHelper';
import { updateTransaction } from '@/lib/api/transactions';
import { InventoryPicker } from '@/components/transactions/InventoryPicker';
import { AccountDropdown } from '@/components/transactions/AccountDropdown';
import type { Account, AccountType, TransactionCategory, Transaction } from '@/types';
import {
  ArrowLeft,
  BookOpen,
  Save,
  TrendingUp,
  TrendingDown,
  Landmark,
  CreditCard,
  Wallet,
  ArrowRightLeft,
  PiggyBank,
  CheckCircle2,
} from 'lucide-react';

// ─── entry types ───────────────────────────────────────────────────────────

type EntryTypeId =
  | 'penjualan'
  | 'pengeluaran'
  | 'pinjaman'
  | 'bayar_hutang'
  | 'cicil_hutang'
  | 'suntik_modal'
  | 'tarik_dividen';

interface EntryType {
  id: EntryTypeId;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  /** Which account type should the debit dropdown show */
  debitFilter: AccountType | 'ALL';
  /** Which account type should the credit dropdown show */
  creditFilter: AccountType | 'ALL';
  /** Default debit account type for auto-resolve */
  defaultDebitType: AccountType;
  /** Default credit account type for auto-resolve */
  defaultCreditType: AccountType;
  /** Suggested category */
  suggestedCategory: TransactionCategory;
  /** Nama label for the "from" party */
  nameLabel: string;
  namePlaceholder: string;
}

const ENTRY_TYPES: EntryType[] = [
  {
    id: 'penjualan',
    label: 'Penjualan',
    description: 'Terima uang dari pelanggan',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-500',
    debitFilter: 'ASSET',
    creditFilter: 'REVENUE',
    defaultDebitType: 'ASSET',
    defaultCreditType: 'REVENUE',
    suggestedCategory: 'EARN',
    nameLabel: 'Nama Pelanggan',
    namePlaceholder: 'Siapa yang membayar?',
  },
  {
    id: 'pengeluaran',
    label: 'Pengeluaran',
    description: 'Bayar beban operasional',
    icon: <TrendingDown className="w-5 h-5" />,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-500',
    debitFilter: 'EXPENSE',
    creditFilter: 'ASSET',
    defaultDebitType: 'EXPENSE',
    defaultCreditType: 'ASSET',
    suggestedCategory: 'OPEX',
    nameLabel: 'Nama Vendor / Penerima',
    namePlaceholder: 'Dibayar ke siapa?',
  },
  {
    id: 'pinjaman',
    label: 'Terima Pinjaman',
    description: 'Uang masuk dari pinjaman',
    icon: <Landmark className="w-5 h-5" />,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-500',
    debitFilter: 'ASSET',
    creditFilter: 'LIABILITY',
    defaultDebitType: 'ASSET',
    defaultCreditType: 'LIABILITY',
    suggestedCategory: 'FIN',
    nameLabel: 'Nama Pemberi Pinjaman',
    namePlaceholder: 'Bank / kreditur',
  },
  {
    id: 'bayar_hutang',
    label: 'Bayar Hutang',
    description: 'Lunasi kewajiban sepenuhnya',
    icon: <CreditCard className="w-5 h-5" />,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-500',
    debitFilter: 'LIABILITY',
    creditFilter: 'ASSET',
    defaultDebitType: 'LIABILITY',
    defaultCreditType: 'ASSET',
    suggestedCategory: 'FIN',
    nameLabel: 'Nama Kreditur',
    namePlaceholder: 'Bank / kreditur yang dibayar',
  },
  {
    id: 'cicil_hutang',
    label: 'Cicil Hutang',
    description: 'Bayar sebagian kewajiban',
    icon: <ArrowRightLeft className="w-5 h-5" />,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-500',
    debitFilter: 'LIABILITY',
    creditFilter: 'ASSET',
    defaultDebitType: 'LIABILITY',
    defaultCreditType: 'ASSET',
    suggestedCategory: 'FIN',
    nameLabel: 'Nama Kreditur',
    namePlaceholder: 'Bank / kreditur yang dicicil',
  },
  {
    id: 'suntik_modal',
    label: 'Suntik Modal',
    description: 'Pemilik menambah modal bisnis',
    icon: <PiggyBank className="w-5 h-5" />,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-500',
    debitFilter: 'ASSET',
    creditFilter: 'EQUITY',
    defaultDebitType: 'ASSET',
    defaultCreditType: 'EQUITY',
    suggestedCategory: 'FIN',
    nameLabel: 'Nama Penyetor Modal',
    namePlaceholder: 'Nama pemilik / investor',
  },
  {
    id: 'tarik_dividen',
    label: 'Tarik Dividen',
    description: 'Pemilik mengambil keuntungan',
    icon: <Wallet className="w-5 h-5" />,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    borderColor: 'border-indigo-500',
    debitFilter: 'EQUITY',
    creditFilter: 'ASSET',
    defaultDebitType: 'EQUITY',
    defaultCreditType: 'ASSET',
    suggestedCategory: 'FIN',
    nameLabel: 'Nama Penerima',
    namePlaceholder: 'Nama pemilik / investor',
  },
];

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  EARN: 'Pendapatan (EARN)',
  OPEX: 'Beban Operasional (OPEX)',
  VAR: 'Beban Variabel (VAR)',
  CAPEX: 'Belanja Modal (CAPEX)',
  TAX: 'Pajak (TAX)',
  FIN: 'Keuangan (FIN)',
};

const ALL_CATEGORIES: TransactionCategory[] = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

// ─── helpers ───────────────────────────────────────────────────────────────

function formatNumberWithSeparator(num: number | string): string {
  if (!num) return '';
  const numStr = num.toString().replace(/\D/g, '');
  if (!numStr) return '';
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseFormattedNumber(str: string): number {
  const cleaned = str.replace(/\./g, '');
  return parseInt(cleaned) || 0;
}

// ─── page ──────────────────────────────────────────────────────────────────

export default function JournalEntryPage() {
  const router = useRouter();
  const { user, activeBusiness, activeBusinessId: businessId } = useBusinessContext();

  // step state
  const [selectedEntryType, setSelectedEntryType] = useState<EntryType | null>(null);

  // form state
  const [amount, setAmount] = useState(0);
  const [displayAmount, setDisplayAmount] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [category, setCategory] = useState<TransactionCategory>('OPEX');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // inventory state
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);

  // data state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  // fetch accounts + transactions
  useEffect(() => {
    if (!businessId) return;
    async function fetchData() {
      try {
        const [accs, txns] = await Promise.all([
          getAccounts(businessId!),
          getTransactions(businessId!),
        ]);
        setAccounts(accs);
        setAllTransactions(txns);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoadingAccounts(false);
      }
    }
    fetchData();
  }, [businessId]);

  // derived
  const cashAccount = useMemo(() => findDefaultCashAccount(accounts), [accounts]);

  // Auto-set default accounts & category when entry type is selected
  const handleSelectEntryType = useCallback((entryType: EntryType) => {
    setSelectedEntryType(entryType);
    setErrors({});

    // Auto-fill debit: prefer cash/bank for ASSET type
    if (entryType.defaultDebitType === 'ASSET' && cashAccount) {
      setDebitAccountId(cashAccount.id);
    } else {
      setDebitAccountId('');
    }

    // Auto-fill credit: prefer cash/bank for ASSET type
    if (entryType.defaultCreditType === 'ASSET' && cashAccount) {
      setCreditAccountId(cashAccount.id);
    } else {
      setCreditAccountId('');
    }

    setCategory(entryType.suggestedCategory);
  }, [cashAccount]);

  // Auto-detect category when debit/credit accounts change
  useEffect(() => {
    if (!debitAccountId || !creditAccountId) return;
    const debitAcc = accounts.find(a => a.id === debitAccountId);
    const creditAcc = accounts.find(a => a.id === creditAccountId);
    if (!debitAcc || !creditAcc) return;
    const detected = detectCategory(debitAcc.account_code, creditAcc.account_code, debitAcc, creditAcc);
    setCategory(detected);
  }, [debitAccountId, creditAccountId, accounts]);

  // Inventory picker
  const debitAccount = accounts.find(a => a.id === debitAccountId);
  const creditAccount = accounts.find(a => a.id === creditAccountId);
  const isRevenueCredit = creditAccount?.account_type === 'REVENUE';
  const stockTransactions = useMemo(
    () => (isRevenueCredit ? getStockTransactions(allTransactions) : []),
    [isRevenueCredit, allTransactions]
  );
  const showInventoryPicker = isRevenueCredit && stockTransactions.length > 0;

  const handleToggleStock = (transactionId: string) => {
    setSelectedStockIds(prev =>
      prev.includes(transactionId)
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  // handlers
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = parseFormattedNumber(e.target.value);
    setDisplayAmount(formatNumberWithSeparator(numericValue));
    setAmount(numericValue);
    if (errors.amount) setErrors(p => { const n = { ...p }; delete n.amount; return n; });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (amount <= 0) newErrors.amount = 'Jumlah harus lebih dari 0';
    if (!debitAccountId) newErrors.debit = 'Akun debit harus dipilih';
    if (!creditAccountId) newErrors.credit = 'Akun kredit harus dipilih';
    if (debitAccountId && creditAccountId && debitAccountId === creditAccountId) {
      newErrors.credit = 'Akun debit dan kredit tidak boleh sama';
    }
    if (!name.trim()) newErrors.name = 'Nama harus diisi';
    if (!date) newErrors.date = 'Tanggal harus diisi';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !businessId || !user) return;

    setSaving(true);
    try {
      // Convert selected stock to COGS first
      if (selectedStockIds.length > 0) {
        const cogsAccount = findCogsAccount(accounts);
        if (!cogsAccount) throw new Error('Tidak ada akun HPP/Beban yang aktif.');
        for (const txId of selectedStockIds) {
          await updateTransaction(txId, { debit_account_id: cogsAccount.id });
        }
      }

      const meta = selectedStockIds.length > 0
        ? { sold_stock_ids: selectedStockIds }
        : undefined;

      await createTransaction({
        business_id: businessId,
        created_by: user.id,
        date,
        category,
        name,
        description: description || (debitAccount?.account_name ?? ''),
        amount,
        account: 'Double-entry transaction',
        debit_account_id: debitAccountId,
        credit_account_id: creditAccountId,
        is_double_entry: true,
        notes: description || undefined,
        meta,
      });

      // Reset form (keep entry type selected for quick multi-entry)
      setAmount(0);
      setDisplayAmount('');
      setName('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setSelectedStockIds([]);
      setErrors({});
      setSuccessMessage('Transaksi berhasil disimpan!');
      setTimeout(() => setSuccessMessage(''), 3000);

      // Refresh transactions list for inventory picker
      const txns = await getTransactions(businessId);
      setAllTransactions(txns);
    } catch (err: any) {
      setErrors({ submit: err.message || 'Gagal menyimpan transaksi' });
    } finally {
      setSaving(false);
    }
  };

  // ─── render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Back nav */}
      <button
        onClick={() => router.push('/transactions')}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Transaksi
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Journal Entry</h1>
          {activeBusiness && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{activeBusiness.business_name}</p>
          )}
        </div>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">{successMessage}</p>
        </div>
      )}

      {/* ── STEP 1: Entry type selector ── */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Jenis Transaksi
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {ENTRY_TYPES.map((et) => {
            const isSelected = selectedEntryType?.id === et.id;
            return (
              <button
                key={et.id}
                type="button"
                onClick={() => handleSelectEntryType(et)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                  isSelected
                    ? `${et.bgColor} ${et.borderColor} ${et.color}`
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <span className={isSelected ? et.color : 'text-gray-400 dark:text-gray-500'}>
                  {et.icon}
                </span>
                <span className="text-xs font-semibold leading-tight">{et.label}</span>
              </button>
            );
          })}
        </div>
        {selectedEntryType && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {selectedEntryType.description}
          </p>
        )}
      </div>

      {/* ── STEP 2: Form (shown after entry type selected) ── */}
      {selectedEntryType && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Submit error */}
            {errors.submit && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">{errors.submit}</p>
              </div>
            )}

            {/* Row 1: Amount + Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label text-base font-semibold">Jumlah (Rp)</label>
                <input
                  type="text"
                  value={displayAmount}
                  onChange={handleAmountChange}
                  className={`input text-2xl font-bold ${
                    selectedEntryType.id === 'penjualan' || selectedEntryType.id === 'pinjaman' || selectedEntryType.id === 'suntik_modal'
                      ? 'border-emerald-400 dark:border-emerald-500 focus:ring-emerald-500'
                      : 'border-red-400 dark:border-red-500 focus:ring-red-500'
                  }`}
                  placeholder="0"
                  inputMode="numeric"
                  autoFocus
                />
                {errors.amount && (
                  <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.amount}</p>
                )}
              </div>

              <div>
                <label className="label text-base font-semibold">Tanggal</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    if (errors.date) setErrors(p => { const n = { ...p }; delete n.date; return n; });
                  }}
                  className="input"
                />
                {errors.date && (
                  <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.date}</p>
                )}
              </div>
            </div>

            {/* Row 2: Debit + Credit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <AccountDropdown
                  label="Akun Debit"
                  accounts={accounts.filter(a =>
                    selectedEntryType.debitFilter === 'ALL'
                      ? true
                      : a.account_type === selectedEntryType.debitFilter
                  )}
                  value={debitAccountId}
                  onChange={(id, _code) => {
                    setDebitAccountId(id);
                    if (errors.debit) setErrors(p => { const n = { ...p }; delete n.debit; return n; });
                  }}
                  placeholder="Pilih akun debit..."
                  error={errors.debit}
                  required
                />
              </div>
              <div>
                <AccountDropdown
                  label="Akun Kredit"
                  accounts={accounts.filter(a =>
                    selectedEntryType.creditFilter === 'ALL'
                      ? true
                      : a.account_type === selectedEntryType.creditFilter
                  )}
                  value={creditAccountId}
                  onChange={(id, _code) => {
                    setCreditAccountId(id);
                    if (errors.credit) setErrors(p => { const n = { ...p }; delete n.credit; return n; });
                  }}
                  placeholder="Pilih akun kredit..."
                  error={errors.credit}
                  required
                />
              </div>
            </div>

            {/* Debit/Credit visual preview */}
            {debitAccount && creditAccount && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                <span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                  Debit
                </span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {debitAccount.account_code} {debitAccount.account_name}
                </span>
                <span className="text-gray-400 dark:text-gray-500 mx-1">→</span>
                <span className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-semibold">
                  Kredit
                </span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {creditAccount.account_code} {creditAccount.account_name}
                </span>
              </div>
            )}

            {/* Inventory Picker */}
            {showInventoryPicker && (
              <InventoryPicker
                stockTransactions={stockTransactions}
                selectedIds={selectedStockIds}
                onToggle={handleToggleStock}
              />
            )}

            {/* Row 3: Name + Category */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label text-base font-semibold">{selectedEntryType.nameLabel}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors(p => { const n = { ...p }; delete n.name; return n; });
                  }}
                  className="input"
                  placeholder={selectedEntryType.namePlaceholder}
                />
                {errors.name && (
                  <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="label text-base font-semibold">
                  Kategori
                  <span className="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">(otomatis terdeteksi)</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                  className="input"
                >
                  {ALL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="label text-base font-semibold">
                Deskripsi
                <span className="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">(opsional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input"
                rows={3}
                placeholder="Catatan atau penjelasan tambahan..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => router.push('/transactions')}
                className="btn-secondary flex-1"
                disabled={saving}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                disabled={saving || loadingAccounts}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Menyimpan...
                  </span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Simpan Transaksi
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

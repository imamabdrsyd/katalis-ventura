'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Transaction, TransactionCategory, Account } from '@/types';
import { CATEGORY_LABELS } from '@/lib/calculations';
import { getAccounts } from '@/lib/api/accounts';
import { AccountDropdown } from './AccountDropdown';
import { useParams } from 'next/navigation';

export interface TransactionFormData {
  date: string;
  category: TransactionCategory;
  name: string;
  description: string;
  amount: number;
  account: string;

  // NEW: Double-entry fields (optional)
  debit_account_id?: string;
  credit_account_id?: string;
  is_double_entry?: boolean;
  notes?: string;
}

interface TransactionFormProps {
  transaction?: Transaction | null;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  defaultCategory?: TransactionCategory;
  allowedCategories?: TransactionCategory[];
  businessId?: string; // NEW: Pass businessId as prop
}

const ALL_CATEGORIES: TransactionCategory[] = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

// Category-to-account suggestions mapping
const CATEGORY_SUGGESTIONS: Record<TransactionCategory, { debit: string; credit: string; description: string }> = {
  EARN: {
    debit: '1120',   // Bank BCA
    credit: '4100',  // Rental Income
    description: 'Uang masuk ke bank → Pendapatan',
  },
  OPEX: {
    debit: '5110',   // Operating Expenses (Utilities)
    credit: '1120',  // Bank BCA
    description: 'Bayar beban operasional dari bank',
  },
  VAR: {
    debit: '5210',   // Variable Costs (Cleaning)
    credit: '1120',  // Bank BCA
    description: 'Bayar biaya variabel dari bank',
  },
  CAPEX: {
    debit: '1210',   // Property/Fixed Assets
    credit: '1120',  // Bank BCA
    description: 'Beli aset dari bank',
  },
  TAX: {
    debit: '5310',   // Taxes
    credit: '1120',  // Bank BCA
    description: 'Bayar pajak dari bank',
  },
  FIN: {
    debit: '3300',   // Owner Drawings
    credit: '1120',  // Bank BCA
    description: 'Tarik dana pemilik dari bank',
  },
};

export function TransactionForm({
  transaction,
  onSubmit,
  onCancel,
  loading = false,
  defaultCategory,
  allowedCategories,
  businessId: businessIdProp,
}: TransactionFormProps) {
  const params = useParams();
  const businessId = businessIdProp || (params?.businessId as string);

  const categories = allowedCategories || ALL_CATEGORIES;
  const [formData, setFormData] = useState<TransactionFormData>({
    date: transaction?.date || new Date().toISOString().split('T')[0],
    category: transaction?.category || defaultCategory || categories[0],
    name: transaction?.name || '',
    description: transaction?.description || '',
    amount: transaction?.amount || 0,
    account: transaction?.account || '',
    debit_account_id: transaction?.debit_account_id,
    credit_account_id: transaction?.credit_account_id,
    is_double_entry: transaction?.is_double_entry || false,
    notes: transaction?.notes || '',
  });

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch accounts on mount
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

  // Get suggested account codes based on category
  const suggestedAccounts = useMemo(() => {
    return CATEGORY_SUGGESTIONS[formData.category];
  }, [formData.category]);

  // Check if using double-entry format
  const isDoubleEntry = !!(formData.debit_account_id || formData.credit_account_id);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.date) newErrors.date = 'Tanggal harus diisi';
    if (!formData.name.trim()) newErrors.name = 'Nama harus diisi';
    if (!formData.description.trim()) newErrors.description = 'Deskripsi harus diisi';
    if (formData.amount <= 0) newErrors.amount = 'Jumlah harus lebih dari 0';

    // Validate accounts based on format
    if (isDoubleEntry) {
      // Double-entry validation
      if (!formData.debit_account_id) newErrors.debit_account_id = 'Akun debit harus diisi';
      if (!formData.credit_account_id) newErrors.credit_account_id = 'Akun kredit harus diisi';
      if (formData.debit_account_id === formData.credit_account_id) {
        newErrors.debit_account_id = 'Akun debit dan kredit harus berbeda';
      }
    } else {
      // Legacy validation
      if (!formData.account.trim()) newErrors.account = 'Akun harus diisi';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      const submitData: TransactionFormData = {
        ...formData,
        is_double_entry: isDoubleEntry,
      };

      // Clear unused fields based on format
      if (isDoubleEntry) {
        submitData.account = formData.account || 'Double-entry transaction';
      } else {
        submitData.debit_account_id = undefined;
        submitData.credit_account_id = undefined;
        submitData.notes = undefined;
      }

      await onSubmit(submitData);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value,
    }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleAccountChange = (field: 'debit' | 'credit') => (accountId: string, accountCode: string) => {
    if (field === 'debit') {
      setFormData((prev) => ({ ...prev, debit_account_id: accountId }));
      if (errors.debit_account_id) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors.debit_account_id;
          return newErrors;
        });
      }
    } else {
      setFormData((prev) => ({ ...prev, credit_account_id: accountId }));
      if (errors.credit_account_id) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors.credit_account_id;
          return newErrors;
        });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Tanggal *</label>
        <input
          type="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          className="input"
          required
        />
        {errors.date && <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.date}</p>}
      </div>

      <div>
        <label className="label">Kategori *</label>
        <select
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="input"
          required
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
        {suggestedAccounts && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            💡 {suggestedAccounts.description}
          </p>
        )}
      </div>

      {/* NEW: Double-entry account fields */}
      {!loadingAccounts && accounts.length > 0 && (
        <>
          <div className="pt-2 pb-1 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Double-Entry Bookkeeping (Opsional)
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Gunakan akun debit/kredit untuk pencatatan yang lebih detail. Atau kosongkan dan gunakan field "Akun" di bawah untuk format lama.
            </p>
          </div>

          <AccountDropdown
            label="Akun Debit (Uang Keluar Dari / Beban)"
            accounts={accounts}
            value={formData.debit_account_id}
            onChange={handleAccountChange('debit')}
            placeholder="Pilih akun debit (opsional)"
            suggestedCode={suggestedAccounts?.debit}
            error={errors.debit_account_id}
          />

          <AccountDropdown
            label="Akun Kredit (Uang Masuk Ke / Pendapatan)"
            accounts={accounts}
            value={formData.credit_account_id}
            onChange={handleAccountChange('credit')}
            placeholder="Pilih akun kredit (opsional)"
            suggestedCode={suggestedAccounts?.credit}
            error={errors.credit_account_id}
          />

          {isDoubleEntry && (
            <div>
              <label className="label">Catatan (Opsional)</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="input"
                rows={2}
                placeholder="Catatan tambahan untuk transaksi ini"
              />
            </div>
          )}
        </>
      )}

      <div>
        <label className="label">Nama *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className="input"
          placeholder="Customer atau vendor terkait"
          required
        />
        {errors.name && <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.name}</p>}
      </div>

      <div>
        <label className="label">Deskripsi *</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="input"
          rows={3}
          placeholder="Masukkan deskripsi transaksi"
          required
        />
        {errors.description && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.description}</p>
        )}
      </div>

      <div>
        <label className="label">Jumlah (Rp) *</label>
        <input
          type="number"
          name="amount"
          value={formData.amount || ''}
          onChange={handleChange}
          className="input"
          placeholder="0"
          min="1"
          step="any"
          required
        />
        {errors.amount && <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.amount}</p>}
      </div>

      {!isDoubleEntry && (
        <div>
          <label className="label">Akun *</label>
          <input
            type="text"
            name="account"
            value={formData.account}
            onChange={handleChange}
            className="input"
            placeholder="cth: BCA, Cash, OVO, GoPay"
            required={!isDoubleEntry}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Format lama (backward compatible). Gunakan akun debit/kredit di atas untuk pencatatan yang lebih baik.
          </p>
          {errors.account && <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.account}</p>}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary flex-1"
          disabled={loading}
        >
          Batal
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={loading}>
          {loading ? 'Menyimpan...' : transaction ? 'Update Transaksi' : 'Tambah Transaksi'}
        </button>
      </div>
    </form>
  );
}

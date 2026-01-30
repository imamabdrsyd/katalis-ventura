'use client';

import { useState } from 'react';
import type { Transaction, TransactionCategory } from '@/types';
import { CATEGORY_LABELS } from '@/lib/calculations';

export interface TransactionFormData {
  date: string;
  category: TransactionCategory;
  description: string;
  amount: number;
  account: string;
}

interface TransactionFormProps {
  transaction?: Transaction | null;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  defaultCategory?: TransactionCategory;
  allowedCategories?: TransactionCategory[];
}

const ALL_CATEGORIES: TransactionCategory[] = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

export function TransactionForm({
  transaction,
  onSubmit,
  onCancel,
  loading = false,
  defaultCategory,
  allowedCategories,
}: TransactionFormProps) {
  const categories = allowedCategories || ALL_CATEGORIES;
  const [formData, setFormData] = useState<TransactionFormData>({
    date: transaction?.date || new Date().toISOString().split('T')[0],
    category: transaction?.category || defaultCategory || categories[0],
    description: transaction?.description || '',
    amount: transaction?.amount || 0,
    account: transaction?.account || '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof TransactionFormData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof TransactionFormData, string>> = {};

    if (!formData.date) newErrors.date = 'Tanggal harus diisi';
    if (!formData.description.trim()) newErrors.description = 'Deskripsi harus diisi';
    if (formData.amount <= 0) newErrors.amount = 'Jumlah harus lebih dari 0';
    if (!formData.account.trim()) newErrors.account = 'Akun harus diisi';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      await onSubmit(formData);
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
    if (errors[name as keyof TransactionFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
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

      <div>
        <label className="label">Akun *</label>
        <input
          type="text"
          name="account"
          value={formData.account}
          onChange={handleChange}
          className="input"
          placeholder="cth: BCA, Cash, OVO, GoPay"
          required
        />
        {errors.account && <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.account}</p>}
      </div>

      <div className="flex gap-3 pt-4">
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

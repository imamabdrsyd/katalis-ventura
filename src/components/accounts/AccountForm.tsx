'use client';

import { useState, useEffect } from 'react';
import type { Account, AccountType, NormalBalance, TransactionCategory } from '@/types';
import { AlertCircle } from 'lucide-react';
import * as accountsApi from '@/lib/api/accounts';

export interface AccountFormData {
  account_code: string;
  account_name: string;
  account_type: AccountType;
  normal_balance: NormalBalance;
  parent_account_id?: string;
  description?: string;
  sort_order: number;
  default_category?: TransactionCategory;
}

interface AccountFormProps {
  account?: Account | null;
  onSubmit: (data: AccountFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  businessId: string;
  existingCodes: string[];
  parentAccounts: Account[]; // Main accounts (parent_account_id IS NULL)
  parentAccountId?: string; // Pre-selected parent (when adding sub-account from card)
}

// Helper: suggest normal balance based on type
function suggestNormalBalance(type: AccountType): NormalBalance {
  return ['ASSET', 'EXPENSE'].includes(type) ? 'DEBIT' : 'CREDIT';
}

export function AccountForm({
  account,
  onSubmit,
  onCancel,
  loading = false,
  businessId,
  existingCodes,
  parentAccounts,
  parentAccountId,
}: AccountFormProps) {
  const isEditMode = !!account;

  const [formData, setFormData] = useState<AccountFormData>({
    account_code: account?.account_code || '',
    account_name: account?.account_name || '',
    account_type: account?.account_type || 'ASSET',
    normal_balance: account?.normal_balance || 'DEBIT',
    parent_account_id: account?.parent_account_id || parentAccountId || '',
    description: account?.description || '',
    sort_order: account?.sort_order || 0,
    default_category: account?.default_category,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingCode, setLoadingCode] = useState(false);
  const [codeRangeError, setCodeRangeError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);

  // Auto-generate code when parent changes (create mode only)
  useEffect(() => {
    if (isEditMode || !formData.parent_account_id) return;

    async function generateCode() {
      setLoadingCode(true);
      setCodeRangeError(null);
      try {
        const nextCode = await accountsApi.getNextAccountCode(businessId, formData.parent_account_id!);
        setFormData(prev => ({
          ...prev,
          account_code: nextCode,
          sort_order: parseInt(nextCode) || 0,
        }));
      } catch (err: any) {
        console.error('Failed to generate code:', err);
        setCodeRangeError(err?.message || 'Gagal membuat kode akun');
      } finally {
        setLoadingCode(false);
      }
    }

    generateCode();
  }, [formData.parent_account_id, businessId, isEditMode]);

  // Auto-set type and normal balance when parent changes
  useEffect(() => {
    if (isEditMode || !formData.parent_account_id) return;

    const parent = parentAccounts.find(p => p.id === formData.parent_account_id);
    if (parent) {
      setFormData(prev => ({
        ...prev,
        account_type: parent.account_type,
        normal_balance: suggestNormalBalance(parent.account_type),
      }));
    }
  }, [formData.parent_account_id, parentAccounts, isEditMode]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.parent_account_id && !isEditMode) {
      newErrors.parent_account_id = 'Pilih kategori induk';
    }

    if (!formData.account_name.trim()) {
      newErrors.account_name = 'Nama akun wajib diisi';
    } else if (formData.account_name.length < 3) {
      newErrors.account_name = 'Nama minimal 3 karakter';
    } else if (formData.account_name.length > 100) {
      newErrors.account_name = 'Nama maksimal 100 karakter';
    }

    if (!formData.account_code) {
      newErrors.account_code = 'Kode akun belum dibuat';
    } else if (!isEditMode && existingCodes.includes(formData.account_code)) {
      newErrors.account_code = 'Kode akun sudah digunakan';
    }

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
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    // Auto-suggest default_category for ASSET sub-accounts based on account name
    if (name === 'account_name' && selectedParent?.account_type === 'ASSET' && !isEditMode) {
      const lower = value.toLowerCase();
      let suggested: TransactionCategory | undefined;
      if (/persediaan|inventory|stok|bahan|barang/.test(lower)) {
        suggested = 'VAR';
      } else if (/piutang|receivable/.test(lower)) {
        suggested = 'EARN';
      } else if (/peralatan|equipment|kendaraan|vehicle|properti|property|gedung|mesin|furniture|tanah/.test(lower)) {
        suggested = 'CAPEX';
      }
      if (suggested) {
        setFormData(prev => ({ ...prev, default_category: suggested }));
      }
    }
  };

  // Get the selected parent for display
  const selectedParent = parentAccounts.find(p => p.id === formData.parent_account_id);

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        {isEditMode ? 'Edit Akun' : 'Tambah Sub-Akun Baru'}
      </h2>

      {/* Warning for edit mode */}
      {isEditMode && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Kode dan tipe akun tidak dapat diubah.
          </p>
        </div>
      )}

      {/* Parent Account Selector (create mode only) */}
      {!isEditMode && (
        <div>
          <label className="label">Kategori Induk *</label>
          <select
            name="parent_account_id"
            value={formData.parent_account_id}
            onChange={handleChange}
            className={`input ${parentAccountId ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
            disabled={loading || !!parentAccountId}
            required
          >
            <option value="">Pilih kategori...</option>
            {parentAccounts.map(parent => (
              <option key={parent.id} value={parent.id}>
                {parent.account_code} - {parent.account_name}
              </option>
            ))}
          </select>
          {parentAccountId && selectedParent && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              ✓ Sub-akun akan ditambahkan ke: {selectedParent.account_name}
            </p>
          )}
          {errors.parent_account_id && (
            <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.parent_account_id}</p>
          )}
        </div>
      )}

      {/* Asset Account Guidance */}
      {selectedParent?.account_type === 'ASSET' && !isEditMode && (
        <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setGuideOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left"
          >
            <span className="font-semibold text-blue-700 dark:text-blue-400">Panduan Pembuatan Akun Aset</span>
            <span className="text-gray-400 dark:text-gray-500">{guideOpen ? '▲' : '▼'}</span>
          </button>
          {guideOpen && (
            <div className="px-3 pb-3 space-y-1.5 text-gray-700 dark:text-gray-300">
              <p><strong>Aset Lancar</strong> (bisa dicairkan &lt;12 bulan):</p>
              <ul className="list-disc list-inside pl-2 space-y-0.5">
                <li>Persediaan / Inventory &rarr; kategori default: <strong>VAR</strong></li>
                <li>Piutang Usaha &rarr; kategori default: <strong>EARN</strong></li>
                <li>Uang Muka, Sewa Dibayar di Muka &rarr; kosongkan kategori</li>
              </ul>
              <p><strong>Aset Tetap</strong> (digunakan &gt;12 bulan):</p>
              <ul className="list-disc list-inside pl-2 space-y-0.5">
                <li>Peralatan, Kendaraan, Properti &rarr; kategori default: <strong>CAPEX</strong></li>
              </ul>
              <p className="text-gray-500 dark:text-gray-400 italic">Kategori akan terdeteksi otomatis dari nama akun.</p>
            </div>
          )}
        </div>
      )}

      {/* Account Code (auto-generated, read-only) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Kode Akun</label>
          <input
            type="text"
            name="account_code"
            value={loadingCode ? 'Generating...' : formData.account_code}
            className="input bg-gray-50 dark:bg-gray-700"
            disabled
            readOnly
          />
          {!isEditMode && formData.account_code && !codeRangeError && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Kode otomatis berdasarkan kategori
            </p>
          )}
          {codeRangeError && (
            <p className="text-sm text-red-500 dark:text-red-400 mt-1">{codeRangeError}</p>
          )}
          {errors.account_code && (
            <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.account_code}</p>
          )}
        </div>

        {/* Account Type (auto from parent, read-only) */}
        <div>
          <label className="label">Tipe Akun</label>
          <input
            type="text"
            value={formData.account_type}
            className="input bg-gray-50 dark:bg-gray-700"
            disabled
            readOnly
          />
          {selectedParent && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Otomatis dari: {selectedParent.account_name}
            </p>
          )}
        </div>
      </div>

      {/* Account Name */}
      <div>
        <label className="label">Nama Akun *</label>
        <input
          type="text"
          name="account_name"
          value={formData.account_name}
          onChange={handleChange}
          className="input"
          placeholder="Contoh: Bank BCA, Listrik, Gaji Karyawan"
          maxLength={100}
          disabled={loading}
          required
        />
        {errors.account_name && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.account_name}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="label">Deskripsi (Opsional)</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="input"
          rows={2}
          placeholder="Catatan tambahan tentang akun ini"
          disabled={loading}
        />
      </div>

      {/* Default Category */}
      <div>
        <label className="label">
          Kategori Transaksi Default
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">(Opsional)</span>
        </label>
        <select
          name="default_category"
          value={formData.default_category || ''}
          onChange={(e) => {
            const value = e.target.value as TransactionCategory | '';
            setFormData(prev => ({
              ...prev,
              default_category: value || undefined
            }));
          }}
          className="input"
          disabled={loading}
        >
          <option value="">Deteksi otomatis dari tipe akun</option>
          <option value="EARN">EARN - Pendapatan/Penjualan</option>
          <option value="OPEX">OPEX - Beban Operasional</option>
          <option value="VAR">VAR - Biaya Variabel/COGS</option>
          <option value="CAPEX">CAPEX - Belanja Modal</option>
          <option value="TAX">TAX - Beban Pajak</option>
          <option value="FIN">FIN - Aktivitas Pendanaan</option>
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Kategori transaksi default ketika akun ini dipilih. Kosongkan untuk deteksi otomatis berdasarkan tipe akun.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary flex-1"
          disabled={loading}
        >
          Batal
        </button>
        <button
          type="submit"
          className="btn-primary flex-1"
          disabled={loading || loadingCode || !!codeRangeError || (!isEditMode && !formData.parent_account_id)}
        >
          {loading ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Buat Akun'}
        </button>
      </div>
    </form>
  );
}

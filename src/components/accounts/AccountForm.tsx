'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Account, AccountType, NormalBalance, TransactionCategory } from '@/types';
import { AlertCircle, Check } from 'lucide-react';
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
  is_retained_earnings?: boolean;
  is_stock?: boolean;             // EQUITY: tandai akun modal disetor pemilik/investor
  is_dividend?: boolean;          // EQUITY: tandai akun Dividen / Prive
  is_dividend_payable?: boolean;  // LIABILITY: tandai akun Hutang Dividen
  is_cash_equivalent?: boolean;   // ASSET: tandai akun sebagai Kas / Setara Kas
  // Depreciation fields (PSAK 16) — only for ASSET + CAPEX
  useful_life_months?: number;
  residual_value?: number;
  acquisition_date?: string;
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
  const isSystemAccount = !!account?.is_system;

  const [formData, setFormData] = useState<AccountFormData>({
    account_code: account?.account_code || '',
    account_name: account?.account_name || '',
    account_type: account?.account_type || 'ASSET',
    normal_balance: account?.normal_balance || 'DEBIT',
    parent_account_id: account?.parent_account_id || parentAccountId || '',
    description: account?.description || '',
    sort_order: account?.sort_order || 0,
    default_category: account?.default_category,
    is_retained_earnings: account?.is_retained_earnings ?? false,
    is_stock: account?.is_stock ?? false,
    is_dividend: account?.is_dividend ?? false,
    is_dividend_payable: account?.is_dividend_payable ?? false,
    is_cash_equivalent: account?.is_cash_equivalent ?? false,
    useful_life_months: account?.useful_life_months,
    residual_value: account?.residual_value,
    acquisition_date: account?.acquisition_date,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingCode, setLoadingCode] = useState(false);
  const [codeRangeError, setCodeRangeError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);
  // Track auto-generated suggestion separately so user can override
  const [suggestedCode, setSuggestedCode] = useState('');
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [codeValidation, setCodeValidation] = useState<{ valid: boolean; message: string } | null>(null);

  // Get the selected parent for display and validation
  const selectedParent = parentAccounts.find(p => p.id === formData.parent_account_id);

  // Auto-generate code when parent changes (create mode only)
  useEffect(() => {
    if (isEditMode || !formData.parent_account_id) return;

    async function generateCode() {
      setLoadingCode(true);
      setCodeRangeError(null);
      setCodeManuallyEdited(false);
      setCodeValidation(null);
      try {
        const nextCode = await accountsApi.getNextAccountCode(businessId, formData.parent_account_id!);
        setSuggestedCode(nextCode);
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

  // Validate account code on change (create mode, when user edits manually)
  const validateAccountCode = useCallback((code: string) => {
    if (!code) {
      setCodeValidation(null);
      return;
    }

    // Must be 4-digit numeric
    if (!/^\d{4}$/.test(code)) {
      setCodeValidation({ valid: false, message: 'Kode harus 4 digit angka' });
      return;
    }

    // Must be within parent range
    if (selectedParent) {
      const baseCode = parseInt(selectedParent.account_code);
      const codeNum = parseInt(code);
      const minCode = baseCode + 1;
      const maxCode = baseCode + 999;
      if (codeNum < minCode || codeNum > maxCode) {
        setCodeValidation({ valid: false, message: `Kode harus dalam rentang ${minCode}–${maxCode}` });
        return;
      }
    }

    // Must not be already taken
    if (existingCodes.includes(code)) {
      setCodeValidation({ valid: false, message: 'Kode sudah digunakan oleh akun lain' });
      return;
    }

    setCodeValidation({ valid: true, message: 'Kode tersedia' });
  }, [selectedParent, existingCodes]);

  // Handle manual account code input
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4); // numeric only, max 4 chars
    setCodeManuallyEdited(value !== suggestedCode);
    setFormData(prev => ({
      ...prev,
      account_code: value,
      sort_order: parseInt(value) || 0,
    }));
    validateAccountCode(value);
    // Clear submit-time errors for this field
    if (errors.account_code) {
      setErrors(prev => {
        const next = { ...prev };
        delete next.account_code;
        return next;
      });
    }
  };

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
    } else if (!isEditMode) {
      if (!/^\d{4}$/.test(formData.account_code)) {
        newErrors.account_code = 'Kode harus 4 digit angka';
      } else if (selectedParent) {
        const baseCode = parseInt(selectedParent.account_code);
        const codeNum = parseInt(formData.account_code);
        if (codeNum < baseCode + 1 || codeNum > baseCode + 999) {
          newErrors.account_code = `Kode harus dalam rentang ${baseCode + 1}–${baseCode + 999}`;
        } else if (existingCodes.includes(formData.account_code)) {
          newErrors.account_code = 'Kode akun sudah digunakan';
        }
      } else if (existingCodes.includes(formData.account_code)) {
        newErrors.account_code = 'Kode akun sudah digunakan';
      }
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


  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        {isEditMode ? 'Edit Akun' : 'Tambah Sub-Akun Baru'}
      </h2>

      {/* Warning for edit mode */}
      {isEditMode && (
        <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
          <AlertCircle className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isSystemAccount
              ? 'Akun sistem — kode, tipe, dan kategori tidak dapat diubah. Anda boleh mengubah nama (mis. "Bank" → "BCA Rekening Usaha") dan deskripsi.'
              : 'Kode dan tipe akun tidak dapat diubah.'}
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
            <p className="text-xs text-emerald-500 dark:text-emerald-400 mt-1">
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

      {/* Account Code — editable in create mode, read-only in edit mode */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Kode Akun</label>
          <div className="relative">
            <input
              type="text"
              name="account_code"
              value={loadingCode ? '' : formData.account_code}
              onChange={handleCodeChange}
              placeholder={loadingCode ? 'Generating...' : suggestedCode || 'Kode akun'}
              className={`input ${isEditMode ? 'bg-gray-50 dark:bg-gray-700' : ''} ${
                !isEditMode && codeValidation
                  ? codeValidation.valid
                    ? 'border-emerald-400 dark:border-emerald-500 focus:ring-emerald-300'
                    : 'border-red-400 dark:border-red-500 focus:ring-red-300'
                  : ''
              } pr-9`}
              disabled={loading || loadingCode || isEditMode}
              readOnly={isEditMode}
              inputMode="numeric"
              maxLength={4}
            />
            {/* Validation indicator */}
            {!isEditMode && !loadingCode && formData.account_code && codeValidation && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                {codeValidation.valid ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
              </span>
            )}
          </div>
          {/* Validation message */}
          {!isEditMode && !loadingCode && codeValidation && (
            <p className={`text-xs mt-1 ${codeValidation.valid ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              {codeValidation.message}
            </p>
          )}
          {!isEditMode && !codeValidation && formData.account_code && !codeRangeError && !loadingCode && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Kode otomatis — bisa diubah manual
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
          disabled={loading || isSystemAccount}
          title={isSystemAccount ? 'Kategori akun sistem dikelola otomatis' : undefined}
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

      {/* Depreciation Settings — only for ASSET + CAPEX accounts (PSAK 16) */}
      {(formData.account_type === 'ASSET' && formData.default_category === 'CAPEX') && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-800/50">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Penyusutan Aset Tetap
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">(Opsional — PSAK 16)</span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Isi jika ingin sistem menghitung penyusutan otomatis di laporan keuangan. Kosongkan jika tidak perlu.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tanggal Perolehan</label>
              <input
                type="date"
                name="acquisition_date"
                value={formData.acquisition_date || ''}
                onChange={handleChange}
                className="input"
                disabled={loading}
              />
            </div>
            <div>
              <label className="label">Masa Manfaat (bulan)</label>
              <input
                type="number"
                name="useful_life_months"
                value={formData.useful_life_months ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                  setFormData(prev => ({ ...prev, useful_life_months: val }));
                }}
                className="input"
                placeholder="Contoh: 60"
                min={1}
                disabled={loading}
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Kendaraan: 96, Peralatan: 48, Bangunan: 240
              </p>
            </div>
          </div>

          <div>
            <label className="label">Nilai Residu (Rp)</label>
            <input
              type="number"
              name="residual_value"
              value={formData.residual_value ?? ''}
              onChange={(e) => {
                const val = e.target.value ? parseFloat(e.target.value) : undefined;
                setFormData(prev => ({ ...prev, residual_value: val }));
              }}
              className="input"
              placeholder="0"
              min={0}
              disabled={loading}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Estimasi nilai aset saat masa manfaat habis. Default: 0
            </p>
          </div>
        </div>
      )}

      {/* Share / Owner Capital designation — hanya untuk EQUITY accounts */}
      {formData.account_type === 'EQUITY' && !formData.is_retained_earnings && !formData.is_dividend && (
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Akun Saham / Modal Pemilik
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Tandai akun ini sebagai modal disetor pemilik/investor (share capital). Kredit ke akun ini masuk gross invested capital untuk ROI dashboard.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={formData.is_stock}
              onClick={() =>
                setFormData(prev => ({
                  ...prev,
                  is_stock: !prev.is_stock,
                  is_retained_earnings: false,
                  is_dividend: false,
                }))
              }
              disabled={loading}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                formData.is_stock
                  ? 'bg-indigo-600 dark:bg-indigo-500'
                  : 'bg-gray-200 dark:bg-gray-600'
              } disabled:opacity-50`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  formData.is_stock ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Retained Earnings designation — hanya untuk EQUITY accounts */}
      {formData.account_type === 'EQUITY' && (
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Akun Laba Ditahan (Retained Earnings)
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Tandai akun ini sebagai tujuan transfer laba/rugi saat Tutup Buku. Hanya satu akun per bisnis.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={formData.is_retained_earnings}
              onClick={() =>
                setFormData(prev => ({
                  ...prev,
                  is_retained_earnings: !prev.is_retained_earnings,
                  is_stock: false,
                  is_dividend: false,
                }))
              }
              disabled={loading}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                formData.is_retained_earnings
                  ? 'bg-indigo-600 dark:bg-indigo-500'
                  : 'bg-gray-200 dark:bg-gray-600'
              } disabled:opacity-50`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  formData.is_retained_earnings ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          {formData.is_retained_earnings && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Jika bisnis sudah memiliki akun Laba Ditahan lain, penanda tersebut akan dipindah ke akun ini.
            </p>
          )}
        </div>
      )}

      {/* Kas / Setara Kas designation — hanya untuk ASSET accounts */}
      {formData.account_type === 'ASSET' && (
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Akun Kas / Setara Kas
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Tandai akun ini sebagai kas atau setara kas (mis. Kas Kecil, BCA, Mandiri). Akun yang ditandai akan masuk Cash Flow report, Bank Reconciliation, dan jadi counter-account otomatis di Quick Transaction.
              </p>
              {isSystemAccount && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  Status untuk akun sistem dikelola otomatis dan tidak dapat diubah.
                </p>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={formData.is_cash_equivalent}
              onClick={() =>
                setFormData(prev => ({ ...prev, is_cash_equivalent: !prev.is_cash_equivalent }))
              }
              disabled={loading || isSystemAccount}
              aria-disabled={isSystemAccount}
              title={isSystemAccount ? 'Akun sistem — status kas dikelola otomatis' : undefined}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                formData.is_cash_equivalent
                  ? 'bg-indigo-600 dark:bg-indigo-500'
                  : 'bg-gray-200 dark:bg-gray-600'
              } ${isSystemAccount ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} disabled:opacity-60`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  formData.is_cash_equivalent ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Dividen / Prive designation — hanya untuk EQUITY accounts */}
      {formData.account_type === 'EQUITY' && !formData.is_retained_earnings && !formData.is_stock && (
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Akun Dividen / Prive (Penarikan Pemilik)
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Tandai akun ini sebagai Dividen / Prive / Drawing. Saat dipilih di transaksi, sistem menawarkan mode <strong>Declare</strong> (vs Hutang Dividen) atau <strong>Cashout</strong> langsung (vs Kas/Bank).
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={formData.is_dividend}
              onClick={() =>
                setFormData(prev => ({
                  ...prev,
                  is_dividend: !prev.is_dividend,
                  is_stock: false,
                }))
              }
              disabled={loading}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                formData.is_dividend
                  ? 'bg-indigo-600 dark:bg-indigo-500'
                  : 'bg-gray-200 dark:bg-gray-600'
              } disabled:opacity-50`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  formData.is_dividend ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Hutang Dividen designation — hanya untuk LIABILITY accounts */}
      {formData.account_type === 'LIABILITY' && (
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Akun Hutang Dividen (Dividend Payable)
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Tandai akun ini sebagai tujuan kredit otomatis saat dividen di-<em>declare</em> (commitment). Hanya satu akun per bisnis.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={formData.is_dividend_payable}
              onClick={() =>
                setFormData(prev => ({ ...prev, is_dividend_payable: !prev.is_dividend_payable }))
              }
              disabled={loading}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                formData.is_dividend_payable
                  ? 'bg-indigo-600 dark:bg-indigo-500'
                  : 'bg-gray-200 dark:bg-gray-600'
              } disabled:opacity-50`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  formData.is_dividend_payable ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          {formData.is_dividend_payable && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Jika bisnis sudah memiliki akun Hutang Dividen lain, penanda tersebut akan dipindah ke akun ini.
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
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
          className="btn-primary-glow flex-1"
          disabled={loading || loadingCode || !!codeRangeError || (!isEditMode && !formData.parent_account_id) || (codeValidation !== null && !codeValidation.valid)}
        >
          {loading ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Buat Akun'}
        </button>
      </div>
    </form>
  );
}

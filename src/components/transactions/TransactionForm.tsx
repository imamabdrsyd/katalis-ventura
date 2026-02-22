'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Transaction, TransactionCategory, TransactionMeta, Account } from '@/types';
import { CATEGORY_LABELS } from '@/lib/calculations';
import { getAccounts } from '@/lib/api/accounts';
import { AccountDropdown } from './AccountDropdown';
import { useParams } from 'next/navigation';
import { detectCategory } from '@/lib/utils/transactionHelpers';
import { useAccountingGuidance } from '@/hooks/useAccountingGuidance';
import { AlertCircle, Lightbulb, AlertTriangle } from 'lucide-react';
import { CurrencyInputWithCalculator, CalcMultiplicationInfo } from '@/components/ui/CurrencyInputWithCalculator';
import type { UnitBreakdown } from '@/types';

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

  // Metadata
  meta?: TransactionMeta | null;
}

interface TransactionFormProps {
  transaction?: Transaction | null;
  initialValues?: Partial<TransactionFormData>;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  defaultCategory?: TransactionCategory;
  allowedCategories?: TransactionCategory[];
  businessId?: string;
  mode?: 'in' | 'out' | 'full'; // NEW: mode prop
}

const ALL_CATEGORIES: TransactionCategory[] = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

const UNIT_OPTIONS = ['pcs', 'gram', 'galon', 'ikat', 'orang', 'trip'] as const;

// Helper function to format number with thousand separator
function formatNumberWithSeparator(num: number | string): string {
  if (!num) return '';
  const numStr = num.toString().replace(/\D/g, '');
  if (!numStr) return '';
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

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

// ─── Unit Breakdown Row ─────────────────────────────────────────────────────

function UnitBreakdownRow({
  unitBreakdown,
  showCustomUnit,
  customUnitValue,
  onUnitChange,
  onCustomUnitInput,
}: {
  unitBreakdown: UnitBreakdown;
  showCustomUnit: boolean;
  customUnitValue: string;
  onUnitChange: (value: string) => void;
  onCustomUnitInput: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-1.5">
        <span className="text-gray-500 dark:text-gray-400">Harga/unit:</span>
        <span className="font-semibold text-gray-800 dark:text-gray-100">
          {formatNumberWithSeparator(unitBreakdown.price_per_unit)}
        </span>
      </div>
      <span className="text-gray-300 dark:text-gray-600">×</span>
      <div className="flex items-center gap-1.5">
        <span className="text-gray-500 dark:text-gray-400">Qty:</span>
        <span className="font-semibold text-gray-800 dark:text-gray-100">
          {formatNumberWithSeparator(unitBreakdown.quantity)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 ml-auto">
        {showCustomUnit ? (
          <input
            type="text"
            value={customUnitValue}
            onChange={(e) => onCustomUnitInput(e.target.value)}
            placeholder="Satuan..."
            className="w-20 px-2 py-1 text-xs border border-indigo-300 dark:border-indigo-600 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            autoFocus
          />
        ) : (
          <select
            value={UNIT_OPTIONS.includes(unitBreakdown.unit as typeof UNIT_OPTIONS[number]) ? unitBreakdown.unit : '__custom__'}
            onChange={(e) => onUnitChange(e.target.value)}
            className="px-2 py-1 text-xs border border-indigo-300 dark:border-indigo-600 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
            <option value="__custom__">Lainnya...</option>
          </select>
        )}
      </div>
    </div>
  );
}

export function TransactionForm({
  transaction,
  initialValues,
  onSubmit,
  onCancel,
  loading = false,
  defaultCategory,
  allowedCategories,
  businessId: businessIdProp,
  mode = 'full', // Default to full mode for backward compatibility
}: TransactionFormProps) {
  const params = useParams();
  const businessId = businessIdProp || (params?.businessId as string);

  const categories = allowedCategories || ALL_CATEGORIES;
  const [formData, setFormData] = useState<TransactionFormData>({
    date: transaction?.date || initialValues?.date || new Date().toISOString().split('T')[0],
    category: transaction?.category || initialValues?.category || defaultCategory || categories[0],
    name: transaction?.name || initialValues?.name || '',
    description: transaction?.description || initialValues?.description || '',
    amount: transaction?.amount || initialValues?.amount || 0,
    account: transaction?.account || initialValues?.account || '',
    debit_account_id: transaction?.debit_account_id || initialValues?.debit_account_id,
    credit_account_id: transaction?.credit_account_id || initialValues?.credit_account_id,
    is_double_entry: transaction?.is_double_entry || initialValues?.is_double_entry || false,
    meta: transaction?.meta || initialValues?.meta || null,
  });

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [displayAmount, setDisplayAmount] = useState<string>(
    transaction?.amount
      ? formatNumberWithSeparator(transaction.amount)
      : initialValues?.amount
        ? formatNumberWithSeparator(initialValues.amount)
        : ''
  );

  // Unit breakdown state (shown after calculator multiplication)
  const [unitBreakdown, setUnitBreakdown] = useState<UnitBreakdown | null>(
    transaction?.meta?.unit_breakdown || null
  );
  const [showCustomUnit, setShowCustomUnit] = useState(false);
  const [customUnitValue, setCustomUnitValue] = useState('');

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

  // Check if using double-entry format (always true for 'in' and 'out' modes)
  const isDoubleEntry = mode !== 'full' || !!(formData.debit_account_id || formData.credit_account_id);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.date) newErrors.date = 'Tanggal harus diisi';
    if (!formData.name.trim()) newErrors.name = 'Nama harus diisi';

    // Auto-fill description if empty and using double-entry
    if (!formData.description.trim() && isDoubleEntry) {
      const oppositeAccount = getOppositeAccountName();
      if (oppositeAccount) {
        setFormData((prev) => ({
          ...prev,
          description: oppositeAccount,
        }));
      } else {
        newErrors.description = 'Deskripsi harus diisi';
      }
    } else if (!formData.description.trim()) {
      newErrors.description = 'Deskripsi harus diisi';
    }

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
        meta: {
          ...formData.meta,
          unit_breakdown: unitBreakdown && unitBreakdown.unit ? unitBreakdown : undefined,
        },
      };

      // Auto-detect category for 'in' and 'out' modes
      if (mode !== 'full' && formData.debit_account_id && formData.credit_account_id) {
        const debitAccount = accounts.find(acc => acc.id === formData.debit_account_id);
        const creditAccount = accounts.find(acc => acc.id === formData.credit_account_id);

        if (debitAccount && creditAccount) {
          submitData.category = detectCategory(
            debitAccount.account_code,
            creditAccount.account_code,
            debitAccount,
            creditAccount
          );
        }
      }

      // Clear unused fields based on format
      if (isDoubleEntry) {
        submitData.account = formData.account || 'Double-entry transaction';
      } else {
        submitData.debit_account_id = undefined;
        submitData.credit_account_id = undefined;
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

  // Helper function to get account name by ID
  const getAccountName = (accountId: string | undefined): string => {
    if (!accountId) return '';
    const account = accounts.find((acc) => acc.id === accountId);
    return account ? account.account_name : '';
  };

  // Helper function to get the opposite account name for auto-fill description
  const getOppositeAccountName = (): string => {
    // For 'in' mode or EARN: show the source (credit) account
    if (mode === 'in' || formData.category === 'EARN') {
      return getAccountName(formData.credit_account_id);
    }

    // For 'out' mode or expenses: show the destination (debit) account
    return getAccountName(formData.debit_account_id);
  };

  // Auto-fill description when it's empty
  const handleDescriptionBlur = () => {
    if (!formData.description.trim() && isDoubleEntry) {
      const oppositeAccount = getOppositeAccountName();
      if (oppositeAccount) {
        setFormData((prev) => ({
          ...prev,
          description: oppositeAccount,
        }));
        // Clear description error if it exists
        if (errors.description) {
          setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors.description;
            return newErrors;
          });
        }
      }
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

  // Handle calculator multiplication result (called only when user clicks "Gunakan & Breakdown Unit")
  const handleMultiplicationResult = (info: CalcMultiplicationInfo) => {
    setUnitBreakdown({
      price_per_unit: info.operandA,
      quantity: info.operandB,
      unit: 'pcs',
    });
    setShowCustomUnit(false);
    setCustomUnitValue('');
  };

  const handleUnitChange = (value: string) => {
    if (value === '__custom__') {
      setShowCustomUnit(true);
      setCustomUnitValue('');
      setUnitBreakdown(prev => prev ? { ...prev, unit: '' } : null);
    } else {
      setShowCustomUnit(false);
      setCustomUnitValue('');
      setUnitBreakdown(prev => prev ? { ...prev, unit: value } : null);
    }
  };

  const handleCustomUnitInput = (value: string) => {
    setCustomUnitValue(value);
    setUnitBreakdown(prev => prev ? { ...prev, unit: value } : null);
  };

  const [guidanceOpen, setGuidanceOpen] = useState(false);

  const renderBold = (text: string) =>
    text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part
    );

  // Accounting guidance and validation
  const { guidance, validation, isValid: isAccountingValid } = useAccountingGuidance({
    debitAccountId: formData.debit_account_id,
    creditAccountId: formData.credit_account_id,
    amount: formData.amount,
    transactionName: formData.name,
    accounts,
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* AMOUNT FIRST for 'in' and 'out' modes - Make it PROMINENT */}
      {mode !== 'full' && (
        <>
          <CurrencyInputWithCalculator
            label="Jumlah (Rp)"
            value={formData.amount}
            displayValue={displayAmount}
            onChange={(numeric, formatted) => {
              setDisplayAmount(formatted);
              setFormData(prev => ({ ...prev, amount: numeric }));
              if (errors.amount) setErrors(prev => { const n = { ...prev }; delete n.amount; return n; });
            }}
            onMultiplicationResult={handleMultiplicationResult}
            inputClassName="text-2xl font-bold"
            colorVariant={mode === 'in' ? 'green' : 'red'}
            error={errors.amount}
            required
          />
          {unitBreakdown && <UnitBreakdownRow unitBreakdown={unitBreakdown} showCustomUnit={showCustomUnit} customUnitValue={customUnitValue} onUnitChange={handleUnitChange} onCustomUnitInput={handleCustomUnitInput} />}
        </>
      )}

      {/* Category + Date for full mode only */}
      {mode === 'full' && (
        <div className="grid grid-cols-2 gap-4">
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
        </div>
      )}

      {/* Amount for full mode (normal size) */}
      {mode === 'full' && (
        <>
        <CurrencyInputWithCalculator
          label="Jumlah (Rp)"
          value={formData.amount}
          displayValue={displayAmount}
          onChange={(numeric, formatted) => {
            setDisplayAmount(formatted);
            setFormData(prev => ({ ...prev, amount: numeric }));
            if (errors.amount) setErrors(prev => { const n = { ...prev }; delete n.amount; return n; });
          }}
          onMultiplicationResult={handleMultiplicationResult}
          error={errors.amount}
          required
        />
        {unitBreakdown && <UnitBreakdownRow unitBreakdown={unitBreakdown} showCustomUnit={showCustomUnit} customUnitValue={customUnitValue} onUnitChange={handleUnitChange} onCustomUnitInput={handleCustomUnitInput} />}
        </>
      )}

      {/* Account fields - Different labels based on mode */}
      {!loadingAccounts && accounts.length > 0 && (
        <>
          {mode === 'in' && (
            <>
              <AccountDropdown
                label="Uang Masuk Ke"
                accounts={accounts}
                value={formData.debit_account_id}
                onChange={handleAccountChange('debit')}
                placeholder="Pilih rekening tujuan"
                suggestedCode={suggestedAccounts?.debit}
                error={errors.debit_account_id}
                filterMode="in-destination"
                required
              />

              <AccountDropdown
                label="Dari (Sumber)"
                accounts={accounts}
                value={formData.credit_account_id}
                onChange={handleAccountChange('credit')}
                placeholder="Pilih sumber pendapatan"
                suggestedCode={suggestedAccounts?.credit}
                error={errors.credit_account_id}
                filterMode="in-source"
                required
              />
            </>
          )}

          {mode === 'out' && (
            <>
              <AccountDropdown
                label="Bayar Dari"
                accounts={accounts}
                value={formData.credit_account_id}
                onChange={handleAccountChange('credit')}
                placeholder="Pilih rekening sumber"
                suggestedCode={suggestedAccounts?.credit}
                error={errors.credit_account_id}
                filterMode="out-source"
                required
              />

              <AccountDropdown
                label="Untuk (Jenis Beban)"
                accounts={accounts}
                value={formData.debit_account_id}
                onChange={handleAccountChange('debit')}
                placeholder="Pilih jenis beban"
                suggestedCode={suggestedAccounts?.debit}
                error={errors.debit_account_id}
                filterMode="out-destination"
                required
              />
            </>
          )}

          {/* Accounting Guidance for 'in' and 'out' modes */}
          {mode !== 'full' && (formData.debit_account_id || formData.credit_account_id) && (
            <div className="space-y-3">
              {/* Pattern Detection & Explanation */}
              {guidance.pattern && (
                <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setGuidanceOpen((v) => !v)}
                    className="w-full flex items-center gap-2 p-3 text-left"
                  >
                    <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <h4 className="font-medium text-sm text-blue-700 dark:text-blue-400 flex-1">
                      {guidance.pattern.name}
                    </h4>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{guidanceOpen ? '▲' : '▼'}</span>
                  </button>
                  {guidanceOpen && (
                    <div className="px-3 pb-3">
                      <p className="text-xs text-gray-700 dark:text-gray-300">
                        {guidance.pattern.description}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Warnings */}
              {guidance.warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      {guidance.warnings.map((warning, i) => (
                        <p key={i} className="text-xs text-amber-700 dark:text-amber-300">
                          {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Validation Errors */}
              {!isAccountingValid && validation.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      {validation.errors.map((error, i) => (
                        <p key={i} className="text-xs text-red-700 dark:text-red-300">
                          {error.message}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'full' && (
            <>
              <div className="pt-2 pb-1 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Account
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Gunakan akun debit/kredit untuk pencatatan yang lebih detail.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <AccountDropdown
                  label="Debit"
                  accounts={accounts}
                  value={formData.debit_account_id}
                  onChange={handleAccountChange('debit')}
                  placeholder="Pilih akun Debit"
                  suggestedCode={suggestedAccounts?.debit}
                  error={errors.debit_account_id}
                />

                <AccountDropdown
                  label="Kredit"
                  accounts={accounts}
                  value={formData.credit_account_id}
                  onChange={handleAccountChange('credit')}
                  placeholder="Pilih akun Kredit"
                  suggestedCode={suggestedAccounts?.credit}
                  error={errors.credit_account_id}
                />
              </div>

              {/* Accounting Guidance Panel */}
              {isDoubleEntry && (formData.debit_account_id || formData.credit_account_id) && (
                <div className="space-y-3">
                  {/* Pattern Detection & Explanation */}
                  {guidance.pattern && (
                    <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setGuidanceOpen((v) => !v)}
                        className="w-full flex items-center gap-2 p-4 text-left"
                      >
                        <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 flex-1">
                          {guidance.pattern.name}
                        </h4>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{guidanceOpen ? '▲' : '▼'}</span>
                      </button>
                      {guidanceOpen && (
                        <div className="px-4 pb-4">
                          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                            {guidance.explanation.split('\n').map((line, i) => (
                              <p key={i}>{renderBold(line)}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Basic guidance when no pattern detected */}
                  {!guidance.pattern && guidance.explanation && (
                    <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg">
                      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        {guidance.explanation.split('\n').map((line, i) => (
                          <p key={i}>{renderBold(line)}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings from guidance */}
                  {guidance.warnings.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          {guidance.warnings.map((warning, i) => (
                            <p key={i} className="text-sm text-amber-700 dark:text-amber-300">
                              {warning}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Validation Errors */}
                  {!isAccountingValid && validation.errors.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          {validation.errors.map((error, i) => (
                            <p key={i} className="text-sm text-red-700 dark:text-red-300">
                              {error.message}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Validation Warnings */}
                  {validation.warnings.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          {validation.warnings.map((warning, i) => (
                            <p key={i} className="text-sm text-amber-700 dark:text-amber-300">
                              {warning.message}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Date for 'in' and 'out' modes */}
      {mode !== 'full' && (
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
      )}

      {/* Customer/Vendor Name - Different label based on mode */}
      <div>
        <label className="label">
          {mode === 'in' ? 'Nama Customer' : mode === 'out' ? 'Nama Vendor' : 'Nama'} *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className="input"
          placeholder={mode === 'in' ? 'Nama customer' : mode === 'out' ? 'Nama vendor/penerima' : 'Customer atau vendor terkait'}
          required
        />
        {errors.name && <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.name}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="label">Deskripsi/Catatan {mode !== 'full' && '(opsional)'}</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          onBlur={handleDescriptionBlur}
          className="input"
          rows={3}
          placeholder={
            isDoubleEntry
              ? 'Masukkan deskripsi transaksi (kosongkan untuk auto-fill dengan nama akun)'
              : 'Masukkan deskripsi transaksi'
          }
        />
        {errors.description && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.description}</p>
        )}
      </div>

      {/* Legacy Account field (only for full mode when not using double-entry) */}
      {mode === 'full' && !isDoubleEntry && (
        <div>
          <label className="label">Akun</label>
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
            Format lama (backward compatible)
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
          {loading ? 'Menyimpan...' : transaction ? 'Update Transaksi' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}

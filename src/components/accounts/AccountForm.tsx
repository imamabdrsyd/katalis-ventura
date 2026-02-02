'use client';

import { useState, useEffect } from 'react';
import type { Account, AccountType, NormalBalance } from '@/types';
import { AlertCircle } from 'lucide-react';

export interface AccountFormData {
  account_code: string;
  account_name: string;
  account_type: AccountType;
  normal_balance: NormalBalance;
  description?: string;
  sort_order: number;
}

interface AccountFormProps {
  account?: Account | null;
  onSubmit: (data: AccountFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  businessId: string;
  existingCodes: string[];
}

const ACCOUNT_TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

// Helper: suggest normal balance based on type
function suggestNormalBalance(type: AccountType): NormalBalance {
  return ['ASSET', 'EXPENSE'].includes(type) ? 'DEBIT' : 'CREDIT';
}

// Helper: suggest next available code based on type
function suggestNextCode(type: AccountType, existingCodes: string[]): string {
  const rangeStart = {
    ASSET: 1000,
    LIABILITY: 2000,
    EQUITY: 3000,
    REVENUE: 4000,
    EXPENSE: 5000,
  }[type];

  const codesInRange = existingCodes
    .filter((code) => {
      const num = parseInt(code);
      return num >= rangeStart && num < rangeStart + 1000;
    })
    .map((code) => parseInt(code))
    .sort((a, b) => a - b);

  let suggested = rangeStart;
  for (const code of codesInRange) {
    if (code === suggested) {
      suggested++;
    } else {
      break;
    }
  }

  return suggested.toString();
}

// Helper: calculate sort order based on code
function calculateSortOrder(code: string): number {
  const num = parseInt(code);
  return isNaN(num) ? 0 : num;
}

export function AccountForm({
  account,
  onSubmit,
  onCancel,
  loading = false,
  businessId,
  existingCodes,
}: AccountFormProps) {
  const isEditMode = !!account;

  const [formData, setFormData] = useState<AccountFormData>({
    account_code: account?.account_code || '',
    account_name: account?.account_name || '',
    account_type: account?.account_type || 'ASSET',
    normal_balance: account?.normal_balance || 'DEBIT',
    description: account?.description || '',
    sort_order: account?.sort_order || 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [suggestedCode, setSuggestedCode] = useState<string>('');

  // Update suggested code when type changes (create mode only)
  useEffect(() => {
    if (!isEditMode && formData.account_type) {
      const suggested = suggestNextCode(formData.account_type, existingCodes);
      setSuggestedCode(suggested);
    }
  }, [formData.account_type, existingCodes, isEditMode]);

  // Auto-suggest normal balance when type changes
  useEffect(() => {
    if (!isEditMode) {
      const suggested = suggestNormalBalance(formData.account_type);
      setFormData((prev) => ({ ...prev, normal_balance: suggested }));
    }
  }, [formData.account_type, isEditMode]);

  const validateCode = (code: string): string | null => {
    if (!code.trim()) {
      return 'Account code is required';
    }
    if (!/^\d{4}$/.test(code)) {
      return 'Code must be exactly 4 digits';
    }
    if (!isEditMode && existingCodes.includes(code)) {
      return 'This code already exists';
    }
    return null;
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const codeError = validateCode(formData.account_code);
    if (codeError) newErrors.account_code = codeError;

    if (!formData.account_name.trim()) {
      newErrors.account_name = 'Account name is required';
    } else if (formData.account_name.length < 3) {
      newErrors.account_name = 'Name must be at least 3 characters';
    } else if (formData.account_name.length > 100) {
      newErrors.account_name = 'Name must not exceed 100 characters';
    }

    if (!formData.account_type) {
      newErrors.account_type = 'Account type is required';
    }

    if (!formData.normal_balance) {
      newErrors.normal_balance = 'Normal balance is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      const submitData: AccountFormData = {
        ...formData,
        sort_order: calculateSortOrder(formData.account_code),
      };
      await onSubmit(submitData);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleCodeBlur = () => {
    const codeError = validateCode(formData.account_code);
    if (codeError) {
      setErrors((prev) => ({ ...prev, account_code: codeError }));
    }
  };

  const handleUseSuggested = () => {
    setFormData((prev) => ({ ...prev, account_code: suggestedCode }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.account_code;
      return newErrors;
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        {isEditMode ? 'Edit Account' : 'Add New Account'}
      </h2>

      {/* Warning for edit mode */}
      {isEditMode && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Account code and type cannot be changed for existing accounts.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Account Type */}
        <div>
          <label className="label">Account Type *</label>
          <select
            name="account_type"
            value={formData.account_type}
            onChange={handleChange}
            className="input"
            disabled={isEditMode || loading}
            required
          >
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.account_type && (
            <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.account_type}</p>
          )}
        </div>

        {/* Account Code */}
        <div>
          <label className="label">Account Code *</label>
          <input
            type="text"
            name="account_code"
            value={formData.account_code}
            onChange={handleChange}
            onBlur={handleCodeBlur}
            className="input"
            placeholder="e.g., 1120"
            maxLength={4}
            disabled={isEditMode || loading}
            required
          />
          {!isEditMode && suggestedCode && !formData.account_code && (
            <button
              type="button"
              onClick={handleUseSuggested}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
            >
              Suggested: {suggestedCode} (click to use)
            </button>
          )}
          {errors.account_code && (
            <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.account_code}</p>
          )}
        </div>
      </div>

      {/* Account Name */}
      <div>
        <label className="label">Account Name *</label>
        <input
          type="text"
          name="account_name"
          value={formData.account_name}
          onChange={handleChange}
          className="input"
          placeholder="e.g., Bank - BCA"
          maxLength={100}
          disabled={loading}
          required
        />
        {errors.account_name && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.account_name}</p>
        )}
      </div>

      {/* Normal Balance */}
      <div>
        <label className="label">Normal Balance *</label>
        <select
          name="normal_balance"
          value={formData.normal_balance}
          onChange={handleChange}
          className="input"
          disabled={loading}
          required
        >
          <option value="DEBIT">DEBIT</option>
          <option value="CREDIT">CREDIT</option>
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Auto-suggested based on account type. DEBIT for Assets/Expenses, CREDIT for Liabilities/Equity/Revenue.
        </p>
        {errors.normal_balance && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.normal_balance}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="label">Description (Optional)</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="input"
          rows={3}
          placeholder="Additional notes about this account"
          disabled={loading}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary flex-1"
          disabled={loading}
        >
          Cancel
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={loading}>
          {loading ? 'Saving...' : isEditMode ? 'Update Account' : 'Create Account'}
        </button>
      </div>
    </form>
  );
}

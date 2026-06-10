'use client';

import { useState, useEffect, useMemo } from 'react';
import type { CatalogItem, CatalogItemType, Account } from '@/types';
import { AlertCircle, Package, Wrench } from 'lucide-react';
import { CurrencyInputWithCalculator } from '@/components/ui/CurrencyInputWithCalculator';
import { useLanguage } from '@/context/LanguageContext';

export interface CatalogItemFormData {
  name: string;
  description?: string | null;
  item_type: CatalogItemType;
  default_price: number;
  unit?: string | null;
  revenue_account_id?: string | null;
  is_active: boolean;
}

interface CatalogItemFormProps {
  item?: CatalogItem | null;
  revenueAccounts: Account[];
  existingNames: string[]; // lowercase names already used (for uniqueness check)
  onSubmit: (data: CatalogItemFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const TYPE_OPTIONS: { value: CatalogItemType; icon: typeof Package }[] = [
  { value: 'product', icon: Package },
  { value: 'service', icon: Wrench },
];

export function CatalogItemForm({
  item,
  revenueAccounts,
  existingNames,
  onSubmit,
  onCancel,
  loading = false,
}: CatalogItemFormProps) {
  const { t } = useLanguage();
  const tc = t.catalog;
  const isEditMode = !!item;

  const [formData, setFormData] = useState<CatalogItemFormData>({
    name: item?.name ?? '',
    description: item?.description ?? '',
    item_type: item?.item_type ?? 'product',
    default_price: item?.default_price ?? 0,
    unit: item?.unit ?? '',
    revenue_account_id: item?.revenue_account_id ?? null,
    is_active: item?.is_active ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [priceDisplay, setPriceDisplay] = useState<string>(
    item?.default_price ? item.default_price.toLocaleString('id-ID') : ''
  );

  // Reset when switching target item
  useEffect(() => {
    setFormData({
      name: item?.name ?? '',
      description: item?.description ?? '',
      item_type: item?.item_type ?? 'product',
      default_price: item?.default_price ?? 0,
      unit: item?.unit ?? '',
      revenue_account_id: item?.revenue_account_id ?? null,
      is_active: item?.is_active ?? true,
    });
    setPriceDisplay(item?.default_price ? item.default_price.toLocaleString('id-ID') : '');
    setErrors({});
  }, [item]);

  // Names taken by *other* items (exclude self when editing)
  const takenNames = useMemo(() => {
    const self = item?.name?.toLowerCase();
    return new Set(existingNames.filter(n => n !== self));
  }, [existingNames, item]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    const trimmed = formData.name.trim();
    if (!trimmed) {
      next.name = tc.errorNameRequired;
    } else if (takenNames.has(trimmed.toLowerCase())) {
      next.name = tc.errorNameTaken;
    }
    if (formData.default_price < 0) {
      next.default_price = tc.errorPriceNegative;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit({
      ...formData,
      name: formData.name.trim(),
      description: formData.description?.trim() || null,
      unit: formData.unit?.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tipe item */}
      <div>
        <label className="label">{tc.typeLabel}</label>
        <div className="grid grid-cols-2 gap-2">
          {TYPE_OPTIONS.map(({ value, icon: Icon }) => {
            const active = formData.item_type === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, item_type: value }))}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  active
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500/20'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {value === 'product' ? tc.typeProduct : tc.typeService}
              </button>
            );
          })}
        </div>
      </div>

      {/* Nama */}
      <div>
        <label className="label">
          {formData.item_type === 'product' ? tc.nameLabelProduct : tc.nameLabelService} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder={formData.item_type === 'product' ? tc.namePlaceholderProduct : tc.namePlaceholderService}
          className="input"
          autoFocus
        />
        {errors.name && (
          <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.name}
          </p>
        )}
      </div>

      {/* Harga + satuan */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{tc.priceLabel}</label>
          <CurrencyInputWithCalculator
            displayValue={priceDisplay}
            onChange={(val, display) => {
              setFormData(prev => ({ ...prev, default_price: val }));
              setPriceDisplay(display);
            }}
          />
          {errors.default_price && (
            <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.default_price}
            </p>
          )}
        </div>
        <div>
          <label className="label">{tc.unitLabel}</label>
          <input
            type="text"
            value={formData.unit ?? ''}
            onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
            placeholder={tc.unitPlaceholder}
            className="input"
          />
        </div>
      </div>

      {/* Akun pendapatan */}
      <div>
        <label className="label">{tc.revenueAccountLabel}</label>
        <select
          value={formData.revenue_account_id ?? ''}
          onChange={(e) => setFormData(prev => ({ ...prev, revenue_account_id: e.target.value || null }))}
          className="input"
        >
          <option value="">{tc.revenueAccountPlaceholder}</option>
          {revenueAccounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {acc.account_code} - {acc.account_name}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
          {tc.revenueAccountHint}
        </p>
      </div>

      {/* Deskripsi */}
      <div>
        <label className="label">{tc.descriptionLabel}</label>
        <textarea
          value={formData.description ?? ''}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={2}
          placeholder={tc.descriptionPlaceholder}
          className="input resize-none"
        />
      </div>

      {/* Status aktif (edit only) */}
      {isEditMode && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
            className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {tc.activeLabel}
          </span>
        </label>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="btn-secondary flex-1"
        >
          {tc.cancel}
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary-glow flex-1"
        >
          {loading ? tc.saving : isEditMode ? tc.save : tc.create}
        </button>
      </div>
    </form>
  );
}

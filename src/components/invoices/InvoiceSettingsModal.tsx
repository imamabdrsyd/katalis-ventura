'use client';

import { useState, useEffect } from 'react';
import type { InvoiceSettings, InvoiceTaxType } from '@/types';
import { Modal } from '@/components/ui/Modal';

interface InvoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: InvoiceSettings | null;
  onSave: (settings: InvoiceSettings) => Promise<void>;
  loading?: boolean;
}

const TAX_TYPE_OPTIONS: { value: InvoiceTaxType; label: string }[] = [
  { value: 'none', label: 'Tanpa Pajak' },
  { value: 'included', label: 'PPN Termasuk' },
  { value: 'excluded', label: 'PPN Belum Termasuk' },
];

const DEFAULT_SETTINGS: InvoiceSettings = {
  prefix: 'INV',
  default_due_days: 7,
  default_tax_rate: 11,
  default_tax_type: 'none',
  bank_name: '',
  bank_account_number: '',
  bank_account_holder: '',
  contact_number: '',
};

export function InvoiceSettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
  loading = false,
}: InvoiceSettingsModalProps) {
  const [form, setForm] = useState<InvoiceSettings>(
    settings || DEFAULT_SETTINGS
  );

  // Sync form when settings prop changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setForm(settings || DEFAULT_SETTINGS);
    }
  }, [isOpen, settings]);

  const handleChange = (
    field: keyof InvoiceSettings,
    value: string | number
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(form);
  };

  const inputClass =
    'w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pengaturan Invoice">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Prefix */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Prefix Invoice
          </label>
          <input
            type="text"
            value={form.prefix}
            onChange={(e) => handleChange('prefix', e.target.value)}
            className={inputClass}
            placeholder="INV"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Contoh hasil: {form.prefix || 'INV'}-2026-0001
          </p>
        </div>

        {/* Default due days */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Jatuh Tempo Default
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={form.default_due_days}
              onChange={(e) =>
                handleChange('default_due_days', parseInt(e.target.value) || 0)
              }
              className={`${inputClass} w-24`}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              hari setelah tanggal invoice
            </span>
          </div>
        </div>

        {/* Default tax rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tarif Pajak Default
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.default_tax_rate}
              onChange={(e) =>
                handleChange(
                  'default_tax_rate',
                  parseFloat(e.target.value) || 0
                )
              }
              className={`${inputClass} w-24`}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
          </div>
        </div>

        {/* Default tax type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tipe Pajak Default
          </label>
          <select
            value={form.default_tax_type}
            onChange={(e) =>
              handleChange('default_tax_type', e.target.value)
            }
            className={inputClass}
          >
            {TAX_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-200 dark:border-gray-700" />

        {/* Payment details header */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">
            Detail Pembayaran
          </h4>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Informasi ini akan ditampilkan di PDF invoice
          </p>
        </div>

        {/* Bank account holder */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nama Pemegang Rekening
          </label>
          <input
            type="text"
            value={form.bank_account_holder}
            onChange={(e) =>
              handleChange('bank_account_holder', e.target.value)
            }
            className={inputClass}
            placeholder="Nama sesuai rekening"
          />
        </div>

        {/* Bank name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nama Bank
          </label>
          <input
            type="text"
            value={form.bank_name}
            onChange={(e) => handleChange('bank_name', e.target.value)}
            className={inputClass}
            placeholder="Contoh: BCA, Mandiri, BNI"
          />
        </div>

        {/* Bank account number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nomor Rekening
          </label>
          <input
            type="text"
            value={form.bank_account_number}
            onChange={(e) =>
              handleChange('bank_account_number', e.target.value)
            }
            className={inputClass}
            placeholder="1234567890"
          />
        </div>

        {/* Contact number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            No. Kontak
          </label>
          <input
            type="text"
            value={form.contact_number}
            onChange={(e) => handleChange('contact_number', e.target.value)}
            className={inputClass}
            placeholder="08xx-xxxx-xxxx"
          />
        </div>

        {/* Footer buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-ghost flex-1"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex-1"
          >
            {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

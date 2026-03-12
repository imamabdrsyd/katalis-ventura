'use client';

import { useState, useMemo } from 'react';
import type { Invoice, InvoiceFormData, InvoiceTaxType } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { InvoiceLineItemEditor } from './InvoiceLineItemEditor';

interface InvoiceFormProps {
  onSubmit: (data: InvoiceFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  invoice?: Invoice | null;
  defaultInvoiceNumber?: string;
  defaultDueDays?: number;
  defaultTaxRate?: number;
  defaultTaxType?: InvoiceTaxType;
  businessCategory?: string | null;
}

function getItemLabel(businessCategory?: string | null): string {
  switch (businessCategory) {
    case 'jasa':
      return 'Layanan';
    case 'produk':
      return 'Produk';
    case 'dagang':
      return 'Barang';
    default:
      return 'Item';
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const TAX_TYPE_OPTIONS: { value: InvoiceTaxType; label: string }[] = [
  { value: 'none', label: 'Tanpa Pajak' },
  { value: 'included', label: 'PPN (termasuk harga)' },
  { value: 'excluded', label: 'PPN (belum termasuk)' },
];

export function InvoiceForm({
  onSubmit,
  onCancel,
  loading = false,
  invoice,
  defaultInvoiceNumber = '',
  defaultDueDays = 7,
  defaultTaxRate = 11,
  defaultTaxType = 'none',
  businessCategory,
}: InvoiceFormProps) {
  const today = new Date().toISOString().split('T')[0];

  const [invoiceNumber, setInvoiceNumber] = useState(
    invoice?.invoice_number || defaultInvoiceNumber
  );
  const [invoiceDate, setInvoiceDate] = useState(
    invoice?.invoice_date || today
  );
  const [dueDate, setDueDate] = useState(
    invoice?.due_date || addDays(today, defaultDueDays)
  );
  const [customerName, setCustomerName] = useState(
    invoice?.customer_name || ''
  );
  const [customerPhone, setCustomerPhone] = useState(
    invoice?.customer_phone || ''
  );
  const [customerIdLabel, setCustomerIdLabel] = useState(
    invoice?.customer_id_label || ''
  );
  const [description, setDescription] = useState(
    invoice?.description || ''
  );

  const defaultLabel = getItemLabel(businessCategory);
  const [itemLabel, setItemLabel] = useState(
    invoice?.item_label || defaultLabel
  );

  const [lineItems, setLineItems] = useState<
    { item_name: string; quantity: number; unit_price: number }[]
  >(
    invoice?.line_items?.map((li) => ({
      item_name: li.item_name,
      quantity: li.quantity,
      unit_price: li.unit_price,
    })) || [{ item_name: '', quantity: 1, unit_price: 0 }]
  );

  const [taxType, setTaxType] = useState<InvoiceTaxType>(
    invoice?.tax_type || defaultTaxType
  );
  const [taxRate, setTaxRate] = useState(
    invoice?.tax_rate ?? defaultTaxRate
  );
  const [notes, setNotes] = useState(invoice?.notes || '');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-calculate summary
  const summary = useMemo(() => {
    const subtotal = lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );

    let taxAmount = 0;
    let total = subtotal;

    if (taxType === 'included') {
      taxAmount = subtotal * (taxRate / (100 + taxRate));
      total = subtotal;
    } else if (taxType === 'excluded') {
      taxAmount = subtotal * (taxRate / 100);
      total = subtotal + taxAmount;
    }

    return { subtotal, taxAmount: Math.round(taxAmount), total: Math.round(total) };
  }, [lineItems, taxType, taxRate]);

  // Update due date when invoice date changes (only if user hasn't manually edited)
  const handleInvoiceDateChange = (newDate: string) => {
    setInvoiceDate(newDate);
    // Auto-update due date based on default days
    setDueDate(addDays(newDate, defaultDueDays));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!invoiceNumber.trim()) newErrors.invoiceNumber = 'Nomor invoice harus diisi';
    if (!invoiceDate) newErrors.invoiceDate = 'Tanggal invoice harus diisi';
    if (!customerName.trim()) newErrors.customerName = 'Nama customer harus diisi';

    // Validate line items
    const hasValidItem = lineItems.some(
      (item) => item.item_name.trim() && item.quantity > 0 && item.unit_price > 0
    );
    if (!hasValidItem) {
      newErrors.lineItems = 'Minimal satu item harus diisi lengkap';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const data: InvoiceFormData = {
      invoice_number: invoiceNumber.trim(),
      invoice_date: invoiceDate,
      due_date: dueDate,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_id_label: customerIdLabel.trim(),
      description: description.trim(),
      item_label: itemLabel.trim() || defaultLabel,
      line_items: lineItems.filter(
        (item) => item.item_name.trim() && item.quantity > 0 && item.unit_price > 0
      ),
      tax_type: taxType,
      tax_rate: taxType !== 'none' ? taxRate : 0,
      notes: notes.trim(),
    };

    await onSubmit(data);
  };

  const sectionHeading =
    'text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3';

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Section 1: Info Invoice */}
      <div>
        <h3 className={sectionHeading}>Info Invoice</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nomor Invoice *
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => {
                setInvoiceNumber(e.target.value);
                if (errors.invoiceNumber) {
                  setErrors((prev) => {
                    const n = { ...prev };
                    delete n.invoiceNumber;
                    return n;
                  });
                }
              }}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              placeholder="INV-2026-0001"
            />
            {errors.invoiceNumber && (
              <p className="text-sm text-red-500 dark:text-red-400 mt-1">
                {errors.invoiceNumber}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tanggal Invoice *
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => {
                  handleInvoiceDateChange(e.target.value);
                  if (errors.invoiceDate) {
                    setErrors((prev) => {
                      const n = { ...prev };
                      delete n.invoiceDate;
                      return n;
                    });
                  }
                }}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              />
              {errors.invoiceDate && (
                <p className="text-sm text-red-500 dark:text-red-400 mt-1">
                  {errors.invoiceDate}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Jatuh Tempo
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Info Customer */}
      <div>
        <h3 className={sectionHeading}>Info Customer</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Customer *
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                if (errors.customerName) {
                  setErrors((prev) => {
                    const n = { ...prev };
                    delete n.customerName;
                    return n;
                  });
                }
              }}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              placeholder="Nama customer"
            />
            {errors.customerName && (
              <p className="text-sm text-red-500 dark:text-red-400 mt-1">
                {errors.customerName}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                No. HP / Telepon
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                placeholder="08xx-xxxx-xxxx"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Customer ID
              </label>
              <input
                type="text"
                value={customerIdLabel}
                onChange={(e) => setCustomerIdLabel(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                placeholder="Contoh: BDG-2026-01"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Deskripsi */}
      <div>
        <h3 className={sectionHeading}>Deskripsi</h3>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors resize-none"
          placeholder="Deskripsi umum invoice (opsional)"
        />
      </div>

      {/* Section 4: Line Items */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            {itemLabel}
          </h3>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 dark:text-gray-500">Label kolom:</span>
            <input
              type="text"
              value={itemLabel}
              onChange={(e) => setItemLabel(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors w-24"
            />
          </div>
        </div>
        <InvoiceLineItemEditor
          items={lineItems}
          onChange={setLineItems}
          itemLabel={itemLabel}
        />
        {errors.lineItems && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-2">
            {errors.lineItems}
          </p>
        )}
      </div>

      {/* Section 5: Pajak */}
      <div>
        <h3 className={sectionHeading}>Pajak</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipe Pajak
            </label>
            <select
              value={taxType}
              onChange={(e) => setTaxType(e.target.value as InvoiceTaxType)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            >
              {TAX_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {taxType !== 'none' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tarif Pajak (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors w-32"
              />
            </div>
          )}
        </div>
      </div>

      {/* Section 6: Ringkasan */}
      <div>
        <h3 className={sectionHeading}>Ringkasan</h3>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
            <span className="font-medium text-gray-800 dark:text-gray-100">
              {formatCurrency(summary.subtotal)}
            </span>
          </div>

          {taxType !== 'none' && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                PPN ({taxRate}%)
                {taxType === 'included' && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                    (sudah termasuk)
                  </span>
                )}
              </span>
              <span className="font-medium text-gray-800 dark:text-gray-100">
                {formatCurrency(summary.taxAmount)}
              </span>
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-gray-700 pt-2.5 flex justify-between">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Total
            </span>
            <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
              {formatCurrency(summary.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Section 7: Catatan */}
      <div>
        <h3 className={sectionHeading}>Catatan</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors resize-none"
          placeholder="Catatan internal (opsional)"
        />
      </div>

      {/* Footer buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? 'Menyimpan...' : invoice ? 'Update Invoice' : 'Simpan Invoice'}
        </button>
      </div>
    </form>
  );
}

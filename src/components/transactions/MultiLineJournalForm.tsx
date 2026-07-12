'use client';

import { useState, useEffect, useMemo } from 'react';
import { PlusCircle, Trash2, AlertCircle, PackageOpen } from 'lucide-react';
import { AccountDropdown } from './AccountDropdown';
import { ContactAutocomplete } from './ContactAutocomplete';
import FloatingField, { FloatingSelect } from '@/components/ui/FloatingField';
import { getAccounts } from '@/lib/api/accounts';
import { resolveContactTypeFromCategory, saveContactFromTransaction } from '@/lib/api/contacts';
import { useParams } from 'next/navigation';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import { CATEGORY_LABELS } from '@/lib/calculations';
import type { TransactionCategory, JournalLineInput, Account, TransactionAttachment, SalesChannel } from '@/types';
import { getSalesChannelOptions, SALES_CHANNEL_CONFIG } from '@/lib/salesChannels';
import { FileUpload } from '@/components/ui/FileUpload';
import { AnimatedDialog } from '@/components/ui/AnimatedDialog';
import { CatalogItemPicker, type PickedCatalogLine } from '@/components/catalog/CatalogItemPicker';

export interface MultiLineFormData {
  date: string;
  category: TransactionCategory;
  name: string;
  description: string;
  notes?: string;
  sales_channel?: SalesChannel | null;
  attachments?: TransactionAttachment[];
  journal_lines: JournalLineInput[];
}

interface MultiLineJournalFormProps {
  onSubmit: (data: MultiLineFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  businessId?: string;
  initialData?: MultiLineFormData;
  submitLabel?: string;
}

const ALL_CATEGORIES: TransactionCategory[] = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

function emptyLine(sort_order: number): JournalLineInput {
  return { account_id: '', debit_amount: 0, credit_amount: 0, description: '', sort_order };
}

function formatNumber(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('id-ID');
}

function parseNumber(s: string): number {
  const cleaned = s.replace(/\./g, '').replace(/,/g, '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export function MultiLineJournalForm({
  onSubmit,
  onCancel,
  loading = false,
  businessId: businessIdProp,
  initialData,
  submitLabel,
}: MultiLineJournalFormProps) {
  const params = useParams();
  const businessId = businessIdProp || (params?.businessId as string);
  const { user, activeBusiness } = useBusinessContext();
  const { t } = useLanguage();
  const baseChannelOptions = getSalesChannelOptions(activeBusiness?.business_type);

  const [formData, setFormData] = useState<Omit<MultiLineFormData, 'journal_lines'>>({
    date: initialData?.date ?? new Date().toISOString().split('T')[0],
    category: initialData?.category ?? 'OPEX',
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    notes: initialData?.notes ?? '',
    sales_channel: initialData?.sales_channel ?? null,
  });

  const initialLines = initialData?.journal_lines && initialData.journal_lines.length >= 2
    ? initialData.journal_lines
    : [emptyLine(0), emptyLine(1)];

  const [lines, setLines] = useState<JournalLineInput[]>(initialLines);

  // Display strings for debit/credit inputs (formatted with thousand separators)
  const [displayDebit, setDisplayDebit] = useState<string[]>(
    initialLines.map((l) => formatNumber(l.debit_amount))
  );
  const [displayCredit, setDisplayCredit] = useState<string[]>(
    initialLines.map((l) => formatNumber(l.credit_amount))
  );

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<TransactionAttachment[]>(
    initialData?.attachments ?? []
  );
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    getAccounts(businessId)
      .then(setAccounts)
      .catch(console.error)
      .finally(() => setLoadingAccounts(false));
  }, [businessId]);

  const totalDebit = useMemo(
    () => lines.reduce((s, l) => s + l.debit_amount, 0),
    [lines]
  );
  const totalCredit = useMemo(
    () => lines.reduce((s, l) => s + l.credit_amount, 0),
    [lines]
  );
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const difference = totalDebit - totalCredit;

  function addLine() {
    setLines((prev) => [...prev, emptyLine(prev.length)]);
    setDisplayDebit((prev) => [...prev, '']);
    setDisplayCredit((prev) => [...prev, '']);
  }

  function removeLine(idx: number) {
    if (lines.length <= 2) return; // minimum 2 lines
    setLines((prev) => prev.filter((_, i) => i !== idx));
    setDisplayDebit((prev) => prev.filter((_, i) => i !== idx));
    setDisplayCredit((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLineAccount(idx: number, accountId: string) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, account_id: accountId } : l))
    );
    if (errors[`line_${idx}_account`]) {
      setErrors((prev) => { const n = { ...prev }; delete n[`line_${idx}_account`]; return n; });
    }
  }

  function updateLineDebit(idx: number, raw: string) {
    const n = parseNumber(raw);
    setDisplayDebit((prev) => prev.map((v, i) => (i === idx ? (raw === '' ? '' : formatNumber(n)) : v)));
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, debit_amount: n, credit_amount: n > 0 ? 0 : l.credit_amount } : l))
    );
    // Clear credit display if debit is set
    if (n > 0) {
      setDisplayCredit((prev) => prev.map((v, i) => (i === idx ? '' : v)));
    }
  }

  function updateLineCredit(idx: number, raw: string) {
    const n = parseNumber(raw);
    setDisplayCredit((prev) => prev.map((v, i) => (i === idx ? (raw === '' ? '' : formatNumber(n)) : v)));
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, credit_amount: n, debit_amount: n > 0 ? 0 : l.debit_amount } : l))
    );
    // Clear debit display if credit is set
    if (n > 0) {
      setDisplayDebit((prev) => prev.map((v, i) => (i === idx ? '' : v)));
    }
  }

  function updateLineDescription(idx: number, value: string) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, description: value } : l))
    );
  }

  // Terapkan item dari katalog → generate baris jurnal.
  // Struktur: 1 baris Debit kosong (user pilih akun kas/piutang, amount = total)
  // + 1 baris Credit per item ke akun pendapatannya.
  function applyCatalogLines(picked: PickedCatalogLine[]) {
    if (picked.length === 0) { setShowCatalogPicker(false); return; }

    const total = picked.reduce((s, l) => s + l.lineTotal, 0);

    // Baris debit: akun penampung (kas/bank/piutang) — user yang pilih akunnya.
    const debitLine: JournalLineInput = {
      account_id: '',
      debit_amount: total,
      credit_amount: 0,
      description: 'Penerimaan penjualan',
      sort_order: 0,
    };

    // Baris kredit per item ke akun pendapatannya (kalau di-set di katalog).
    const creditLines: JournalLineInput[] = picked.map((l, i) => ({
      account_id: l.item.revenue_account_id ?? '',
      debit_amount: 0,
      credit_amount: l.lineTotal,
      description: l.qty > 1 ? `${l.item.name} ×${l.qty}` : l.item.name,
      sort_order: i + 1,
    }));

    const newLines = [debitLine, ...creditLines];
    setLines(newLines);
    setDisplayDebit(newLines.map((l) => formatNumber(l.debit_amount)));
    setDisplayCredit(newLines.map((l) => formatNumber(l.credit_amount)));

    // Auto-isi deskripsi transaksi kalau masih kosong
    setFormData((p) => {
      const summary = picked.length === 1
        ? (picked[0].qty > 1 ? `${picked[0].item.name} ×${picked[0].qty}` : picked[0].item.name)
        : `${picked.length} item dari katalog`;
      return {
        ...p,
        description: p.description.trim() || summary,
      };
    });

    setShowCatalogPicker(false);
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.date) newErrors.date = 'Tanggal harus diisi';
    if (!formData.name.trim()) newErrors.name = 'Nama harus diisi';
    if (!formData.description.trim()) newErrors.description = 'Keterangan harus diisi';

    lines.forEach((line, idx) => {
      if (!line.account_id) {
        newErrors[`line_${idx}_account`] = 'Pilih akun';
      }
      if (line.debit_amount === 0 && line.credit_amount === 0) {
        newErrors[`line_${idx}_amount`] = 'Masukkan jumlah debit atau kredit';
      }
    });

    if (totalDebit === 0) {
      newErrors.balance = 'Jumlah transaksi tidak boleh 0';
    } else if (!isBalanced) {
      newErrors.balance = `Jurnal tidak seimbang. Selisih: ${Math.abs(difference).toLocaleString('id-ID')}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const cleanLines: JournalLineInput[] = lines.map((l, i) => ({
      account_id: l.account_id,
      debit_amount: l.debit_amount,
      credit_amount: l.credit_amount,
      description: l.description || undefined,
      sort_order: i,
    }));

    await onSubmit({ ...formData, attachments: attachments.length > 0 ? attachments : undefined, journal_lines: cleanLines });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FloatingField
            label="Tanggal *"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
            required
          />
          {errors.date && <p className="text-sm text-red-500 mt-1">{errors.date}</p>}
        </div>
        <FloatingSelect
          label="Kategori *"
          value={formData.category}
          onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value as TransactionCategory }))}
        >
          {ALL_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
          ))}
        </FloatingSelect>
      </div>

      {/* Sales channel — hanya untuk EARN */}
      {formData.category === 'EARN' && (
        <FloatingSelect
          label="Channel Penjualan"
          value={formData.sales_channel ?? ''}
          onChange={(e) =>
            setFormData((p) => ({
              ...p,
              sales_channel: (e.target.value as SalesChannel) || null,
            }))
          }
        >
          <option value="">— Tanpa channel —</option>
          {(() => {
              const saved = formData.sales_channel;
              const opts =
                saved && !baseChannelOptions.some((o) => o.value === saved)
                  ? [
                      ...baseChannelOptions,
                      { value: saved, label: SALES_CHANNEL_CONFIG[saved].label },
                    ]
                  : baseChannelOptions;
              return opts;
            })().map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
        </FloatingSelect>
      )}

      <div>
        <label className="label">Nama / Referensi *</label>
        <ContactAutocomplete
          businessId={businessId}
          value={formData.name}
          onChange={(val) => setFormData((p) => ({ ...p, name: val }))}
          placeholder="cth: Bayar Gaji Karyawan Maret 2026"
          required
          onSaveAsContact={async (name) => {
            if (!businessId || !user) return;
            try {
              await saveContactFromTransaction(
                businessId,
                name,
                resolveContactTypeFromCategory(formData.category),
                user.id
              );
            } catch (err) {
              console.error('Failed to save contact:', err);
            }
          }}
        />
        {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
      </div>

      <div>
        <label className="label">Keterangan *</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
          className="input"
          rows={2}
          placeholder="Deskripsi singkat jurnal ini"
        />
        {errors.description && <p className="text-sm text-red-500 mt-1">{errors.description}</p>}
      </div>

      {/* Journal lines table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Baris Jurnal *
          </label>
          {formData.category === 'EARN' ? (
            <button
              type="button"
              onClick={() => setShowCatalogPicker(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
            >
              <PackageOpen className="w-3.5 h-3.5" />
              {t.catalog.addFromCatalog}
            </button>
          ) : (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Total harus seimbang (Debit = Kredit)
            </span>
          )}
        </div>

        {loadingAccounts ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Memuat akun...</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-8">#</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Akun</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-36">Debit (Rp)</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-36">Kredit (Rp)</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Keterangan Baris</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {lines.map((line, idx) => (
                  <tr key={idx} className="bg-white dark:bg-gray-900">
                    <td className="px-3 py-2 text-gray-400 dark:text-gray-500">{idx + 1}</td>
                    <td className="px-2 py-1.5 min-w-48">
                      <AccountDropdown
                        label=""
                        accounts={accounts}
                        value={line.account_id || undefined}
                        onChange={(accountId) => updateLineAccount(idx, accountId)}
                        placeholder="Pilih akun"
                        error={errors[`line_${idx}_account`]}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={displayDebit[idx] ?? ''}
                        onChange={(e) => updateLineDebit(idx, e.target.value.replace(/[^0-9.,]/g, ''))}
                        className="input text-right text-sm py-1"
                        placeholder="0"
                      />
                      {errors[`line_${idx}_amount`] && (
                        <p className="text-xs text-red-500 mt-0.5">{errors[`line_${idx}_amount`]}</p>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={displayCredit[idx] ?? ''}
                        onChange={(e) => updateLineCredit(idx, e.target.value.replace(/[^0-9.,]/g, ''))}
                        className="input text-right text-sm py-1"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={line.description ?? ''}
                        onChange={(e) => updateLineDescription(idx, e.target.value)}
                        className="input text-sm py-1"
                        placeholder="Opsional"
                      />
                    </td>
                    <td className="px-1 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length <= 2}
                        className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Hapus baris"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                    TOTAL
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {totalDebit.toLocaleString('id-ID')}
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {totalCredit.toLocaleString('id-ID')}
                  </td>
                  <td colSpan={2} className="px-3 py-2">
                    {isBalanced && totalDebit > 0 ? (
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">Seimbang</span>
                    ) : totalDebit > 0 ? (
                      <span className="text-xs font-medium text-red-500 dark:text-red-400">
                        Selisih: {Math.abs(difference).toLocaleString('id-ID')}
                      </span>
                    ) : null}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <button
          type="button"
          onClick={addLine}
          className="mt-2 flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          Tambah Baris
        </button>

        {errors.balance && (
          <div className="mt-2 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 dark:text-red-400">{errors.balance}</p>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="label">Catatan (opsional)</label>
        <textarea
          value={formData.notes ?? ''}
          onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
          className="input"
          rows={2}
          placeholder="Catatan tambahan"
        />
      </div>

      {/* Attachment */}
      <div>
        <label className="label">Lampiran (opsional)</label>
        <FileUpload
          businessId={businessId}
          value={attachments}
          onChange={setAttachments}
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
          Batal
        </button>
        <button
          type="submit"
          className="btn-primary-glow flex-1"
          disabled={loading || !isBalanced || totalDebit === 0}
        >
          {loading ? 'Menyimpan...' : (submitLabel ?? 'Simpan Jurnal')}
        </button>
      </div>

      {/* Catalog picker modal */}
      <AnimatedDialog isOpen={showCatalogPicker} onClose={() => setShowCatalogPicker(false)}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <PackageOpen className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{t.catalog.pickerTitle}</h3>
          </div>
          <CatalogItemPicker
            businessId={businessId}
            mode="multi"
            onApply={applyCatalogLines}
            onClose={() => setShowCatalogPicker(false)}
          />
        </div>
      </AnimatedDialog>
    </form>
  );
}

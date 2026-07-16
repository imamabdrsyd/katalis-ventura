'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Transaction, TransactionCategory, TransactionMeta, TransactionAttachment, Account, TransactionTemplate, SalesChannel } from '@/types';
import { CATEGORY_LABELS } from '@/lib/calculations';
import { getAccounts } from '@/lib/api/accounts';
import { AccountDropdown } from './AccountDropdown';
import { useParams } from 'next/navigation';
import { detectCategory } from '@/lib/utils/transactionHelpers';
import { useAccountingGuidance } from '@/hooks/useAccountingGuidance';
import { AlertCircle, Lightbulb, AlertTriangle, BookTemplate, ChevronDown, Trash2, X, RefreshCw } from 'lucide-react';
import { CurrencyInputWithCalculator } from '@/components/ui/CurrencyInputWithCalculator';
import FloatingField, { FloatingSelect } from '@/components/ui/FloatingField';
import { UnitBreakdownSection } from '@/components/transactions/UnitBreakdownSection';
import { CatalogItemPicker } from '@/components/catalog/CatalogItemPicker';
import { isInventoryAccount } from '@/lib/utils/inventoryHelper';
import { FileUpload } from '@/components/ui/FileUpload';
import { makePendingAttachment, isPendingAttachment, uploadPendingAttachments } from '@/lib/storage/attachments';
import { ContactAutocomplete } from '@/components/transactions/ContactAutocomplete';
import { resolveContactTypeFromCategory, saveContactFromTransaction } from '@/lib/api/contacts';
import { useBusinessContext } from '@/context/BusinessContext';
import type { UnitBreakdown } from '@/types';
import { getTransactionTemplates, createTransactionTemplate, deleteTransactionTemplate } from '@/lib/api/transactionTemplates';
import { getRecurringTransactions } from '@/lib/api/recurring';
import { getSalesChannelOptions, SALES_CHANNEL_CONFIG } from '@/lib/salesChannels';
import OCRScanButton from '@/components/transactions/OCRScanButton';
import type { OcrResult } from '@/lib/ocr/types';
import {
  BASE_CURRENCY,
  SUPPORTED_CURRENCIES,
  calculateBaseAmount,
  normalizeCurrencyCode,
} from '@/lib/currency';

export interface RecurringFormData {
  frequency: 'weekly' | 'monthly' | 'yearly';
  interval_value: number;
  start_date: string;
  end_date?: string;
}

export interface TransactionFormData {
  date: string;
  category: TransactionCategory;
  name: string;
  description: string;
  amount: number;
  original_amount?: number | null;
  currency_code?: string | null;
  fx_rate?: number | null;
  fx_rate_date?: string | null;
  fx_gain_loss_amount?: number | null;
  account: string;

  // NEW: Double-entry fields (optional)
  debit_account_id?: string;
  credit_account_id?: string;
  is_double_entry?: boolean;

  // Link ke business_contacts — diisi saat user memilih kontak dari autocomplete
  contact_id?: string | null;

  // Sales channel (untuk EARN transactions)
  sales_channel?: SalesChannel | null;

  // Metadata
  meta?: TransactionMeta | null;

  // Recurring (optional — set when "Jadikan Berulang" is toggled)
  recurring?: RecurringFormData | null;
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
  /**
   * Dipanggil saat OCR scan selesai. Kalau provided, form TIDAK auto-apply hasil
   * scan ke field-field-nya — parent yang pegang kendali (mis. tampilkan preview
   * modal dulu, baru putuskan apply single-line atau switch ke multi-line).
   * Kalau tidak disediakan, form fallback ke perilaku lama (langsung apply).
   */
  onOcrResult?: (result: OcrResult) => void;
  /**
   * Hasil OCR yang HARUS langsung di-apply ke form (skip preview gate). Dipakai
   * parent untuk "push" hasil scan setelah user pilih opsi "single transaction"
   * dari preview modal. Form akan apply tiap kali nilai prop ini berubah ke non-null.
   */
  pendingOcrApply?: OcrResult | null;
  /** Edit mode only: dipanggil saat user klik "Tambah Baris" untuk upgrade ke multi-line journal. */
  onConvertToMultiLine?: () => void;
}

const ALL_CATEGORIES: TransactionCategory[] = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

// Helper function to format number with thousand separator
function formatNumberWithSeparator(num: number | string): string {
  if (!num) return '';
  const numStr = num.toString().replace(/\D/g, '');
  if (!numStr) return '';
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatAmountForCurrency(num: number | string, currencyCode: string): string {
  const numeric = typeof num === 'number' ? num : Number(num);
  if (!Number.isFinite(numeric) || numeric === 0) return '';
  if (normalizeCurrencyCode(currencyCode) === BASE_CURRENCY) {
    return formatNumberWithSeparator(Math.round(numeric));
  }
  return numeric.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
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
  onOcrResult,
  pendingOcrApply,
  onConvertToMultiLine,
}: TransactionFormProps) {
  const params = useParams();
  const businessId = businessIdProp || (params?.businessId as string);
  const { user, activeBusiness } = useBusinessContext();
  const baseChannelOptions = getSalesChannelOptions(activeBusiness?.business_type);

  const categories = allowedCategories || ALL_CATEGORIES;
  const initialCurrency = normalizeCurrencyCode(transaction?.currency_code ?? initialValues?.currency_code);
  const initialOriginalAmount =
    transaction?.original_amount ??
    initialValues?.original_amount ??
    transaction?.amount ??
    initialValues?.amount ??
    0;
  const initialFxRate = initialCurrency === BASE_CURRENCY
    ? 1
    : Number(transaction?.fx_rate ?? initialValues?.fx_rate ?? 1);
  const [formData, setFormData] = useState<TransactionFormData>({
    date: transaction?.date || initialValues?.date || new Date().toISOString().split('T')[0],
    category: transaction?.category || initialValues?.category || defaultCategory || categories[0],
    name: transaction?.name || initialValues?.name || '',
    description: transaction?.description || initialValues?.description || '',
    amount: initialCurrency === BASE_CURRENCY
      ? initialOriginalAmount
      : calculateBaseAmount(initialOriginalAmount, initialFxRate),
    original_amount: initialOriginalAmount || null,
    currency_code: initialCurrency,
    fx_rate: initialFxRate,
    fx_rate_date: transaction?.fx_rate_date || initialValues?.fx_rate_date || new Date().toISOString().split('T')[0],
    fx_gain_loss_amount: transaction?.fx_gain_loss_amount ?? initialValues?.fx_gain_loss_amount ?? 0,
    account: transaction?.account || initialValues?.account || '',
    debit_account_id: transaction?.debit_account_id || initialValues?.debit_account_id,
    credit_account_id: transaction?.credit_account_id || initialValues?.credit_account_id,
    is_double_entry: transaction?.is_double_entry || initialValues?.is_double_entry || false,
    contact_id: transaction?.contact_id ?? initialValues?.contact_id ?? null,
    sales_channel: transaction?.sales_channel || initialValues?.sales_channel || null,
    meta: transaction?.meta || initialValues?.meta || null,
  });

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Template state
  const [templates, setTemplates] = useState<TransactionTemplate[]>([]);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [saveTemplateMode, setSaveTemplateMode] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Recurring state
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [recurringInterval, setRecurringInterval] = useState(1);
  const [recurringEndDate, setRecurringEndDate] = useState('');

  const [displayAmount, setDisplayAmount] = useState<string>(
    initialOriginalAmount
      ? formatAmountForCurrency(initialOriginalAmount, initialCurrency)
        : ''
  );

  // Unit breakdown state — pakai `transaction` (mode edit) atau `initialValues` (mode
  // duplikat/prefill) supaya breakdown ikut ter-copy saat menduplikasi transaksi.
  const initialUnitBreakdown =
    transaction?.meta?.unit_breakdown ?? initialValues?.meta?.unit_breakdown ?? null;
  const [unitBreakdown, setUnitBreakdown] = useState<UnitBreakdown | null>(initialUnitBreakdown);
  const [showBreakdown, setShowBreakdown] = useState(!!initialUnitBreakdown);

  // Link ke item katalog (chip di kolom deskripsi list) — dipilih saat debit = akun
  // persediaan (VAR→stok); ikut ter-copy saat edit/duplikat transaksi.
  const [pickedCatalogItem, setPickedCatalogItem] = useState<{ id: string; name: string } | null>(
    transaction?.meta?.catalog_item ?? initialValues?.meta?.catalog_item ?? null
  );

  // Attachment state
  const [attachments, setAttachments] = useState<TransactionAttachment[]>(
    transaction?.meta?.attachments ??
    (transaction?.meta?.attachment ? [transaction.meta.attachment] : [])
  );
  // Sedang mengupload lampiran pending ke Cloudinary saat submit
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  // Tambah/ganti lampiran hasil OCR (selalu maksimal 1, yaitu scan terbaru).
  // Tidak menghitung kuota slot manual.
  const addOcrAttachment = (file: File) => {
    setAttachments((prev) => {
      prev.forEach((a) => {
        if (a.source === 'ocr' && isPendingAttachment(a) && a.url.startsWith('blob:')) {
          URL.revokeObjectURL(a.url);
        }
      });
      return [...prev.filter((a) => a.source !== 'ocr'), makePendingAttachment(file, 'ocr')];
    });
  };

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

  // Fetch templates (only when creating new transaction)
  // Form ini single-line saja — sembunyikan template multi-baris (dipakai di Journal Entry)
  useEffect(() => {
    if (!businessId || transaction) return;
    getTransactionTemplates(businessId)
      .then((tmpls) => setTemplates(tmpls.filter((t) => !(t.journal_lines && t.journal_lines.length >= 2))))
      .catch(() => {/* silent */});
  }, [businessId, transaction]);

  // Populate recurring state from existing template when editing
  useEffect(() => {
    if (!businessId || !transaction?.meta?.recurring_template_id) return;
    getRecurringTransactions(businessId).then((templates) => {
      const tmpl = templates.find((t) => t.id === transaction.meta?.recurring_template_id);
      if (!tmpl) return;
      setRecurringEnabled(true);
      setRecurringFrequency(tmpl.frequency);
      setRecurringInterval(tmpl.interval_value);
      setRecurringEndDate(tmpl.end_date ?? '');
    }).catch(() => {/* silent */});
  }, [businessId, transaction]);

  // Get suggested account codes based on category
  const suggestedAccounts = useMemo(() => {
    return CATEGORY_SUGGESTIONS[formData.category];
  }, [formData.category]);

  // Check if using double-entry format (always true for 'in' and 'out' modes)
  const isDoubleEntry = mode !== 'full' || !!(formData.debit_account_id || formData.credit_account_id);

  // Debit = akun persediaan → transaksi VAR→stok, tawarkan link ke katalog
  const debitInventorySelected = useMemo(() => {
    const acc = accounts.find((a) => a.id === formData.debit_account_id);
    return !!acc && isInventoryAccount(acc);
  }, [accounts, formData.debit_account_id]);
  const selectedCurrency = normalizeCurrencyCode(formData.currency_code);
  const isForeignCurrency = selectedCurrency !== BASE_CURRENCY;
  const originalAmount = formData.original_amount ?? formData.amount;
  const fxRate = selectedCurrency === BASE_CURRENCY ? 1 : Number(formData.fx_rate ?? 1);

  const calculateFunctionalAmount = (sourceAmount: number, rate = fxRate, currency = selectedCurrency) =>
    currency === BASE_CURRENCY ? sourceAmount : calculateBaseAmount(sourceAmount, rate);

  const handleOriginalAmountChange = (numeric: number, formatted: string) => {
    setDisplayAmount(formatted);
    setFormData(prev => {
      const currency = normalizeCurrencyCode(prev.currency_code);
      const rate = currency === BASE_CURRENCY ? 1 : Number(prev.fx_rate ?? 1);
      return {
        ...prev,
        original_amount: numeric,
        amount: calculateFunctionalAmount(numeric, rate, currency),
        fx_rate: rate,
      };
    });
    if (errors.amount) setErrors(prev => { const n = { ...prev }; delete n.amount; return n; });
  };

  const handleCurrencyChange = (currencyValue: string) => {
    const currency = normalizeCurrencyCode(currencyValue);
    setFormData(prev => {
      const sourceAmount = prev.original_amount ?? prev.amount;
      const previousCurrency = normalizeCurrencyCode(prev.currency_code);
      const rate = currency === BASE_CURRENCY
        ? 1
        : currency === previousCurrency
          ? Number(prev.fx_rate ?? 1)
          : 1;
      return {
        ...prev,
        currency_code: currency,
        original_amount: sourceAmount,
        amount: calculateFunctionalAmount(sourceAmount, rate, currency),
        fx_rate: rate,
        fx_rate_date: prev.fx_rate_date ?? prev.date,
      };
    });
    setErrors(prev => {
      const next = { ...prev };
      delete next.fx_rate;
      return next;
    });
  };

  const handleFxRateChange = (value: string) => {
    const rate = Number(value);
    setFormData(prev => ({
      ...prev,
      fx_rate: Number.isFinite(rate) ? rate : 0,
      amount: calculateFunctionalAmount(prev.original_amount ?? prev.amount, Number.isFinite(rate) ? rate : 0, normalizeCurrencyCode(prev.currency_code)),
    }));
    if (errors.fx_rate) setErrors(prev => { const n = { ...prev }; delete n.fx_rate; return n; });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.date) newErrors.date = 'Tanggal harus diisi';
    if (!formData.name.trim()) newErrors.name = 'Nama harus diisi';

    // Auto-fill description if empty and using double-entry
    if (!formData.description.trim() && isDoubleEntry) {
      const oppositeAccount = getOppositeAccountDescription();
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

    if (originalAmount <= 0 || formData.amount <= 0) newErrors.amount = 'Jumlah harus lebih dari 0';
    if (isForeignCurrency && (!fxRate || fxRate <= 0)) {
      newErrors.fx_rate = 'Kurs harus lebih dari 0';
    }

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
      // Upload lampiran pending ke Cloudinary HANYA saat submit (defer upload).
      // Kalau user cancel sebelum ini, tidak ada file yang pernah naik ke Cloudinary.
      let finalAttachments = attachments;
      if (businessId && attachments.some(isPendingAttachment)) {
        setUploadingAttachments(true);
        try {
          finalAttachments = await uploadPendingAttachments(businessId, attachments);
          setAttachments(finalAttachments);
        } catch (err: any) {
          setUploadingAttachments(false);
          setErrors((prev) => ({ ...prev, submit: err?.message || 'Gagal mengupload lampiran' }));
          return;
        }
        setUploadingAttachments(false);
      }

      const currency = normalizeCurrencyCode(formData.currency_code);
      const submittedOriginalAmount = formData.original_amount ?? formData.amount;
      const submittedFxRate = currency === BASE_CURRENCY ? 1 : Number(formData.fx_rate ?? 1);
      const submitData: TransactionFormData = {
        ...formData,
        amount: calculateFunctionalAmount(submittedOriginalAmount, submittedFxRate, currency),
        original_amount: submittedOriginalAmount,
        currency_code: currency,
        fx_rate: submittedFxRate,
        fx_rate_date: formData.fx_rate_date ?? formData.date,
        is_double_entry: isDoubleEntry,
        meta: {
          ...formData.meta,
          unit_breakdown: unitBreakdown && unitBreakdown.unit ? unitBreakdown : undefined,
          attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
          catalog_item: pickedCatalogItem ?? undefined,
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

      // Attach recurring data if enabled
      if (recurringEnabled) {
        submitData.recurring = {
          frequency: recurringFrequency,
          interval_value: recurringInterval,
          start_date: formData.date,
          end_date: recurringEndDate || undefined,
        };
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

  // Helper function to get account description (or fallback to name) for auto-fill
  const getAccountDescription = (accountId: string | undefined): string => {
    if (!accountId) return '';
    const account = accounts.find((acc) => acc.id === accountId);
    return account ? (account.description || account.account_name) : '';
  };

  // Helper function to get the opposite account description for auto-fill description
  const getOppositeAccountDescription = (): string => {
    // For 'in' mode or EARN: show the source (credit) account
    if (mode === 'in' || formData.category === 'EARN') {
      return getAccountDescription(formData.credit_account_id);
    }

    // For 'out' mode or expenses: show the destination (debit) account
    return getAccountDescription(formData.debit_account_id);
  };

  // Auto-fill description when it's empty
  const handleDescriptionBlur = () => {
    if (!formData.description.trim() && isDoubleEntry) {
      const oppositeAccount = getOppositeAccountDescription();
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

  const handleAccountChange = (field: 'debit' | 'credit') => (accountId: string) => {
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

  // Apply OCR scan result to form (pre-fill date, amount, vendor name, description, category)
  const applyOcrResultInternal = (result: OcrResult) => {
    const { parsed } = result;
    setFormData((prev) => ({
      ...prev,
      date: parsed.date ?? prev.date,
      currency_code: parsed.currency_code ? normalizeCurrencyCode(parsed.currency_code) : prev.currency_code,
      original_amount: parsed.total ?? prev.original_amount ?? prev.amount,
      amount: parsed.total
        ? calculateFunctionalAmount(
            parsed.total,
            parsed.currency_code && normalizeCurrencyCode(parsed.currency_code) === BASE_CURRENCY ? 1 : Number(prev.fx_rate ?? 1),
            parsed.currency_code ? normalizeCurrencyCode(parsed.currency_code) : normalizeCurrencyCode(prev.currency_code)
          )
        : prev.amount,
      fx_rate: parsed.currency_code && normalizeCurrencyCode(parsed.currency_code) === BASE_CURRENCY ? 1 : prev.fx_rate ?? 1,
      name: parsed.vendor ?? prev.name,
      description: parsed.vendor
        ? `Pembelian di ${parsed.vendor}`
        : prev.description,
      category: parsed.category ?? prev.category,
      meta: {
        ...(prev.meta ?? {}),
        ocr: {
          provider: result.provider,
          raw_text: result.raw_text,
          cached: result.cached,
          currency_code: parsed.currency_code,
        },
      } as TransactionMeta,
    }));
    if (parsed.total) {
      setDisplayAmount(formatAmountForCurrency(parsed.total, parsed.currency_code ? normalizeCurrencyCode(parsed.currency_code) : selectedCurrency));
    }
    if (errors.amount && parsed.total) {
      setErrors((prev) => {
        const n = { ...prev };
        delete n.amount;
        return n;
      });
    }
  };

  // Gate OCR result: kalau parent kasih `onOcrResult` (mode preview modal),
  // delegate ke parent dan JANGAN auto-apply. Kalau tidak, fallback langsung apply.
  const handleOcrParsed = (result: OcrResult, file: File) => {
    if (onOcrResult) {
      // Jalur preview modal (bisa split jadi banyak transaksi) — lampiran di-defer.
      onOcrResult(result);
      return;
    }
    applyOcrResultInternal(result);
    addOcrAttachment(file);
  };

  // Watch `pendingOcrApply`: parent set ini ketika user pilih opsi "single transaction"
  // dari preview modal — kita langsung apply ke form tanpa lewat gate.
  useEffect(() => {
    if (pendingOcrApply) {
      applyOcrResultInternal(pendingOcrApply);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOcrApply]);

  // Apply a template to the form
  const applyTemplate = (tmpl: TransactionTemplate) => {
    setFormData(prev => ({
      ...prev,
      category: tmpl.category,
      description: tmpl.description ?? prev.description,
      debit_account_id: tmpl.debit_account_id ?? prev.debit_account_id,
      credit_account_id: tmpl.credit_account_id ?? prev.credit_account_id,
      is_double_entry: tmpl.is_double_entry,
      ...(tmpl.default_amount ? {
        amount: tmpl.default_amount,
        original_amount: tmpl.default_amount,
        currency_code: BASE_CURRENCY,
        fx_rate: 1,
      } : {}),
    }));
    if (tmpl.default_amount) {
      setDisplayAmount(tmpl.default_amount.toLocaleString('id-ID'));
    }
    setTemplateDropdownOpen(false);
  };

  // Save current form state as a new template
  const handleSaveTemplate = async () => {
    if (!businessId || !templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const saved = await createTransactionTemplate(businessId, {
        name: templateName.trim(),
        category: formData.category,
        description: formData.description || null,
        default_amount: formData.amount > 0 ? formData.amount : null,
        debit_account_id: formData.debit_account_id ?? null,
        credit_account_id: formData.credit_account_id ?? null,
        is_double_entry: isDoubleEntry,
        journal_lines: null,
      });
      setTemplates(prev => [saved, ...prev]);
      setTemplateName('');
      setSaveTemplateMode(false);
    } catch {
      /* silent — user can retry */
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteTransactionTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch {
      /* silent */
    }
  };

  // Unit breakdown handlers
  const handleToggleBreakdown = () => {
    if (!showBreakdown) {
      // Opening: initialize with defaults if no existing data
      if (!unitBreakdown) {
        setUnitBreakdown({ price_per_unit: 0, quantity: 0, unit: 'pcs' });
      }
    }
    setShowBreakdown(prev => !prev);
  };

  const handleBreakdownPriceChange = (price: number) => {
    setUnitBreakdown(prev => {
      const updated = { ...(prev || { price_per_unit: 0, quantity: 0, unit: 'pcs' }), price_per_unit: price };
      // Auto-calculate amount
      const total = updated.price_per_unit * updated.quantity;
      if (total > 0) {
        const formatted = formatNumberWithSeparator(total);
        setDisplayAmount(formatted);
        setFormData(f => ({
          ...f,
          original_amount: total,
          amount: calculateFunctionalAmount(total, Number(f.fx_rate ?? 1), normalizeCurrencyCode(f.currency_code)),
        }));
      }
      return updated;
    });
  };

  const handleBreakdownQtyChange = (qty: number) => {
    setUnitBreakdown(prev => {
      const updated = { ...(prev || { price_per_unit: 0, quantity: 0, unit: 'pcs' }), quantity: qty };
      // Auto-calculate amount
      const total = updated.price_per_unit * updated.quantity;
      if (total > 0) {
        const formatted = formatNumberWithSeparator(total);
        setDisplayAmount(formatted);
        setFormData(f => ({
          ...f,
          original_amount: total,
          amount: calculateFunctionalAmount(total, Number(f.fx_rate ?? 1), normalizeCurrencyCode(f.currency_code)),
        }));
      }
      return updated;
    });
  };

  const handleBreakdownUnitChange = (unit: string) => {
    setUnitBreakdown(prev => prev ? { ...prev, unit } : null);
  };

  const handleRemoveBreakdown = () => {
    setUnitBreakdown(null);
    setShowBreakdown(false);
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
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* OCR SCAN — only when creating new transaction */}
      {!transaction && businessId && (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 min-w-0">
            <Lightbulb className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Punya foto struk? Scan otomatis untuk isi form.</span>
          </div>
          <OCRScanButton
            businessId={businessId}
            onParsed={handleOcrParsed}
            variant="secondary"
            label="Scan Struk"
          />
        </div>
      )}

      {/* TEMPLATE SELECTOR — only when creating new transaction */}
      {!transaction && templates.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setTemplateDropdownOpen(v => !v)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-sm text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookTemplate className="w-4 h-4" />
              <span>Gunakan Template</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${templateDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {templateDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
              {templates.map(tmpl => (
                <div
                  key={tmpl.id}
                  onClick={() => applyTemplate(tmpl)}
                  className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{tmpl.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {CATEGORY_LABELS[tmpl.category]}{tmpl.default_amount ? ` · Rp ${tmpl.default_amount.toLocaleString('id-ID')}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteTemplate(tmpl.id, e)}
                    className="ml-2 p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Hapus template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 1. AMOUNT — prominent for in/out mode */}
      {mode !== 'full' && (
        <>
          <CurrencyInputWithCalculator
            label="Jumlah"
            displayValue={displayAmount}
            onChange={handleOriginalAmountChange}
            inputClassName="text-2xl font-bold"
            colorVariant={mode === 'in' ? 'green' : 'red'}
            error={errors.amount}
            required
            currencyCode={selectedCurrency}
            onCurrencyChange={handleCurrencyChange}
            supportedCurrencies={SUPPORTED_CURRENCIES}
            fxRate={isForeignCurrency ? (formData.fx_rate ?? 1) : undefined}
            onFxRateChange={isForeignCurrency ? handleFxRateChange : undefined}
            fxBookValue={isForeignCurrency ? formData.amount : undefined}
            fxRateError={errors.fx_rate}
            fxRateEditable={!!transaction}
            autoApplyFxRate={!transaction}
          />
          <UnitBreakdownSection
            unitBreakdown={unitBreakdown}
            showBreakdown={showBreakdown}
            onToggle={handleToggleBreakdown}
            onPriceChange={handleBreakdownPriceChange}
            onQuantityChange={handleBreakdownQtyChange}
            onUnitChange={handleBreakdownUnitChange}
            onRemove={handleRemoveBreakdown}
          />
        </>
      )}

      {/* 1. KATEGORI — full mode only */}
      {mode === 'full' && (
        <div>
          <FloatingSelect
            label="Kategori *"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </FloatingSelect>
          {suggestedAccounts && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              <Lightbulb className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />{suggestedAccounts.description}
            </p>
          )}
        </div>
      )}

      {/* 1b. SALES CHANNEL — hanya untuk EARN (semua mode) */}
      {formData.category === 'EARN' && (
        <FloatingSelect
          label="Channel Penjualan"
          name="sales_channel"
          value={formData.sales_channel ?? ''}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              sales_channel: (e.target.value as SalesChannel) || null,
            }))
          }
        >
          <option value="">— Tanpa channel —</option>
          {(() => {
              // Pastikan channel yang sudah tersimpan tetap tampil walau tak relevan
              // dengan tipe bisnis (mis. data lama), agar value tidak terlihat kosong.
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

      {/* 2. AMOUNT — normal size for full mode */}
      {mode === 'full' && (
        <>
          <CurrencyInputWithCalculator
            label="Jumlah"
            displayValue={displayAmount}
            onChange={handleOriginalAmountChange}
            error={errors.amount}
            required
            currencyCode={selectedCurrency}
            onCurrencyChange={handleCurrencyChange}
            supportedCurrencies={SUPPORTED_CURRENCIES}
            fxRate={isForeignCurrency ? (formData.fx_rate ?? 1) : undefined}
            onFxRateChange={isForeignCurrency ? handleFxRateChange : undefined}
            fxBookValue={isForeignCurrency ? formData.amount : undefined}
            fxRateError={errors.fx_rate}
            fxRateEditable={!!transaction}
            autoApplyFxRate={!transaction}
          />
          <UnitBreakdownSection
            unitBreakdown={unitBreakdown}
            showBreakdown={showBreakdown}
            onToggle={handleToggleBreakdown}
            onPriceChange={handleBreakdownPriceChange}
            onQuantityChange={handleBreakdownQtyChange}
            onUnitChange={handleBreakdownUnitChange}
            onRemove={handleRemoveBreakdown}
          />
        </>
      )}

      {/* 3. NAMA Customer/Vendor */}
      <div>
        <label className="label">
          {mode === 'in' ? 'Nama Customer' : mode === 'out' ? 'Nama Vendor' : 'Nama'} *
        </label>
        <ContactAutocomplete
          businessId={businessId}
          value={formData.name}
          onChange={(val) => setFormData((prev) => ({ ...prev, name: val, contact_id: null }))}
          onSelectContact={(contact) => setFormData((prev) => ({ ...prev, contact_id: contact.id }))}
          className="input-underline"
          placeholder={mode === 'in' ? 'Nama customer' : mode === 'out' ? 'Nama vendor/penerima' : 'Customer atau vendor terkait'}
          required
          onSaveAsContact={async (name) => {
            if (!businessId || !user) return;
            try {
              const contactType = mode === 'in'
                ? 'customer'
                : mode === 'out'
                  ? 'vendor'
                  : resolveContactTypeFromCategory(formData.category);
              const result = await saveContactFromTransaction(businessId, name, contactType, user.id);
              setFormData((prev) => ({ ...prev, contact_id: result.contact.id }));
            } catch (err) {
              console.error('Failed to save contact:', err);
            }
          }}
        />
        {errors.name && <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.name}</p>}
      </div>

      {/* 4. KETERANGAN */}
      <div>
        <label className="label">Keterangan {mode !== 'full' && '(opsional)'}</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          onBlur={handleDescriptionBlur}
          className="input"
          rows={3}
          placeholder={
            isDoubleEntry
              ? 'Masukkan keterangan transaksi (kosongkan untuk auto-fill dengan deskripsi akun)'
              : 'Masukkan keterangan transaksi'
          }
        />
        {errors.description && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.description}</p>
        )}
      </div>

      {/* 5. LAMPIRAN */}
      {businessId && (
        <div>
          <label className="label">Lampiran (opsional)</label>
          <FileUpload
            businessId={businessId}
            value={attachments}
            onChange={setAttachments}
            disabled={loading || uploadingAttachments}
            deferUpload
          />
        </div>
      )}

      {/* 6. TANGGAL */}
      <div>
        <FloatingField
          label="Tanggal *"
          type="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          required
        />
        {errors.date && <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.date}</p>}
      </div>

      {/* 6. ACCOUNT FIELDS */}
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
              {guidance.warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      {guidance.warnings.map((warning, i) => (
                        <p key={i} className="text-xs text-amber-500 dark:text-amber-300">{warning}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {!isAccountingValid && validation.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      {validation.errors.map((error, i) => (
                        <p key={i} className="text-xs text-red-500 dark:text-red-300">{error.message}</p>
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
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account</p>
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
                  {!guidance.pattern && guidance.explanation && (
                    <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg">
                      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        {guidance.explanation.split('\n').map((line, i) => (
                          <p key={i}>{renderBold(line)}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {guidance.warnings.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          {guidance.warnings.map((warning, i) => (
                            <p key={i} className="text-sm text-amber-500 dark:text-amber-300">{warning}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {!isAccountingValid && validation.errors.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          {validation.errors.map((error, i) => (
                            <p key={i} className="text-sm text-red-500 dark:text-red-300">{error.message}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {validation.warnings.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          {validation.warnings.map((warning, i) => (
                            <p key={i} className="text-sm text-amber-500 dark:text-amber-300">{warning.message}</p>
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

      {/* Link ke Katalog — debit akun persediaan (VAR→stok): pilih/buat item katalog,
          namanya tampil sebagai chip di kolom deskripsi list transaksi */}
      {debitInventorySelected && businessId && (
        <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-900/10 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-2">
            Hubungkan ke Katalog
          </p>
          {pickedCatalogItem ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                {pickedCatalogItem.name}
                <button
                  type="button"
                  onClick={() => setPickedCatalogItem(null)}
                  aria-label="Hapus item katalog"
                  className="hover:text-indigo-900 dark:hover:text-indigo-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            </div>
          ) : (
            <CatalogItemPicker
              businessId={businessId}
              mode="single"
              onPick={(item) => setPickedCatalogItem({ id: item.id, name: item.name })}
              allowCreate
            />
          )}
        </div>
      )}

      {/* Legacy Account field (only for full mode when not using double-entry) */}
      {mode === 'full' && !isDoubleEntry && (
        <div>
          <FloatingField
            label="Akun"
            type="text"
            name="account"
            value={formData.account}
            onChange={handleChange}
            placeholder="cth: BCA, Cash, OVO, GoPay"
            required={!isDoubleEntry}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Format lama (backward compatible)
          </p>
          {errors.account && <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.account}</p>}
        </div>
      )}

      {/* SIMPAN SEBAGAI TEMPLATE — only when creating new */}
      {!transaction && (
        <div>
          {!saveTemplateMode ? (
            <button
              type="button"
              onClick={() => setSaveTemplateMode(true)}
              className="flex items-center gap-1.5 text-xs text-indigo-500 dark:text-indigo-400 hover:underline"
            >
              <BookTemplate className="w-3.5 h-3.5" />
              Simpan sebagai Template
            </button>
          ) : (
            <div className="flex items-center gap-2 p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700">
              <BookTemplate className="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Nama template, e.g. Bayar Gaji Bulanan"
                className="flex-1 text-sm bg-transparent outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveTemplate(); } }}
              />
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || savingTemplate}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 disabled:opacity-40"
              >
                {savingTemplate ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={() => { setSaveTemplateMode(false); setTemplateName(''); }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recurring toggle */}
      {(
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={recurringEnabled}
              onChange={(e) => setRecurringEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500"
            />
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Jadikan Berulang
            </span>
          </label>

          {recurringEnabled && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Frekuensi</label>
                <select
                  value={recurringFrequency}
                  onChange={(e) => setRecurringFrequency(e.target.value as 'weekly' | 'monthly' | 'yearly')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  <option value="weekly">Mingguan</option>
                  <option value="monthly">Bulanan</option>
                  <option value="yearly">Tahunan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Setiap</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={recurringInterval}
                    onChange={(e) => setRecurringInterval(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {recurringFrequency === 'weekly' ? 'minggu' : recurringFrequency === 'monthly' ? 'bulan' : 'tahun'}
                  </span>
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Sampai (opsional)
                </label>
                <input
                  type="date"
                  value={recurringEndDate}
                  onChange={(e) => setRecurringEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  placeholder="Tanpa batas"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upgrade ke multi-line — hanya di edit mode double-entry */}
      {transaction && onConvertToMultiLine && isDoubleEntry && (
        <button
          type="button"
          onClick={onConvertToMultiLine}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-primary-400 dark:border-primary-600 text-primary-600 dark:text-primary-400 text-sm font-medium hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          Tambah Baris (upgrade ke multi-line journal)
        </button>
      )}

      {errors.submit && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-500 dark:text-red-300">{errors.submit}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary flex-1"
          disabled={loading || uploadingAttachments}
        >
          Batal
        </button>
        <button type="submit" className="btn-primary-glow flex-1" disabled={loading || uploadingAttachments}>
          {uploadingAttachments ? 'Mengupload lampiran...' : loading ? 'Menyimpan...' : transaction ? 'Update Transaksi' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}

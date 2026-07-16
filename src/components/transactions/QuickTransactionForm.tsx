'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Account, AccountType, TransactionAttachment } from '@/types';
import type { TransactionFormData } from './TransactionForm';
import { getAccounts } from '@/lib/api/accounts';
import { useParams } from 'next/navigation';
import {
  resolveQuickTransaction,
  getQuickAddAccounts,
  getFlowLabel,
  getFlowDirection,
  findDefaultCashAccount,
  isDividendChoiceAccount,
  type DividendEntryMode,
} from '@/lib/utils/quickTransactionHelper';
import { DividendEntryModeModal } from './DividendEntryModeModal';
import { findDividendPayableAccount } from '@/lib/accounting/guidance/dividendSettlement';
import { getStockTransactions, isInventoryAccount } from '@/lib/utils/inventoryHelper';
import { InventoryPicker } from './InventoryPicker';
import { CatalogItemPicker } from '@/components/catalog/CatalogItemPicker';
import type { CatalogItem } from '@/types';
import { UnitBreakdownSection } from './UnitBreakdownSection';
import { FileUpload } from '@/components/ui/FileUpload';
import { makePendingAttachment, isPendingAttachment, uploadPendingAttachments } from '@/lib/storage/attachments';
import { ChevronDown, StickyNote, Paperclip, Zap, ArrowDownLeft, ArrowUpRight, X } from 'lucide-react';
import { CurrencyInputWithCalculator } from '@/components/ui/CurrencyInputWithCalculator';
import { CurrencyPill } from '@/components/ui/CurrencyPill';
import { ContactAutocomplete } from '@/components/transactions/ContactAutocomplete';
import { resolveContactTypeFromFlow, saveContactFromTransaction, getContacts } from '@/lib/api/contacts';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import OCRScanButton from '@/components/transactions/OCRScanButton';
import type { OcrResult } from '@/lib/ocr/types';
import { matchAccountByKeywords, matchContactByVendor } from '@/lib/ocr/matcher';
import { BASE_CURRENCY, SUPPORTED_CURRENCIES, calculateBaseAmount, normalizeCurrencyCode } from '@/lib/currency';

import type { Transaction, UnitBreakdown } from '@/types';

interface QuickTransactionFormProps {
  onSubmit: (data: TransactionFormData) => Promise<void>;
  /**
   * Simpan sebagai draft tanpa memaksa field mandatory (akun boleh kosong).
   * Draft yang belum lengkap TIDAK bisa di-post sampai semua field wajib diisi.
   * Kalau tidak di-provide, tombol "Save Draft" tidak ditampilkan.
   */
  onSaveDraft?: (data: TransactionFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  businessId?: string;
  /** All transactions for detecting stock items */
  transactions?: Transaction[];
  /** Callback to convert stock transactions to COGS */
  onConvertStockToCOGS?: (transactionIds: string[]) => Promise<void>;
  /**
   * Dipanggil saat OCR scan selesai. Kalau provided, form TIDAK auto-apply hasil
   * scan — parent yang putuskan (mis. tampilkan preview modal dulu).
   */
  onOcrResult?: (result: OcrResult) => void;
  /**
   * Hasil OCR yang HARUS langsung di-apply ke form (skip preview gate). Dipakai
   * parent untuk "push" hasil scan setelah user pilih opsi "single transaction"
   * dari preview modal.
   */
  pendingOcrApply?: OcrResult | null;
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Aset',
  LIABILITY: 'Liabilitas',
  EQUITY: 'Ekuitas',
  REVENUE: 'Pendapatan',
  EXPENSE: 'Beban',
};

const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  ASSET: 'text-blue-600 dark:text-blue-400',
  LIABILITY: 'text-amber-500 dark:text-amber-400',
  EQUITY: 'text-purple-500 dark:text-purple-400',
  REVENUE: 'text-emerald-500 dark:text-emerald-400',
  EXPENSE: 'text-red-500 dark:text-red-400',
};

type SupplementaryTab = 'note' | 'attachment';

export function QuickTransactionForm({
  onSubmit,
  onSaveDraft,
  onCancel,
  loading = false,
  businessId: businessIdProp,
  transactions: allTransactions = [],
  onConvertStockToCOGS,
  onOcrResult,
  pendingOcrApply,
}: QuickTransactionFormProps) {
  const params = useParams();
  const businessId = businessIdProp || (params?.businessId as string);
  const { user } = useBusinessContext();
  const { t } = useLanguage();

  // Form state
  const [amount, setAmount] = useState(0);
  const [displayAmount, setDisplayAmount] = useState('');
  const [currencyCode, setCurrencyCode] = useState(BASE_CURRENCY);
  const [fxRate, setFxRate] = useState(1);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [name, setName] = useState('');
  // Link ke business_contacts — terisi saat user memilih kontak dari autocomplete
  const [contactId, setContactId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [activeSupplementaryTab, setActiveSupplementaryTab] = useState<SupplementaryTab | null>(null);

  // Attachment state
  const [attachments, setAttachments] = useState<TransactionAttachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  // Tambah/ganti lampiran hasil OCR (maks 1, scan terbaru). Tidak menghitung slot manual.
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

  // Unit breakdown state
  const [unitBreakdown, setUnitBreakdown] = useState<UnitBreakdown | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [portalReady, setPortalReady] = useState(false);

  // Create a dedicated portal container AFTER mount (ensures it's after the modal in DOM)
  useEffect(() => {
    const el = document.createElement('div');
    el.setAttribute('data-dropdown-portal', '');
    el.style.position = 'relative';
    el.style.zIndex = '99999';
    document.body.appendChild(el);
    portalRef.current = el;
    setPortalReady(true);
    return () => el.remove();
  }, []);

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setDropdownOpen(true);
    setSearchTerm('');
  };

  // Inventory selection state
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);
  // Item katalog yang dipilih → disimpan sbg chip di meta (bukan digabung ke deskripsi ketikan).
  const [pickedCatalogItem, setPickedCatalogItem] = useState<{ id: string; name: string } | null>(null);

  // Dividend entry mode state
  const [dividendEntryMode, setDividendEntryMode] = useState<DividendEntryMode | null>(null);
  const [showDividendModeModal, setShowDividendModeModal] = useState(false);

  // Data state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch accounts
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

  // Filtered accounts for dropdown (exclude cash/bank)
  const quickAccounts = useMemo(() => getQuickAddAccounts(accounts), [accounts]);

  // Group accounts by type
  const groupedAccounts = useMemo(() => {
    const groups: Record<AccountType, Account[]> = {
      REVENUE: [],
      EXPENSE: [],
      ASSET: [],
      LIABILITY: [],
      EQUITY: [],
    };

    const filtered = searchTerm.trim()
      ? quickAccounts.filter(
          (acc) =>
            acc.account_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.description?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : quickAccounts;

    filtered.forEach((acc) => {
      groups[acc.account_type].push(acc);
    });

    return groups;
  }, [quickAccounts, searchTerm]);

  // Selected account object
  const selectedAccount = useMemo(
    () => accounts.find((acc) => acc.id === selectedAccountId) || null,
    [accounts, selectedAccountId]
  );

  // Default cash/bank account
  const cashAccount = useMemo(() => findDefaultCashAccount(accounts), [accounts]);

  // Flow preview
  const flowDirection = selectedAccount ? getFlowDirection(selectedAccount) : null;
  const flowLabel = selectedAccount ? getFlowLabel(selectedAccount) : null;

  // Override counter-account untuk dividen mode 'declare'
  const dividendPayableAccount = useMemo(
    () => findDividendPayableAccount(accounts),
    [accounts]
  );
  const isDividendDeclareMode =
    selectedAccount &&
    isDividendChoiceAccount(selectedAccount) &&
    dividendEntryMode === 'declare';

  // Detect if this is a revenue/sales transaction and show inventory picker
  const isRevenueSelected = selectedAccount?.account_type === 'REVENUE';
  // Akun persediaan dipilih (VAR→stok) → tawarkan link ke item katalog
  const isInventorySelected = !!selectedAccount && isInventoryAccount(selectedAccount);
  const stockTransactions = useMemo(
    () => (isRevenueSelected ? getStockTransactions(allTransactions) : []),
    [isRevenueSelected, allTransactions]
  );
  const showInventoryPicker = isRevenueSelected && stockTransactions.length > 0 && !!onConvertStockToCOGS;

  const handleToggleStock = (transactionId: string) => {
    setSelectedStockIds((prev) =>
      prev.includes(transactionId)
        ? prev.filter((id) => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  // Quick entry: pilih satu item katalog → isi amount + nama otomatis.
  // Kalau item punya akun pendapatan sendiri, pindahkan ke akun itu.
  const handlePickCatalogItem = (item: CatalogItem) => {
    // VAR→stok: cuma link chip ke catalog — amount adalah harga beli (bukan
    // default_price jual) dan akun tetap akun persediaan yang dipilih user.
    if (isInventorySelected) {
      setPickedCatalogItem({ id: item.id, name: item.name });
      return;
    }
    setAmount(item.default_price);
    setDisplayAmount(formatAmountForCurrency(item.default_price, currencyCode));
    // Nama item TIDAK lagi digabung ke field nama/deskripsi — disimpan sbg chip
    // di meta.catalog_item (dibedakan dari deskripsi yang diketik manual).
    setPickedCatalogItem({ id: item.id, name: item.name });
    if (item.revenue_account_id && item.revenue_account_id !== selectedAccountId) {
      setSelectedAccountId(item.revenue_account_id);
    }
    if (errors.amount) {
      setErrors((prev) => { const next = { ...prev }; delete next.amount; return next; });
    }
  };

  // Handle account selection
  const handleSelectAccount = (account: Account) => {
    setSelectedAccountId(account.id);
    setSelectedStockIds([]);
    setDropdownOpen(false);
    setSearchTerm('');
    // Reset dividend mode bila ganti akun
    setDividendEntryMode(null);
    // Trigger popup pilihan declare/cashout untuk akun Dividen / Prive
    if (isDividendChoiceAccount(account)) {
      setShowDividendModeModal(true);
    }
    if (errors.selectedAccountId) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.selectedAccountId;
        return next;
      });
    }
  };

  const handleDividendModeSelect = (mode: DividendEntryMode) => {
    setDividendEntryMode(mode);
    setShowDividendModeModal(false);
  };

  const handleDividendModeCancel = () => {
    setShowDividendModeModal(false);
    // Bila user batal, reset selection agar tidak terkunci di mode tak dipilih
    setSelectedAccountId('');
    setDividendEntryMode(null);
  };

  // Unit breakdown handlers
  const formatNum = (n: number) => n ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
  const formatAmountForCurrency = (n: number, code: string) => {
    if (!n) return '';
    if (normalizeCurrencyCode(code) === BASE_CURRENCY) return formatNum(Math.round(n));
    return n.toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  // OCR result handler — pre-fill amount, vendor name, date, account & contact
  const applyOcrResultInternal = async (result: OcrResult) => {
    const { parsed } = result;
    const parsedCurrency = parsed.currency_code ? normalizeCurrencyCode(parsed.currency_code) : currencyCode;
    if (parsed.total) {
      setAmount(parsed.total);
      setDisplayAmount(formatAmountForCurrency(parsed.total, parsedCurrency));
      if (errors.amount) {
        setErrors((prev) => {
          const n = { ...prev };
          delete n.amount;
          return n;
        });
      }
    }
    if (parsed.currency_code) {
      setCurrencyCode(parsedCurrency);
      setFxRate(parsedCurrency === BASE_CURRENCY ? 1 : fxRate || 1);
    }
    if (parsed.date) setDate(parsed.date);

    // Smart match: pilih akun berdasarkan keyword semantik DAN nama vendor.
    // - Strong: keyword spesifik dari rule topical (supplies, indomaret, indihome, dll)
    //   + token nama vendor → dominan menentukan match
    // - Weak: fallback dari kategori (beban, biaya, operasional) → cuma tie-breaker
    //   supaya match minimal nyangkut ke CoA default tanpa mengalahkan akun spesifik
    const vendorTokens = parsed.vendor
      ? parsed.vendor.toLowerCase().split(/\s+/).filter((t) => t.length >= 3)
      : [];
    const accountKeywords = [
      ...(parsed.keywords ?? []).map((keyword) => ({ keyword, weight: 'strong' as const })),
      ...vendorTokens.map((keyword) => ({ keyword, weight: 'strong' as const })),
      ...(parsed.fallback_keywords ?? []).map((keyword) => ({ keyword, weight: 'weak' as const })),
    ];
    const matchedAccount = matchAccountByKeywords(quickAccounts, accountKeywords);
    if (matchedAccount) {
      setSelectedAccountId(matchedAccount.id);
      if (errors.selectedAccountId) {
        setErrors((prev) => {
          const n = { ...prev };
          delete n.selectedAccountId;
          return n;
        });
      }
    }

    // Smart match: pilih kontak yang sesuai dengan vendor.
    // Fallback: jika tidak ada kontak match, isi nama vendor mentah ke field.
    let resolvedContactName = parsed.vendor ?? '';
    if (businessId && parsed.vendor) {
      try {
        const contacts = await getContacts(businessId);
        const matchedContact = matchContactByVendor(contacts, parsed.vendor, parsed.keywords);
        if (matchedContact) {
          resolvedContactName = matchedContact.name;
        }
      } catch (err) {
        console.error('Failed to fetch contacts for OCR match:', err);
      }
    }
    if (resolvedContactName) setName(resolvedContactName);
  };

  // Gate OCR result melalui parent kalau `onOcrResult` provided (preview modal mode).
  const handleOcrParsed = (result: OcrResult, file: File) => {
    if (onOcrResult) {
      // Jalur preview modal (bisa split) — lampiran di-defer.
      onOcrResult(result);
      return;
    }
    void applyOcrResultInternal(result);
    addOcrAttachment(file);
  };

  // Watch `pendingOcrApply`: parent set ini saat user pilih "single transaction"
  // dari preview modal — apply langsung tanpa gate.
  useEffect(() => {
    if (pendingOcrApply) {
      void applyOcrResultInternal(pendingOcrApply);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOcrApply]);

  const handleToggleBreakdown = () => {
    if (!showBreakdown) {
      setUnitBreakdown({ price_per_unit: 0, quantity: 0, unit: 'pcs' });
    }
    setShowBreakdown((prev) => !prev);
  };

  const handleBreakdownPriceChange = (price: number) => {
    setUnitBreakdown(prev => {
      const updated = { ...(prev || { price_per_unit: 0, quantity: 0, unit: 'pcs' }), price_per_unit: price };
      const total = updated.price_per_unit * updated.quantity;
      if (total > 0) {
        setAmount(total);
        setDisplayAmount(formatNum(total));
      }
      return updated;
    });
  };

  const handleBreakdownQtyChange = (qty: number) => {
    setUnitBreakdown(prev => {
      const updated = { ...(prev || { price_per_unit: 0, quantity: 0, unit: 'pcs' }), quantity: qty };
      const total = updated.price_per_unit * updated.quantity;
      if (total > 0) {
        setAmount(total);
        setDisplayAmount(formatNum(total));
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

  // Validate
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (amount <= 0) newErrors.amount = 'Amount must be greater than 0';
    if (currencyCode !== BASE_CURRENCY && (!fxRate || fxRate <= 0)) {
      newErrors.fxRate = 'Exchange rate must be greater than 0';
    }
    if (!selectedAccountId) newErrors.selectedAccountId = 'Account is required';
    if (!date) newErrors.date = 'Date is required';
    if (selectedAccount && isDividendChoiceAccount(selectedAccount) && !dividendEntryMode) {
      newErrors.selectedAccountId = 'Select dividend entry method (Declare or Cashout)';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Upload lampiran pending ke Cloudinary HANYA saat submit (defer upload).
  // Cancel sebelum ini = tidak ada file yang pernah naik ke Cloudinary.
  // Return null bila upload gagal (error sudah di-set ke state).
  const resolveFinalAttachments = async (): Promise<TransactionAttachment[] | null> => {
    if (businessId && attachments.some(isPendingAttachment)) {
      setUploadingAttachments(true);
      try {
        const uploaded = await uploadPendingAttachments(businessId, attachments);
        setAttachments(uploaded);
        setUploadingAttachments(false);
        return uploaded;
      } catch (err: any) {
        setUploadingAttachments(false);
        setErrors({ submit: err?.message || 'Gagal mengupload lampiran' });
        return null;
      }
    }
    return attachments;
  };

  const buildMeta = (finalAttachments: TransactionAttachment[]) => ({
    ...(selectedStockIds.length > 0 ? { sold_stock_ids: selectedStockIds } : {}),
    ...(pickedCatalogItem ? { catalog_item: pickedCatalogItem } : {}),
    unit_breakdown: unitBreakdown && unitBreakdown.unit ? unitBreakdown : undefined,
    attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
  });

  const applyCurrencyFields = (formData: TransactionFormData, baseAmount: number) => {
    formData.amount = baseAmount;
    formData.original_amount = amount;
    formData.currency_code = currencyCode;
    formData.fx_rate = currencyCode === BASE_CURRENCY ? 1 : fxRate;
    formData.fx_rate_date = date;
  };

  // Submit — jalur "Save Transaction": validasi penuh + double-entry lengkap.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const resolvedName = name.trim() || selectedAccount?.description || selectedAccount?.account_name || '';

    const baseAmount = currencyCode === BASE_CURRENCY ? amount : calculateBaseAmount(amount, fxRate);
    const result = resolveQuickTransaction(
      {
        amount: baseAmount,
        selectedAccountId,
        name: resolvedName,
        date,
        notes,
        dividendEntryMode: dividendEntryMode ?? undefined,
      },
      accounts
    );

    if ('error' in result) {
      setErrors({ submit: result.error });
      return;
    }

    // Convert selected stock transactions to COGS
    if (selectedStockIds.length > 0 && onConvertStockToCOGS) {
      try {
        await onConvertStockToCOGS(selectedStockIds);
      } catch (err: any) {
        setErrors({ submit: err.message || 'Gagal mengkonversi persediaan ke HPP' });
        return;
      }
    }

    const finalAttachments = await resolveFinalAttachments();
    if (finalAttachments === null) return;

    const formData = result as TransactionFormData;
    formData.meta = buildMeta(finalAttachments);
    formData.contact_id = contactId;
    applyCurrencyFields(formData, baseAmount);

    await onSubmit(formData);
  };

  // Save Draft — simpan apa yang sudah diisi tanpa memaksa field mandatory
  // (akun boleh kosong). Kalau akun sudah dipilih & valid, tetap resolve jadi
  // double-entry lengkap; kalau belum, simpan draft single-sided yang BELUM
  // bisa di-post sampai field wajib dilengkapi.
  const handleSaveDraft = async () => {
    if (!onSaveDraft) return;

    // Minimal tetap butuh amount > 0 (batas bawah DB & tujuan "sudah diisi").
    if (amount <= 0) {
      setErrors({ amount: 'Amount must be greater than 0' });
      return;
    }
    if (currencyCode !== BASE_CURRENCY && (!fxRate || fxRate <= 0)) {
      setErrors({ fxRate: 'Exchange rate must be greater than 0' });
      return;
    }

    const baseAmount = currencyCode === BASE_CURRENCY ? amount : calculateBaseAmount(amount, fxRate);
    const resolvedName = name.trim() || selectedAccount?.description || selectedAccount?.account_name || '';

    // Bila akun sudah dipilih, coba resolve jadi double-entry lengkap. Kalau
    // gagal (mis. belum ada kas/bank), fallback ke draft single-sided.
    let formData: TransactionFormData;
    if (selectedAccountId && !(selectedAccount && isDividendChoiceAccount(selectedAccount) && !dividendEntryMode)) {
      const result = resolveQuickTransaction(
        {
          amount: baseAmount,
          selectedAccountId,
          name: resolvedName,
          date,
          notes,
          dividendEntryMode: dividendEntryMode ?? undefined,
        },
        accounts
      );
      formData = 'error' in result
        ? buildIncompleteDraft(baseAmount, resolvedName)
        : (result as TransactionFormData);
    } else {
      formData = buildIncompleteDraft(baseAmount, resolvedName);
    }

    const finalAttachments = await resolveFinalAttachments();
    if (finalAttachments === null) return;

    formData.meta = buildMeta(finalAttachments);
    formData.contact_id = contactId;
    applyCurrencyFields(formData, baseAmount);

    await onSaveDraft(formData);
  };

  // Draft single-sided: belum ada pasangan akun, jadi is_double_entry=false.
  // Kategori default OPEX hanya placeholder sampai user melengkapi & mem-posting.
  const buildIncompleteDraft = (baseAmount: number, resolvedName: string): TransactionFormData => ({
    date,
    category: 'OPEX',
    // name wajib min 1 di server — fallback ke placeholder saat semua kosong.
    name: resolvedName || 'Draft transaksi',
    description: notes || selectedAccount?.description || selectedAccount?.account_name || '',
    amount: baseAmount,
    account: '',
    is_double_entry: false,
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Submit error */}
      {errors.submit && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-500 dark:text-red-300">{errors.submit}</p>
        </div>
      )}

      {/* 1. AMOUNT HERO CARD — gabungan flow badge, jumlah besar, breakdown unit, OCR scan */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/60 dark:to-gray-800/20 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Amount
            </span>
            <CurrencyPill
              currencyCode={currencyCode}
              onCurrencyChange={(c) => {
                const currency = normalizeCurrencyCode(c);
                setCurrencyCode(currency);
                if (currency === BASE_CURRENCY) setFxRate(1);
              }}
              supportedCurrencies={SUPPORTED_CURRENCIES}
            />
          </div>
          <div className="flex items-center gap-2">
            {flowDirection && flowLabel && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                  flowDirection === 'in'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300'
                }`}
              >
                {flowDirection === 'in' ? (
                  <ArrowDownLeft className="w-3 h-3" />
                ) : (
                  <ArrowUpRight className="w-3 h-3" />
                )}
                {flowLabel}
              </span>
            )}
            {businessId && (
              <OCRScanButton
                businessId={businessId}
                onParsed={handleOcrParsed}
                variant="compact"
              />
            )}
          </div>
        </div>
        <div className="mt-2">
          <CurrencyInputWithCalculator
            displayValue={displayAmount}
            onChange={(numeric, formatted) => {
              setDisplayAmount(formatted);
              setAmount(numeric);
              if (errors.amount) setErrors(prev => { const n = { ...prev }; delete n.amount; return n; });
            }}
            inputClassName="text-3xl font-bold tabular-nums leading-tight !border-0 !bg-transparent dark:!bg-transparent !py-0 !pl-0 !pr-14 !shadow-none focus:!ring-0"
            colorVariant={flowDirection === 'in' ? 'green' : flowDirection === 'out' ? 'red' : 'default'}
            calcButtonVariant="boxed"
            error={errors.amount}
            autoFocus
            currencyCode={currencyCode}
            onCurrencyChange={(c) => {
              const currency = normalizeCurrencyCode(c);
              setCurrencyCode(currency);
              if (currency === BASE_CURRENCY) setFxRate(1);
            }}
            supportedCurrencies={SUPPORTED_CURRENCIES}
            fxRate={currencyCode !== BASE_CURRENCY ? fxRate : undefined}
            onFxRateChange={currencyCode !== BASE_CURRENCY ? (v) => { setFxRate(Number(v)); if (errors.fxRate) setErrors(prev => { const n = { ...prev }; delete n.fxRate; return n; }); } : undefined}
            fxBookValue={currencyCode !== BASE_CURRENCY ? calculateBaseAmount(amount, fxRate || 0) : undefined}
            fxRateError={errors.fxRate}
          />
        </div>
        <div className="mt-3">
          <UnitBreakdownSection
            unitBreakdown={unitBreakdown}
            showBreakdown={showBreakdown}
            onToggle={handleToggleBreakdown}
            onPriceChange={handleBreakdownPriceChange}
            onQuantityChange={handleBreakdownQtyChange}
            onUnitChange={handleBreakdownUnitChange}
            onRemove={handleRemoveBreakdown}
          />
        </div>
      </div>

      {/* 2. CATEGORY */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
          Category
        </label>

        {/* Combobox trigger — search happens inline */}
        <div
          ref={triggerRef}
          onClick={() => !dropdownOpen && openDropdown()}
          className={`input w-full flex justify-between items-center cursor-pointer focus:ring-0 ${
            errors.selectedAccountId ? 'border-red-500 dark:border-red-400' : ''
          } ${dropdownOpen ? 'ring-2 ring-indigo-500/20 border-indigo-500 dark:border-indigo-400' : ''}`}
        >
          {dropdownOpen ? (
            <input
              type="text"
              placeholder={selectedAccount ? selectedAccount.account_name : 'Search account code or name...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent outline-none ring-0 focus:ring-0 focus:outline-none border-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : selectedAccount ? (
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                  ACCOUNT_TYPE_COLORS[selectedAccount.account_type]
                } bg-gray-100 dark:bg-gray-700`}
              >
                {selectedAccount.account_code}
              </span>
              <span className="truncate">{selectedAccount.account_name}</span>
            </div>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">Search account code or name...</span>
          )}
          <ChevronDown
            className={`w-5 h-5 flex-shrink-0 ml-2 transition-transform ${
              dropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </div>

        {errors.selectedAccountId && !dropdownOpen && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.selectedAccountId}</p>
        )}

        {/* Portal dropdown — escapes modal overflow */}
        {dropdownOpen && portalReady && portalRef.current && createPortal(
          <>
            <div
              className="fixed inset-0"
              style={{ zIndex: 99999 }}
              onClick={() => {
                setDropdownOpen(false);
                setSearchTerm('');
              }}
            />
            <div
              className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl overflow-hidden"
              style={{
                zIndex: 100000,
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                maxHeight: '320px',
              }}
            >
              <div className="overflow-y-auto max-h-80">
                {(Object.entries(groupedAccounts) as [AccountType, Account[]][]).map(
                  ([type, accs]) => {
                    if (accs.length === 0) return null;
                    return (
                      <div key={type}>
                        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold uppercase tracking-wide sticky top-0">
                          <span className={ACCOUNT_TYPE_COLORS[type]}>
                            {ACCOUNT_TYPE_LABELS[type]}
                          </span>
                        </div>
                        {accs.map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => handleSelectAccount(account)}
                            className={`w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors ${
                              account.id === selectedAccountId
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-indigo-500'
                                : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                {account.account_code}
                              </span>
                              <span className="text-sm text-gray-900 dark:text-gray-100">
                                {account.account_name}
                              </span>
                            </div>
                            {account.description && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 pl-14">
                                {account.description}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    );
                  }
                )}

                {Object.values(groupedAccounts).every((accs) => accs.length === 0) && (
                  <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                    Tidak ada akun yang cocok
                  </div>
                )}
              </div>
            </div>
          </>,
          portalRef.current
        )}

        {/* Counter-account hint — inline subtle */}
        {selectedAccount && cashAccount && (
          isDividendDeclareMode && dividendPayableAccount ? (
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-300">
                  Declare Dividen
                </span>
                <span className="truncate">
                  → {dividendPayableAccount.account_name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDividendModeModal(true)}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 underline hover:no-underline flex-shrink-0"
              >
                Ganti
              </button>
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="truncate">
                {flowDirection === 'in'
                  ? `→ ${cashAccount.account_name}`
                  : `→ ${cashAccount.account_name}`}
              </span>
              {selectedAccount && isDividendChoiceAccount(selectedAccount) && (
                <button
                  type="button"
                  onClick={() => setShowDividendModeModal(true)}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 underline hover:no-underline flex-shrink-0"
                >
                  Ganti
                </button>
              )}
            </div>
          )
        )}
      </div>

      {/* Dividend entry mode picker modal */}
      <DividendEntryModeModal
        isOpen={showDividendModeModal}
        onClose={handleDividendModeCancel}
        onSelect={handleDividendModeSelect}
        selectedAccount={selectedAccount}
        accounts={accounts}
      />

      {/* Inventory Picker - shown when revenue account selected and stock exists */}
      {showInventoryPicker && (
        <InventoryPicker
          stockTransactions={stockTransactions}
          selectedIds={selectedStockIds}
          onToggle={handleToggleStock}
        />
      )}

      {/* Catalog Picker - revenue (isi harga+akun) atau inventory/VAR→stok (link chip) */}
      {(isRevenueSelected || isInventorySelected) && businessId && (
        <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-900/10 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-2">
            {isInventorySelected ? t.catalog.stockPickerLabel : t.catalog.quickPickerLabel}
          </p>
          <CatalogItemPicker
            businessId={businessId}
            mode="single"
            onPick={handlePickCatalogItem}
            allowCreate={isInventorySelected}
          />
          {pickedCatalogItem && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-gray-400 dark:text-gray-500">Dipilih:</span>
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
          )}
        </div>
      )}

      {/* 3+4. TANGGAL + NAMA (2-column row) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              if (errors.date) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.date;
                  return next;
                });
              }
            }}
            className="input text-gray-600 dark:text-gray-300 [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-80 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
          {errors.date && (
            <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.date}</p>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
            Related Party
          </label>
          <ContactAutocomplete
            businessId={businessId}
            value={name}
            onChange={(val) => { setName(val); setContactId(null); }}
            onSelectContact={(contact) => setContactId(contact.id)}
            placeholder="Search contact..."
            onSaveAsContact={async (contactName) => {
              if (!businessId || !user) return;
              try {
                const result = await saveContactFromTransaction(
                  businessId,
                  contactName,
                  resolveContactTypeFromFlow(flowDirection),
                  user.id
                );
                setContactId(result.contact.id);
              } catch (err) {
                console.error('Failed to save contact:', err);
              }
            }}
          />
        </div>
      </div>

      {/* 5. CATATAN + LAMPIRAN (Tabs) */}
      <div className="space-y-2">
        <div
          role="tablist"
          aria-label="Transaction note and attachment"
          className={[
            'flex items-center justify-start transition-colors',
            activeSupplementaryTab
              ? 'inline-flex w-fit gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-gray-800'
              : 'gap-2 rounded-xl border border-gray-100 bg-white px-3 py-1 dark:border-gray-600 dark:bg-gray-700/40',
          ].join(' ')}
        >
          {([
            { value: 'note' as const, label: 'Add note', icon: StickyNote },
            ...(businessId ? [{ value: 'attachment' as const, label: 'Attach', icon: Paperclip }] : []),
          ]).map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeSupplementaryTab === tab.value;
            return (
              <div key={tab.value} className="flex items-center gap-2">
                {!activeSupplementaryTab && index > 0 && (
                  <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">
                    ·
                  </span>
                )}
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`quick-transaction-${tab.value}-panel`}
                  onClick={() => setActiveSupplementaryTab((current) => current === tab.value ? null : tab.value)}
                  className={[
                    'inline-flex h-8 min-w-0 items-center justify-center gap-2 rounded-xl text-sm font-normal transition-all',
                    activeSupplementaryTab ? 'px-3' : 'px-0',
                    isActive
                      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5 dark:bg-gray-900 dark:text-gray-100 dark:ring-white/10'
                      : activeSupplementaryTab
                        ? 'text-gray-500 hover:bg-white/60 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/70 dark:hover:text-gray-200'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                  {tab.value === 'attachment' && attachments.length > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-100 px-1.5 text-[11px] font-semibold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
                      {attachments.length}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {activeSupplementaryTab && (
          <div
            id={`quick-transaction-${activeSupplementaryTab}-panel`}
            role="tabpanel"
            className="rounded-2xl border border-gray-100 bg-white p-3 shadow-card dark:border-gray-700 dark:bg-gray-900"
          >
            {activeSupplementaryTab === 'note' ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input"
                rows={2}
                placeholder="Brief description..."
                aria-label="Note"
                autoFocus
              />
            ) : businessId ? (
              <FileUpload
                businessId={businessId}
                value={attachments}
                onChange={setAttachments}
                disabled={loading || uploadingAttachments}
                deferUpload
              />
            ) : null}
          </div>
        )}
      </div>

      {/* Action Buttons — Save primary, Save Draft secondary (lanjut nanti).
          Cancel/tutup form via tombol X di header modal. */}
      <div className="flex items-center gap-4 pt-1">
        <button
          type="submit"
          className="btn-primary-glow flex-1 flex items-center justify-center gap-2"
          disabled={loading || loadingAccounts || uploadingAttachments}
        >
          {uploadingAttachments ? (
            'Mengupload lampiran...'
          ) : loading ? (
            'Saving...'
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Save Transaction
            </>
          )}
        </button>
        {onSaveDraft ? (
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={loading || uploadingAttachments}
            title="Simpan yang sudah diisi sebagai draft — lanjutkan nanti sebelum di-posting"
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition-colors disabled:opacity-50"
          >
            Save Draft
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading || uploadingAttachments}
            className="px-2 py-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

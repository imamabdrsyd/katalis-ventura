'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useBusinessContext } from '@/context/BusinessContext';
import { useInvoices } from '@/hooks/useInvoices';
import { Modal } from '@/components/ui/Modal';
import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { getAccounts } from '@/lib/api/accounts';
import { createTransaction, createMultiLineTransaction } from '@/lib/api/transactions';
import { getTransactions } from '@/lib/api/transactions';
import { detectCategory } from '@/lib/utils/transactionHelpers';
import {
  findDefaultCashAccount,
  isDividendChoiceAccount,
  type DividendEntryMode,
} from '@/lib/utils/quickTransactionHelper';
import { findDividendPayableAccount } from '@/lib/accounting/guidance/dividendSettlement';
import { DividendEntryModeModal } from '@/components/transactions/DividendEntryModeModal';
import { getStockTransactions, findCogsAccount, deriveCatalogItemFromStock } from '@/lib/utils/inventoryHelper';
import { updateTransaction } from '@/lib/api/transactions';
import { InventoryPicker } from '@/components/transactions/InventoryPicker';
import {
  OutstandingSettlementPicker,
  getOutstandingTransactions,
  type SettlementSide,
} from '@/components/transactions/OutstandingSettlementPicker';
import { CatalogQuickPicker } from '@/components/transactions/CatalogQuickPicker';
import { ShareholderEntitlementPanel } from '@/components/transactions/ShareholderEntitlementPanel';
import { getCatalogItems } from '@/lib/api/catalog';
import { AccountDropdown } from '@/components/transactions/AccountDropdown';
import { ContactAutocomplete } from '@/components/transactions/ContactAutocomplete';
import { resolveContactTypeFromCategory, saveContactFromTransaction } from '@/lib/api/contacts';
import { validateCategoryConsistency } from '@/lib/accounting/validators/transactionValidator';
import { showTransactionSavedToast } from '@/lib/transactionToast';
import {
  getTransactionTemplates,
  createTransactionTemplate,
  deleteTransactionTemplate,
} from '@/lib/api/transactionTemplates';
import {
  createRecurringTransaction,
  computeNextDueDate,
} from '@/lib/api/recurring';
import type { Account, AccountType, TransactionCategory, Transaction, UnitBreakdown, TransactionAttachment, JournalLineInput, TransactionTemplate, CatalogItem } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import type { Translations, JournalEntryTypeKey, JournalEntryTypeStrings } from '@/lib/i18n/types';
import { isAnyReceivableAccount } from '@/lib/accounting/classification';
import {
  ArrowLeft,
  BookOpen,
  Save,
  TrendingUp,
  TrendingDown,
  Landmark,
  CreditCard,
  Wallet,
  ArrowRightLeft,
  PiggyBank,
  Clock,
  AlertTriangle,
  RotateCcw,
  Repeat,
  FileText,
  HandCoins,
  Receipt,
  ChevronDown,
  Plus,
  PlusCircle,
  Trash2,
  X,
  Check,
  CheckCircle,
  AlertCircle,
  BookTemplate,
  RefreshCw,
} from 'lucide-react';
import { CurrencyInputWithCalculator } from '@/components/ui/CurrencyInputWithCalculator';
import FloatingField, { FloatingSelect } from '@/components/ui/FloatingField';
import { UnitBreakdownSection } from '@/components/transactions/UnitBreakdownSection';
import { FileUpload } from '@/components/ui/FileUpload';

// ─── entry types ───────────────────────────────────────────────────────────

type EntryTypeId = JournalEntryTypeKey;

/**
 * Konfigurasi non-teks jenis transaksi. Label/deskripsi/label nama diambil dari
 * i18n (`t.journalEntry.entryTypes[id]`) lewat `buildEntryTypes()` — panel ini
 * dwibahasa, jadi teksnya tidak boleh ditanam di sini.
 */
interface EntryTypeConfig {
  id: EntryTypeId;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  /** Which account type should the debit dropdown show */
  debitFilter: AccountType | 'ALL';
  /** Which account type should the credit dropdown show */
  creditFilter: AccountType | 'ALL';
  /** Optional sub-filter applied AFTER debitFilter (e.g. only talangan ASSET accounts) */
  debitSubFilter?: (acc: Account) => boolean;
  /** Optional sub-filter applied AFTER creditFilter */
  creditSubFilter?: (acc: Account) => boolean;
  /** Default debit account type for auto-resolve */
  defaultDebitType: AccountType;
  /** Default credit account type for auto-resolve */
  defaultCreditType: AccountType;
  /** Suggested category */
  suggestedCategory: TransactionCategory;
  /** If true, category dropdown is locked (user cannot change it) */
  lockCategory?: boolean;
}

type EntryType = EntryTypeConfig & JournalEntryTypeStrings;

/** Filter: only ASSET accounts that are talangan/advance (default_category=FIN or name match) */
function isTalanganAccount(acc: Account): boolean {
  if (acc.default_category === 'FIN') return true;
  return /talangan|advance|piutang talangan/i.test(acc.account_name);
}

const ENTRY_TYPE_CONFIGS: EntryTypeConfig[] = [
  {
    id: 'penjualan',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'text-emerald-500 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-500',
    debitFilter: 'ASSET',
    creditFilter: 'REVENUE',
    defaultDebitType: 'ASSET',
    defaultCreditType: 'REVENUE',
    suggestedCategory: 'EARN',
  },
  {
    id: 'pengeluaran',
    icon: <TrendingDown className="w-5 h-5" />,
    color: 'text-red-500 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-500',
    debitFilter: 'EXPENSE',
    creditFilter: 'ASSET',
    defaultDebitType: 'EXPENSE',
    defaultCreditType: 'ASSET',
    suggestedCategory: 'OPEX',
  },
  {
    id: 'pinjaman',
    icon: <Landmark className="w-5 h-5" />,
    color: 'text-amber-500 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-500',
    debitFilter: 'ASSET',
    creditFilter: 'LIABILITY',
    defaultDebitType: 'ASSET',
    defaultCreditType: 'LIABILITY',
    suggestedCategory: 'FIN',
  },
  {
    // Lunas & cicil digabung di satu kartu — pilihannya ada di dalam baris
    // daftar hutang (lihat OutstandingSettlementPicker), karena dari sisi user
    // kejadiannya sama: bayar ke kreditur. Yang beda cuma nominalnya.
    id: 'bayar_hutang',
    icon: <CreditCard className="w-5 h-5" />,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-500',
    debitFilter: 'LIABILITY',
    creditFilter: 'ASSET',
    defaultDebitType: 'LIABILITY',
    defaultCreditType: 'ASSET',
    suggestedCategory: 'FIN',
  },
  {
    id: 'suntik_modal',
    icon: <PiggyBank className="w-5 h-5" />,
    color: 'text-purple-500 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-500',
    debitFilter: 'ASSET',
    creditFilter: 'EQUITY',
    defaultDebitType: 'ASSET',
    defaultCreditType: 'EQUITY',
    suggestedCategory: 'FIN',
  },
  {
    id: 'tarik_dividen',
    icon: <Wallet className="w-5 h-5" />,
    color: 'text-indigo-500 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    borderColor: 'border-indigo-500',
    debitFilter: 'EQUITY',
    creditFilter: 'ASSET',
    defaultDebitType: 'EQUITY',
    defaultCreditType: 'ASSET',
    suggestedCategory: 'FIN',
  },
  {
    id: 'beban_terutang',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    borderColor: 'border-rose-500',
    debitFilter: 'EXPENSE',
    creditFilter: 'LIABILITY',
    defaultDebitType: 'EXPENSE',
    defaultCreditType: 'LIABILITY',
    suggestedCategory: 'OPEX',
  },
  {
    id: 'realisasi_pendapatan_dimuka',
    icon: <RotateCcw className="w-5 h-5" />,
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    borderColor: 'border-teal-500',
    debitFilter: 'LIABILITY',
    creditFilter: 'REVENUE',
    defaultDebitType: 'LIABILITY',
    defaultCreditType: 'REVENUE',
    suggestedCategory: 'EARN',
  },
  {
    id: 'reklasifikasi_hutang',
    icon: <Repeat className="w-5 h-5" />,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-900/20',
    borderColor: 'border-slate-500',
    debitFilter: 'LIABILITY',
    creditFilter: 'LIABILITY',
    defaultDebitType: 'LIABILITY',
    defaultCreditType: 'LIABILITY',
    suggestedCategory: 'FIN',
  },
  {
    id: 'pendapatan_dimuka',
    icon: <Clock className="w-5 h-5" />,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    borderColor: 'border-cyan-500',
    debitFilter: 'ASSET',
    creditFilter: 'LIABILITY',
    defaultDebitType: 'ASSET',
    defaultCreditType: 'LIABILITY',
    suggestedCategory: 'FIN',
  },
  {
    id: 'catat_talangan',
    icon: <HandCoins className="w-5 h-5" />,
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-900/20',
    borderColor: 'border-sky-500',
    debitFilter: 'ASSET',
    creditFilter: 'ASSET',
    debitSubFilter: isTalanganAccount,
    defaultDebitType: 'ASSET',
    defaultCreditType: 'ASSET',
    suggestedCategory: 'FIN',
    lockCategory: true,
  },
  {
    // Piutang usaha & talangan digabung: keduanya "orang bayar balik ke saya".
    // Kategori TIDAK dikunci — pelunasan piutang usaha masuk EARN, talangan FIN,
    // dan itu diturunkan otomatis dari akun piutang transaksi asalnya.
    id: 'terima_pelunasan',
    icon: <Receipt className="w-5 h-5" />,
    color: 'text-lime-600 dark:text-lime-400',
    bgColor: 'bg-lime-50 dark:bg-lime-900/20',
    borderColor: 'border-lime-500',
    debitFilter: 'ASSET',
    creditFilter: 'ASSET',
    creditSubFilter: isAnyReceivableAccount,
    defaultDebitType: 'ASSET',
    defaultCreditType: 'ASSET',
    suggestedCategory: 'FIN',
  },
];

function buildEntryTypes(t: Translations): EntryType[] {
  return ENTRY_TYPE_CONFIGS.map((config) => ({
    ...config,
    ...t.journalEntry.entryTypes[config.id],
  }));
}

/**
 * Kartu jenis transaksi di panel kiri. Memakai utility `.card` (shadow diffuse
 * ala Airbnb + hover lift) supaya seragam dengan kartu di hub Accounting —
 * hanya padding yang dikecilkan karena daftar ini kompak & tetap vertikal.
 */
function EntryTypeCard({
  entryType,
  isSelected,
  onSelect,
}: {
  entryType: EntryType;
  isSelected: boolean;
  onSelect: (entryType: EntryType) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entryType)}
      className={`card !p-3 w-full flex items-center gap-3 text-left ${
        isSelected
          ? '!bg-indigo-50 dark:!bg-indigo-900/20 !border-indigo-500 dark:!border-indigo-400'
          : ''
      }`}
    >
      <span className={isSelected ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}>
        {entryType.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
          {entryType.label}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{entryType.description}</div>
      </div>
    </button>
  );
}

const ALL_CATEGORIES: TransactionCategory[] = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

// Kartu yang SELALU tampil di panel, BERURUTAN.
//
// Kriterianya: jenis yang tidak sekadar membuka form mentah — melainkan
// menampilkan daftar/pilihan lebih dulu (katalog, tagihan outstanding, hak bagi
// hasil) — ditaruh paling atas, karena di situlah sistem benar-benar membantu.
// Pengeluaran adalah pengecualian: formnya polos, tapi paling sering dipakai.
// Sisanya (pinjaman, talangan, akrual, uang muka, reklasifikasi) jarang dipakai
// dan tidak ikut tampil sampai user menambahkannya sendiri lewat tombol
// "Tambah Jenis" (disimpan per bisnis, lihat STORAGE_KEY_PINNED_ENTRY_TYPES).
const DEFAULT_VISIBLE_ORDER: EntryTypeId[] = [
  'penjualan',        // katalog produk/jasa
  'pengeluaran',      // form polos, tapi paling sering
  'terima_pelunasan', // daftar piutang usaha & talangan
  'bayar_hutang',     // daftar hutang outstanding
  'tarik_dividen',    // hak bagi hasil + daftar dividen ter-declare
];

const DEFAULT_VISIBLE_IDS: Set<EntryTypeId> = new Set(DEFAULT_VISIBLE_ORDER);

/** Jenis tambahan yang dipilih user untuk ikut tampil — per bisnis, karena
 *  kebutuhannya beda (trading butuh talangan, F&B butuh akrual). */
const STORAGE_KEY_PINNED_ENTRY_TYPES = 'katalis_journal_pinned_entry_types';
/** Key lama (toggle "Tampilkan Lainnya"). Dibaca sekali untuk migrasi: yang
 *  dulu memilih expand langsung dapat semua jenis ter-pin, lalu key dihapus. */
const STORAGE_KEY_ENTRY_TYPES_EXPANDED = 'katalis_journal_entry_types_expanded';

const ALL_ENTRY_TYPE_IDS: Set<string> = new Set(ENTRY_TYPE_CONFIGS.map(c => c.id));

// ─── multi-line helpers ───────────────────────────────────────────────────

/** Entry types that support multi-line mode */
const MULTI_LINE_ELIGIBLE: Set<EntryTypeId> = new Set(['penjualan', 'pengeluaran', 'pinjaman']);

interface MultiLineLine {
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  description: string;
  sort_order: number;
}

function emptyLine(sort_order: number): MultiLineLine {
  return { account_id: '', debit_amount: 0, credit_amount: 0, description: '', sort_order };
}

function mlFormatNumber(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('id-ID');
}

function mlParseNumber(s: string): number {
  const cleaned = s.replace(/\./g, '').replace(/,/g, '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// ─── page ──────────────────────────────────────────────────────────────────

export default function JournalEntryPage() {
  const router = useRouter();
  const { user, activeBusiness, activeBusinessId: businessId } = useBusinessContext();
  const { t } = useLanguage();
  const entryTypes = useMemo(() => buildEntryTypes(t), [t]);

  // Invoice modal — Buat Invoice di header
  const {
    saving: invoiceSaving,
    showAddModal: showInvoiceModal,
    setShowAddModal: setShowInvoiceModal,
    invoiceSettings,
    nextInvoiceNumber,
    handleCreateInvoice,
  } = useInvoices();

  // step state — simpan ID-nya saja; objek EntryType diturunkan dari `entryTypes`
  // supaya label ikut berganti saat bahasa diubah.
  const [selectedEntryTypeId, setSelectedEntryTypeId] = useState<EntryTypeId | null>('penjualan');
  const selectedEntryType = useMemo(
    () => entryTypes.find((et) => et.id === selectedEntryTypeId) ?? null,
    [entryTypes, selectedEntryTypeId]
  );

  // dividend entry mode (only relevant when selectedEntryType.id === 'tarik_dividen')
  const [dividendEntryMode, setDividendEntryMode] = useState<DividendEntryMode | null>(null);
  const [showDividendModeModal, setShowDividendModeModal] = useState(false);

  // Jenis tambahan yang dipilih user untuk ikut tampil di panel — disimpan per
  // bisnis di localStorage, urutannya = urutan penambahan.
  const [pinnedEntryTypeIds, setPinnedEntryTypeIds] = useState<EntryTypeId[]>([]);
  const [showEntryTypePicker, setShowEntryTypePicker] = useState(false);

  const pinnedStorageKey = businessId ? `${STORAGE_KEY_PINNED_ENTRY_TYPES}_${businessId}` : null;

  useEffect(() => {
    if (!pinnedStorageKey) return;
    const sanitize = (ids: unknown): EntryTypeId[] =>
      Array.isArray(ids)
        ? (ids.filter(
            (id): id is EntryTypeId =>
              typeof id === 'string' && ALL_ENTRY_TYPE_IDS.has(id) && !DEFAULT_VISIBLE_IDS.has(id as EntryTypeId)
          ))
        : [];
    try {
      const raw = localStorage.getItem(pinnedStorageKey);
      if (raw !== null) {
        setPinnedEntryTypeIds(sanitize(JSON.parse(raw)));
        return;
      }
      // Migrasi dari toggle lama: pernah expand = semua jenis dianggap dipilih.
      const wasExpanded = localStorage.getItem(STORAGE_KEY_ENTRY_TYPES_EXPANDED) === 'true';
      const migrated = wasExpanded
        ? ENTRY_TYPE_CONFIGS.map(c => c.id).filter(id => !DEFAULT_VISIBLE_IDS.has(id))
        : [];
      setPinnedEntryTypeIds(migrated);
      localStorage.setItem(pinnedStorageKey, JSON.stringify(migrated));
    } catch {
      setPinnedEntryTypeIds([]);
    }
  }, [pinnedStorageKey]);

  const togglePinnedEntryType = (id: EntryTypeId) => {
    const removing = pinnedEntryTypeIds.includes(id);
    const next = removing ? pinnedEntryTypeIds.filter(x => x !== id) : [...pinnedEntryTypeIds, id];
    setPinnedEntryTypeIds(next);
    if (pinnedStorageKey) {
      try { localStorage.setItem(pinnedStorageKey, JSON.stringify(next)); } catch { /* noop */ }
    }
    // Melepas jenis yang sedang dipilih akan menyisakan form tanpa kartu aktif —
    // kembalikan ke jenis pertama. Menambah jenis TIDAK ikut memilihnya: form
    // yang sedang diisi user tidak boleh ter-reset hanya karena buka picker.
    if (removing && selectedEntryTypeId === id) {
      const fallback = entryTypes.find(et => et.id === DEFAULT_VISIBLE_ORDER[0]);
      if (fallback) handleSelectEntryType(fallback);
    }
  };

  // Urutan kartu mengikuti DEFAULT_VISIBLE_ORDER (bukan urutan konfigurasi),
  // lalu jenis tambahan sesuai urutan user menambahkannya.
  const defaultEntryTypes = DEFAULT_VISIBLE_ORDER
    .map((id) => entryTypes.find((et) => et.id === id))
    .filter((et): et is EntryType => !!et);
  const extraEntryTypes = entryTypes.filter(et => !DEFAULT_VISIBLE_IDS.has(et.id));
  const pinnedEntryTypes = pinnedEntryTypeIds
    .map((id) => extraEntryTypes.find((et) => et.id === id))
    .filter((et): et is EntryType => !!et);
  const visibleEntryTypes = [...defaultEntryTypes, ...pinnedEntryTypes];

  // form state
  const [amount, setAmount] = useState(0);
  const [displayAmount, setDisplayAmount] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [category, setCategory] = useState<TransactionCategory>('OPEX');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // unit breakdown state
  const [unitBreakdown, setUnitBreakdown] = useState<UnitBreakdown | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // attachment state
  const [attachments, setAttachments] = useState<TransactionAttachment[]>([]);

  // template state
  const [templates, setTemplates] = useState<TransactionTemplate[]>([]);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [saveTemplateMode, setSaveTemplateMode] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // recurring state
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [recurringInterval, setRecurringInterval] = useState(1);
  const [recurringEndDate, setRecurringEndDate] = useState('');

  // multi-line state
  const [isMultiLineMode, setIsMultiLineMode] = useState(false);
  const [mlLines, setMlLines] = useState<MultiLineLine[]>([emptyLine(0), emptyLine(1)]);
  const [mlDisplayDebit, setMlDisplayDebit] = useState<string[]>(['', '']);
  const [mlDisplayCredit, setMlDisplayCredit] = useState<string[]>(['', '']);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const isMultiLineEligible = selectedEntryType ? MULTI_LINE_ELIGIBLE.has(selectedEntryType.id) : false;

  const mlTotalDebit = useMemo(() => mlLines.reduce((s, l) => s + l.debit_amount, 0), [mlLines]);
  const mlTotalCredit = useMemo(() => mlLines.reduce((s, l) => s + l.credit_amount, 0), [mlLines]);
  const mlIsBalanced = Math.abs(mlTotalDebit - mlTotalCredit) < 0.01;
  const mlDifference = mlTotalDebit - mlTotalCredit;

  // inventory state
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);

  // data state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pemilihan-dulu (lihat blok "list-first entry" di bawah): user bisa keluar
  // dari daftar dan kembali ke form jurnal mentah lewat "Catat manual".
  const [manualEntryOverride, setManualEntryOverride] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogItem | null>(null);

  // fetch accounts + transactions + katalog
  useEffect(() => {
    if (!businessId) return;
    async function fetchData() {
      try {
        const [accs, txns, items] = await Promise.all([
          getAccounts(businessId!),
          getTransactions(businessId!),
          getCatalogItems(businessId!, { activeOnly: true }).catch(() => [] as CatalogItem[]),
        ]);
        setAccounts(accs);
        setAllTransactions(txns);
        setCatalogItems(items);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoadingAccounts(false);
      }
    }
    fetchData();
  }, [businessId]);

  // Refresh daftar transaksi setelah pelunasan lewat picker — supaya baris yang
  // baru lunas langsung hilang dari daftar outstanding.
  const refreshTransactions = useCallback(async () => {
    if (!businessId) return;
    try {
      setAllTransactions(await getTransactions(businessId));
    } catch (err) {
      console.error('Failed to refresh transactions:', err);
    }
  }, [businessId]);

  // fetch templates
  useEffect(() => {
    if (!businessId) return;
    getTransactionTemplates(businessId)
      .then(setTemplates)
      .catch((err) => console.error('Failed to fetch templates:', err));
  }, [businessId]);

  // derived
  const cashAccount = useMemo(() => findDefaultCashAccount(accounts), [accounts]);

  const dividendPayableAccount = useMemo(() => findDividendPayableAccount(accounts), [accounts]);

  // ── list-first entry ──────────────────────────────────────────────────────
  // Sebagian jenis transaksi sebenarnya bukan "entry baru", tapi tindak lanjut
  // atas transaksi/data yang sudah ada. Untuk jenis-jenis ini form jurnal
  // mentah ditahan dulu dan user memilih dari daftar:
  //
  //   bayar_hutang      → daftar hutang belum lunas (lunas/cicil, settle via RPC)
  //   terima_pelunasan  → daftar piutang belum lunas: usaha & talangan (2 tab)
  //   tarik_dividen     → daftar dividen yang sudah di-declare tapi belum dibayar
  //   penjualan         → katalog produk/jasa (prefill form)
  //
  // Kalau daftarnya kosong (belum ada hutang / katalog masih kosong), form
  // manual langsung ditampilkan seperti sebelumnya.
  const settlementSide: SettlementSide | null =
    selectedEntryType?.id === 'bayar_hutang'
      ? 'payable'
      : selectedEntryType?.id === 'terima_pelunasan'
        ? 'receivable'
        : selectedEntryType?.id === 'tarik_dividen'
          ? 'dividend'
          : null;

  const outstandingRows = useMemo(
    () => (settlementSide ? getOutstandingTransactions(settlementSide, allTransactions) : []),
    [settlementSide, allTransactions]
  );

  const showSettlementPicker =
    !!settlementSide && !manualEntryOverride && outstandingRows.length > 0;

  const sellableCatalogItems = useMemo(
    () => catalogItems.filter((i) => i.asset_class == null),
    [catalogItems]
  );

  const showCatalogPicker =
    selectedEntryType?.id === 'penjualan' &&
    !manualEntryOverride &&
    !selectedCatalogItem &&
    sellableCatalogItems.length > 0;

  const showEntryForm = !showSettlementPicker && !showCatalogPicker;

  /** Prefill form penjualan dari item katalog yang dipilih. */
  const handleSelectCatalogItem = useCallback(
    (item: CatalogItem, qty: number, total: number) => {
      setSelectedCatalogItem(item);
      setAmount(total);
      setDisplayAmount(total.toLocaleString('id-ID'));
      setDescription(qty > 1 ? `${item.name} × ${qty}` : item.name);
      if (item.revenue_account_id) setCreditAccountId(item.revenue_account_id);
      setErrors({});
    },
    []
  );

  // Auto-set default accounts & category when entry type is selected
  const handleSelectEntryType = useCallback((entryType: EntryType) => {
    setSelectedEntryTypeId(entryType.id);
    setDividendEntryMode(null);
    setErrors({});
    // Kembali ke mode "pilih dulu" tiap ganti jenis transaksi.
    setManualEntryOverride(false);
    setSelectedCatalogItem(null);

    // Auto-fill debit: prefer cash/bank for ASSET type
    if (entryType.defaultDebitType === 'ASSET' && cashAccount) {
      setDebitAccountId(cashAccount.id);
    } else {
      setDebitAccountId('');
    }

    // Auto-fill credit: prefer cash/bank for ASSET type
    if (entryType.defaultCreditType === 'ASSET' && cashAccount) {
      setCreditAccountId(cashAccount.id);
    } else {
      setCreditAccountId('');
    }

    setCategory(entryType.suggestedCategory);

    // Reset multi-line state when switching entry types
    setIsMultiLineMode(false);
    setMlLines([emptyLine(0), emptyLine(1)]);
    setMlDisplayDebit(['', '']);
    setMlDisplayCredit(['', '']);
    setShowCancelConfirm(false);
  }, [cashAccount]);

  // Munculkan popup pilihan saat user memilih akun Dividen sebagai DEBIT
  // (di entry type 'tarik_dividen' atau lainnya yang debit-nya EQUITY).
  // Setelah user pilih mode, override credit account sesuai mode.
  const handleDividendModeSelect = useCallback(
    (mode: DividendEntryMode) => {
      setDividendEntryMode(mode);
      setShowDividendModeModal(false);
      if (mode === 'declare' && dividendPayableAccount) {
        setCreditAccountId(dividendPayableAccount.id);
      } else if (mode === 'cashout' && cashAccount) {
        setCreditAccountId(cashAccount.id);
      }
    },
    [dividendPayableAccount, cashAccount]
  );

  const handleDividendModeCancel = useCallback(() => {
    setShowDividendModeModal(false);
    // Bila batal, kosongkan debit agar user bisa pilih ulang.
    setDebitAccountId('');
    setDividendEntryMode(null);
  }, []);

  // Auto-detect category when debit/credit accounts change (skip if locked)
  useEffect(() => {
    if (selectedEntryType?.lockCategory) return;
    if (!debitAccountId || !creditAccountId) return;
    const debitAcc = accounts.find(a => a.id === debitAccountId);
    const creditAcc = accounts.find(a => a.id === creditAccountId);
    if (!debitAcc || !creditAcc) return;
    const detected = detectCategory(debitAcc.account_code, creditAcc.account_code, debitAcc, creditAcc);
    setCategory(detected);
  }, [debitAccountId, creditAccountId, accounts, selectedEntryType]);

  // Trigger popup pilihan declare/cashout saat user memilih akun Dividen
  // sebagai DEBIT — relevan terutama untuk entry type 'tarik_dividen'.
  useEffect(() => {
    if (!debitAccountId) return;
    if (dividendEntryMode) return; // user sudah pilih
    const debitAcc = accounts.find(a => a.id === debitAccountId);
    if (!debitAcc) return;
    if (isDividendChoiceAccount(debitAcc)) {
      setShowDividendModeModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debitAccountId]);

  // Inventory picker
  const debitAccount = accounts.find(a => a.id === debitAccountId);
  const creditAccount = accounts.find(a => a.id === creditAccountId);
  const isRevenueCredit = creditAccount?.account_type === 'REVENUE';
  const stockTransactions = useMemo(
    () => (isRevenueCredit ? getStockTransactions(allTransactions) : []),
    [isRevenueCredit, allTransactions]
  );
  const showInventoryPicker = isRevenueCredit && stockTransactions.length > 0;

  // Category consistency warnings
  const categoryWarnings = useMemo(() => {
    if (!debitAccount || !creditAccount) return [];
    return validateCategoryConsistency(
      category,
      debitAccount.account_type,
      creditAccount.account_type
    );
  }, [category, debitAccount, creditAccount]);

  const handleToggleStock = (transactionId: string) => {
    setSelectedStockIds(prev =>
      prev.includes(transactionId)
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  // unit breakdown handlers
  const handleToggleBreakdown = () => {
    if (!showBreakdown && !unitBreakdown) {
      setUnitBreakdown({ price_per_unit: 0, quantity: 0, unit: 'pcs' });
    }
    setShowBreakdown(prev => !prev);
  };

  const handleBreakdownPriceChange = (price: number) => {
    setUnitBreakdown(prev => {
      const updated = { ...(prev || { price_per_unit: 0, quantity: 0, unit: 'pcs' }), price_per_unit: price };
      const total = updated.price_per_unit * updated.quantity;
      if (total > 0) {
        setAmount(total);
        setDisplayAmount(total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
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
        setDisplayAmount(total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
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

  // ─── multi-line handlers ────────────────────────────────────────────────

  /** Enter multi-line mode, pre-filling first row from single-line state */
  const handleEnterMultiLine = () => {
    const firstLine: MultiLineLine = { ...emptyLine(0) };
    const secondLine: MultiLineLine = { ...emptyLine(1) };

    if (selectedEntryType?.id === 'penjualan') {
      // Penjualan: first row debit=ASSET(cash), second row credit=REVENUE
      if (debitAccountId) {
        firstLine.account_id = debitAccountId;
        firstLine.debit_amount = amount;
      }
      if (creditAccountId) {
        secondLine.account_id = creditAccountId;
        secondLine.credit_amount = amount;
      }
    } else if (selectedEntryType?.id === 'pengeluaran') {
      // Pengeluaran: first row debit=EXPENSE, second row credit=ASSET(cash)
      if (debitAccountId) {
        firstLine.account_id = debitAccountId;
        firstLine.debit_amount = amount;
      }
      if (creditAccountId) {
        secondLine.account_id = creditAccountId;
        secondLine.credit_amount = amount;
      }
    } else if (selectedEntryType?.id === 'pinjaman') {
      // Terima Pinjaman: first row debit=ASSET(cash/bank), second row credit=LIABILITY
      if (debitAccountId) {
        firstLine.account_id = debitAccountId;
        firstLine.debit_amount = amount;
      }
      if (creditAccountId) {
        secondLine.account_id = creditAccountId;
        secondLine.credit_amount = amount;
      }
    }

    setMlLines([firstLine, secondLine]);
    setMlDisplayDebit([mlFormatNumber(firstLine.debit_amount), mlFormatNumber(secondLine.debit_amount)]);
    setMlDisplayCredit([mlFormatNumber(firstLine.credit_amount), mlFormatNumber(secondLine.credit_amount)]);
    setIsMultiLineMode(true);
  };

  /** Exit multi-line mode, restoring first row values to single-line */
  const handleExitMultiLine = () => {
    // Keep first line values
    const first = mlLines[0];
    if (first) {
      const lineAmount = first.debit_amount || first.credit_amount;
      if (lineAmount > 0) {
        setAmount(lineAmount);
        setDisplayAmount(lineAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
      }
      if (first.account_id) {
        if (first.debit_amount > 0) setDebitAccountId(first.account_id);
        else if (first.credit_amount > 0) setCreditAccountId(first.account_id);
      }
    }
    setMlLines([emptyLine(0), emptyLine(1)]);
    setMlDisplayDebit(['', '']);
    setMlDisplayCredit(['', '']);
    setIsMultiLineMode(false);
    setShowCancelConfirm(false);
  };

  const mlAddLine = () => {
    setMlLines(prev => [...prev, emptyLine(prev.length)]);
    setMlDisplayDebit(prev => [...prev, '']);
    setMlDisplayCredit(prev => [...prev, '']);
  };

  const mlRemoveLine = (idx: number) => {
    if (mlLines.length <= 2) return;
    setMlLines(prev => prev.filter((_, i) => i !== idx));
    setMlDisplayDebit(prev => prev.filter((_, i) => i !== idx));
    setMlDisplayCredit(prev => prev.filter((_, i) => i !== idx));
  };

  const mlUpdateAccount = (idx: number, accountId: string) => {
    setMlLines(prev => prev.map((l, i) => (i === idx ? { ...l, account_id: accountId } : l)));
    if (errors[`ml_${idx}_account`]) {
      setErrors(prev => { const n = { ...prev }; delete n[`ml_${idx}_account`]; return n; });
    }
  };

  const mlUpdateDebit = (idx: number, raw: string) => {
    const n = mlParseNumber(raw);
    setMlDisplayDebit(prev => prev.map((v, i) => (i === idx ? (raw === '' ? '' : mlFormatNumber(n)) : v)));
    setMlLines(prev =>
      prev.map((l, i) => (i === idx ? { ...l, debit_amount: n, credit_amount: n > 0 ? 0 : l.credit_amount } : l))
    );
    if (n > 0) {
      setMlDisplayCredit(prev => prev.map((v, i) => (i === idx ? '' : v)));
    }
  };

  const mlUpdateCredit = (idx: number, raw: string) => {
    const n = mlParseNumber(raw);
    setMlDisplayCredit(prev => prev.map((v, i) => (i === idx ? (raw === '' ? '' : mlFormatNumber(n)) : v)));
    setMlLines(prev =>
      prev.map((l, i) => (i === idx ? { ...l, credit_amount: n, debit_amount: n > 0 ? 0 : l.debit_amount } : l))
    );
    if (n > 0) {
      setMlDisplayDebit(prev => prev.map((v, i) => (i === idx ? '' : v)));
    }
  };

  const mlUpdateDescription = (idx: number, value: string) => {
    setMlLines(prev => prev.map((l, i) => (i === idx ? { ...l, description: value } : l)));
  };

  // ─── template handlers ─────────────────────────────────────────────────

  const applyTemplate = (tmpl: TransactionTemplate) => {
    setCategory(tmpl.category);
    if (tmpl.description) setDescription(tmpl.description);

    if (tmpl.journal_lines && tmpl.journal_lines.length >= 2) {
      // Multi-line template: masuk mode multi-baris & ganti semua baris dengan isi template
      const lines: MultiLineLine[] = tmpl.journal_lines.map((l, i) => ({
        account_id: l.account_id,
        debit_amount: l.debit_amount,
        credit_amount: l.credit_amount,
        description: l.description ?? '',
        sort_order: i,
      }));
      setMlLines(lines);
      setMlDisplayDebit(lines.map((l) => mlFormatNumber(l.debit_amount)));
      setMlDisplayCredit(lines.map((l) => mlFormatNumber(l.credit_amount)));
      setIsMultiLineMode(true);
      setShowCancelConfirm(false);
    } else {
      // Single-line template (perilaku lama)
      if (tmpl.debit_account_id) setDebitAccountId(tmpl.debit_account_id);
      if (tmpl.credit_account_id) setCreditAccountId(tmpl.credit_account_id);
      if (tmpl.default_amount) {
        setAmount(tmpl.default_amount);
        setDisplayAmount(tmpl.default_amount.toLocaleString('id-ID'));
      }
    }
    setTemplateDropdownOpen(false);
  };

  const handleSaveTemplate = async () => {
    if (!businessId || !templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const templateJournalLines: JournalLineInput[] | null = isMultiLineMode
        ? mlLines.map((l, i) => ({
            account_id: l.account_id,
            debit_amount: l.debit_amount,
            credit_amount: l.credit_amount,
            description: l.description || undefined,
            sort_order: i,
          }))
        : null;

      const saved = await createTransactionTemplate(businessId, {
        name: templateName.trim(),
        category,
        description: description || null,
        default_amount: isMultiLineMode ? null : amount > 0 ? amount : null,
        debit_account_id: isMultiLineMode ? null : debitAccountId || null,
        credit_account_id: isMultiLineMode ? null : creditAccountId || null,
        is_double_entry: true,
        journal_lines: templateJournalLines,
      });
      setTemplates((prev) => [saved, ...prev]);
      setTemplateName('');
      setSaveTemplateMode(false);
    } catch (err) {
      console.error('Failed to save template:', err);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteTransactionTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  // ─── handlers ──────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = t.journalEntry.form.errNameRequired;
    if (!date) newErrors.date = t.journalEntry.form.errDateRequired;

    if (isMultiLineMode) {
      // Multi-line validation
      mlLines.forEach((line, idx) => {
        if (!line.account_id) newErrors[`ml_${idx}_account`] = t.journalEntry.form.errSelectAccount;
        if (line.debit_amount === 0 && line.credit_amount === 0) {
          newErrors[`ml_${idx}_amount`] = t.journalEntry.form.errEnterDebitOrCredit;
        }
      });
      if (mlTotalDebit === 0) {
        newErrors.ml_balance = t.journalEntry.form.errAmountZero;
      } else if (!mlIsBalanced) {
        newErrors.ml_balance = t.journalEntry.form.errUnbalanced(Math.abs(mlDifference).toLocaleString('id-ID'));
      }
    } else {
      // Single-line validation
      if (amount <= 0) newErrors.amount = t.journalEntry.form.errAmountPositive;
      if (!debitAccountId) newErrors.debit = t.journalEntry.form.errDebitRequired;
      if (!creditAccountId) newErrors.credit = t.journalEntry.form.errCreditRequired;
      if (debitAccountId && creditAccountId && debitAccountId === creditAccountId) {
        newErrors.credit = t.journalEntry.form.errSameAccount;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !businessId || !user) return;

    setSaving(true);
    try {
      let savedTransaction: Transaction | null = null;

      if (isMultiLineMode) {
        // ── Multi-line save ──
        const journalLines: JournalLineInput[] = mlLines.map((l, i) => ({
          account_id: l.account_id,
          debit_amount: l.debit_amount,
          credit_amount: l.credit_amount,
          description: l.description || undefined,
          sort_order: i,
        }));

        // Stok yang dipilih sebelum masuk mode multi-line ikut tersimpan.
        // Sebelumnya tautan ini hilang diam-diam saat ganti mode, sehingga
        // penjualan multi-line tidak pernah terhubung ke item katalognya.
        // Catatan: di mode multi-line user menulis sendiri baris kredit
        // persediaan, jadi stok TIDAK dikonversi ke HPP di sini (beda dengan
        // jalur single-line) — kalau tidak, cost basis akan terpotong dua kali.
        const mlMeta: Record<string, unknown> = {};
        if (selectedStockIds.length > 0) {
          mlMeta.sold_stock_ids = selectedStockIds;
          const soldItem = deriveCatalogItemFromStock(selectedStockIds, allTransactions);
          if (soldItem) mlMeta.catalog_item = soldItem;
        }

        savedTransaction = await createMultiLineTransaction({
          business_id: businessId,
          created_by: user.id,
          date,
          category,
          name,
          description: description || (selectedEntryType?.label ?? ''),
          notes: description || undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
          meta: Object.keys(mlMeta).length > 0 ? mlMeta : undefined,
          journal_lines: journalLines,
        });
      } else {
        // ── Single-line save ──
        // Convert selected stock to COGS first
        if (selectedStockIds.length > 0) {
          const cogsAccount = findCogsAccount(accounts);
          if (!cogsAccount) throw new Error(t.journalEntry.form.errNoCogsAccount);
          for (const txId of selectedStockIds) {
            await updateTransaction(txId, { debit_account_id: cogsAccount.id });
          }
        }

        const meta: Record<string, unknown> = {};
        if (selectedStockIds.length > 0) {
          meta.sold_stock_ids = selectedStockIds;
          // Bawa serta item katalog dari stok yang dilepas, supaya penjualan
          // ikut terbaca Asset Console (posisi berkurang, bukan cuma sisi beli).
          const soldItem = deriveCatalogItemFromStock(selectedStockIds, allTransactions);
          if (soldItem) meta.catalog_item = soldItem;
        }
        if (unitBreakdown && unitBreakdown.unit) {
          meta.unit_breakdown = unitBreakdown;
        }
        if (selectedEntryType) {
          meta.entry_type = {
            id: selectedEntryType.id,
            label: selectedEntryType.label,
            description: selectedEntryType.description,
          };
        }
        if (attachments.length > 0) {
          meta.attachments = attachments;
        }

        savedTransaction = await createTransaction({
          business_id: businessId,
          created_by: user.id,
          date,
          category,
          name,
          description: description || (debitAccount?.account_name ?? ''),
          amount,
          account: 'Double-entry transaction',
          debit_account_id: debitAccountId,
          credit_account_id: creditAccountId,
          is_double_entry: true,
          notes: description || undefined,
          meta: Object.keys(meta).length > 0 ? meta : undefined,
        });

        // Create recurring template if enabled (single-line only)
        if (recurringEnabled) {
          const nextDue = computeNextDueDate(date, recurringFrequency, recurringInterval);
          await createRecurringTransaction({
            business_id: businessId,
            name,
            description: description || (debitAccount?.account_name ?? ''),
            amount,
            category,
            account: 'Double-entry transaction',
            debit_account_id: debitAccountId,
            credit_account_id: creditAccountId,
            is_double_entry: true,
            frequency: recurringFrequency,
            interval_value: recurringInterval,
            next_due_date: nextDue,
            end_date: recurringEndDate || null,
            created_by: user.id,
          });
        }
      }

      // Reset form (keep entry type selected for quick multi-entry)
      setAmount(0);
      setDisplayAmount('');
      setName('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setSelectedStockIds([]);
      setUnitBreakdown(null);
      setShowBreakdown(false);
      setAttachments([]);
      setIsMultiLineMode(false);
      setMlLines([emptyLine(0), emptyLine(1)]);
      setMlDisplayDebit(['', '']);
      setMlDisplayCredit(['', '']);
      setRecurringEnabled(false);
      setRecurringEndDate('');
      setErrors({});

      if (savedTransaction) {
        const transactionId = savedTransaction.id;
        showTransactionSavedToast({
          message: t.journalEntry.form.savedToast,
          createdAt: savedTransaction.created_at,
          onOpenDetail: () => router.push(`/transactions?detail=${transactionId}`),
        });
      }

      // Refresh transactions list for inventory picker
      const txns = await getTransactions(businessId);
      setAllTransactions(txns);
    } catch (err: any) {
      setErrors({ submit: err.message || t.journalEntry.form.errSaveFailed });
    } finally {
      setSaving(false);
    }
  };

  // ─── render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen-dvh flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-8 py-6 flex-shrink-0">
        {/* Back button */}
        <button
          onClick={() => router.push('/transactions')}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
          title={t.journalEntry.form.backToTransactions}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t.nav.journalEntry}</h1>
            {activeBusiness && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{activeBusiness.business_name}</p>
            )}
          </div>

          {/* Pemisah */}
          <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

          {/* Menu navigation — Invoicing, Rekonsiliasi Bank, Tutup Buku */}
          <nav className="flex items-center">
            <button
              type="button"
              onClick={() => router.push('/invoices')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title={t.nav.invoice}
            >
              <FileText className="w-4 h-4" />
              {t.nav.invoice}
            </button>
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-0.5" />
            <button
              type="button"
              onClick={() => router.push('/reconciliation')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title={t.nav.bankReconciliation}
            >
              <Landmark className="w-4 h-4" />
              {t.nav.bankReconciliation}
            </button>
          </nav>
        </div>

        <div className="flex-1" />

        {/* Buat Invoice — buka modal langsung */}
        <button
          type="button"
          onClick={() => setShowInvoiceModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-sm font-semibold"
        >
          <FileText className="w-4 h-4" />
          {t.journalEntry.form.createInvoice}
        </button>
      </div>

      {/* Baris label — di LUAR area scroll kedua panel supaya ikut ter-pin
          bersama header halaman saat isi panel di-scroll. */}
      <div className="flex flex-shrink-0 pt-8 pb-3">
        <div className="w-72 flex-shrink-0 pl-8 pr-3">
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide h-5">
            {t.journalEntry.sectionLabel}
          </p>
        </div>
        <div className="flex-1 min-w-0 pl-3 pr-8">
          <p className="text-sm text-gray-500 dark:text-gray-400 h-5 truncate">
            {selectedEntryType?.description ?? ''}
          </p>
        </div>
      </div>

      {/* Main Content: 2-Panel Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Transaction Types */}
        <div className="w-72 overflow-y-auto scrollbar-hide flex-shrink-0">
          <div className="pl-8 pr-3 pb-6 space-y-4">
            {/* Jenis default + jenis tambahan pilihan user (satu daftar) */}
            <div className="space-y-2">
              {visibleEntryTypes.map((et) => (
                <EntryTypeCard
                  key={et.id}
                  entryType={et}
                  isSelected={selectedEntryType?.id === et.id}
                  onSelect={handleSelectEntryType}
                />
              ))}
            </div>

            {/* Tambah jenis — gaya dashed sama seperti tombol "Buat Invoice" */}
            <button
              type="button"
              onClick={() => setShowEntryTypePicker(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-indigo-300 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              {t.journalEntry.addEntryType}
            </button>
          </div>
        </div>

        {/* Right Panel: Form */}
        <div className="flex-1 overflow-y-auto flex flex-col min-w-0">
          {/* Form */}
          <div className="flex-1 pl-3 pr-8 pb-8">
            {/* Hak bagi hasil per pemilik — ditampilkan sebelum penarikan dicatat
                supaya user tidak perlu bolak-balik ke halaman SCE untuk tahu
                berapa yang boleh ditarik. Angkanya dari fungsi SCE yang sama. */}
            {selectedEntryType?.id === 'tarik_dividen' && (
              <div className="mb-4">
                <ShareholderEntitlementPanel
                  transactions={allTransactions}
                  accounts={accounts}
                  capital={activeBusiness?.capital_investment ?? 0}
                  onPickOwner={({ ownerName, dividendAccountId, remaining }) => {
                    setManualEntryOverride(true);
                    if (dividendAccountId) setDebitAccountId(dividendAccountId);
                    setAmount(remaining);
                    setDisplayAmount(remaining.toLocaleString('id-ID'));
                    setName(ownerName);
                    setErrors({});
                  }}
                />
              </div>
            )}

            {/* Pilih-dulu: daftar hutang/talangan outstanding (settle langsung) */}
            {showSettlementPicker && settlementSide && (
              <OutstandingSettlementPicker
                side={settlementSide}
                transactions={allTransactions}
                accounts={accounts}
                onSettled={refreshTransactions}
                onManualEntry={() => setManualEntryOverride(true)}
              />
            )}

            {/* Pilih-dulu: katalog produk/jasa (prefill form penjualan) */}
            {showCatalogPicker && (
              <CatalogQuickPicker
                items={sellableCatalogItems}
                onSelect={handleSelectCatalogItem}
                onManualEntry={() => setManualEntryOverride(true)}
              />
            )}

            <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 ${showEntryForm ? '' : 'hidden'}`}>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Item katalog terpilih — konteks untuk form penjualan */}
            {selectedCatalogItem && (
              <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20">
                <p className="text-sm text-primary-700 dark:text-primary-300 truncate">
                  {t.journalEntry.picker.fromCatalog}{' '}
                  <span className="font-semibold">{selectedCatalogItem.name}</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCatalogItem(null);
                    setManualEntryOverride(false);
                  }}
                  className="shrink-0 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {t.journalEntry.picker.changeItem}
                </button>
              </div>
            )}

            {/* Submit error */}
            {errors.submit && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-500 dark:text-red-300">{errors.submit}</p>
              </div>
            )}

            {/* Template selector — tersedia di mode single-line & multi-baris */}
            {templates.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTemplateDropdownOpen((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-sm text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <BookTemplate className="w-4 h-4" />
                    <span>{t.journalEntry.form.useTemplate}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${templateDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {templateDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                    {templates.map((tmpl) => (
                      <div
                        key={tmpl.id}
                        onClick={() => applyTemplate(tmpl)}
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{tmpl.name}</p>
                            {tmpl.journal_lines && tmpl.journal_lines.length >= 2 && (
                              <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300">
                                {t.journalEntry.form.templateLines(tmpl.journal_lines.length)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {t.categories[tmpl.category]}
                            {tmpl.default_amount ? ` · Rp ${tmpl.default_amount.toLocaleString('id-ID')}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTemplate(tmpl.id, e)}
                          className="ml-2 p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title={t.journalEntry.form.deleteTemplate}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Single-line mode (default) ── */}
            {!isMultiLineMode && (
              <>
                {/* Row 1: Amount + Date — dibuat sejajar dengan FloatingField Tanggal.
                    Meniru struktur FloatingField (label mengambang absolut + input
                    pt-5/pb-1.5) supaya garis bawah kedua field persis di garis yang
                    sama, dan nominal pakai ukuran teks normal (bukan text-2xl).
                    Khusus di form ini — komponen CurrencyInput tidak diubah. */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="pointer-events-none absolute left-0 top-5 z-10 origin-[0] -translate-y-5 scale-75 text-gray-500 dark:text-gray-400">
                      {t.journalEntry.form.amountRp}
                    </label>
                    <CurrencyInputWithCalculator
                      displayValue={displayAmount}
                      onChange={(numeric, formatted) => {
                        setDisplayAmount(formatted);
                        setAmount(numeric);
                        if (errors.amount) setErrors(p => { const n = { ...p }; delete n.amount; return n; });
                      }}
                      inputClassName="pt-5 pb-1.5"
                      colorVariant="primary"
                      error={errors.amount}
                      autoFocus
                    />
                  </div>

                  <div>
                    <FloatingField
                      label={t.common.date}
                      type="date"
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        if (errors.date) setErrors(p => { const n = { ...p }; delete n.date; return n; });
                      }}
                    />
                    {errors.date && (
                      <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.date}</p>
                    )}
                  </div>
                </div>

                {/* Unit Breakdown */}
                <UnitBreakdownSection
                  unitBreakdown={unitBreakdown}
                  showBreakdown={showBreakdown}
                  onToggle={handleToggleBreakdown}
                  onPriceChange={handleBreakdownPriceChange}
                  onQuantityChange={handleBreakdownQtyChange}
                  onUnitChange={handleBreakdownUnitChange}
                  onRemove={handleRemoveBreakdown}
                />

                {/* Row 2: Debit + Credit (Free Input - All Accounts) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <AccountDropdown
                      label={t.journalEntry.form.debitAccount}
                      accounts={accounts}
                      value={debitAccountId}
                      onChange={(id, _code) => {
                        setDebitAccountId(id);
                        if (errors.debit) setErrors(p => { const n = { ...p }; delete n.debit; return n; });
                      }}
                      placeholder={t.journalEntry.form.selectDebitAccount}
                      error={errors.debit}
                      required
                    />
                  </div>
                  <div>
                    <AccountDropdown
                      label={t.journalEntry.form.creditAccount}
                      accounts={accounts}
                      value={creditAccountId}
                      onChange={(id, _code) => {
                        setCreditAccountId(id);
                        if (errors.credit) setErrors(p => { const n = { ...p }; delete n.credit; return n; });
                      }}
                      placeholder={t.journalEntry.form.selectCreditAccount}
                      error={errors.credit}
                      required
                    />
                  </div>
                </div>

                {/* Debit/Credit visual preview */}
                {debitAccount && creditAccount && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                    <span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                      {t.journalEntry.form.debit}
                    </span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {debitAccount.account_code} {debitAccount.account_name}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 mx-1">→</span>
                    <span className="px-2 py-1 rounded bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-300 text-xs font-semibold">
                      {t.journalEntry.form.credit}
                    </span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {creditAccount.account_code} {creditAccount.account_name}
                    </span>
                  </div>
                )}

                {/* Inventory Picker */}
                {showInventoryPicker && (
                  <InventoryPicker
                    stockTransactions={stockTransactions}
                    selectedIds={selectedStockIds}
                    onToggle={handleToggleStock}
                  />
                )}

                {/* + Tambah Baris button — only for penjualan & pengeluaran */}
                {isMultiLineEligible && (
                  <button
                    type="button"
                    onClick={handleEnterMultiLine}
                    className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors border border-indigo-200 dark:border-indigo-700 rounded-lg px-3 py-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    {t.journalEntry.form.addLine}
                  </button>
                )}
              </>
            )}

            {/* ── Multi-line mode ── */}
            {isMultiLineMode && (
              <>
                {/* Date field in multi-line mode */}
                <div className="max-w-xs">
                  <FloatingField
                    label={t.common.date}
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      if (errors.date) setErrors(p => { const n = { ...p }; delete n.date; return n; });
                    }}
                  />
                  {errors.date && (
                    <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.date}</p>
                  )}
                </div>

                {/* Multi-line journal table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t.journalEntry.form.journalLines}
                    </label>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {t.journalEntry.form.debitMustEqualCredit}
                    </span>
                  </div>

                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-visible">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-8">#</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">{t.journalEntry.form.colAccount}</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-36">{t.journalEntry.form.colDebitRp}</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-36">{t.journalEntry.form.colCreditRp}</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">{t.common.description}</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {mlLines.map((line, idx) => {
                          return (
                            <tr key={idx} className="bg-white dark:bg-gray-900">
                              <td className="px-3 py-2 text-gray-400 dark:text-gray-500">{idx + 1}</td>
                              <td className="px-2 py-1.5 min-w-48">
                                <AccountDropdown
                                  label=""
                                  accounts={accounts}
                                  value={line.account_id || undefined}
                                  onChange={(accountId) => mlUpdateAccount(idx, accountId)}
                                  placeholder={t.journalEntry.form.selectAccount}
                                  error={errors[`ml_${idx}_account`]}
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={mlDisplayDebit[idx] ?? ''}
                                  onChange={(e) => mlUpdateDebit(idx, e.target.value.replace(/[^0-9.,]/g, ''))}
                                  className="input text-right text-sm py-1"
                                  placeholder="0"
                                />
                                {errors[`ml_${idx}_amount`] && (
                                  <p className="text-xs text-red-500 mt-0.5">{errors[`ml_${idx}_amount`]}</p>
                                )}
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={mlDisplayCredit[idx] ?? ''}
                                  onChange={(e) => mlUpdateCredit(idx, e.target.value.replace(/[^0-9.,]/g, ''))}
                                  className="input text-right text-sm py-1"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="text"
                                  value={line.description ?? ''}
                                  onChange={(e) => mlUpdateDescription(idx, e.target.value)}
                                  className="input text-sm py-1"
                                  placeholder={t.journalEntry.form.optionalPlaceholder}
                                />
                              </td>
                              <td className="px-1 py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => mlRemoveLine(idx)}
                                  disabled={mlLines.length <= 2}
                                  className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  title={t.journalEntry.form.deleteLine}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                        <tr>
                          <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                            TOTAL
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {mlTotalDebit.toLocaleString('id-ID')}
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {mlTotalCredit.toLocaleString('id-ID')}
                          </td>
                          <td colSpan={2} className="px-3 py-2">
                            {mlIsBalanced && mlTotalDebit > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                                <CheckCircle className="w-3.5 h-3.5" />
                                {t.journalEntry.form.balanced}
                              </span>
                            ) : mlTotalDebit > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {t.journalEntry.form.difference(Math.abs(mlDifference).toLocaleString('id-ID'))}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Multi-line balance error */}
                  {errors.ml_balance && (
                    <div className="mt-2 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-600 dark:text-red-400">{errors.ml_balance}</p>
                    </div>
                  )}

                  {/* + Tambah Baris & Batalkan Multi-Baris */}
                  <div className="mt-2 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={mlAddLine}
                      className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors border border-indigo-200 dark:border-indigo-700 rounded-lg px-3 py-1.5"
                    >
                      <PlusCircle className="w-4 h-4" />
                      {t.journalEntry.form.addLine}
                    </button>

                    {!showCancelConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowCancelConfirm(true)}
                        className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        {t.journalEntry.form.cancelMultiLine}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600 dark:text-gray-300">{t.journalEntry.form.exitMultiLineConfirm}</span>
                        <button
                          type="button"
                          onClick={handleExitMultiLine}
                          className="text-red-600 dark:text-red-400 font-medium hover:underline"
                        >
                          {t.common.yes}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCancelConfirm(false)}
                          className="text-gray-500 dark:text-gray-400 hover:underline"
                        >
                          {t.common.no}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Row 3: Name + Category */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <ContactAutocomplete
                  businessId={businessId ?? ''}
                  value={name}
                  onChange={(v) => {
                    setName(v);
                    if (errors.name) setErrors(p => { const n = { ...p }; delete n.name; return n; });
                  }}
                  className="input-underline"
                  floatingLabel={selectedEntryType!.nameLabel}
                  placeholder={selectedEntryType!.namePlaceholder}
                  onSaveAsContact={async (contactName) => {
                    if (!businessId || !user) return;
                    try {
                      await saveContactFromTransaction(
                        businessId,
                        contactName,
                        resolveContactTypeFromCategory(selectedEntryType!.suggestedCategory),
                        user.id
                      );
                    } catch (err) {
                      console.error('Failed to save contact:', err);
                    }
                  }}
                />
                {errors.name && (
                  <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <FloatingSelect
                  label={t.journalEntry.form.categoryLabel}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                  disabled={selectedEntryType!.lockCategory}
                >
                  {ALL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {`${t.categories[cat]} (${cat})`}
                    </option>
                  ))}
                </FloatingSelect>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {selectedEntryType!.lockCategory ? t.journalEntry.form.categoryLocked : t.journalEntry.form.categoryAuto}
                </p>
              </div>
            </div>

            {/* Category consistency warnings */}
            {categoryWarnings.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    {categoryWarnings.map((warning, i) => (
                      <p key={i} className="text-sm text-amber-500 dark:text-amber-300">{warning}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="label text-base font-semibold">
                {t.journalEntry.form.descriptionLabel}
                <span className="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">{t.journalEntry.form.optionalSuffix}</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input"
                rows={3}
                placeholder={t.journalEntry.form.descriptionPlaceholder}
              />
            </div>

            {/* Lampiran */}
            {businessId && (
              <div>
                <label className="label text-base font-semibold">
                  {t.journalEntry.form.attachmentsLabel}
                  <span className="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">{t.journalEntry.form.optionalSuffix}</span>
                </label>
                <FileUpload
                  businessId={businessId}
                  value={attachments}
                  onChange={setAttachments}
                  disabled={saving}
                />
              </div>
            )}

            {/* Save as Template — tersedia di mode single-line & multi-baris */}
            <div>
              {!saveTemplateMode ? (
                <button
                  type="button"
                  onClick={() => setSaveTemplateMode(true)}
                  className="flex items-center gap-1.5 text-xs text-indigo-500 dark:text-indigo-400 hover:underline"
                >
                  <BookTemplate className="w-3.5 h-3.5" />
                  {t.journalEntry.form.saveAsTemplate}
                </button>
              ) : (
                  <div className="flex items-center gap-2 p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700">
                    <BookTemplate className="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder={t.journalEntry.form.templateNamePlaceholder}
                      className="flex-1 text-sm bg-transparent outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveTemplate();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      disabled={!templateName.trim() || savingTemplate}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 disabled:opacity-40"
                    >
                      {savingTemplate ? t.common.saving : t.common.save}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSaveTemplateMode(false);
                        setTemplateName('');
                      }}
                      className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
            </div>

            {/* Recurring toggle — single-line only */}
            {!isMultiLineMode && (
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
                    {t.journalEntry.form.makeRecurring}
                  </span>
                </label>

                {recurringEnabled && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.journalEntry.form.frequency}</label>
                      <select
                        value={recurringFrequency}
                        onChange={(e) =>
                          setRecurringFrequency(e.target.value as 'weekly' | 'monthly' | 'yearly')
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      >
                        <option value="weekly">{t.journalEntry.form.weekly}</option>
                        <option value="monthly">{t.journalEntry.form.monthly}</option>
                        <option value="yearly">{t.journalEntry.form.yearly}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.journalEntry.form.every}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={52}
                          value={recurringInterval}
                          onChange={(e) =>
                            setRecurringInterval(Math.max(1, parseInt(e.target.value) || 1))
                          }
                          className="w-16 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {recurringFrequency === 'weekly'
                            ? t.journalEntry.form.weeksUnit
                            : recurringFrequency === 'monthly'
                              ? t.journalEntry.form.monthsUnit
                              : t.journalEntry.form.yearsUnit}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t.journalEntry.form.untilOptional}
                      </label>
                      <input
                        type="date"
                        value={recurringEndDate}
                        onChange={(e) => setRecurringEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                        placeholder={t.journalEntry.form.noLimit}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => router.push('/transactions')}
                className="btn-secondary flex-1"
                disabled={saving}
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                className="btn-primary-glow flex-1 flex items-center justify-center gap-2"
                disabled={saving || loadingAccounts || (isMultiLineMode && (!mlIsBalanced || mlTotalDebit === 0))}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    {t.common.saving}
                  </span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {t.journalEntry.form.saveTransaction}
                  </>
                )}
              </button>
            </div>
          </form>
            </div>
          </div>
        </div>
      </div>

      {/* Dividend entry mode picker — muncul saat user pilih akun Dividen */}
      <DividendEntryModeModal
        isOpen={showDividendModeModal}
        onClose={handleDividendModeCancel}
        onSelect={handleDividendModeSelect}
        selectedAccount={accounts.find(a => a.id === debitAccountId) ?? null}
        accounts={accounts}
      />

      {/* Picker jenis transaksi — pilih jenis tambahan yang ikut tampil di panel.
          Efeknya langsung (panel di belakang ikut berubah), jadi tidak ada
          tombol simpan; klik ulang kartu = melepasnya dari panel. */}
      <Modal
        isOpen={showEntryTypePicker}
        onClose={() => setShowEntryTypePicker(false)}
        title={t.journalEntry.entryTypePickerTitle}
        size="lg"
      >
        {extraEntryTypes.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
            {t.journalEntry.entryTypePickerEmpty}
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {t.journalEntry.entryTypePickerHint}
            </p>
            <div className="space-y-2">
              {extraEntryTypes.map((et) => {
                const isPinned = pinnedEntryTypeIds.includes(et.id);
                return (
                  <button
                    key={et.id}
                    type="button"
                    onClick={() => togglePinnedEntryType(et.id)}
                    aria-pressed={isPinned}
                    className={`w-full flex items-center gap-3 text-left p-3 rounded-xl border transition-colors ${
                      isPinned
                        ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <span className={isPinned ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}>
                      {et.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${isPinned ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {et.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{et.description}</div>
                    </div>
                    {isPinned ? (
                      <span className="flex items-center gap-1 flex-shrink-0 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                        <Check className="w-3.5 h-3.5" />
                        {t.journalEntry.entryTypeShown}
                      </span>
                    ) : (
                      <Plus className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Modal>

      {/* Create Invoice Modal — di-trigger dari button "Buat Invoice" di header */}
      <Modal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title={t.journalEntry.form.createInvoice}
      >
        <InvoiceForm
          onSubmit={handleCreateInvoice}
          onCancel={() => setShowInvoiceModal(false)}
          loading={invoiceSaving}
          defaultInvoiceNumber={nextInvoiceNumber}
          defaultDueDays={invoiceSettings?.default_due_days ?? 7}
          defaultTaxRate={invoiceSettings?.default_tax_rate ?? 11}
          defaultTaxType={invoiceSettings?.default_tax_type ?? 'none'}
          businessCategory={activeBusiness?.business_type}
        />
      </Modal>
    </div>
  );
}

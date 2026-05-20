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
import { getStockTransactions, findCogsAccount } from '@/lib/utils/inventoryHelper';
import { updateTransaction } from '@/lib/api/transactions';
import { InventoryPicker } from '@/components/transactions/InventoryPicker';
import { AccountDropdown } from '@/components/transactions/AccountDropdown';
import { ContactAutocomplete } from '@/components/transactions/ContactAutocomplete';
import { saveContactFromTransaction } from '@/lib/api/contacts';
import { validateCategoryConsistency } from '@/lib/accounting/validators/transactionValidator';
import { showTransactionSavedToast } from '@/lib/transactionToast';
import type { Account, AccountType, TransactionCategory, Transaction, UnitBreakdown, TransactionAttachment, JournalLineInput } from '@/types';
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
  ScanSearch,
  BookCheck,
  HandCoins,
  Receipt,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { CurrencyInputWithCalculator } from '@/components/ui/CurrencyInputWithCalculator';
import { UnitBreakdownSection } from '@/components/transactions/UnitBreakdownSection';
import { FileUpload } from '@/components/ui/FileUpload';

// ─── entry types ───────────────────────────────────────────────────────────

type EntryTypeId =
  | 'penjualan'
  | 'pengeluaran'
  | 'pinjaman'
  | 'bayar_hutang'
  | 'cicil_hutang'
  | 'suntik_modal'
  | 'tarik_dividen'
  | 'beban_terutang'
  | 'realisasi_pendapatan_dimuka'
  | 'reklasifikasi_hutang'
  | 'pendapatan_dimuka'
  | 'catat_talangan'
  | 'terima_kembali_talangan';

interface EntryType {
  id: EntryTypeId;
  label: string;
  description: string;
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
  /** Nama label for the "from" party */
  nameLabel: string;
  namePlaceholder: string;
}

/** Filter: only ASSET accounts that are talangan/advance (default_category=FIN or name match) */
function isTalanganAccount(acc: Account): boolean {
  if (acc.default_category === 'FIN') return true;
  return /talangan|advance|piutang talangan/i.test(acc.account_name);
}

const ENTRY_TYPES: EntryType[] = [
  {
    id: 'penjualan',
    label: 'Penjualan',
    description: 'Terima uang dari pelanggan',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'text-emerald-500 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-500',
    debitFilter: 'ASSET',
    creditFilter: 'REVENUE',
    defaultDebitType: 'ASSET',
    defaultCreditType: 'REVENUE',
    suggestedCategory: 'EARN',
    nameLabel: 'Nama Pelanggan',
    namePlaceholder: 'Siapa yang membayar?',
  },
  {
    id: 'pengeluaran',
    label: 'Pengeluaran',
    description: 'Bayar beban operasional',
    icon: <TrendingDown className="w-5 h-5" />,
    color: 'text-red-500 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-500',
    debitFilter: 'EXPENSE',
    creditFilter: 'ASSET',
    defaultDebitType: 'EXPENSE',
    defaultCreditType: 'ASSET',
    suggestedCategory: 'OPEX',
    nameLabel: 'Nama Vendor / Penerima',
    namePlaceholder: 'Dibayar ke siapa?',
  },
  {
    id: 'pinjaman',
    label: 'Terima Pinjaman',
    description: 'Uang masuk dari pinjaman',
    icon: <Landmark className="w-5 h-5" />,
    color: 'text-amber-500 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-500',
    debitFilter: 'ASSET',
    creditFilter: 'LIABILITY',
    defaultDebitType: 'ASSET',
    defaultCreditType: 'LIABILITY',
    suggestedCategory: 'FIN',
    nameLabel: 'Nama Pemberi Pinjaman',
    namePlaceholder: 'Bank / kreditur',
  },
  {
    id: 'bayar_hutang',
    label: 'Bayar Hutang',
    description: 'Lunasi kewajiban sepenuhnya',
    icon: <CreditCard className="w-5 h-5" />,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-500',
    debitFilter: 'LIABILITY',
    creditFilter: 'ASSET',
    defaultDebitType: 'LIABILITY',
    defaultCreditType: 'ASSET',
    suggestedCategory: 'FIN',
    nameLabel: 'Nama Kreditur',
    namePlaceholder: 'Bank / kreditur yang dibayar',
  },
  {
    id: 'cicil_hutang',
    label: 'Cicil Hutang',
    description: 'Bayar sebagian kewajiban',
    icon: <ArrowRightLeft className="w-5 h-5" />,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-500',
    debitFilter: 'LIABILITY',
    creditFilter: 'ASSET',
    defaultDebitType: 'LIABILITY',
    defaultCreditType: 'ASSET',
    suggestedCategory: 'FIN',
    nameLabel: 'Nama Kreditur',
    namePlaceholder: 'Bank / kreditur yang dicicil',
  },
  {
    id: 'suntik_modal',
    label: 'Suntik Modal',
    description: 'Pemilik menambah modal bisnis',
    icon: <PiggyBank className="w-5 h-5" />,
    color: 'text-purple-500 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-500',
    debitFilter: 'ASSET',
    creditFilter: 'EQUITY',
    defaultDebitType: 'ASSET',
    defaultCreditType: 'EQUITY',
    suggestedCategory: 'FIN',
    nameLabel: 'Nama Penyetor Modal',
    namePlaceholder: 'Nama pemilik / investor',
  },
  {
    id: 'tarik_dividen',
    label: 'Tarik Dividen',
    description: 'Pemilik mengambil keuntungan',
    icon: <Wallet className="w-5 h-5" />,
    color: 'text-indigo-500 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    borderColor: 'border-indigo-500',
    debitFilter: 'EQUITY',
    creditFilter: 'ASSET',
    defaultDebitType: 'EQUITY',
    defaultCreditType: 'ASSET',
    suggestedCategory: 'FIN',
    nameLabel: 'Nama Penerima',
    namePlaceholder: 'Nama pemilik / investor',
  },
  {
    id: 'beban_terutang',
    label: 'Beban Terutang',
    description: 'Catat beban yang belum dibayar (accrued expense)',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    borderColor: 'border-rose-500',
    debitFilter: 'EXPENSE',
    creditFilter: 'LIABILITY',
    defaultDebitType: 'EXPENSE',
    defaultCreditType: 'LIABILITY',
    suggestedCategory: 'OPEX',
    nameLabel: 'Nama Beban / Vendor',
    namePlaceholder: 'Contoh: PLN, Telkom, Gaji karyawan',
  },
  {
    id: 'realisasi_pendapatan_dimuka',
    label: 'Realisasi Pendapatan',
    description: 'Akui pendapatan dari uang muka yang sudah diterima',
    icon: <RotateCcw className="w-5 h-5" />,
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    borderColor: 'border-teal-500',
    debitFilter: 'LIABILITY',
    creditFilter: 'REVENUE',
    defaultDebitType: 'LIABILITY',
    defaultCreditType: 'REVENUE',
    suggestedCategory: 'EARN',
    nameLabel: 'Nama Pelanggan',
    namePlaceholder: 'Pelanggan yang sudah bayar di muka',
  },
  {
    id: 'reklasifikasi_hutang',
    label: 'Reklasifikasi Hutang',
    description: 'Pindahkan saldo antar akun hutang',
    icon: <Repeat className="w-5 h-5" />,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-900/20',
    borderColor: 'border-slate-500',
    debitFilter: 'LIABILITY',
    creditFilter: 'LIABILITY',
    defaultDebitType: 'LIABILITY',
    defaultCreditType: 'LIABILITY',
    suggestedCategory: 'FIN',
    nameLabel: 'Keterangan',
    namePlaceholder: 'Reklasifikasi dari ... ke ...',
  },
  {
    id: 'pendapatan_dimuka',
    label: 'Pendapatan Dimuka',
    description: 'Terima uang sebelum jasa/barang diserahkan',
    icon: <Clock className="w-5 h-5" />,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    borderColor: 'border-cyan-500',
    debitFilter: 'ASSET',
    creditFilter: 'LIABILITY',
    defaultDebitType: 'ASSET',
    defaultCreditType: 'LIABILITY',
    suggestedCategory: 'FIN',
    nameLabel: 'Nama Pelanggan',
    namePlaceholder: 'Pelanggan yang membayar di muka',
  },
  {
    id: 'catat_talangan',
    label: 'Catat Talangan',
    description: 'Bayar dulu untuk orang lain, akan ditagih kembali',
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
    nameLabel: 'Nama Penerima Talangan',
    namePlaceholder: 'Siapa yang ditalangi?',
  },
  {
    id: 'terima_kembali_talangan',
    label: 'Terima Kembali Talangan',
    description: 'Terima pembayaran kembali atas talangan yang diberikan',
    icon: <Receipt className="w-5 h-5" />,
    color: 'text-lime-600 dark:text-lime-400',
    bgColor: 'bg-lime-50 dark:bg-lime-900/20',
    borderColor: 'border-lime-500',
    debitFilter: 'ASSET',
    creditFilter: 'ASSET',
    creditSubFilter: isTalanganAccount,
    defaultDebitType: 'ASSET',
    defaultCreditType: 'ASSET',
    suggestedCategory: 'FIN',
    lockCategory: true,
    nameLabel: 'Nama Pembayar',
    namePlaceholder: 'Siapa yang membayar kembali?',
  },
];

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  EARN: 'Pendapatan (EARN)',
  OPEX: 'Beban Operasional (OPEX)',
  VAR: 'Beban Variabel (VAR)',
  CAPEX: 'Belanja Modal (CAPEX)',
  TAX: 'Pajak (TAX)',
  FIN: 'Keuangan (FIN)',
};

const ALL_CATEGORIES: TransactionCategory[] = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

// TODO: make default visible types user-configurable per business
const DEFAULT_VISIBLE_IDS: Set<EntryTypeId> = new Set([
  'penjualan',
  'pengeluaran',
  'catat_talangan',
  'terima_kembali_talangan',
  'suntik_modal',
  'tarik_dividen',
]);

const STORAGE_KEY_ENTRY_TYPES_EXPANDED = 'katalis_journal_entry_types_expanded';

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

  // Invoice modal — Buat Invoice di header
  const {
    saving: invoiceSaving,
    showAddModal: showInvoiceModal,
    setShowAddModal: setShowInvoiceModal,
    invoiceSettings,
    nextInvoiceNumber,
    handleCreateInvoice,
  } = useInvoices();

  // step state — initialize with first default entry type to show form by default
  const [selectedEntryType, setSelectedEntryType] = useState<EntryType | null>(() => {
    return ENTRY_TYPES.find(et => et.id === 'penjualan') || null;
  });

  // dividend entry mode (only relevant when selectedEntryType.id === 'tarik_dividen')
  const [dividendEntryMode, setDividendEntryMode] = useState<DividendEntryMode | null>(null);
  const [showDividendModeModal, setShowDividendModeModal] = useState(false);

  // entry type grid expand/collapse — persisted to localStorage
  const [entryTypesExpanded, setEntryTypesExpanded] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(STORAGE_KEY_ENTRY_TYPES_EXPANDED) === 'true'; } catch { return false; }
  });
  const toggleEntryTypesExpanded = () => {
    setEntryTypesExpanded(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY_ENTRY_TYPES_EXPANDED, String(next)); } catch { /* noop */ }
      return next;
    });
  };

  const defaultEntryTypes = ENTRY_TYPES.filter(et => DEFAULT_VISIBLE_IDS.has(et.id));
  const extraEntryTypes = ENTRY_TYPES.filter(et => !DEFAULT_VISIBLE_IDS.has(et.id));

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
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // fetch accounts + transactions
  useEffect(() => {
    if (!businessId) return;
    async function fetchData() {
      try {
        const [accs, txns] = await Promise.all([
          getAccounts(businessId!),
          getTransactions(businessId!),
        ]);
        setAccounts(accs);
        setAllTransactions(txns);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoadingAccounts(false);
      }
    }
    fetchData();
  }, [businessId]);

  // derived
  const cashAccount = useMemo(() => findDefaultCashAccount(accounts), [accounts]);

  const dividendPayableAccount = useMemo(() => findDividendPayableAccount(accounts), [accounts]);

  // Auto-set default accounts & category when entry type is selected
  const handleSelectEntryType = useCallback((entryType: EntryType) => {
    setSelectedEntryType(entryType);
    setDividendEntryMode(null);
    setErrors({});

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

  /** Get filtered accounts for a multi-line row based on entry type */
  const getMlAccountsForRow = (side: 'debit' | 'credit'): Account[] => {
    if (!selectedEntryType) return accounts;
    if (selectedEntryType.id === 'penjualan') {
      // Debit rows → ASSET or EXPENSE (komisi OTA, biaya bank, diskon penjualan)
      // Credit rows → REVENUE only
      return side === 'debit'
        ? accounts.filter(a => a.account_type === 'ASSET' || a.account_type === 'EXPENSE')
        : accounts.filter(a => a.account_type === 'REVENUE');
    }
    if (selectedEntryType.id === 'pengeluaran') {
      // Debit rows → EXPENSE or ASSET; Credit rows → ASSET or LIABILITY
      return side === 'debit'
        ? accounts.filter(a => a.account_type === 'EXPENSE' || a.account_type === 'ASSET')
        : accounts.filter(a => a.account_type === 'ASSET' || a.account_type === 'LIABILITY');
    }
    if (selectedEntryType.id === 'pinjaman') {
      // Debit rows → ASSET or EXPENSE (biaya layanan, admin fee, provisi)
      // Credit rows → LIABILITY only
      return side === 'debit'
        ? accounts.filter(a => a.account_type === 'ASSET' || a.account_type === 'EXPENSE')
        : accounts.filter(a => a.account_type === 'LIABILITY');
    }
    return accounts;
  };

  /** Determine which side a line account should be filtered for */
  const getMlLineSide = (line: MultiLineLine): 'debit' | 'credit' => {
    if (line.debit_amount > 0) return 'debit';
    if (line.credit_amount > 0) return 'credit';
    // Default: infer from account type if set
    if (line.account_id) {
      const acc = accounts.find(a => a.id === line.account_id);
      if (acc) {
        if (acc.account_type === 'REVENUE' || acc.account_type === 'LIABILITY') return 'credit';
        if (acc.account_type === 'EXPENSE') return 'debit';
      }
    }
    return 'debit'; // default
  };

  // ─── handlers ──────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'Nama harus diisi';
    if (!date) newErrors.date = 'Tanggal harus diisi';

    if (isMultiLineMode) {
      // Multi-line validation
      mlLines.forEach((line, idx) => {
        if (!line.account_id) newErrors[`ml_${idx}_account`] = 'Pilih akun';
        if (line.debit_amount === 0 && line.credit_amount === 0) {
          newErrors[`ml_${idx}_amount`] = 'Masukkan jumlah debit atau kredit';
        }
      });
      if (mlTotalDebit === 0) {
        newErrors.ml_balance = 'Jumlah transaksi tidak boleh 0';
      } else if (!mlIsBalanced) {
        newErrors.ml_balance = `Jurnal tidak seimbang. Selisih: Rp ${Math.abs(mlDifference).toLocaleString('id-ID')}`;
      }
    } else {
      // Single-line validation
      if (amount <= 0) newErrors.amount = 'Jumlah harus lebih dari 0';
      if (!debitAccountId) newErrors.debit = 'Akun debit harus dipilih';
      if (!creditAccountId) newErrors.credit = 'Akun kredit harus dipilih';
      if (debitAccountId && creditAccountId && debitAccountId === creditAccountId) {
        newErrors.credit = 'Akun debit dan kredit tidak boleh sama';
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

        savedTransaction = await createMultiLineTransaction({
          business_id: businessId,
          created_by: user.id,
          date,
          category,
          name,
          description: description || (selectedEntryType?.label ?? ''),
          notes: description || undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
          journal_lines: journalLines,
        });
      } else {
        // ── Single-line save ──
        // Convert selected stock to COGS first
        if (selectedStockIds.length > 0) {
          const cogsAccount = findCogsAccount(accounts);
          if (!cogsAccount) throw new Error('Tidak ada akun HPP/Beban yang aktif.');
          for (const txId of selectedStockIds) {
            await updateTransaction(txId, { debit_account_id: cogsAccount.id });
          }
        }

        const meta: Record<string, unknown> = {};
        if (selectedStockIds.length > 0) {
          meta.sold_stock_ids = selectedStockIds;
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
      setErrors({});

      if (savedTransaction) {
        const transactionId = savedTransaction.id;
        showTransactionSavedToast({
          message: 'Transaksi berhasil disimpan',
          createdAt: savedTransaction.created_at,
          onOpenDetail: () => router.push(`/transactions?detail=${transactionId}`),
        });
      }

      // Refresh transactions list for inventory picker
      const txns = await getTransactions(businessId);
      setAllTransactions(txns);
    } catch (err: any) {
      setErrors({ submit: err.message || 'Gagal menyimpan transaksi' });
    } finally {
      setSaving(false);
    }
  };

  // ─── render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-8 py-6 flex-shrink-0">
        {/* Back button */}
        <button
          onClick={() => router.push('/transactions')}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
          title="Kembali ke Transaksi"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Journal Entry</h1>
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
              title="Invoicing"
            >
              <FileText className="w-4 h-4" />
              Invoicing
            </button>
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-0.5" />
            <button
              type="button"
              onClick={() => router.push('/reconciliation')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Rekonsiliasi Bank"
            >
              <ScanSearch className="w-4 h-4" />
              Rekonsiliasi Bank
            </button>
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-0.5" />
            <button
              type="button"
              onClick={() => router.push('/closing-entry')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Tutup Buku"
            >
              <BookCheck className="w-4 h-4" />
              Tutup Buku
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
          Buat Invoice
        </button>
      </div>

      {/* Main Content: 2-Panel Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Transaction Types */}
        <div className="w-72 overflow-y-auto flex-shrink-0">
          <div className="pl-8 pr-3 pt-8 pb-6 space-y-4">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide h-5">
              Jenis Transaksi
            </p>

            {/* Default visible entry types */}
            <div className="space-y-2">
              {defaultEntryTypes.map((et) => {
                const isSelected = selectedEntryType?.id === et.id;
                return (
                  <button
                    key={et.id}
                    type="button"
                    onClick={() => handleSelectEntryType(et)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 dark:border-indigo-400'
                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <span className={isSelected ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}>
                      {et.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {et.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{et.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Expandable extra entry types */}
            {entryTypesExpanded && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 space-y-2">
                {extraEntryTypes.map((et) => {
                  const isSelected = selectedEntryType?.id === et.id;
                  return (
                    <button
                      key={et.id}
                      type="button"
                      onClick={() => handleSelectEntryType(et)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 dark:border-indigo-400'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className={isSelected ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}>
                        {et.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                          {et.label}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{et.description}</div>
                      </div>
                    </button>
                  );
                })}

              </div>
            )}

            {/* Toggle button */}
            <button
              type="button"
              onClick={toggleEntryTypesExpanded}
              className="w-full mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors py-2"
            >
              {entryTypesExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Sembunyikan
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Tampilkan Lainnya
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Panel: Form */}
        <div className="flex-1 overflow-y-auto flex flex-col min-w-0">
          {/* Form */}
          <div className="flex-1 pl-3 pr-8 pt-8 pb-8">
            {/* Entry type description — sejajar dengan label "Jenis Transaksi" di kiri */}
            {selectedEntryType && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 h-5">
                {selectedEntryType.description}
              </p>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Submit error */}
            {errors.submit && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-500 dark:text-red-300">{errors.submit}</p>
              </div>
            )}

            {/* ── Single-line mode (default) ── */}
            {!isMultiLineMode && (
              <>
                {/* Row 1: Amount + Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <CurrencyInputWithCalculator
                      label="Jumlah (Rp)"
                      value={amount}
                      displayValue={displayAmount}
                      onChange={(numeric, formatted) => {
                        setDisplayAmount(formatted);
                        setAmount(numeric);
                        if (errors.amount) setErrors(p => { const n = { ...p }; delete n.amount; return n; });
                      }}
                      inputClassName="text-2xl font-bold"
                      colorVariant="primary"
                      error={errors.amount}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="label text-base font-semibold">Tanggal</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        if (errors.date) setErrors(p => { const n = { ...p }; delete n.date; return n; });
                      }}
                      className="input"
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
                      label="Akun Debit"
                      accounts={accounts}
                      value={debitAccountId}
                      onChange={(id, _code) => {
                        setDebitAccountId(id);
                        if (errors.debit) setErrors(p => { const n = { ...p }; delete n.debit; return n; });
                      }}
                      placeholder="Pilih akun debit..."
                      error={errors.debit}
                      required
                    />
                  </div>
                  <div>
                    <AccountDropdown
                      label="Akun Kredit"
                      accounts={accounts}
                      value={creditAccountId}
                      onChange={(id, _code) => {
                        setCreditAccountId(id);
                        if (errors.credit) setErrors(p => { const n = { ...p }; delete n.credit; return n; });
                      }}
                      placeholder="Pilih akun kredit..."
                      error={errors.credit}
                      required
                    />
                  </div>
                </div>

                {/* Debit/Credit visual preview */}
                {debitAccount && creditAccount && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                    <span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                      Debit
                    </span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {debitAccount.account_code} {debitAccount.account_name}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 mx-1">→</span>
                    <span className="px-2 py-1 rounded bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-300 text-xs font-semibold">
                      Kredit
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
                    Tambah Baris
                  </button>
                )}
              </>
            )}

            {/* ── Multi-line mode ── */}
            {isMultiLineMode && (
              <>
                {/* Date field in multi-line mode */}
                <div className="max-w-xs">
                  <label className="label text-base font-semibold">Tanggal</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      if (errors.date) setErrors(p => { const n = { ...p }; delete n.date; return n; });
                    }}
                    className="input"
                  />
                  {errors.date && (
                    <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errors.date}</p>
                  )}
                </div>

                {/* Multi-line journal table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Baris Jurnal
                    </label>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Total Debit harus = Total Kredit
                    </span>
                  </div>

                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-visible">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-8">#</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Akun</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-36">Debit (Rp)</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-36">Kredit (Rp)</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Keterangan</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {mlLines.map((line, idx) => {
                          const side = getMlLineSide(line);
                          return (
                            <tr key={idx} className="bg-white dark:bg-gray-900">
                              <td className="px-3 py-2 text-gray-400 dark:text-gray-500">{idx + 1}</td>
                              <td className="px-2 py-1.5 min-w-48">
                                <AccountDropdown
                                  label=""
                                  accounts={accounts}
                                  value={line.account_id || undefined}
                                  onChange={(accountId) => mlUpdateAccount(idx, accountId)}
                                  placeholder="Pilih akun"
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
                                  placeholder="Opsional"
                                />
                              </td>
                              <td className="px-1 py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => mlRemoveLine(idx)}
                                  disabled={mlLines.length <= 2}
                                  className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  title="Hapus baris"
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
                                Jurnal seimbang
                              </span>
                            ) : mlTotalDebit > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Selisih: Rp {Math.abs(mlDifference).toLocaleString('id-ID')}
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
                      Tambah Baris
                    </button>

                    {!showCancelConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowCancelConfirm(true)}
                        className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        Batalkan Multi-Baris
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600 dark:text-gray-300">Kembali ke mode biasa? Baris tambahan akan dihapus.</span>
                        <button
                          type="button"
                          onClick={handleExitMultiLine}
                          className="text-red-600 dark:text-red-400 font-medium hover:underline"
                        >
                          Ya
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCancelConfirm(false)}
                          className="text-gray-500 dark:text-gray-400 hover:underline"
                        >
                          Tidak
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
                <label className="label text-base font-semibold">{selectedEntryType!.nameLabel}</label>
                <ContactAutocomplete
                  businessId={businessId ?? ''}
                  value={name}
                  onChange={(v) => {
                    setName(v);
                    if (errors.name) setErrors(p => { const n = { ...p }; delete n.name; return n; });
                  }}
                  placeholder={selectedEntryType!.namePlaceholder}
                  onSaveAsContact={async (contactName) => {
                    if (!businessId || !user) return;
                    try {
                      const contactType = selectedEntryType!.suggestedCategory === 'EARN' ? 'customer'
                        : ['OPEX', 'VAR', 'CAPEX', 'TAX'].includes(selectedEntryType!.suggestedCategory) ? 'vendor'
                        : 'other';
                      await saveContactFromTransaction(businessId, contactName, contactType, user.id);
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
                <label className="label text-base font-semibold">
                  Kategori
                  <span className="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">
                    {selectedEntryType!.lockCategory ? '(terkunci)' : '(otomatis terdeteksi)'}
                  </span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                  className={`input ${selectedEntryType!.lockCategory ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                  disabled={selectedEntryType!.lockCategory}
                >
                  {ALL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
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
                Deskripsi
                <span className="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">(opsional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input"
                rows={3}
                placeholder="Catatan atau penjelasan tambahan..."
              />
            </div>

            {/* Lampiran */}
            {businessId && (
              <div>
                <label className="label text-base font-semibold">
                  Lampiran
                  <span className="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">(opsional)</span>
                </label>
                <FileUpload
                  businessId={businessId}
                  value={attachments}
                  onChange={setAttachments}
                  disabled={saving}
                />
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
                Batal
              </button>
              <button
                type="submit"
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                disabled={saving || loadingAccounts || (isMultiLineMode && (!mlIsBalanced || mlTotalDebit === 0))}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Menyimpan...
                  </span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Simpan Transaksi
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

      {/* Create Invoice Modal — di-trigger dari button "Buat Invoice" di header */}
      <Modal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title="Buat Invoice"
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

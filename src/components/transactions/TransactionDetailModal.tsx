'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import type { Transaction, Account, AuditLog, Contact } from '@/types';
import type { TransactionFormData } from '@/components/transactions/TransactionForm';
import { CATEGORY_LABELS } from '@/lib/calculations';
import { CATEGORY_BADGE_CLASSES } from '@/lib/categoryColors';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { getProfileName } from '@/lib/api/profiles';
import { getRecordAuditHistory, getFieldChanges, formatFieldName, formatAuditValue } from '@/lib/api/audit';
import {
  detectMatchingPrincipleWarning,
  isReceivableTransaction,
  isSettled,
  isPartiallySettled,
  getOutstandingAmount,
  getPartialSettlementIds,
  isDividendDeclaration,
  isDividendSettled,
  getDividendOutstanding,
  getDividendPartialSettlementIds,
} from '@/lib/accounting/guidance';
import { findDefaultCashAccount } from '@/lib/utils/quickTransactionHelper';
import { AlertTriangle, Info, X, CheckCircle2, Banknote, FileText, Download, ExternalLink, Link2, ChevronDown, History, Contact as ContactIcon } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { updateTransaction } from '@/lib/api/transactions';
import { CurrencyInputWithCalculator } from '@/components/ui/CurrencyInputWithCalculator';
import { formatFileSize, isImageType } from '@/lib/storage/attachments';

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  onPost?: (id: string) => void;
  accounts?: Account[];
  allTransactions?: Transaction[];
  onCreateFollowUp?: (prefillData: Partial<TransactionFormData>) => void;
  onTransactionUpdated?: (transaction: Transaction) => void;
  allTags?: string[];
  onSettleReceivable?: (transaction: Transaction) => void;
  onPartialSettleReceivable?: (transaction: Transaction, amount: number) => Promise<void>;
  onSettleDividend?: (transaction: Transaction) => void;
  onPartialSettleDividend?: (transaction: Transaction, amount: number) => Promise<void>;
  settleLoading?: boolean;
  onShowRelatedTransaction?: (transaction: Transaction) => void;
  contacts?: Contact[];
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

const CATEGORY_COLORS = CATEGORY_BADGE_CLASSES;

const STOCK_COLOR = 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300';

const ACCOUNT_TYPE_BG: Record<string, string> = {
  ASSET: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  LIABILITY: 'bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-300',
  EQUITY: 'bg-purple-50 dark:bg-purple-900/20 text-purple-500 dark:text-purple-300',
  REVENUE: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  EXPENSE: 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-300',
};

function isInventoryTransaction(transaction: Transaction): boolean {
  const debitCode = transaction.debit_account?.account_code || '';
  const debitName = transaction.debit_account?.account_name?.toLowerCase() || '';
  return transaction.category === 'VAR' && (
    debitCode.startsWith('13') ||
    debitName.includes('inventory') ||
    debitName.includes('persediaan')
  );
}


export function TransactionDetailModal({
  transaction,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onPost,
  accounts,
  allTransactions,
  onCreateFollowUp,
  onTransactionUpdated,
  allTags = [],
  onSettleReceivable,
  onPartialSettleReceivable,
  onSettleDividend,
  onPartialSettleDividend,
  settleLoading = false,
  onShowRelatedTransaction,
  contacts,
  onNavigatePrev,
  onNavigateNext,
  hasPrev = false,
  hasNext = false,
}: TransactionDetailModalProps) {
  const { t } = useLanguage();

  const ACCOUNT_TYPE_LABEL: Record<string, string> = {
    ASSET: t.generalLedger.asset,
    LIABILITY: t.generalLedger.liability,
    EQUITY: t.generalLedger.equityLabel,
    REVENUE: t.generalLedger.revenueLabel,
    EXPENSE: t.generalLedger.expense,
  };

  const getNameLabel = (category: string): string => {
    switch (category) {
      case 'EARN':
        return t.transactionDetail.nameLabelCustomer;
      case 'OPEX':
      case 'VAR':
      case 'CAPEX':
        return t.transactionDetail.nameLabelVendor;
      case 'TAX':
        return t.transactionDetail.nameLabelTaxAuthority;
      case 'FIN':
        return t.transactionDetail.nameLabelRelatedParty;
      default:
        return t.transactionDetail.nameLabelDefault;
    }
  };

  const getAccountDisplay = (tx: Transaction): string => {
    if (tx.is_double_entry && (tx.debit_account || tx.credit_account)) {
      if (tx.category === 'EARN') {
        const accountName = tx.debit_account?.account_name || 'Unknown';
        return t.transactionDetail.incomingTo.replace('{account}', accountName);
      } else {
        const accountName = tx.credit_account?.account_name || 'Unknown';
        return t.transactionDetail.outgoingFrom.replace('{account}', accountName);
      }
    }
    if (tx.category === 'EARN') {
      return t.transactionDetail.incomingTo.replace('{account}', tx.account || '');
    } else {
      return t.transactionDetail.outgoingFrom.replace('{account}', tx.account || '');
    }
  };

  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [loadingCreator, setLoadingCreator] = useState(false);
  const [updaterName, setUpdaterName] = useState<string | null>(null);
  const [loadingUpdater, setLoadingUpdater] = useState(false);
  const [auditHistory, setAuditHistory] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [showAuditHistory, setShowAuditHistory] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [warningExpanded, setWarningExpanded] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [savingTag, setSavingTag] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);
  const [showPartialInput, setShowPartialInput] = useState(false);
  const [partialAmount, setPartialAmount] = useState(0);
  const [partialDisplayAmount, setPartialDisplayAmount] = useState('');
  const [partialLoading, setPartialLoading] = useState(false);
  const [partialError, setPartialError] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const tagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    return allTags.filter(
      (t) => !tags.includes(t) && (q === '' || t.toLowerCase().includes(q))
    );
  }, [allTags, tags, tagInput]);

  // Sync tags from transaction meta
  useEffect(() => {
    setTags(transaction?.meta?.tags ?? []);
    setTagInput('');
    setShowSettleConfirm(false);
    setShowPartialInput(false);
    setPartialAmount(0);
    setPartialDisplayAmount('');
    setPartialError('');
  }, [transaction?.id]);

  const saveTags = async (newTags: string[], prevTags: string[]) => {
    if (!transaction) return;
    setSavingTag(true);
    try {
      const updated = await updateTransaction(transaction.id, {
        meta: { ...transaction.meta, tags: newTags },
      });
      // Merge updated meta back, preserving joined account fields
      onTransactionUpdated?.({ ...transaction, ...updated, debit_account: transaction.debit_account, credit_account: transaction.credit_account });
    } catch {
      setTags(prevTags); // rollback
    } finally {
      setSavingTag(false);
    }
  };

  const handleAddTag = async () => {
    const trimmed = tagInput.trim();
    if (!trimmed || !transaction) return;
    if (tags.includes(trimmed)) {
      setTagInput('');
      return;
    }
    const prev = tags;
    const newTags = [...tags, trimmed];
    setTags(newTags);
    setTagInput('');
    await saveTags(newTags, prev);
  };

  const handleRemoveTag = async (tag: string) => {
    if (!transaction) return;
    const prev = tags;
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);
    await saveTags(newTags, prev);
  };

  // Reset dismiss/expand state when transaction changes
  useEffect(() => {
    setWarningDismissed(false);
    setWarningExpanded(false);
  }, [transaction?.id]);

  // Keyboard navigation: ArrowLeft = prev, ArrowRight = next
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrev && onNavigatePrev) {
        e.preventDefault();
        onNavigatePrev();
      } else if (e.key === 'ArrowRight' && hasNext && onNavigateNext) {
        e.preventDefault();
        onNavigateNext();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, hasPrev, hasNext, onNavigatePrev, onNavigateNext]);

  // Matching Principle warning detection
  const matchingWarning = useMemo(() => {
    if (!transaction || !accounts || accounts.length === 0) return null;
    return detectMatchingPrincipleWarning(transaction, accounts);
  }, [transaction, accounts]);

  // Look up sold stock transactions from meta.sold_stock_ids
  const soldStockTransactions = useMemo(() => {
    if (!transaction?.meta?.sold_stock_ids || !allTransactions) return [];
    const soldIds = new Set(transaction.meta.sold_stock_ids);
    return allTransactions.filter((t) => soldIds.has(t.id));
  }, [transaction?.meta?.sold_stock_ids, allTransactions]);

  // Only show warning if EARN transaction has no sold stock linked (user skipped InventoryPicker)
  const showWarning = matchingWarning && !warningDismissed && !!onCreateFollowUp
    && (!transaction?.meta?.sold_stock_ids || transaction.meta.sold_stock_ids.length === 0);

  const handleCreateCOGSEntry = useCallback(() => {
    if (!matchingWarning || !transaction || !onCreateFollowUp) return;

    const prefillData: Partial<TransactionFormData> = {
      category: 'VAR' as const,
      date: transaction.date,
      name: `COGS untuk: ${transaction.name}`,
      description: `HPP untuk transaksi: ${transaction.name}`,
      debit_account_id: matchingWarning.cogsAccount?.id,
      credit_account_id: matchingWarning.inventoryAccount.id,
      is_double_entry: true,
      amount: 0,
      account: '',
    };

    onCreateFollowUp(prefillData);
  }, [matchingWarning, transaction, onCreateFollowUp]);

  useEffect(() => {
    if (transaction?.created_by) {
      setLoadingCreator(true);
      getProfileName(transaction.created_by)
        .then((name) => setCreatorName(name))
        .finally(() => setLoadingCreator(false));
    }
  }, [transaction?.created_by]);

  // Fetch updated_by user name
  useEffect(() => {
    if (transaction?.updated_by && transaction.updated_by !== transaction.created_by) {
      setLoadingUpdater(true);
      getProfileName(transaction.updated_by)
        .then((name) => setUpdaterName(name))
        .finally(() => setLoadingUpdater(false));
    } else {
      setUpdaterName(null);
    }
  }, [transaction?.updated_by, transaction?.created_by]);

  // Fetch audit history
  useEffect(() => {
    if (transaction?.id && showAuditHistory) {
      setLoadingAudit(true);
      getRecordAuditHistory('transactions', transaction.id)
        .then((history) => setAuditHistory(history))
        .catch((error) => {
          console.error('Failed to load audit history:', error);
          setAuditHistory([]);
        })
        .finally(() => setLoadingAudit(false));
    }
  }, [transaction?.id, showAuditHistory]);

  if (!transaction) return null;

  const isDraft = transaction.status === 'draft';
  const showActions = onEdit || onDelete || (onPost && isDraft);

  const actionButtons = showActions ? (
    <div className="flex gap-3">
      {onPost && isDraft && (
        <button
          onClick={() => onPost(transaction.id)}
          className="btn-outline flex-1 flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          {t.transactionDetail.postBtn}
        </button>
      )}
      {onEdit && (
        <button
          onClick={() => {
            onClose();
            // Tunggu animasi close detail modal selesai sebelum membuka form edit
            // agar transisi terasa mulus, tanpa blink dua modal yang saling tabrakan.
            setTimeout(() => onEdit(transaction), 200);
          }}
          className="btn-secondary flex-1 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          {t.transactionDetail.editBtn}
        </button>
      )}
      {onDelete && (
        <button
          onClick={() => {
            onClose();
            onDelete(transaction);
          }}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-xl border-2 border-red-500 text-red-500 dark:text-red-400 dark:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          {t.transactionDetail.deleteBtn}
        </button>
      )}
    </div>
  ) : undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div>
          <div>{t.transactionDetail.title}</div>
          {transaction.transaction_number && (
            <div className="text-xs font-mono font-normal text-gray-400 dark:text-gray-500 mt-0.5">
              #{transaction.transaction_number}
            </div>
          )}
        </div>
      }
      footer={actionButtons}
      sideNavPrev={onNavigatePrev ? { onClick: onNavigatePrev, disabled: !hasPrev, title: 'Transaksi sebelumnya (←)' } : undefined}
      sideNavNext={onNavigateNext ? { onClick: onNavigateNext, disabled: !hasNext, title: 'Transaksi berikutnya (→)' } : undefined}
    >
      <div className="space-y-6">
        {/* Matching Principle Warning — expanded panel */}
        {showWarning && matchingWarning && warningExpanded && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <AlertTriangle className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {matchingWarning.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {matchingWarning.body}
                  </p>
                  <div className="mt-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md font-mono text-xs text-gray-600 dark:text-gray-300">
                    {matchingWarning.journalHint}
                  </div>
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 italic">
                    {t.transactionDetail.cogsAmountHint}
                  </p>
                  <button
                    onClick={handleCreateCOGSEntry}
                    className="mt-3 px-3 py-1.5 bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {t.transactionDetail.createCogsEntry}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setWarningExpanded(false)}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                aria-label={t.transactionDetail.closeAria}
              >
                <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </button>
            </div>
          </div>
        )}

        {/* Header with Category Badge, Status, and Amount */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
          {isInventoryTransaction(transaction) ? (
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${STOCK_COLOR}`}>
              {t.transactionDetail.stock}
            </span>
          ) : (
            <div className="relative group inline-flex items-center gap-1.5">
              <span
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${transaction.meta?.settlement_of_transaction_id ? CATEGORY_COLORS['SETTLE'] : CATEGORY_COLORS[transaction.category]}`}
              >
                {transaction.meta?.settlement_of_transaction_id ? t.arAp.settlementBadge : CATEGORY_LABELS[transaction.category]}
              </span>
              {transaction.meta?.entry_type && (
                <>
                  <Info className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                  <div className="absolute left-0 top-full mt-1.5 z-50 hidden group-hover:block">
                    <div className="bg-gray-900 dark:bg-gray-700 text-white rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                      <p className="text-sm font-semibold">{transaction.meta.entry_type.label}</p>
                      <p className="text-xs text-gray-300 dark:text-gray-400">{transaction.meta.entry_type.description}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {isDraft ? (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
              {t.transactionDetail.draft.toUpperCase()}
            </span>
          ) : (
            <div className="relative group inline-flex items-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 cursor-help" />
              <div className="absolute left-0 top-full mt-1.5 z-50 hidden group-hover:block whitespace-nowrap">
                <div className="bg-gray-900 dark:bg-gray-700 text-white rounded-lg px-3 py-2 shadow-lg">
                  <p className="text-xs font-semibold">{t.transactionDetail.posted.toUpperCase()}</p>
                </div>
              </div>
            </div>
          )}
          </div>
          <div className="text-right flex items-center gap-1.5 justify-end">
            {showWarning && matchingWarning && !warningExpanded && (
              <button
                onClick={() => setWarningExpanded(true)}
                title={matchingWarning.title}
                className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-500 text-gray-400 dark:text-gray-500 hover:border-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors flex items-center justify-center flex-shrink-0"
              >
                <span className="text-[10px] font-bold leading-none">!</span>
              </button>
            )}
            <p className={`text-2xl font-bold ${
              transaction.category === 'EARN'
                ? 'text-emerald-500 dark:text-emerald-400'
                : 'text-gray-900 dark:text-gray-100'
            }`}>
              {formatCurrency(transaction.amount)}
            </p>
          </div>
        </div>

        {/* Unit Breakdown */}
        {transaction.meta?.unit_breakdown && (
          <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 dark:text-gray-400">{t.transactionDetail.pricePerUnit}</span>
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                Rp {transaction.meta.unit_breakdown.price_per_unit.toLocaleString('id-ID')}
              </span>
            </div>
            <span className="text-gray-300 dark:text-gray-600">&times;</span>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 dark:text-gray-400">{t.transactionDetail.quantity}</span>
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                {transaction.meta.unit_breakdown.quantity.toLocaleString('id-ID')}
              </span>
            </div>
            {transaction.meta.unit_breakdown.unit && (
              <span className="ml-auto px-2 py-0.5 bg-indigo-50 dark:bg-indigo-50 text-indigo-500 dark:text-indigo-500 rounded text-xs font-medium">
                {transaction.meta.unit_breakdown.unit}
              </span>
            )}
          </div>
        )}

        {/* Main Info */}
        <div className="space-y-4">
          {/* Nama Customer/Vendor */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {getNameLabel(transaction.category)}
            </label>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              {contacts?.some((contact: Contact) => contact.name === transaction.name) && (
                <ContactIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              )}
              {transaction.name}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t.transactionDetail.keterangan}
            </label>
            <div className="mt-1 flex items-start gap-2 flex-wrap">
              <p className="text-gray-700 dark:text-gray-300 flex-1 min-w-0">
                {transaction.description}
              </p>
              {/* Tags inline */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      disabled={savingTag}
                      className="hover:text-indigo-900 dark:hover:text-indigo-100 transition-colors disabled:opacity-50"
                      aria-label={`Hapus tag ${tag}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {/* Add tag inline with suggestions */}
                <div className="relative flex items-center gap-1" ref={suggestionsRef}>
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tagInput}
                    onChange={(e) => { setTagInput(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={(e) => {
                      // delay to allow suggestion click to fire
                      if (!suggestionsRef.current?.contains(e.relatedTarget as Node)) {
                        setTimeout(() => setShowSuggestions(false), 150);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); setShowSuggestions(false); }
                      if (e.key === 'Escape') setShowSuggestions(false);
                    }}
                    placeholder="+ tag"
                    disabled={savingTag}
                    className="w-16 text-xs px-2 py-0.5 rounded-full border border-dashed border-gray-300 dark:border-gray-600 bg-transparent text-gray-500 dark:text-gray-400 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-indigo-400 focus:w-24 transition-all disabled:opacity-50"
                  />
                  {tagInput.trim() && (
                    <button
                      onClick={() => { handleAddTag(); setShowSuggestions(false); }}
                      disabled={savingTag}
                      className="w-5 h-5 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors disabled:opacity-40"
                    >
                      +
                    </button>
                  )}
                  {/* Suggestions dropdown */}
                  {showSuggestions && tagSuggestions.length > 0 && (
                    <div className="absolute left-0 top-full mt-1 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[120px] max-h-40 overflow-y-auto">
                      {tagSuggestions.map((s) => (
                        <button
                          key={s}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={async () => {
                            const prev = tags;
                            const newTags = [...tags, s];
                            setTags(newTags);
                            setTagInput('');
                            setShowSuggestions(false);
                            await saveTags(newTags, prev);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t.transactionDetail.tanggal}
            </label>
            <p className="mt-1 text-gray-900 dark:text-gray-100">
              {formatDate(transaction.date)}
            </p>
          </div>

          {/* Multi-line Journal Lines */}
          {transaction.is_multi_line && transaction.journal_lines && transaction.journal_lines.length > 0 ? (
            <div className="mt-4">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
                {t.transactionDetail.journalLines}
              </label>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">{t.transactionDetail.account}</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-28">{t.transactionDetail.debit}</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-28">{t.transactionDetail.credit}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {transaction.journal_lines.map((line) => (
                      <tr key={line.id} className="bg-white dark:bg-gray-900">
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                            {line.account?.account_code && (
                              <span className="font-mono text-xs text-gray-400 dark:text-gray-500">{line.account.account_code}</span>
                            )}
                            {line.account?.account_name || 'Unknown'}
                          </p>
                          {line.description && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{line.description}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100">
                          {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : ''}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100">
                          {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-gray-800 font-semibold">
                      <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{t.transactionDetail.total}</td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                        {formatCurrency(transaction.journal_lines.reduce((s, l) => s + l.debit_amount, 0))}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                        {formatCurrency(transaction.journal_lines.reduce((s, l) => s + l.credit_amount, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : transaction.is_double_entry && (transaction.debit_account || transaction.credit_account) ? (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {t.transactionDetail.debit}
                </label>
                <div className="flex items-center gap-1.5">
                  {transaction.debit_account?.account_code && (
                    <span className="font-mono text-xs text-gray-400 dark:text-gray-500">{transaction.debit_account.account_code}</span>
                  )}
                  {transaction.debit_account?.account_type && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ACCOUNT_TYPE_BG[transaction.debit_account.account_type] ?? 'bg-gray-100 text-gray-500'}`}>
                      {ACCOUNT_TYPE_LABEL[transaction.debit_account.account_type] ?? transaction.debit_account.account_type}
                    </span>
                  )}
                </div>
                <p className="text-gray-900 dark:text-gray-100 font-semibold leading-tight">
                  {transaction.debit_account?.account_name || 'Unknown'}
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {t.transactionDetail.credit}
                </label>
                <div className="flex items-center gap-1.5">
                  {transaction.credit_account?.account_code && (
                    <span className="font-mono text-xs text-gray-400 dark:text-gray-500">{transaction.credit_account.account_code}</span>
                  )}
                  {transaction.credit_account?.account_type && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ACCOUNT_TYPE_BG[transaction.credit_account.account_type] ?? 'bg-gray-100 text-gray-500'}`}>
                      {ACCOUNT_TYPE_LABEL[transaction.credit_account.account_type] ?? transaction.credit_account.account_type}
                    </span>
                  )}
                </div>
                <p className="text-gray-900 dark:text-gray-100 font-semibold leading-tight">
                  {transaction.credit_account?.account_name || 'Unknown'}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t.transactionDetail.chartOfAccount}
              </label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">
                {getAccountDisplay(transaction)}
              </p>
            </div>
          )}
        </div>

        {/* Attachment / Dokumen Sumber */}
        {(() => {
          const atts =
            transaction.meta?.attachments ??
            (transaction.meta?.attachment ? [transaction.meta.attachment] : []);
          if (atts.length === 0) return null;
          return (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                {t.transactionDetail.attachment}
              </h4>
              <div className="space-y-2">
                {atts.map((att) =>
                  isImageType(att.mime_type) ? (
                    <a
                      key={att.path}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <div className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                        <img
                          src={att.url}
                          alt={att.filename}
                          className="w-full max-h-64 object-contain bg-gray-50 dark:bg-gray-800 group-hover:opacity-90 transition-opacity"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                          <ExternalLink className="w-6 h-6 text-white drop-shadow-lg" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="truncate">{att.filename}</span>
                        <span>{formatFileSize(att.size)}</span>
                      </div>
                    </a>
                  ) : (
                    <a
                      key={att.path}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-red-500 dark:text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {att.filename}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(att.size)}
                        </p>
                      </div>
                      <Download className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                    </a>
                  )
                )}
              </div>
            </div>
          );
        })()}

        {/* Sold Stock Info */}
        {soldStockTransactions.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              {t.transactionDetail.soldInventory}
            </h4>
            <div className="space-y-2">
              {soldStockTransactions.map((stock) => (
                <div
                  key={stock.id}
                  className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-600 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {stock.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(stock.date)}
                      {stock.debit_account && (
                        <span className="ml-2">
                          {stock.debit_account.account_code} - {stock.debit_account.account_name}
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-amber-500 dark:text-amber-300 ml-3 flex-shrink-0">
                    {formatCurrency(stock.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Receivable Settlement Section */}
        {isReceivableTransaction(transaction) && onSettleReceivable && (() => {
          const outstanding = getOutstandingAmount(transaction);
          const partialIds = getPartialSettlementIds(transaction);
          const settled = isSettled(transaction);
          const finalSettlementId = transaction.meta?.settled_by_transaction_id;
          const paymentIds = finalSettlementId && !partialIds.includes(finalSettlementId)
            ? [...partialIds, finalSettlementId]
            : partialIds;
          const paymentTxns = allTransactions?.filter(t => paymentIds.includes(t.id)) ?? [];
          const hasPayments = paymentTxns.length > 0;

          return (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">

              {/* Status badge — only for fully settled */}
              {settled && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">{t.transactionDetail.paidInFull}</p>
                    <p className="text-xs text-emerald-500 dark:text-emerald-400">
                      {t.transactionDetail.paidInFullDesc}
                    </p>
                  </div>
                </div>
              )}

              {/* Payment history — includes partial settlements and final settlement when fully paid */}
              {hasPayments && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-3 py-2.5 flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {t.transactionDetail.paymentHistory}
                      </span>
                    </div>
                    {!settled && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t.transactionDetail.remaining} <span className="font-semibold text-gray-700 dark:text-gray-200">{formatCurrency(outstanding)}</span>
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {paymentTxns
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((pt) => {
                        const clickable = !!onShowRelatedTransaction;
                        const isFinal = settled && pt.id === finalSettlementId;
                        return (
                          <div
                            key={pt.id}
                            onClick={clickable ? () => onShowRelatedTransaction!(pt) : undefined}
                            className={`flex items-center justify-between px-3 py-2.5 ${
                              clickable ? 'cursor-pointer group' : ''
                            }`}
                          >
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(pt.date)}</p>
                              <p className={`text-sm font-medium text-gray-700 dark:text-gray-200 ${
                                clickable ? 'group-hover:underline' : ''
                              }`}>
                                {pt.description || (isFinal ? t.transactionDetail.finalSettlement : t.transactionDetail.partialPayment)}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                              +{formatCurrency(pt.amount)}
                            </span>
                          </div>
                        );
                      })}
                    {/* Running total paid */}
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t.transactionDetail.totalPaid}</span>
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                        {formatCurrency(transaction.amount - outstanding)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons — only when not fully settled */}
              {!settled && !showSettleConfirm && !showPartialInput && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSettleConfirm(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    <Banknote className="w-4 h-4" />
                    {t.transactionDetail.settleFull}
                  </button>
                  {onPartialSettleReceivable && (
                    <button
                      onClick={() => setShowPartialInput(true)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      <ChevronDown className="w-4 h-4" />
                      {t.transactionDetail.settlePartial}
                    </button>
                  )}
                </div>
              )}

              {/* Full settle confirm */}
              {showSettleConfirm && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 p-4 space-y-3">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    {t.transactionDetail.confirmFullSettlement}
                  </p>
                  <div className="px-3 py-2 bg-white dark:bg-gray-800 rounded-md font-mono text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                    {(() => {
                      const cashAcc = findDefaultCashAccount(accounts || []);
                      return (
                        <>
                          Dr {cashAcc?.account_code ?? '1200'} – {cashAcc?.account_name ?? 'Bank'} &nbsp;|&nbsp;
                          Cr {transaction.debit_account?.account_code} – {transaction.debit_account?.account_name} &nbsp;|&nbsp;
                          {formatCurrency(outstanding)}
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowSettleConfirm(false); onSettleReceivable(transaction); }}
                      disabled={settleLoading}
                      className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {settleLoading ? t.transactionDetail.processing : t.transactionDetail.yesSettle}
                    </button>
                    <button
                      onClick={() => setShowSettleConfirm(false)}
                      disabled={settleLoading}
                      className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                    >
                      {t.transactionDetail.cancel}
                    </button>
                  </div>
                </div>
              )}

              {/* Partial settle input */}
              {showPartialInput && onPartialSettleReceivable && (
                <div className="rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/10 p-4 space-y-3">
                  <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                    {t.transactionDetail.partialRemaining.replace('{amount}', formatCurrency(outstanding))}
                  </p>
                  <CurrencyInputWithCalculator
                    label={t.transactionDetail.partialAmountLabel}
                    value={partialAmount}
                    displayValue={partialDisplayAmount}
                    onChange={(num, fmt) => {
                      setPartialAmount(num);
                      setPartialDisplayAmount(fmt);
                      setPartialError('');
                    }}
                    colorVariant="green"
                  />
                  {partialError && (
                    <p className="text-xs text-red-500 dark:text-red-400">{partialError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (partialAmount <= 0) {
                          setPartialError(t.transactionDetail.enterPaymentAmount);
                          return;
                        }
                        if (partialAmount >= outstanding) {
                          setPartialError(t.transactionDetail.mustBeLessThan.replace('{amount}', formatCurrency(outstanding)));
                          return;
                        }
                        setPartialLoading(true);
                        setPartialError('');
                        try {
                          await onPartialSettleReceivable(transaction, partialAmount);
                          setShowPartialInput(false);
                          setPartialAmount(0);
                          setPartialDisplayAmount('');
                        } catch (err: any) {
                          setPartialError(err.message || t.transactionDetail.failedRecordPayment);
                        } finally {
                          setPartialLoading(false);
                        }
                      }}
                      disabled={partialLoading}
                      className="btn-primary flex-1"
                    >
                      {partialLoading ? t.transactionDetail.processing : t.transactionDetail.recordPayment}
                    </button>
                    <button
                      onClick={() => { setShowPartialInput(false); setPartialError(''); }}
                      disabled={partialLoading}
                      className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                    >
                      {t.transactionDetail.cancel}
                    </button>
                  </div>
                </div>
              )}

            </div>
          );
        })()}

        {/* Dividend Settlement Section — mirror of receivable settlement */}
        {isDividendDeclaration(transaction) && onSettleDividend && (() => {
          const outstanding = getDividendOutstanding(transaction);
          const partialIds = getDividendPartialSettlementIds(transaction);
          const settled = isDividendSettled(transaction);
          const finalSettlementId = transaction.meta?.settled_by_transaction_id;
          const paymentIds = finalSettlementId && !partialIds.includes(finalSettlementId)
            ? [...partialIds, finalSettlementId]
            : partialIds;
          const paymentTxns = allTransactions?.filter(t => paymentIds.includes(t.id)) ?? [];
          const hasPayments = paymentTxns.length > 0;

          return (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">

              {/* Status badge — for fully settled or undeclared (no partials yet) */}
              {settled ? (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">Dividen sudah dibayar penuh</p>
                    <p className="text-xs text-emerald-500 dark:text-emerald-400">
                      Hutang dividen sudah dilunasi via Kas/Bank.
                    </p>
                  </div>
                </div>
              ) : !hasPayments ? (
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Dividen di-declare (belum dibayar)</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Klik tombol di bawah untuk mencatat pembayaran ke pemilik.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Payment history — includes partial settlements and final settlement when fully paid */}
              {hasPayments && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-3 py-2.5 flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Riwayat Pembayaran
                      </span>
                    </div>
                    {!settled && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Sisa: <span className="font-semibold text-gray-700 dark:text-gray-200">{formatCurrency(outstanding)}</span>
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {paymentTxns
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((pt) => {
                        const clickable = !!onShowRelatedTransaction;
                        const isFinal = settled && pt.id === finalSettlementId;
                        return (
                          <div
                            key={pt.id}
                            onClick={clickable ? () => onShowRelatedTransaction!(pt) : undefined}
                            className={`flex items-center justify-between px-3 py-2.5 ${
                              clickable ? 'cursor-pointer group' : ''
                            }`}
                          >
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(pt.date)}</p>
                              <p className={`text-sm font-medium text-gray-700 dark:text-gray-200 ${
                                clickable ? 'group-hover:underline' : ''
                              }`}>
                                {pt.description || (isFinal ? 'Pelunasan akhir' : 'Pembayaran sebagian')}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                              +{formatCurrency(pt.amount)}
                            </span>
                          </div>
                        );
                      })}
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total dibayar</span>
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                        {formatCurrency(transaction.amount - outstanding)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons — only when not fully settled */}
              {!settled && !showSettleConfirm && !showPartialInput && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSettleConfirm(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    <Banknote className="w-4 h-4" />
                    Bayar Dividen Penuh
                  </button>
                  {onPartialSettleDividend && (
                    <button
                      onClick={() => setShowPartialInput(true)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      <ChevronDown className="w-4 h-4" />
                      Bayar Sebagian
                    </button>
                  )}
                </div>
              )}

              {/* Full settle confirm */}
              {showSettleConfirm && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 p-4 space-y-3">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    Konfirmasi pembayaran dividen penuh
                  </p>
                  <div className="px-3 py-2 bg-white dark:bg-gray-800 rounded-md font-mono text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                    {(() => {
                      const cashAcc = findDefaultCashAccount(accounts || []);
                      return (
                        <>
                          Dr {transaction.credit_account?.account_code} – {transaction.credit_account?.account_name} &nbsp;|&nbsp;
                          Cr {cashAcc?.account_code ?? '1200'} – {cashAcc?.account_name ?? 'Bank'} &nbsp;|&nbsp;
                          {formatCurrency(outstanding)}
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowSettleConfirm(false); onSettleDividend(transaction); }}
                      disabled={settleLoading}
                      className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {settleLoading ? 'Memproses...' : 'Ya, Bayar'}
                    </button>
                    <button
                      onClick={() => setShowSettleConfirm(false)}
                      disabled={settleLoading}
                      className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {/* Partial settle input */}
              {showPartialInput && onPartialSettleDividend && (
                <div className="rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/10 p-4 space-y-3">
                  <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                    Sisa dividen yang perlu dibayar: {formatCurrency(outstanding)}
                  </p>
                  <CurrencyInputWithCalculator
                    label="Jumlah pembayaran"
                    value={partialAmount}
                    displayValue={partialDisplayAmount}
                    onChange={(num, fmt) => {
                      setPartialAmount(num);
                      setPartialDisplayAmount(fmt);
                      setPartialError('');
                    }}
                    colorVariant="green"
                  />
                  {partialError && (
                    <p className="text-xs text-red-500 dark:text-red-400">{partialError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (partialAmount <= 0) {
                          setPartialError('Masukkan jumlah pembayaran');
                          return;
                        }
                        if (partialAmount >= outstanding) {
                          setPartialError(`Jumlah harus kurang dari ${formatCurrency(outstanding)}`);
                          return;
                        }
                        setPartialLoading(true);
                        setPartialError('');
                        try {
                          await onPartialSettleDividend(transaction, partialAmount);
                          setShowPartialInput(false);
                          setPartialAmount(0);
                          setPartialDisplayAmount('');
                        } catch (err: any) {
                          setPartialError(err.message || 'Gagal mencatat pembayaran');
                        } finally {
                          setPartialLoading(false);
                        }
                      }}
                      disabled={partialLoading}
                      className="btn-primary flex-1"
                    >
                      {partialLoading ? 'Memproses...' : 'Catat Pembayaran'}
                    </button>
                    <button
                      onClick={() => { setShowPartialInput(false); setPartialError(''); }}
                      disabled={partialLoading}
                      className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

            </div>
          );
        })()}

        {/* Related Transaction Section */}
        {(() => {
          const settlementOf = transaction.meta?.settlement_of_transaction_id
            ? allTransactions?.find(tx => tx.id === transaction.meta!.settlement_of_transaction_id)
            : null;
          // Hide "settled by" link when this transaction already shows the final settlement
          // inside its own Payment History (receivable/dividend declarations).
          const showSettledBy =
            !isReceivableTransaction(transaction) && !isDividendDeclaration(transaction);
          const settledBy = showSettledBy && transaction.meta?.settled_by_transaction_id
            ? allTransactions?.find(tx => tx.id === transaction.meta!.settled_by_transaction_id)
            : null;

          if (!settlementOf && !settledBy) return null;

          return (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                {t.transactionDetail.relatedInfo}
              </h4>
              <div className="space-y-2">
                {settlementOf && (
                  <button
                    type="button"
                    onClick={() => onShowRelatedTransaction?.(settlementOf)}
                    className="w-full flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-colors text-left group cursor-pointer"
                  >
                    <Link2 className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 flex-shrink-0 mt-0.5 transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-300 font-semibold mb-1 transition-colors">
                        Pelunasan dari transaksi:
                      </p>
                      <p className="text-sm text-gray-800 dark:text-gray-100 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-300 group-hover:underline transition-colors">
                        {formatDate(settlementOf.date)} • {settlementOf.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 mt-1 transition-colors">
                        {formatCurrency(settlementOf.amount)}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-400 dark:group-hover:text-blue-500 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                )}
                {settledBy && (
                  <button
                    type="button"
                    onClick={() => onShowRelatedTransaction?.(settledBy)}
                    className="w-full flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-colors text-left group cursor-pointer"
                  >
                    <Link2 className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 flex-shrink-0 mt-0.5 transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-300 font-semibold mb-1 transition-colors">
                        Dilunasi oleh transaksi:
                      </p>
                      <p className="text-sm text-gray-800 dark:text-gray-100 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-300 group-hover:underline transition-colors">
                        {formatDate(settledBy.date)} • {settledBy.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 mt-1 transition-colors">
                        {formatCurrency(settledBy.amount)}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-400 dark:group-hover:text-blue-500 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* Metadata Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Informasi Tambahan
          </h4>
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-100 dark:border-gray-700 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">No. Transaksi</span>
              <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">
                {transaction.transaction_number ?? `${transaction.id.slice(0, 8)}...`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Status</span>
              <span className={`font-medium ${isDraft ? 'text-gray-500 dark:text-gray-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                {isDraft ? 'Draft' : 'Posted'}
                {transaction.posted_at && ` (${formatDateTime(transaction.posted_at)})`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Dibuat oleh</span>
              <span className="text-gray-700 dark:text-gray-300">
                {loadingCreator ? (
                  <span className="text-gray-400 dark:text-gray-500">Memuat...</span>
                ) : creatorName ? (
                  creatorName
                ) : (
                  <span className="font-mono text-xs">{transaction.created_by?.slice(0, 8) ?? '—'}...</span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Dibuat pada</span>
              <span className="text-gray-700 dark:text-gray-300">
                {formatDateTime(transaction.created_at)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Terakhir diupdate</span>
              <span className="text-gray-700 dark:text-gray-300">
                {formatDateTime(transaction.updated_at)}
              </span>
            </div>
            {transaction.updated_by && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Diupdate oleh</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {loadingUpdater ? (
                    <span className="text-gray-400 dark:text-gray-500">Memuat...</span>
                  ) : updaterName ? (
                    updaterName
                  ) : (
                    <span className="font-mono text-xs">{transaction.updated_by.slice(0, 8)}...</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Audit History Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            onClick={() => setShowAuditHistory(!showAuditHistory)}
            className="w-full flex items-center justify-between text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Riwayat Perubahan
            </span>
            <svg
              className={`w-5 h-5 transition-transform ${showAuditHistory ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAuditHistory && (
            <div className="mt-4 space-y-3">
              {loadingAudit ? (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  Memuat riwayat...
                </div>
              ) : auditHistory.length === 0 ? (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  Tidak ada riwayat perubahan
                </div>
              ) : (
                <div className="space-y-4">
                  {auditHistory.map((log) => {
                    const changes = getFieldChanges(log);
                    const operationLabel = {
                      INSERT: 'Dibuat',
                      UPDATE: 'Diupdate',
                      DELETE: 'Dihapus',
                    }[log.operation];
                    const operationColor = {
                      INSERT: 'text-emerald-500 dark:text-emerald-400',
                      UPDATE: 'text-blue-600 dark:text-blue-400',
                      DELETE: 'text-red-500 dark:text-red-400',
                    }[log.operation];

                    return (
                      <div
                        key={log.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className={`font-semibold ${operationColor}`}>
                              {operationLabel}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs ml-2">
                              {formatDateTime(log.changed_at)}
                            </span>
                          </div>
                          {log.changed_by_name && (
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              oleh {log.changed_by_name}
                            </span>
                          )}
                        </div>

                        {changes.length > 0 && (
                          <div className="space-y-2 mt-3">
                            {changes.map((change) => (
                              <div
                                key={change.field}
                                className="text-sm border-l-2 border-gray-300 dark:border-gray-600 pl-3"
                              >
                                <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  {formatFieldName(change.field)}
                                </div>
                                <div className="flex items-start gap-2 text-xs">
                                  {change.oldValue !== null && (
                                    <div className="flex-1">
                                      <span className="text-red-500 dark:text-red-400 font-semibold">
                                        Sebelum:
                                      </span>
                                      <div className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-500 dark:text-red-300 font-mono">
                                        {formatAuditValue(change.oldValue)}
                                      </div>
                                    </div>
                                  )}
                                  {change.newValue !== null && (
                                    <div className="flex-1">
                                      <span className="text-emerald-500 dark:text-emerald-400 font-semibold">
                                        Sesudah:
                                      </span>
                                      <div className="mt-1 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded text-emerald-500 dark:text-emerald-300 font-mono">
                                        {formatAuditValue(change.newValue)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </Modal>
  );
}

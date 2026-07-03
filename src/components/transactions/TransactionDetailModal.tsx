'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Modal } from '@/components/ui/Modal';
import type { Transaction, Account, AuditLog, Contact, TransactionAttachment } from '@/types';
import type { TransactionFormData } from '@/components/transactions/TransactionForm';
import { CATEGORY_LABELS } from '@/lib/calculations';
import { CATEGORY_BADGE_CLASSES } from '@/lib/categoryColors';
import { SalesChannelBadge } from '@/components/transactions/SalesChannelBadge';
import { formatCurrency, formatDate, formatDateWithDay, formatDateTime } from '@/lib/utils';
import { getProfileName } from '@/lib/api/profiles';
import { getRecordAuditHistory, getFieldChanges, formatFieldName, formatAuditValue } from '@/lib/api/audit';
import {
  detectMatchingPrincipleWarning,
  isReceivableTransaction,
  isTradeReceivableTransaction,
  isSettled,
  getOutstandingAmount,
  getPartialSettlementIds,
  isDividendDeclaration,
  isDividendSettled,
  getDividendOutstandingAmount,
  getDividendPartialSettlementIds,
} from '@/lib/accounting/guidance';
import { useInvoiceFromTransactions } from '@/hooks/useInvoiceFromTransactions';
import { CreateInvoiceFromTransactionsModal } from '@/components/invoices/CreateInvoiceFromTransactionsModal';
import { findDefaultCashAccount } from '@/lib/utils/quickTransactionHelper';
import { AlertTriangle, Info, X, CheckCircle2, Banknote, FileText, Download, ExternalLink, Link2, ChevronDown, History, Contact as ContactIcon, RotateCcw, ZoomIn, ZoomOut, Receipt, CirclePlus, ChevronRight, Maximize2, Loader2, Copy } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { updateTransaction } from '@/lib/api/transactions';
import { CurrencyInputWithCalculator } from '@/components/ui/CurrencyInputWithCalculator';
import { formatFileSize, isImageType } from '@/lib/storage/attachments';
import { useDeliverableAttachmentUrl, triggerAttachmentDownload } from '@/lib/storage/signedUrl';

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  onDuplicate?: (transaction: Transaction) => void;
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

function isPdfAttachment(attachment: TransactionAttachment): boolean {
  const mimeType = attachment.mime_type?.toLowerCase() ?? '';
  const filename = attachment.filename?.toLowerCase() ?? '';
  return mimeType.includes('pdf') || filename.endsWith('.pdf');
}

function withPdfViewerParams(url: string): string {
  if (url.includes('#')) return url;
  return `${url}#toolbar=1&navpanes=0&view=FitH`;
}


export function TransactionDetailModal({
  transaction,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
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
  const { linkedTransactionIds, canInvoiceTransactions, canManage: canManageInvoices } =
    useInvoiceFromTransactions();
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

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
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
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
  const [previewAttachment, setPreviewAttachment] = useState<TransactionAttachment | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const tagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    return allTags.filter(
      (t) => !tags.includes(t) && (q === '' || t.toLowerCase().includes(q))
    );
  }, [allTags, tags, tagInput]);

  const matchedContact = useMemo(() => {
    if (!transaction?.name) return null;
    return contacts?.find((contact) =>
      contact.id === transaction.contact_id ||
      contact.name.toLowerCase() === transaction.name.toLowerCase()
    ) ?? null;
  }, [contacts, transaction?.contact_id, transaction?.name]);

  const contactManageHref = useMemo(() => {
    if (!transaction) return '#';

    const baseHref = `/businesses/${transaction.business_id}/config?tab=contacts`;
    if (matchedContact) {
      return `${baseHref}&contact=${encodeURIComponent(matchedContact.id)}`;
    }

    return transaction.name
      ? `${baseHref}&search=${encodeURIComponent(transaction.name)}`
      : baseHref;
  }, [matchedContact, transaction]);

  // Sync tags from transaction meta
  useEffect(() => {
    setTags(transaction?.meta?.tags ?? []);
    setTagInput('');
    setShowSettleConfirm(false);
    setShowPartialInput(false);
    setPartialAmount(0);
    setPartialDisplayAmount('');
    setPartialError('');
    setPreviewAttachment(null);
    setPreviewScale(1);
  }, [transaction?.id]);

  useEffect(() => {
    if (!previewAttachment) return;
    const handlePreviewKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setPreviewAttachment(null);
        setPreviewScale(1);
      }
    };
    document.addEventListener('keydown', handlePreviewKey, true);
    return () => document.removeEventListener('keydown', handlePreviewKey, true);
  }, [previewAttachment]);

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
      if (previewAttachment) return;
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
  }, [isOpen, hasPrev, hasNext, onNavigatePrev, onNavigateNext, previewAttachment]);

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
  const showActions = onEdit || onDelete || onDuplicate || (onPost && isDraft);

  const openAttachmentPreview = (attachment: TransactionAttachment) => {
    setPreviewAttachment(attachment);
    setPreviewScale(1);
  };

  const closeAttachmentPreview = () => {
    setPreviewAttachment(null);
    setPreviewScale(1);
  };

  const actionButtons = showActions ? (
    <div className="flex items-center gap-3">
      {onPost && isDraft && (
        <button
          onClick={() => onPost(transaction.id)}
          className="btn-primary-glow flex-1 flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          {t.transactionDetail.postBtn}
        </button>
      )}
      <div className={`flex items-center gap-4 ${onPost && isDraft ? '' : 'flex-1 justify-end'}`}>
      {onEdit && (
        <button
          onClick={() => {
            onClose();
            // Tunggu animasi close detail modal selesai sebelum membuka form edit
            // agar tidak ada dua overlay yang overlap (menyebabkan blink).
            setTimeout(() => onEdit(transaction), 200);
          }}
          className="flex items-center gap-1.5 px-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      {onEdit && onDuplicate && (
        <span className="text-gray-300 dark:text-gray-600">·</span>
      )}
      {onDuplicate && (
        <button
          onClick={() => {
            onClose();
            setTimeout(() => onDuplicate(transaction), 200);
          }}
          className="flex items-center gap-1.5 px-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-medium transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
          {t.transactionDetail.duplicateBtn}
        </button>
      )}
      {(onEdit || onDuplicate) && onDelete && (
        <span className="text-gray-300 dark:text-gray-600">·</span>
      )}
      {onDelete && (
        <button
          onClick={() => {
            onClose();
            onDelete(transaction);
          }}
          className="flex items-center gap-1.5 px-2 py-1 text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 font-medium transition-colors"
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
    </div>
  ) : undefined;

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex flex-col gap-0.5">
          <div className="text-xs font-mono font-normal text-gray-400 dark:text-gray-500">
            #{transaction.transaction_number ?? transaction.id.slice(0, 8)}
          </div>
          <div className="text-base font-semibold text-gray-800 dark:text-gray-100">
            {formatDateWithDay(transaction.date)}
          </div>
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

        {/* Amount Hero Card — gabungan amount, badge kategori, breakdown unit, status */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/60 dark:to-gray-800/20 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {isInventoryTransaction(transaction) ? (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STOCK_COLOR}`}>
                  {t.transactionDetail.stock}
                </span>
              ) : (
                <div className="relative group inline-flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${transaction.meta?.settlement_of_transaction_id ? CATEGORY_COLORS['SETTLE'] : CATEGORY_COLORS[transaction.category]}`}
                  >
                    {transaction.meta?.settlement_of_transaction_id ? t.arAp.settlementBadge : CATEGORY_LABELS[transaction.category]}
                  </span>
                  {transaction.meta?.entry_type && (
                    <>
                      <Info className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 cursor-help" />
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
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                  {t.transactionDetail.draft}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  {t.transactionDetail.posted}
                </span>
              )}
            </div>
            {transaction.sales_channel && transaction.category === 'EARN' && (
              <SalesChannelBadge channel={transaction.sales_channel} size="md" />
            )}
            {showWarning && matchingWarning && !warningExpanded && (
              <button
                onClick={() => setWarningExpanded(true)}
                title={matchingWarning.title}
                className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-500 text-gray-400 dark:text-gray-500 hover:border-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors flex items-center justify-center flex-shrink-0"
              >
                <span className="text-[10px] font-bold leading-none">!</span>
              </button>
            )}
          </div>
          <p className={`mt-3 text-3xl font-bold tabular-nums leading-tight ${
            transaction.category === 'EARN'
              ? 'text-emerald-500 dark:text-emerald-400'
              : 'text-gray-900 dark:text-gray-100'
          }`}>
            {formatCurrency(transaction.amount)}
          </p>
          {transaction.currency_code && transaction.currency_code !== 'IDR' && transaction.original_amount && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
              {formatCurrency(transaction.original_amount, transaction.currency_code)}
              {transaction.fx_rate ? (
                <span className="ml-2">
                  @ {Number(transaction.fx_rate).toLocaleString('id-ID')} IDR/{transaction.currency_code}
                </span>
              ) : null}
            </p>
          )}
          {transaction.fx_gain_loss_amount ? (
            <p className={`mt-1 text-xs tabular-nums ${transaction.fx_gain_loss_amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              FX {transaction.fx_gain_loss_amount > 0 ? 'gain' : 'loss'}: {formatCurrency(Math.abs(transaction.fx_gain_loss_amount))}
            </p>
          ) : null}
          {transaction.meta?.unit_breakdown && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
              {formatCurrency(transaction.meta.unit_breakdown.price_per_unit, transaction.currency_code ?? 'IDR')}
              <span className="mx-1.5 text-gray-300 dark:text-gray-600">×</span>
              {transaction.meta.unit_breakdown.quantity.toLocaleString('id-ID')}
              {transaction.meta.unit_breakdown.unit && (
                <span className="ml-1">{transaction.meta.unit_breakdown.unit}</span>
              )}
            </p>
          )}
        </div>

        {/* Main Info — kompak, label kecil di kiri */}
        <div className="space-y-3">
          {/* Description sebagai judul utama */}
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">
              {transaction.description}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              {matchedContact && (
                <ContactIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              )}
              {transaction.name ? (
                <Link
                  href={contactManageHref}
                  className="inline-flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-300 hover:underline underline-offset-2 transition-colors"
                  title="Kelola kontak"
                >
                  <span>{transaction.name}</span>
                </Link>
              ) : (
                <span className="font-medium text-gray-700 dark:text-gray-300">-</span>
              )}
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span>{getNameLabel(transaction.category)}</span>
            </p>
          </div>

          {/* Tags row */}
          <div>
            <div className="flex items-start gap-2 flex-wrap">
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
            <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 w-12 flex-shrink-0">
                  {t.transactionDetail.debit}
                </span>
                {transaction.debit_account?.account_code && (
                  <span className="font-mono text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{transaction.debit_account.account_code}</span>
                )}
                <p className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate flex-1">
                  {transaction.debit_account?.account_name || 'Unknown'}
                </p>
                {transaction.debit_account?.account_type && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${ACCOUNT_TYPE_BG[transaction.debit_account.account_type] ?? 'bg-gray-100 text-gray-500'}`}>
                    {ACCOUNT_TYPE_LABEL[transaction.debit_account.account_type] ?? transaction.debit_account.account_type}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 w-12 flex-shrink-0">
                  {t.transactionDetail.credit}
                </span>
                {transaction.credit_account?.account_code && (
                  <span className="font-mono text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{transaction.credit_account.account_code}</span>
                )}
                <p className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate flex-1">
                  {transaction.credit_account?.account_name || 'Unknown'}
                </p>
                {transaction.credit_account?.account_type && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${ACCOUNT_TYPE_BG[transaction.credit_account.account_type] ?? 'bg-gray-100 text-gray-500'}`}>
                    {ACCOUNT_TYPE_LABEL[transaction.credit_account.account_type] ?? transaction.credit_account.account_type}
                  </span>
                )}
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
                {atts.map((att) => (
                  <AttachmentPreviewItem
                    key={att.path}
                    attachment={att}
                    onOpenPreview={openAttachmentPreview}
                  />
                ))}
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
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
              {soldStockTransactions.map((stock) => {
                const clickable = !!onShowRelatedTransaction;
                return (
                  <div
                    key={stock.id}
                    onClick={clickable ? () => onShowRelatedTransaction!(stock) : undefined}
                    className={`flex items-center justify-between p-3 ${
                      clickable ? 'cursor-pointer group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium text-gray-900 dark:text-gray-100 truncate ${
                        clickable ? 'group-hover:underline' : ''
                      }`}>
                        {stock.description || stock.name}
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
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 ml-3 flex-shrink-0">
                      {formatCurrency(stock.amount)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Receivable Settlement Section */}
        {isReceivableTransaction(transaction) && onSettleReceivable && (() => {
          const partialIds = getPartialSettlementIds(transaction);
          const settled = isSettled(transaction);
          const finalSettlementId = transaction.meta?.settled_by_transaction_id;
          const paymentIds = finalSettlementId && !partialIds.includes(finalSettlementId)
            ? [...partialIds, finalSettlementId]
            : partialIds;
          const paymentTxns = allTransactions?.filter(t => paymentIds.includes(t.id)) ?? [];
          const hasPayments = paymentTxns.length > 0;
          const outstanding = getOutstandingAmount(transaction, paymentTxns);

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
                <>
                {/* 3 aksi dalam 1 baris: Settle (glow) · Partial (ghost) · Invoice (icon-label) */}
                <div className="flex items-stretch gap-2">
                  <button
                    onClick={() => setShowSettleConfirm(true)}
                    className="flex-[3] flex items-center justify-between gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border border-gray-300 dark:border-gray-600 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                  >
                    {t.transactionDetail.settleShort}
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  </button>
                  {onPartialSettleReceivable && (
                    <button
                      onClick={() => setShowPartialInput(true)}
                      className="btn-ghost flex-[2] flex items-center justify-between gap-1.5"
                    >
                      {t.transactionDetail.settlePartialShort}
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    </button>
                  )}
                  {/* Invoice — icon-label, hanya untuk trade receivable yang belum dijadikan invoice */}
                  {canManageInvoices &&
                    isTradeReceivableTransaction(transaction) &&
                    !linkedTransactionIds.has(transaction.id) && (
                      <button
                        type="button"
                        onClick={() => {
                          const err = canInvoiceTransactions([transaction]);
                          if (err) return; // toast already shown
                          setShowInvoiceModal(true);
                        }}
                        className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                      >
                        <CirclePlus className="w-4 h-4" />
                        {t.transactionDetail.invoiceShort}
                      </button>
                    )}
                </div>
                {/* Invoiced badge — replaces the button if this txn is already linked */}
                {canManageInvoices &&
                  isTradeReceivableTransaction(transaction) &&
                  linkedTransactionIds.has(transaction.id) && (
                    <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                      <Receipt className="w-3.5 h-3.5" />
                      Transaksi ini sudah dijadikan invoice
                    </div>
                  )}
                </>
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
                      className="btn-emerald-glow flex-1"
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
                    displayValue={partialDisplayAmount}
                    onChange={(num, fmt) => {
                      setPartialAmount(num);
                      setPartialDisplayAmount(fmt);
                      setPartialError('');
                    }}
                    colorVariant="default"
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
                      className="btn-primary-glow flex-1"
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
          const partialIds = getDividendPartialSettlementIds(transaction);
          const settled = isDividendSettled(transaction);
          const finalSettlementId = transaction.meta?.settled_by_transaction_id;
          const paymentIds = finalSettlementId && !partialIds.includes(finalSettlementId)
            ? [...partialIds, finalSettlementId]
            : partialIds;
          const paymentTxns = allTransactions?.filter(t => paymentIds.includes(t.id)) ?? [];
          const outstanding = getDividendOutstandingAmount(transaction, paymentTxns);
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
                      className="btn-emerald-glow flex-1"
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
                    displayValue={partialDisplayAmount}
                    onChange={(num, fmt) => {
                      setPartialAmount(num);
                      setPartialDisplayAmount(fmt);
                      setPartialError('');
                    }}
                    colorVariant="default"
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
                      className="btn-primary-glow flex-1"
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

        {/* Metadata Section — collapsible, tertutup secara default */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
            className="w-full flex items-center justify-between text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5" />
              Detail Tambahan
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showAdditionalInfo ? 'rotate-180' : ''}`}
            />
          </button>
          {showAdditionalInfo && (
            <div className="mt-3 space-y-2.5 text-sm">
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
          )}
        </div>

        {/* Audit History Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            onClick={() => setShowAuditHistory(!showAuditHistory)}
            className="w-full flex items-center justify-between text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <span className="flex items-center gap-2">
              <History className="w-3.5 h-3.5" />
              Riwayat Perubahan
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showAuditHistory ? 'rotate-180' : ''}`}
            />
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
    {previewAttachment && typeof document !== 'undefined' && createPortal(
      <div
        className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex flex-col"
        onClick={closeAttachmentPreview}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${previewAttachment.filename}`}
      >
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{previewAttachment.filename}</p>
            <p className="text-xs text-white/60">{formatFileSize(previewAttachment.size)}</p>
          </div>
          <div className="flex items-center gap-1">
            {!isPdfAttachment(previewAttachment) && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewScale((scale) => Math.max(0.5, Number((scale - 0.25).toFixed(2))));
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                  title="Perkecil"
                  aria-label="Perkecil"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewScale(1);
                  }}
                  className="hidden sm:inline-flex h-10 px-3 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                  title="Reset zoom"
                >
                  <RotateCcw className="w-4 h-4" />
                  {Math.round(previewScale * 100)}%
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewScale((scale) => Math.min(3, Number((scale + 0.25).toFixed(2))));
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                  title="Perbesar"
                  aria-label="Perbesar"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
              </>
            )}
            <SignedAttachmentDownloadButton
              attachment={previewAttachment}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              title="Unduh file"
            >
              <Download className="w-5 h-5" />
            </SignedAttachmentDownloadButton>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeAttachmentPreview();
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              title="Tutup"
              aria-label="Tutup"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div
          className={`flex-1 min-h-0 px-4 pb-4 ${isPdfAttachment(previewAttachment) ? '' : 'overflow-auto'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {isPdfAttachment(previewAttachment) ? (
            <div className="h-full min-h-[60vh] overflow-hidden rounded-lg bg-white shadow-2xl">
              <SignedAttachmentPdf
                attachment={previewAttachment}
                title={`Preview ${previewAttachment.filename}`}
                className="h-full w-full"
              />
            </div>
          ) : (
            <div className="min-h-full flex items-center justify-center">
              <SignedAttachmentImage
                attachment={previewAttachment}
                alt={previewAttachment.filename}
                className="max-w-full max-h-full rounded-lg shadow-2xl select-none"
                style={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'center',
                  transition: 'transform 120ms ease-out',
                }}
                draggable={false}
              />
            </div>
          )}
        </div>
      </div>,
      document.body
    )}

    {/* Create Invoice from this single transaction */}
    {transaction && showInvoiceModal && (
      <CreateInvoiceFromTransactionsModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        transactions={[transaction]}
      />
    )}
    </>
  );
}

/**
 * Render satu baris attachment di daftar detail transaksi. Pakai signed URL
 * untuk file legacy bucket Supabase Storage (private setelah CRIT-04 fix).
 */
function AttachmentPreviewItem({
  attachment,
  onOpenPreview,
}: {
  attachment: TransactionAttachment;
  onOpenPreview: (att: TransactionAttachment) => void;
}) {
  const url = useDeliverableAttachmentUrl(attachment);
  const ready = !!url;
  const isImg = isImageType(attachment.mime_type);
  const isPdf = isPdfAttachment(attachment);
  const [downloading, setDownloading] = useState(false);
  const [contentLoaded, setContentLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // Saat URL berubah: reset status muat, TAPI tangani gambar yang sudah ter-cache
  // (browser cache → onLoad tidak fire) dengan mengecek `complete`.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setContentLoaded(true);
    } else {
      setContentLoaded(false);
    }
  }, [url]);

  const handleDownload = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (!ready || downloading) return;
    setDownloading(true);
    try {
      await triggerAttachmentDownload(attachment);
    } catch {
      // gagal unduh — diabaikan diam-diam; user bisa coba lagi
    } finally {
      setDownloading(false);
    }
  };

  if (isImg) {
    return (
      <button
        type="button"
        onClick={() => ready && onOpenPreview(attachment)}
        disabled={!ready}
        className="block w-full text-left group disabled:opacity-60 disabled:cursor-not-allowed"
        aria-label={`Lihat ${attachment.filename}`}
      >
        <div className="relative min-h-[8rem] overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          {ready && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={url}
              alt={attachment.filename}
              onLoad={() => setContentLoaded(true)}
              onError={() => setContentLoaded(true)}
              className={`w-full max-h-64 object-contain transition-opacity duration-300 ${contentLoaded ? 'opacity-100 group-hover:opacity-90' : 'opacity-0'}`}
            />
          )}
          {(!ready || !contentLoaded) && (
            <div className="absolute inset-0 animate-pulse bg-gray-100 dark:bg-gray-800">
              <AttachmentLoading label="Memuat gambar…" />
            </div>
          )}
          {ready && contentLoaded && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
              <ZoomIn className="w-6 h-6 text-white drop-shadow-lg" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="truncate">{attachment.filename}</span>
          <span>{formatFileSize(attachment.size)}</span>
        </div>
      </button>
    );
  }

  if (isPdf) {
    return (
      <div className={`overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 ${ready ? '' : 'opacity-60'}`}>
        <div className="relative h-80 sm:h-96 bg-gray-100 dark:bg-gray-900">
          {ready && (
            <PdfViewerFrame
              url={url}
              title={`Preview ${attachment.filename}`}
              onLoad={() => setContentLoaded(true)}
              className={`h-full w-full transition-opacity duration-300 ${contentLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          )}
          {(!ready || !contentLoaded) && (
            <div className="absolute inset-0">
              <AttachmentLoading label="Memuat PDF…" />
            </div>
          )}
          <button
            type="button"
            onClick={() => ready && onOpenPreview(attachment)}
            disabled={!ready}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-gray-600 shadow-sm ring-1 ring-gray-200 hover:bg-white hover:text-indigo-600 disabled:cursor-not-allowed dark:bg-gray-800/90 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700 dark:hover:text-indigo-300 transition-colors"
            title="Perbesar preview"
            aria-label={`Perbesar preview ${attachment.filename}`}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 border-t border-gray-200 p-3 dark:border-gray-700">
          <FileText className="h-5 w-5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
              {attachment.filename}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileSize(attachment.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => ready && onOpenPreview(attachment)}
            disabled={!ready}
            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-indigo-500 disabled:cursor-not-allowed dark:hover:bg-gray-700 dark:hover:text-indigo-400 transition-colors"
            title="Perbesar preview"
            aria-label={`Perbesar preview ${attachment.filename}`}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!ready || downloading}
            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-gray-700 dark:hover:text-indigo-400 transition-colors"
            title="Unduh file"
            aria-label={`Unduh ${attachment.filename}`}
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={!ready || downloading}
      aria-label={`Unduh ${attachment.filename}`}
      className={`flex w-full items-center gap-3 p-3 text-left bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors group ${ready && !downloading ? 'hover:bg-gray-100 dark:hover:bg-gray-800' : 'cursor-not-allowed opacity-60'}`}
    >
      <FileText className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {attachment.filename}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatFileSize(attachment.size)}
        </p>
      </div>
      <Download className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors flex-shrink-0" />
    </button>
  );
}

function PdfViewerFrame({
  url,
  title,
  ...rest
}: { url: string; title: string } & React.IframeHTMLAttributes<HTMLIFrameElement>) {
  return (
    <iframe
      {...rest}
      src={withPdfViewerParams(url)}
      title={title}
      loading="lazy"
    />
  );
}

/** Indikator loading lampiran (saat menunggu signed URL + file termuat). */
function AttachmentLoading({ dark, label = 'Memuat…' }: { dark?: boolean; label?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2">
      <Loader2 className={`h-7 w-7 animate-spin ${dark ? 'text-white/80' : 'text-indigo-500'}`} />
      <span className={`text-[11px] font-medium ${dark ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
}

/**
 * PDF iframe pembungkus yang pakai signed URL untuk src.
 */
function SignedAttachmentPdf({
  attachment,
  title,
  className,
  ...rest
}: { attachment: TransactionAttachment; title: string } & React.IframeHTMLAttributes<HTMLIFrameElement>) {
  const url = useDeliverableAttachmentUrl(attachment);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [url]);
  return (
    <div className="relative h-full w-full">
      {url && (
        <PdfViewerFrame
          {...rest}
          url={url}
          title={title}
          onLoad={() => setLoaded(true)}
          className={`${className ?? ''} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {(!url || !loaded) && (
        <div className="absolute inset-0">
          <AttachmentLoading dark label="Memuat PDF…" />
        </div>
      )}
    </div>
  );
}

/**
 * Tombol unduh lampiran — resolve signed URL lalu trigger download (bukan buka
 * di tab browser), supaya tidak perlu mengandalkan URL publik.
 */
function SignedAttachmentDownloadButton({
  attachment,
  children,
  className,
  title,
}: {
  attachment: TransactionAttachment;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const url = useDeliverableAttachmentUrl(attachment);
  const [downloading, setDownloading] = useState(false);
  const ready = !!url;
  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ready || downloading) return;
    setDownloading(true);
    try {
      await triggerAttachmentDownload(attachment);
    } catch {
      // gagal unduh — diabaikan
    } finally {
      setDownloading(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!ready || downloading}
      className={className}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

/**
 * Image pembungkus yang pakai signed URL untuk src.
 */
function SignedAttachmentImage({
  attachment,
  alt,
  className,
  ...rest
}: { attachment: TransactionAttachment; alt: string } & React.ImgHTMLAttributes<HTMLImageElement>) {
  const url = useDeliverableAttachmentUrl(attachment);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [url]);
  return (
    <div className={`relative flex items-center justify-center ${loaded ? '' : 'min-h-[40vh] min-w-[260px]'}`}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          {...rest}
          ref={imgRef}
          src={url}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className={`${className ?? ''} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {(!url || !loaded) && (
        <div className="absolute inset-0">
          <AttachmentLoading dark label="Memuat gambar…" />
        </div>
      )}
    </div>
  );
}

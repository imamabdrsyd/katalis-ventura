'use client';

import { useTransactions } from '@/hooks/useTransactions';
import { Modal } from '@/components/ui/Modal';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { MultiLineJournalForm } from '@/components/transactions/MultiLineJournalForm';
import type { MultiLineFormData } from '@/components/transactions/MultiLineJournalForm';
import { OcrResultPreviewModal } from '@/components/transactions/OcrResultPreviewModal';
import type { OcrResult } from '@/lib/ocr/types';
import { TransactionList } from '@/components/transactions/TransactionList';
import { TransactionDetailModal } from '@/components/transactions/TransactionDetailModal';
import { DeleteConfirmModal } from '@/components/transactions/DeleteConfirmModal';
import TransactionImportModal from '@/components/transactions/TransactionImportModal';
import { CreateInvoiceFromTransactionsModal } from '@/components/invoices/CreateInvoiceFromTransactionsModal';
import { useInvoiceFromTransactions } from '@/hooks/useInvoiceFromTransactions';
import type { TransactionCategory } from '@/types';
import { QuickTransactionForm } from '@/components/transactions/QuickTransactionForm';
import { RecurringList } from '@/components/transactions/RecurringList';
import { useRecurringTransactions } from '@/hooks/useRecurringTransactions';
import { Upload, TrendingUp, TrendingDown, Plus, CheckSquare, X, Trash2, MoreVertical, CreditCard, CheckCircle2, Calculator, RefreshCw, Printer, Loader2, Contact as ContactIcon, Receipt } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useLanguage } from '@/context/LanguageContext';

const CATEGORIES: TransactionCategory[] = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

function TransactionsPageInner() {
  const { t } = useLanguage();
  const router = useRouter();
  const {
    // Data
    visibleTransactions,
    filteredTransactions,
    transactions,
    allTransactions,
    loading,
    error,
    saving,
    // Business context
    user,
    businessId,
    activeBusiness,
    businessLoading,
    businessError,
    canManageTransactions,
    closedUntilDate,
    // Filter state
    statusFilter,
    setStatusFilter,
    draftCount,
    categoryFilter,
    setCategoryFilter,
    contactFilter,
    setContactFilter,
    descriptionSearch,
    setDescriptionSearch,
    dateRange,
    setDateRange,
    showFilterDropdown,
    setShowFilterDropdown,
    // Pagination
    rowsPerPage,
    setRowsPerPage,
    currentPage,
    setCurrentPage,
    totalPages,
    // Modal state
    showAddModal,
    setShowAddModal,
    showQuickAddModal,
    setShowQuickAddModal,
    showImportModal,
    setShowImportModal,
    transactionMode,
    setTransactionMode,
    detailTransaction,
    setDetailTransaction,
    editTransaction,
    setEditTransaction,
    deleteTransaction,
    setDeleteTransaction,
    // Accounts (for smart guidance)
    accounts,
    // Contacts (for contact icon in transaction list)
    contacts,
    // Follow-up prefill (for COGS entry)
    followUpPrefill,
    setFollowUpPrefill,
    handleCreateFollowUp,
    handleConvertStockToCOGS,
    // Kebab menu & select mode
    showKebabMenu,
    setShowKebabMenu,
    selectMode,
    setSelectMode,
    selectedIds,
    handleToggleSelect,
    handleSelectAll,
    handleExitSelectMode,
    handleBulkDelete,
    handleBulkPost,
    // Post actions
    handlePostTransaction,
    handleSettleReceivable,
    handlePartialSettleReceivable,
    handleSettleDividend,
    handlePartialSettleDividend,
    // Actions
    fetchTransactions,
    handleAddTransaction,
    handleAddMultiLineTransaction,
    handleQuickAddTransaction,
    handleEditTransaction,
    handleEditMultiLineTransaction,
    handleDeleteTransaction,
    handlePrint,
    handleOpenInModal,
    handleOpenOutModal,
  } = useTransactions();

  // Navigation between transactions in detail modal
  const detailIndex = useMemo(
    () => visibleTransactions.findIndex((t) => t.id === detailTransaction?.id),
    [visibleTransactions, detailTransaction]
  );
  const handleNavigatePrev = useCallback(() => {
    if (detailIndex > 0) setDetailTransaction(visibleTransactions[detailIndex - 1]);
  }, [detailIndex, visibleTransactions, setDetailTransaction]);
  const handleNavigateNext = useCallback(() => {
    if (detailIndex < visibleTransactions.length - 1) setDetailTransaction(visibleTransactions[detailIndex + 1]);
  }, [detailIndex, visibleTransactions, setDetailTransaction]);

  // Recurring transactions
  const {
    recurringList,
    loading: recurringLoading,
    activeCount: recurringActiveCount,
    handlePause: handleRecurringPause,
    handleResume: handleRecurringResume,
    handleStop: handleRecurringStop,
    handleDelete: handleRecurringDelete,
  } = useRecurringTransactions();

  // Main view tab: 'transactions' or 'recurring'
  const [activeView, setActiveView] = useState<'transactions' | 'recurring'>('transactions');

  // Multi-line prefill dari OCR scan — kalau ada, modal add render MultiLineJournalForm
  // bukan TransactionForm. Di-reset ke null saat modal ditutup.
  const [multiLineOcrPrefill, setMultiLineOcrPrefill] = useState<MultiLineFormData | null>(null);

  // OCR preview state — hasil scan struk yang sedang ditampilkan di panel preview
  // di samping modal transaksi. Null = panel tidak muncul.
  const [ocrPreviewResult, setOcrPreviewResult] = useState<OcrResult | null>(null);
  // Hasil OCR yang sudah dikonfirmasi user untuk di-apply sebagai single transaction.
  // Form yang aktif (quick/full) akan watch prop ini dan apply ke field-fieldnya.
  const [pendingOcrApply, setPendingOcrApply] = useState<OcrResult | null>(null);

  const handleConfirmSingleOcr = useCallback((result: OcrResult) => {
    setPendingOcrApply(result);
    setOcrPreviewResult(null);
  }, []);

  const handleConfirmMultiLineOcr = useCallback((data: MultiLineFormData) => {
    setMultiLineOcrPrefill(data);
    setOcrPreviewResult(null);
  }, []);

  const ocrSidePanel = ocrPreviewResult ? (
    <OcrResultPreviewModal
      result={ocrPreviewResult}
      accounts={accounts}
      onChooseSingle={handleConfirmSingleOcr}
      onChooseMultiLine={handleConfirmMultiLineOcr}
      onClose={() => setOcrPreviewResult(null)}
    />
  ) : null;

  // Tag filter state
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);

  // Collect all unique tags from the full transaction dataset so tag chips
  // stay available even when the current page/filter result is empty.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    allTransactions.forEach((t) => t.meta?.tags?.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [allTransactions]);

  // Apply tag filter on top of visibleTransactions
  const tagFilteredTransactions = useMemo(() => {
    if (activeTagFilters.length === 0) return visibleTransactions;
    return visibleTransactions.filter((t) =>
      activeTagFilters.every((tag) => t.meta?.tags?.includes(tag))
    );
  }, [visibleTransactions, activeTagFilters]);


  // Compute summary for selected transactions (across all pages)
  const selectedSummary = useMemo(() => {
    if (selectedIds.size === 0) return { masuk: 0, keluar: 0, selisih: 0 };
    let masuk = 0;
    let keluar = 0;
    for (const t of allTransactions) {
      if (!selectedIds.has(t.id)) continue;
      if (t.category === 'EARN') {
        masuk += t.amount;
      } else {
        keluar += t.amount;
      }
    }
    return { masuk, keluar, selisih: masuk - keluar };
  }, [selectedIds, allTransactions]);

  const [showSelectedSummary, setShowSelectedSummary] = useState(false);

  // Invoice-from-transactions bulk action
  const invoiceFromTxns = useInvoiceFromTransactions();
  const [showBulkInvoiceModal, setShowBulkInvoiceModal] = useState(false);
  const bulkInvoiceTransactions = useMemo(
    () => allTransactions.filter((t) => selectedIds.has(t.id)),
    [allTransactions, selectedIds]
  );
  const bulkInvoiceEligible = useMemo(() => {
    if (bulkInvoiceTransactions.length === 0) return false;
    return bulkInvoiceTransactions.every((t) =>
      invoiceFromTxns.filterInvoiceable([t]).length === 1
    );
  }, [bulkInvoiceTransactions, invoiceFromTxns]);

  const handleBulkCreateInvoice = useCallback(() => {
    const err = invoiceFromTxns.canInvoiceTransactions(bulkInvoiceTransactions);
    if (err) return; // toast already shown
    setShowBulkInvoiceModal(true);
  }, [invoiceFromTxns, bulkInvoiceTransactions]);

  // PDF export config for selected transactions
  const [showPdfConfigModal, setShowPdfConfigModal] = useState(false);
  const [pdfTitle, setPdfTitle] = useState('Daftar Transaksi');
  const [pdfSubtitle, setPdfSubtitle] = useState('');
  const [pdfExporting, setPdfExporting] = useState(false);

  const handleExportSelectedPdf = useCallback(async () => {
    if (selectedIds.size === 0 || !pdfTitle.trim()) return;
    const selected = allTransactions.filter((t) => selectedIds.has(t.id));
    setPdfExporting(true);
    try {
      const { exportSelectedTransactionsToPDF } = await import('@/lib/export');
      await exportSelectedTransactionsToPDF(
        activeBusiness?.business_name ?? 'Bisnis',
        pdfTitle.trim(),
        pdfSubtitle.trim() || undefined,
        selected
      );
      setShowPdfConfigModal(false);
    } finally {
      setPdfExporting(false);
    }
  }, [selectedIds, allTransactions, activeBusiness, pdfTitle, pdfSubtitle]);

  const toggleTagFilter = (tag: string) => {
    setActiveTagFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const hasActiveTransactionFilters = statusFilter !== 'all'
    || Boolean(categoryFilter)
    || Boolean(contactFilter)
    || Boolean(descriptionSearch)
    || Boolean(dateRange.start)
    || Boolean(dateRange.end)
    || activeTagFilters.length > 0;

  const resetTransactionFilters = useCallback(() => {
    setActiveView('transactions');
    setStatusFilter('all');
    setCategoryFilter('');
    setContactFilter('');
    setDescriptionSearch('');
    setDateRange({ start: '', end: '' });
    setActiveTagFilters([]);
    setCurrentPage(1);
  }, [setCategoryFilter, setContactFilter, setCurrentPage, setDateRange, setDescriptionSearch, setStatusFilter]);

  // Highlight recently imported transactions
  const [highlightAfter, setHighlightAfter] = useState<string | null>(null);

  const handleImportComplete = useCallback((importedAt?: string) => {
    fetchTransactions();
    if (importedAt) {
      setHighlightAfter(importedAt);
    }
  }, [fetchTransactions]);

  // Auto-clear highlight after 8 seconds
  useEffect(() => {
    if (!highlightAfter) return;
    const timer = setTimeout(() => setHighlightAfter(null), 8000);
    return () => clearTimeout(timer);
  }, [highlightAfter]);

  // Read filters from URL search params (e.g., /transactions?category=EARN&start=2026-01-01&end=2026-01-31)
  const searchParams = useSearchParams();
  const detailParam = searchParams.get('detail');

  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'recurring') {
      setActiveView('recurring');
    }

    const category = searchParams.get('category');
    if (category && CATEGORIES.includes(category as TransactionCategory)) {
      setCategoryFilter(category as TransactionCategory);
    }
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    if (start || end) {
      setDateRange({ start: start ?? '', end: end ?? '' });
    }
  }, [searchParams, setCategoryFilter, setDateRange]);

  useEffect(() => {
    if (!detailParam) return;
    const transaction =
      allTransactions.find((item) => item.id === detailParam) ??
      transactions.find((item) => item.id === detailParam);

    if (transaction) {
      setDetailTransaction(transaction);
    }
  }, [allTransactions, detailParam, setDetailTransaction, transactions]);

  const handleCloseDetailModal = useCallback(() => {
    setDetailTransaction(null);

    if (!detailParam) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('detail');
    const queryString = nextParams.toString();
    router.replace(queryString ? `/transactions?${queryString}` : '/transactions', { scroll: false });
  }, [detailParam, router, searchParams, setDetailTransaction]);

  // Compute highlighted transaction IDs based on ?highlight param
  const highlightParam = searchParams.get('highlight');
  const highlightIds = (() => {
    if (!highlightParam) return undefined;
    const endParam = searchParams.get('end');
    if (highlightParam === 'equity' && endParam) {
      // Highlight transaksi ekuitas ↔ kas (Dr Kas/Cr Ekuitas atau Dr Ekuitas/Cr Kas)
      const ids = new Set<string>();
      transactions.forEach(t => {
        if (!t.is_double_entry) return;
        const debitCode = t.debit_account?.account_code ?? '';
        const creditCode = t.credit_account?.account_code ?? '';
        const isCash = (code: string) => code === '1100' || code === '1200';
        const isEquity = (type?: string) => type === 'EQUITY';
        if (isCash(debitCode) && isEquity(t.credit_account?.account_type)) ids.add(t.id);
        if (isCash(creditCode) && isEquity(t.debit_account?.account_type)) ids.add(t.id);
      });
      return ids.size > 0 ? ids : undefined;
    }
    return new Set([highlightParam]);
  })();

  // Loading state
  if (businessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  // Error state (no business)
  if (businessError) {
    return (
      <div className="p-8">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">&#9888;&#65039;</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">{t.common.businessNotFound}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{businessError}</p>
          <a href="/setup-business" className="btn-primary">
            {t.common.setupBusiness}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
              <CreditCard className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
              {t.transactions.manageTransactions}
            </h1>
        </div>
        {canManageTransactions && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="btn-ghost flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {t.transactions.importExcel}
            </button>

            <button
              onClick={() => router.push('/transactions/journal-entry')}
              className="btn-primary-glow flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {t.transactions.journalEntry}
            </button>

            {/* TEMPORARILY HIDDEN - To re-enable, uncomment this section */}
            {/* <button
              onClick={handleOpenInModal}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
            >
              <TrendingUp className="h-5 w-5" />
              Uang Masuk
            </button>

            <button
              onClick={handleOpenOutModal}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
            >
              <TrendingDown className="h-5 w-5" />
              Uang Keluar
            </button>

            <button
              onClick={() => { setTransactionMode(null); setShowAddModal(true); }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-2"
            >
              + Form Lengkap
            </button> */}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          <button onClick={fetchTransactions} className="text-red-500 dark:text-red-400 underline text-sm mt-2">
            {t.common.retry}
          </button>
        </div>
      )}

      {/* Transaction List */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] p-5">

        {/* Status Filter Tabs + Tag Filter */}
        <div className="flex items-center mb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1 flex-1">
            <button
              onClick={resetTransactionFilters}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'transactions' && statusFilter === 'all'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.transactions.allTab}
            </button>
            <button
              onClick={() => { setActiveView('transactions'); setStatusFilter('draft'); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeView === 'transactions' && statusFilter === 'draft'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.transactions.draft}
              {draftCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                  {draftCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveView('transactions'); setStatusFilter('posted'); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'transactions' && statusFilter === 'posted'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.transactions.posted}
            </button>
            <button
              onClick={() => setActiveView('recurring')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeView === 'recurring'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t.transactions.recurring}
              {recurringActiveCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300">
                  {recurringActiveCount}
                </span>
              )}
            </button>
          </div>

          {/* Tag Filter — scrollable chips ujung kanan */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-px max-w-xs flex-shrink-0 pl-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTagFilter(tag)}
                  className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap mb-1 ${
                    activeTagFilters.includes(tag)
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 border-indigo-300 dark:border-indigo-600'
                      : 'bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 border-transparent hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Contact management shortcut */}
          {businessId && (
            <button
              onClick={() => router.push(`/businesses/${businessId}/config?tab=contacts`)}
              className="ml-2 mb-1 flex-shrink-0 p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              title="Kelola kontak"
            >
              <ContactIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Recurring List View */}
        {activeView === 'recurring' && (
          <RecurringList
            items={recurringList}
            loading={recurringLoading}
            onPause={handleRecurringPause}
            onResume={handleRecurringResume}
            onStop={handleRecurringStop}
            onDelete={handleRecurringDelete}
          />
        )}

        {/* Transaction List View */}
        {activeView === 'transactions' && <>
        {/* Select Mode Action Bar */}
        {selectMode && (
          <div className="sticky top-0 z-20 flex items-center justify-between mb-4 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {t.transactions.selected.replace('{n}', String(selectedIds.size))}
              </span>
              {selectedIds.size > 0 && (
                <>
                  <button
                    onClick={handleBulkPost}
                    disabled={saving}
                    className="btn-secondary flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t.transactions.posting}
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={saving}
                    className="btn-secondary flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t.common.delete} ({selectedIds.size})
                  </button>
                  {bulkInvoiceEligible && (
                    <button
                      onClick={handleBulkCreateInvoice}
                      disabled={saving || invoiceFromTxns.saving}
                      className="btn-secondary flex items-center gap-1.5 border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                      title="Buat invoice dari transaksi piutang terpilih"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      Buat Invoice
                    </button>
                  )}
                  <button
                    onClick={() => setShowSelectedSummary(!showSelectedSummary)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${showSelectedSummary ? 'bg-indigo-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    {t.transactions.summary}
                  </button>
                  <button
                    onClick={() => setShowPdfConfigModal(true)}
                    className="p-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    title="Ekspor ke PDF"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {showSelectedSummary && selectedIds.size > 0 && (
                <div className="flex items-center gap-3 ml-2 text-sm">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">
                    {t.transactions.cashIn} {selectedSummary.masuk.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300 font-medium">
                    {t.transactions.cashOut} {selectedSummary.keluar.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
                  </span>
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    {t.transactions.difference} {selectedSummary.selisih.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleExitSelectMode}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              title={t.common.cancel}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="overflow-auto max-h-[70vh]">
          <TransactionList
            transactions={tagFilteredTransactions}
            loading={loading}
            onRowClick={selectMode ? undefined : setDetailTransaction}
            onEdit={canManageTransactions && !selectMode ? setEditTransaction : undefined}
            onDelete={canManageTransactions && !selectMode ? setDeleteTransaction : undefined}
            selectMode={selectMode}
            selectedIds={selectedIds}
            invoicedTransactionIds={invoiceFromTxns.linkedTransactionIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            highlightAfter={highlightAfter}
            highlightIds={highlightIds}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            contactFilter={contactFilter}
            onContactFilterChange={setContactFilter}
            descriptionSearch={descriptionSearch}
            onDescriptionSearchChange={setDescriptionSearch}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            onEnterSelectMode={canManageTransactions ? () => setSelectMode(true) : undefined}
            closedUntilDate={closedUntilDate}
            rowOffset={(currentPage - 1) * rowsPerPage}
            contacts={contacts}
            hasActiveFilters={hasActiveTransactionFilters}
            onResetFilters={resetTransactionFilters}
          />
        </div>

        {/* Pagination */}
        {!loading && transactions.length > 0 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  const showPage =
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1);

                  const showEllipsis =
                    (page === currentPage - 2 && currentPage > 3) ||
                    (page === currentPage + 2 && currentPage < totalPages - 2);

                  if (showEllipsis) {
                    return (
                      <span key={page} className="px-2 text-gray-500 dark:text-gray-400">
                        ...
                      </span>
                    );
                  }

                  if (!showPage) return null;

                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[40px] h-[40px] rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-indigo-500 text-white dark:bg-indigo-500'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
            >
              <option value={5}>5 / halaman</option>
              <option value={8}>8 / halaman</option>
              <option value={10}>10 / halaman</option>
              <option value={20}>20 / halaman</option>
              <option value={50}>50 / halaman</option>
            </select>
          </div>
        )}
        </>}
      </div>

      {/* Quick Add Modal */}
      <Modal
        isOpen={showQuickAddModal}
        onClose={() => { setShowQuickAddModal(false); setMultiLineOcrPrefill(null); setOcrPreviewResult(null); setPendingOcrApply(null); }}
        title={multiLineOcrPrefill ? 'Jurnal Multi-Item (dari Struk)' : t.transactions.addTransaction}
        size={multiLineOcrPrefill ? '3xl' : 'md'}
        sidePanel={ocrSidePanel}
      >
        {multiLineOcrPrefill ? (
          <MultiLineJournalForm
            initialData={multiLineOcrPrefill}
            onSubmit={async (data) => {
              await handleAddMultiLineTransaction(data);
              setMultiLineOcrPrefill(null);
            }}
            onCancel={() => { setShowQuickAddModal(false); setMultiLineOcrPrefill(null); }}
            loading={saving}
            businessId={businessId || undefined}
            submitLabel="Simpan Jurnal"
          />
        ) : (
          <QuickTransactionForm
            onSubmit={handleQuickAddTransaction}
            onCancel={() => setShowQuickAddModal(false)}
            loading={saving}
            businessId={businessId || undefined}
            transactions={transactions}
            onConvertStockToCOGS={handleConvertStockToCOGS}
            onOcrResult={setOcrPreviewResult}
            pendingOcrApply={pendingOcrApply}
          />
        )}
      </Modal>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setTransactionMode(null); setFollowUpPrefill(null); setMultiLineOcrPrefill(null); setOcrPreviewResult(null); setPendingOcrApply(null); }}
        title={
          multiLineOcrPrefill ? 'Jurnal Multi-Item (dari Struk)' :
          followUpPrefill ? t.transactions.createCOGSEntry :
          transactionMode === 'in' ? t.transactions.moneyIn :
          transactionMode === 'out' ? t.transactions.moneyOut :
          t.transactions.fullForm
        }
        size={multiLineOcrPrefill ? '3xl' : 'md'}
        sidePanel={ocrSidePanel}
      >
        {multiLineOcrPrefill ? (
          <MultiLineJournalForm
            initialData={multiLineOcrPrefill}
            onSubmit={async (data) => {
              await handleAddMultiLineTransaction(data);
              setMultiLineOcrPrefill(null);
            }}
            onCancel={() => { setShowAddModal(false); setTransactionMode(null); setMultiLineOcrPrefill(null); }}
            loading={saving}
            businessId={businessId || undefined}
            submitLabel="Simpan Jurnal"
          />
        ) : (
          <TransactionForm
            mode={transactionMode || 'full'}
            initialValues={followUpPrefill ?? undefined}
            onSubmit={async (data) => {
              await handleAddTransaction(data);
              setFollowUpPrefill(null);
            }}
            onCancel={() => { setShowAddModal(false); setTransactionMode(null); setFollowUpPrefill(null); }}
            loading={saving}
            businessId={businessId || undefined}
            onOcrResult={setOcrPreviewResult}
            pendingOcrApply={pendingOcrApply}
          />
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editTransaction}
        onClose={() => setEditTransaction(null)}
        title={t.transactions.editTransaction}
        size={editTransaction?.is_multi_line ? '3xl' : 'md'}
      >
        {editTransaction?.is_multi_line ? (
          <MultiLineJournalForm
            initialData={editTransaction ? {
              date: editTransaction.date,
              category: editTransaction.category,
              name: editTransaction.name,
              description: editTransaction.description,
              notes: editTransaction.notes ?? undefined,
              attachments: editTransaction.meta?.attachments ?? (editTransaction.meta?.attachment ? [editTransaction.meta.attachment] : []),
              journal_lines: (editTransaction.journal_lines ?? []).map((l, i) => ({
                account_id: l.account_id,
                debit_amount: l.debit_amount,
                credit_amount: l.credit_amount,
                description: l.description ?? '',
                sort_order: l.sort_order ?? i,
              })),
            } : undefined}
            onSubmit={handleEditMultiLineTransaction as (data: MultiLineFormData) => Promise<void>}
            onCancel={() => setEditTransaction(null)}
            loading={saving}
            businessId={businessId || undefined}
            submitLabel="Update Jurnal"
          />
        ) : (
          <TransactionForm
            transaction={editTransaction}
            onSubmit={handleEditTransaction}
            onCancel={() => setEditTransaction(null)}
            loading={saving}
            businessId={businessId || undefined}
          />
        )}
      </Modal>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        transaction={detailTransaction}
        isOpen={!!detailTransaction}
        onClose={handleCloseDetailModal}
        onEdit={canManageTransactions ? setEditTransaction : undefined}
        onDelete={canManageTransactions ? setDeleteTransaction : undefined}
        onPost={canManageTransactions ? handlePostTransaction : undefined}
        accounts={accounts}
        allTransactions={allTransactions}
        onCreateFollowUp={canManageTransactions ? handleCreateFollowUp : undefined}
        onTransactionUpdated={setDetailTransaction}
        allTags={allTags}
        onSettleReceivable={canManageTransactions ? handleSettleReceivable : undefined}
        onPartialSettleReceivable={canManageTransactions ? handlePartialSettleReceivable : undefined}
        onSettleDividend={canManageTransactions ? handleSettleDividend : undefined}
        onPartialSettleDividend={canManageTransactions ? handlePartialSettleDividend : undefined}
        settleLoading={saving}
        onShowRelatedTransaction={setDetailTransaction}
        contacts={contacts}
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
        hasPrev={detailIndex > 0}
        hasNext={detailIndex < visibleTransactions.length - 1}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmModal
        isOpen={!!deleteTransaction}
        onClose={() => setDeleteTransaction(null)}
        onConfirm={handleDeleteTransaction}
        loading={saving}
        transactionDescription={deleteTransaction?.description || ''}
      />

      {/* Import Modal */}
      {businessId && user && (
        <TransactionImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          businessId={businessId}
          userId={user.id}
          onImportComplete={handleImportComplete}
        />
      )}

      {/* PDF Export Config Modal */}
      <Modal
        isOpen={showPdfConfigModal}
        onClose={() => { if (!pdfExporting) setShowPdfConfigModal(false); }}
        title="Ekspor ke PDF"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {selectedIds.size} transaksi terpilih akan diekspor ke PDF.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Judul <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={pdfTitle}
              onChange={(e) => setPdfTitle(e.target.value)}
              placeholder="Daftar Transaksi"
              disabled={pdfExporting}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sub judul <span className="text-gray-400 text-xs">(opsional)</span>
            </label>
            <input
              type="text"
              value={pdfSubtitle}
              onChange={(e) => setPdfSubtitle(e.target.value)}
              placeholder="Contoh: Periode Januari 2026"
              disabled={pdfExporting}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowPdfConfigModal(false)}
              disabled={pdfExporting}
              className="btn-secondary"
            >
              Batal
            </button>
            <button
              onClick={handleExportSelectedPdf}
              disabled={pdfExporting || !pdfTitle.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {pdfExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  Ekspor PDF
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk: Create Invoice from selected transactions */}
      <CreateInvoiceFromTransactionsModal
        isOpen={showBulkInvoiceModal}
        onClose={() => setShowBulkInvoiceModal(false)}
        transactions={bulkInvoiceTransactions}
        onSuccess={() => {
          setShowBulkInvoiceModal(false);
          handleExitSelectMode();
        }}
      />

    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center min-h-[50vh]"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <TransactionsPageInner />
    </Suspense>
  );
}

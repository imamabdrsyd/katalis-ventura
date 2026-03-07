'use client';

import { useTransactions } from '@/hooks/useTransactions';
import { Modal } from '@/components/ui/Modal';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { TransactionList } from '@/components/transactions/TransactionList';
import { TransactionDetailModal } from '@/components/transactions/TransactionDetailModal';
import { DeleteConfirmModal } from '@/components/transactions/DeleteConfirmModal';
import TransactionImportModal from '@/components/transactions/TransactionImportModal';
import type { TransactionCategory } from '@/types';
import { QuickTransactionForm } from '@/components/transactions/QuickTransactionForm';
import { Upload, TrendingUp, TrendingDown, BookOpen, CheckSquare, X, Trash2, MoreVertical, CreditCard } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense } from 'react';

const CATEGORIES: TransactionCategory[] = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

const CATEGORY_LABELS_ID: Record<TransactionCategory, string> = {
  EARN: 'Pendapatan',
  OPEX: 'Beban Operasional',
  VAR: 'Beban Variabel',
  CAPEX: 'Belanja Modal',
  TAX: 'Pajak',
  FIN: 'Financing',
};

function TransactionsPageInner() {
  const router = useRouter();
  const {
    // Data
    visibleTransactions,
    filteredTransactions,
    transactions,
    loading,
    error,
    saving,
    // Business context
    user,
    businessId,
    businessLoading,
    businessError,
    canManageTransactions,
    // Filter state
    categoryFilter,
    setCategoryFilter,
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
    // Actions
    fetchTransactions,
    handleAddTransaction,
    handleQuickAddTransaction,
    handleEditTransaction,
    handleDeleteTransaction,
    handlePrint,
    handleOpenInModal,
    handleOpenOutModal,
  } = useTransactions();

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
  useEffect(() => {
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
    return undefined;
  })();

  // Loading state
  if (businessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Memuat...</p>
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
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Bisnis Tidak Ditemukan</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{businessError}</p>
          <a href="/setup-business" className="btn-primary">
            Setup Bisnis
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
              Kelola Transaksi
            </h1>
        </div>
        {canManageTransactions && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Import Excel
            </button>

            <button
              onClick={() => router.push('/transactions/journal-entry')}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors flex items-center gap-2 font-medium shadow-sm"
            >
              <BookOpen className="h-4 w-4" />
              Journal Entry
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
            Coba lagi
          </button>
        </div>
      )}

      {/* Transaction List */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] p-5">

        {/* Select Mode Action Bar */}
        {selectMode && (
          <div className="flex items-center justify-between mb-4 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-600 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-indigo-500 dark:text-indigo-300">
                {selectedIds.size} transaksi dipilih
              </span>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={saving}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus ({selectedIds.size})
                </button>
              )}
            </div>
            <button
              onClick={handleExitSelectMode}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              title="Batal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="overflow-auto max-h-[70vh]">
          <TransactionList
            transactions={visibleTransactions}
            loading={loading}
            onRowClick={selectMode ? undefined : setDetailTransaction}
            onEdit={canManageTransactions && !selectMode ? setEditTransaction : undefined}
            onDelete={canManageTransactions && !selectMode ? setDeleteTransaction : undefined}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            highlightAfter={highlightAfter}
            highlightIds={highlightIds}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            onEnterSelectMode={canManageTransactions ? () => setSelectMode(true) : undefined}
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
      </div>

      {/* Quick Add Modal */}
      <Modal
        isOpen={showQuickAddModal}
        onClose={() => setShowQuickAddModal(false)}
        title="Tambah Transaksi"
      >
        <QuickTransactionForm
          onSubmit={handleQuickAddTransaction}
          onCancel={() => setShowQuickAddModal(false)}
          loading={saving}
          businessId={businessId || undefined}
          transactions={transactions}
          onConvertStockToCOGS={handleConvertStockToCOGS}
        />
      </Modal>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setTransactionMode(null); setFollowUpPrefill(null); }}
        title={
          followUpPrefill ? 'Buat Entry COGS' :
          transactionMode === 'in' ? 'Uang Masuk' :
          transactionMode === 'out' ? 'Uang Keluar' :
          'Tambah Transaksi (Form Lengkap)'
        }
      >
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
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editTransaction}
        onClose={() => setEditTransaction(null)}
        title="Edit Transaksi"
      >
        <TransactionForm
          transaction={editTransaction}
          onSubmit={handleEditTransaction}
          onCancel={() => setEditTransaction(null)}
          loading={saving}
          businessId={businessId || undefined}
        />
      </Modal>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        transaction={detailTransaction}
        isOpen={!!detailTransaction}
        onClose={() => setDetailTransaction(null)}
        onEdit={canManageTransactions ? setEditTransaction : undefined}
        onDelete={canManageTransactions ? setDeleteTransaction : undefined}
        accounts={accounts}
        allTransactions={transactions}
        onCreateFollowUp={canManageTransactions ? handleCreateFollowUp : undefined}
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

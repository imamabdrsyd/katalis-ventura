'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import { Modal } from '@/components/ui/Modal';
import { TransactionForm, TransactionFormData } from '@/components/transactions/TransactionForm';
import { TransactionList } from '@/components/transactions/TransactionList';
import { TransactionDetailModal } from '@/components/transactions/TransactionDetailModal';
import { DeleteConfirmModal } from '@/components/transactions/DeleteConfirmModal';
import TransactionImportModal from '@/components/transactions/TransactionImportModal';
import * as transactionsApi from '@/lib/api/transactions';
import type { Transaction, TransactionCategory } from '@/types';
import { Upload, Plus } from 'lucide-react';

const CATEGORIES: TransactionCategory[] = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

const CATEGORY_LABELS_ID: Record<TransactionCategory, string> = {
  EARN: 'Pendapatan',
  OPEX: 'Beban Operasional',
  VAR: 'Beban Variabel',
  CAPEX: 'Belanja Modal',
  TAX: 'Pajak',
  FIN: 'Financing',
};

export default function TransactionsPage() {
  const { user, activeBusinessId: businessId, loading: businessLoading, error: businessError, userRole } = useBusinessContext();
  const canManageTransactions = userRole === 'business_manager' || userRole === 'both';

  // Transaction state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<TransactionCategory | ''>('');

  // Table state
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Apply filters
  const filteredTransactions = transactions.filter((transaction) => {
    // Date range filter
    if (dateRange.start && new Date(transaction.date) < new Date(dateRange.start)) {
      return false;
    }
    if (dateRange.end && new Date(transaction.date) > new Date(dateRange.end)) {
      return false;
    }
    return true;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredTransactions.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const visibleTransactions = filteredTransactions.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, rowsPerPage, dateRange]);

  // Handle print/export to PDF
  const handlePrint = () => {
    window.print();
  };

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [quickAddMode, setQuickAddMode] = useState<'earn' | 'spend' | null>(null);
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [deleteTransaction, setDeleteTransaction] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!businessId) return;

    setLoading(true);
    setError(null);

    try {
      let data = await transactionsApi.getTransactions(businessId);

      // Apply category filter
      if (categoryFilter) {
        data = data.filter((t) => t.category === categoryFilter);
      }

      setTransactions(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat transaksi');
    } finally {
      setLoading(false);
    }
  }, [businessId, categoryFilter]);

  useEffect(() => {
    if (businessId) {
      fetchTransactions();
    }
  }, [businessId, fetchTransactions]);

  // Handle add transaction
  const handleAddTransaction = async (data: TransactionFormData) => {
    if (!businessId || !user) return;

    setSaving(true);
    try {
      await transactionsApi.createTransaction({
        ...data,
        business_id: businessId,
        created_by: user.id,
      });
      setShowAddModal(false);
      setQuickAddMode(null);
      fetchTransactions();
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan transaksi');
    } finally {
      setSaving(false);
    }
  };

  // Handle edit transaction
  const handleEditTransaction = async (data: TransactionFormData) => {
    if (!editTransaction) return;

    setSaving(true);
    try {
      await transactionsApi.updateTransaction(editTransaction.id, data);
      setEditTransaction(null);
      fetchTransactions();
    } catch (err: any) {
      alert(err.message || 'Gagal mengupdate transaksi');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete transaction
  const handleDeleteTransaction = async () => {
    if (!deleteTransaction) return;

    setSaving(true);
    try {
      await transactionsApi.deleteTransaction(deleteTransaction.id);
      setDeleteTransaction(null);
      fetchTransactions();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus transaksi');
    } finally {
      setSaving(false);
    }
  };

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
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
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
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Kelola Transaksi</h1>
          {/* <p className="text-gray-500 mt-1">
            {canManageTransactions ? 'Kelola transaksi keuangan bisnis Anda' : 'Lihat transaksi keuangan bisnis'}
          </p> */}
        </div>
        {canManageTransactions && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Import Excel
            </button>
            <button onClick={() => setShowAddModal(true)} className="btn-primary">
              + Tambah Transaksi
            </button>
          </div>
        )}
      </div>


      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          <button onClick={fetchTransactions} className="text-red-600 dark:text-red-400 underline text-sm mt-2">
            Coba lagi
          </button>
        </div>
      )}

      {/* Transaction List */}
      <div className="card-static">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          {/* Left side - Date Range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              placeholder="Start date"
            />
            <span className="text-gray-500 dark:text-gray-400">-</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              placeholder="End date"
            />
            <button
              onClick={handlePrint}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Print / Export to PDF"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </button>
          </div>

          {/* Right side - Controls */}
          <div className="flex items-center gap-2">
            {/* Rows per page */}
            <div className="relative">
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="appearance-none pl-4 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
              >
                <option value={5}>Show 5 Row</option>
                <option value={8}>Show 8 Row</option>
                <option value={10}>Show 10 Row</option>
                <option value={20}>Show 20 Row</option>
                <option value={50}>Show 50 Row</option>
              </select>
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Quick Add Buttons */}
            {canManageTransactions && (
              <>
                <button
                  onClick={() => setQuickAddMode('earn')}
                  className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Sales</span>
                </button>
                <button
                  onClick={() => setQuickAddMode('spend')}
                  className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  <span>Pay</span>
                </button>
              </>
            )}

            {/* Filter */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  showFilterDropdown ? 'bg-gray-50 dark:bg-gray-700' : ''
                }`}
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>

              {/* Filter Dropdown */}
              {showFilterDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowFilterDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                    <div className="p-3">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Filter Kategori</p>
                      <div className="space-y-1">
                        <button
                          onClick={() => {
                            setCategoryFilter('');
                            setShowFilterDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                            categoryFilter === ''
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          Semua Kategori
                        </button>
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => {
                              setCategoryFilter(cat);
                              setShowFilterDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                              categoryFilter === cat
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            {CATEGORY_LABELS_ID[cat]} ({cat})
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* More options */}
            <button className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </div>

        <TransactionList
          transactions={visibleTransactions}
          loading={loading}
          onRowClick={setDetailTransaction}
          onEdit={canManageTransactions ? setEditTransaction : undefined}
          onDelete={canManageTransactions ? setDeleteTransaction : undefined}
        />

        {/* Pagination */}
        {!loading && transactions.length > 0 && (
          <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
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
                // Show first page, last page, current page, and pages around current
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
                        ? 'bg-indigo-600 text-white dark:bg-indigo-500'
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
        )}
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Tambah Transaksi"
      >
        <TransactionForm
          onSubmit={handleAddTransaction}
          onCancel={() => setShowAddModal(false)}
          loading={saving}
          businessId={businessId || undefined}
        />
      </Modal>

      {/* Quick Add Earn Modal */}
      <Modal
        isOpen={quickAddMode === 'earn'}
        onClose={() => setQuickAddMode(null)}
        title="Tambah Pemasukan"
      >
        <TransactionForm
          onSubmit={handleAddTransaction}
          onCancel={() => setQuickAddMode(null)}
          loading={saving}
          defaultCategory="EARN"
          allowedCategories={['EARN']}
          businessId={businessId || undefined}
        />
      </Modal>

      {/* Quick Add Spend Modal */}
      <Modal
        isOpen={quickAddMode === 'spend'}
        onClose={() => setQuickAddMode(null)}
        title="Tambah Pengeluaran"
      >
        <TransactionForm
          onSubmit={handleAddTransaction}
          onCancel={() => setQuickAddMode(null)}
          loading={saving}
          defaultCategory="OPEX"
          allowedCategories={['OPEX', 'VAR']}
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
          onImportComplete={fetchTransactions}
        />
      )}
    </div>
  );
}

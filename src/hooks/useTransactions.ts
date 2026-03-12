'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBusinessContext } from '@/context/BusinessContext';
import * as transactionsApi from '@/lib/api/transactions';
import { getAccounts } from '@/lib/api/accounts';
import { findCogsAccount } from '@/lib/utils/inventoryHelper';
import type { Transaction, TransactionCategory, TransactionStatus, Account } from '@/types';
import type { TransactionFormData } from '@/components/transactions/TransactionForm';
import type { TransactionFilters } from '@/lib/api/transactions';

export function useTransactions() {
  const { user, activeBusinessId: businessId, loading: businessLoading, error: businessError, userRole } = useBusinessContext();
  const canManageTransactions = userRole === 'business_manager' || userRole === 'both';
  const queryClient = useQueryClient();

  // Filter state
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<TransactionCategory | ''>('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [transactionMode, setTransactionMode] = useState<'in' | 'out' | null>(null);
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [deleteTransaction, setDeleteTransaction] = useState<Transaction | null>(null);

  // Accounts state (for smart guidance in detail modal)
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Follow-up prefill state (for COGS entry guidance)
  const [followUpPrefill, setFollowUpPrefill] = useState<Partial<TransactionFormData> | null>(null);

  // Kebab menu & select mode state
  const [showKebabMenu, setShowKebabMenu] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Build filters object for server-side query
  const filters: TransactionFilters = useMemo(() => ({
    status: statusFilter,
    category: categoryFilter,
    startDate: dateRange.start,
    endDate: dateRange.end,
  }), [statusFilter, categoryFilter, dateRange]);

  // Server-side paginated query — filters & pagination handled by Supabase
  const {
    data: paginatedResult,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ['transactions-paginated', businessId, currentPage, rowsPerPage, filters],
    queryFn: () => transactionsApi.getTransactionsPaginated(businessId!, currentPage, rowsPerPage, filters),
    enabled: !!businessId,
    placeholderData: (prev) => prev, // Keep previous data while fetching (smooth pagination)
  });

  // Also fetch all transactions (lightweight — shared cache with dashboard/reports)
  // Used only for draftCount badge
  const { data: allTransactions = [] } = useQuery({
    queryKey: ['transactions', businessId],
    queryFn: () => transactionsApi.getTransactions(businessId!),
    enabled: !!businessId,
  });

  const transactions = paginatedResult?.data ?? [];
  const totalPages = paginatedResult?.totalPages ?? 0;
  const totalCount = paginatedResult?.totalCount ?? 0;
  const error = queryError?.message ?? null;

  // visibleTransactions = transactions from server (already paginated)
  const visibleTransactions = transactions;

  // filteredTransactions kept for backward compat (same as transactions since server already filtered)
  const filteredTransactions = transactions;

  // Count drafts from full dataset for badge display
  const draftCount = useMemo(() => allTransactions.filter((t) => t.status === 'draft').length, [allTransactions]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, categoryFilter, rowsPerPage, dateRange]);

  // Fetch accounts for smart guidance
  const fetchAccounts = useCallback(async () => {
    if (!businessId) return;
    try {
      const data = await getAccounts(businessId);
      setAccounts(data);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      fetchAccounts();
    }
  }, [businessId, fetchAccounts]);

  // Refetch ketika FloatingQuickAdd berhasil menyimpan transaksi
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['transactions-paginated', businessId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', businessId] });
    };
    window.addEventListener('transaction-saved', handler);
    return () => window.removeEventListener('transaction-saved', handler);
  }, [queryClient, businessId]);

  // Helper to invalidate all transaction caches
  const invalidateTransactions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['transactions-paginated', businessId] });
    queryClient.invalidateQueries({ queryKey: ['transactions', businessId] });
  }, [queryClient, businessId]);

  // Kept for backward compat — now just triggers cache invalidation
  const fetchTransactions = useCallback(() => {
    invalidateTransactions();
  }, [invalidateTransactions]);

  // CRUD handlers
  const handleAddTransaction = useCallback(async (data: TransactionFormData) => {
    if (!businessId || !user) return;
    setSaving(true);
    try {
      await transactionsApi.createTransaction({
        ...data,
        business_id: businessId,
        created_by: user.id,
      });
      setShowAddModal(false);
      setTransactionMode(null);
      invalidateTransactions();
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan transaksi');
    } finally {
      setSaving(false);
    }
  }, [businessId, user, invalidateTransactions]);

  const handleEditTransaction = useCallback(async (data: TransactionFormData) => {
    if (!editTransaction) return;
    setSaving(true);
    try {
      await transactionsApi.updateTransaction(editTransaction.id, data);
      setEditTransaction(null);
      invalidateTransactions();
    } catch (err: any) {
      alert(err.message || 'Gagal mengupdate transaksi');
    } finally {
      setSaving(false);
    }
  }, [editTransaction, invalidateTransactions]);

  const handleDeleteTransaction = useCallback(async () => {
    if (!deleteTransaction) return;
    setSaving(true);
    try {
      await transactionsApi.deleteTransaction(deleteTransaction.id);
      setDeleteTransaction(null);
      invalidateTransactions();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus transaksi');
    } finally {
      setSaving(false);
    }
  }, [deleteTransaction, invalidateTransactions]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleOpenInModal = useCallback(() => {
    setTransactionMode('in');
    setShowAddModal(true);
  }, []);

  const handleOpenOutModal = useCallback(() => {
    setTransactionMode('out');
    setShowAddModal(true);
  }, []);

  const handleOpenQuickAddModal = useCallback(() => {
    setShowQuickAddModal(true);
  }, []);

  const handleQuickAddTransaction = useCallback(async (data: TransactionFormData) => {
    if (!businessId || !user) return;
    setSaving(true);
    try {
      await transactionsApi.createTransaction({
        ...data,
        business_id: businessId,
        created_by: user.id,
      });
      setShowQuickAddModal(false);
      invalidateTransactions();
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan transaksi');
    } finally {
      setSaving(false);
    }
  }, [businessId, user, invalidateTransactions]);

  // Convert stock transactions to COGS: change debit from Inventory to COGS account
  const handleConvertStockToCOGS = useCallback(async (transactionIds: string[]) => {
    if (transactionIds.length === 0) return;

    const cogsAccount = findCogsAccount(accounts);
    if (!cogsAccount) {
      throw new Error('Tidak ada akun HPP/Beban yang aktif. Silakan buat akun beban terlebih dahulu.');
    }

    for (const txId of transactionIds) {
      await transactionsApi.updateTransaction(txId, {
        debit_account_id: cogsAccount.id,
      });
    }
  }, [accounts]);

  // Toggle select for a single transaction
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Select all visible transactions
  const handleSelectAll = useCallback(() => {
    const allVisible = new Set(visibleTransactions.map((t) => t.id));
    setSelectedIds((prev) => {
      const allSelected = visibleTransactions.every((t) => prev.has(t.id));
      if (allSelected) return new Set(); // deselect all
      return allVisible;
    });
  }, [visibleTransactions]);

  // Exit select mode
  const handleExitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  // Bulk delete selected transactions
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      for (const id of selectedIds) {
        await transactionsApi.deleteTransaction(id);
      }
      setSelectedIds(new Set());
      setSelectMode(false);
      invalidateTransactions();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus transaksi');
    } finally {
      setSaving(false);
    }
  }, [selectedIds, invalidateTransactions]);

  // Post a single draft transaction
  const handlePostTransaction = useCallback(async (id: string) => {
    setSaving(true);
    try {
      await transactionsApi.postTransaction(id);
      setDetailTransaction(null);
      invalidateTransactions();
    } catch (err: any) {
      alert(err.message || 'Gagal memposting transaksi');
    } finally {
      setSaving(false);
    }
  }, [invalidateTransactions]);

  // Bulk post selected draft transactions
  const handleBulkPost = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      const draftIds = [...selectedIds].filter((id) => {
        const tx = transactions.find((t) => t.id === id);
        return tx?.status === 'draft';
      });
      if (draftIds.length === 0) {
        alert('Tidak ada transaksi draft yang dipilih');
        return;
      }
      const posted = await transactionsApi.postTransactionsBulk(draftIds);
      setSelectedIds(new Set());
      setSelectMode(false);
      invalidateTransactions();
      alert(`${posted} transaksi berhasil diposting`);
    } catch (err: any) {
      alert(err.message || 'Gagal memposting transaksi');
    } finally {
      setSaving(false);
    }
  }, [selectedIds, transactions, invalidateTransactions]);

  // Handle COGS follow-up: close detail modal and open TransactionForm with prefill
  const handleCreateFollowUp = useCallback((prefillData: Partial<TransactionFormData>) => {
    setDetailTransaction(null);
    setFollowUpPrefill(prefillData);
    setTransactionMode(null);
    setShowAddModal(true);
  }, []);

  return {
    // Data
    transactions,
    filteredTransactions,
    visibleTransactions,
    loading,
    error,
    saving,
    totalCount,
    // Business context
    user,
    businessId,
    businessLoading,
    businessError,
    canManageTransactions,
    // Filter state
    statusFilter,
    setStatusFilter,
    draftCount,
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
    handleBulkPost,
    // Post actions
    handlePostTransaction,
    // Actions
    fetchTransactions,
    handleAddTransaction,
    handleQuickAddTransaction,
    handleEditTransaction,
    handleDeleteTransaction,
    handlePrint,
    handleOpenInModal,
    handleOpenOutModal,
    handleOpenQuickAddModal,
  };
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import * as transactionsApi from '@/lib/api/transactions';
import { getAccounts } from '@/lib/api/accounts';
import { findCogsAccount } from '@/lib/utils/inventoryHelper';
import type { Transaction, TransactionCategory, Account } from '@/types';
import type { TransactionFormData } from '@/components/transactions/TransactionForm';

export function useTransactions() {
  const { user, activeBusinessId: businessId, loading: businessLoading, error: businessError, userRole } = useBusinessContext();
  const canManageTransactions = userRole === 'business_manager' || userRole === 'both';

  // Transaction state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<TransactionCategory | ''>('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
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

  // Apply filters
  const filteredTransactions = transactions.filter((transaction) => {
    if (dateRange.start && new Date(transaction.date) < new Date(dateRange.start)) return false;
    if (dateRange.end && new Date(transaction.date) > new Date(dateRange.end)) return false;
    return true;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredTransactions.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const visibleTransactions = filteredTransactions.slice(startIndex, startIndex + rowsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, rowsPerPage, dateRange]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      let data = await transactionsApi.getTransactions(businessId);
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
      fetchTransactions();
      fetchAccounts();
    }
  }, [businessId, fetchTransactions, fetchAccounts]);

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
      fetchTransactions();
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan transaksi');
    } finally {
      setSaving(false);
    }
  }, [businessId, user, fetchTransactions]);

  const handleEditTransaction = useCallback(async (data: TransactionFormData) => {
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
  }, [editTransaction, fetchTransactions]);

  const handleDeleteTransaction = useCallback(async () => {
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
  }, [deleteTransaction, fetchTransactions]);

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
      fetchTransactions();
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan transaksi');
    } finally {
      setSaving(false);
    }
  }, [businessId, user, fetchTransactions]);

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
      fetchTransactions();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus transaksi');
    } finally {
      setSaving(false);
    }
  }, [selectedIds, fetchTransactions]);

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
    handleOpenQuickAddModal,
  };
}

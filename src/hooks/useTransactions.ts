'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import * as transactionsApi from '@/lib/api/transactions';
import type { Transaction, TransactionCategory } from '@/types';
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [transactionMode, setTransactionMode] = useState<'in' | 'out' | null>(null);
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [deleteTransaction, setDeleteTransaction] = useState<Transaction | null>(null);

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

  useEffect(() => {
    if (businessId) {
      fetchTransactions();
    }
  }, [businessId, fetchTransactions]);

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
    // Actions
    fetchTransactions,
    handleAddTransaction,
    handleEditTransaction,
    handleDeleteTransaction,
    handlePrint,
    handleOpenInModal,
    handleOpenOutModal,
  };
}

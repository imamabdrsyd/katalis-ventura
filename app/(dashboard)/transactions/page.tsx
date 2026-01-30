'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import { Modal } from '@/components/ui/Modal';
import { TransactionForm, TransactionFormData } from '@/components/transactions/TransactionForm';
import { TransactionList } from '@/components/transactions/TransactionList';
import { DeleteConfirmModal } from '@/components/transactions/DeleteConfirmModal';
import { CATEGORY_LABELS } from '@/lib/calculations';
import * as transactionsApi from '@/lib/api/transactions';
import type { Transaction, TransactionCategory } from '@/types';

const CATEGORIES: TransactionCategory[] = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

export default function TransactionsPage() {
  const { user, activeBusinessId: businessId, loading: businessLoading, error: businessError, userRole } = useBusinessContext();
  const canManageTransactions = userRole === 'business_manager' || userRole === 'both';

  // Transaction state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<TransactionCategory | ''>('');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
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
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Transaksi</h1>
          {/* <p className="text-gray-500 mt-1">
            {canManageTransactions ? 'Kelola transaksi keuangan bisnis Anda' : 'Lihat transaksi keuangan bisnis'}
          </p> */}
        </div>
        {canManageTransactions && (
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            + Tambah Transaksi
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card-static mb-6">
        <div className="flex items-center gap-4">
          <div>
            <label className="label">Filter Kategori</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as TransactionCategory | '')}
              className="input"
              style={{ minWidth: '200px' }}
            >
              <option value="">Semua Kategori</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>
          {categoryFilter && (
            <button
              onClick={() => setCategoryFilter('')}
              className="btn-secondary mt-6"
            >
              Reset Filter
            </button>
          )}
        </div>
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
        <TransactionList
          transactions={transactions}
          loading={loading}
          onEdit={canManageTransactions ? setEditTransaction : undefined}
          onDelete={canManageTransactions ? setDeleteTransaction : undefined}
        />
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
        />
      </Modal>

      {/* Delete Confirmation */}
      <DeleteConfirmModal
        isOpen={!!deleteTransaction}
        onClose={() => setDeleteTransaction(null)}
        onConfirm={handleDeleteTransaction}
        loading={saving}
        transactionDescription={deleteTransaction?.description || ''}
      />
    </div>
  );
}

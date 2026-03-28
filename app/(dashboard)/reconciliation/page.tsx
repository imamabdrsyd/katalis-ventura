'use client';

import React, { Suspense } from 'react';
import {
  CheckCircle2,
  Circle,
  Calendar,
  ArrowLeftRight,
  Check,
  Undo2,
  AlertTriangle,
} from 'lucide-react';
import { useReconciliation } from '@/hooks/useReconciliation';
import { formatCurrency } from '@/lib/utils';
import type { Transaction } from '@/types';

const CATEGORY_COLORS: Record<string, string> = {
  EARN: 'text-emerald-600 dark:text-emerald-400',
  OPEX: 'text-red-600 dark:text-red-400',
  VAR: 'text-pink-600 dark:text-pink-400',
  CAPEX: 'text-blue-600 dark:text-blue-400',
  TAX: 'text-yellow-600 dark:text-yellow-400',
  FIN: 'text-indigo-600 dark:text-indigo-400',
};

function getCashDirection(t: Transaction): 'in' | 'out' {
  if (t.is_double_entry) {
    const dc = t.debit_account?.account_code;
    if (dc === '1100' || dc === '1200') return 'in';
    return 'out';
  }
  if (t.category === 'EARN' || t.category === 'FIN') return 'in';
  return 'out';
}

function ReconciliationPageInner() {
  const {
    activeBusiness,
    loading,
    saving,
    displayedTransactions,
    unreconciledTransactions,
    reconciledTransactions,
    bookBalance,
    bankBalance,
    setBankBalance,
    bankBalanceNum,
    difference,
    showReconciled,
    setShowReconciled,
    dateRange,
    setDateRange,
    selectedIds,
    toggleSelect,
    selectAll,
    selectedAmount,
    reconcileSelected,
    unreconcile,
  } = useReconciliation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (!activeBusiness) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500 dark:text-gray-400">Pilih bisnis terlebih dahulu.</p>
      </div>
    );
  }

  const isBalanced = Math.abs(difference) < 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
            <ArrowLeftRight className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
            Rekonsiliasi Bank
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cocokkan saldo buku dengan saldo bank — {activeBusiness.business_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange((d) => ({ ...d, start: e.target.value }))}
            className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
          />
          <span className="text-xs text-gray-400">—</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange((d) => ({ ...d, end: e.target.value }))}
            className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
          />
        </div>
      </div>

      {/* Balance Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Book Balance */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Saldo Buku</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(bookBalance)}</p>
          <p className="text-xs text-gray-500 mt-1">
            {unreconciledTransactions.length + reconciledTransactions.length} transaksi kas/bank
          </p>
        </div>

        {/* Bank Balance Input */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Saldo Bank (Mutasi)</p>
          <input
            type="number"
            value={bankBalance}
            onChange={(e) => setBankBalance(e.target.value)}
            placeholder="Masukkan saldo bank..."
            className="w-full text-xl font-bold bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600"
          />
          <p className="text-xs text-gray-500 mt-1">Dari rekening koran / mutasi bank</p>
        </div>

        {/* Difference */}
        <div className={`rounded-xl border p-4 ${
          !bankBalance ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800' :
          isBalanced ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' :
          'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {!bankBalance ? (
              <ArrowLeftRight className="w-4 h-4 text-gray-400" />
            ) : isBalanced ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            )}
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Selisih</p>
          </div>
          <p className={`text-xl font-bold ${
            !bankBalance ? 'text-gray-400' :
            isBalanced ? 'text-emerald-600 dark:text-emerald-400' :
            'text-amber-600 dark:text-amber-400'
          }`}>
            {bankBalance ? formatCurrency(difference) : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {!bankBalance ? 'Masukkan saldo bank' : isBalanced ? 'Saldo cocok!' : 'Bank - Buku'}
          </p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 mb-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            {/* Tab toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              <button
                onClick={() => setShowReconciled(false)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  !showReconciled
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Belum Dicocokkan
                <span className="ml-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs px-1.5 py-0.5 rounded-full">
                  {unreconciledTransactions.length}
                </span>
              </button>
              <button
                onClick={() => setShowReconciled(true)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  showReconciled
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Sudah Dicocokkan
                <span className="ml-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs px-1.5 py-0.5 rounded-full">
                  {reconciledTransactions.length}
                </span>
              </button>
            </div>
          </div>

          {/* Reconcile button */}
          {!showReconciled && selectedIds.size > 0 && (
            <button
              onClick={reconcileSelected}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <Check className="w-4 h-4" />
              Cocokkan {selectedIds.size} transaksi ({formatCurrency(selectedAmount)})
            </button>
          )}
        </div>

        {/* Transaction List */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {displayedTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">
                {showReconciled ? 'Belum ada transaksi yang dicocokkan' : 'Semua transaksi sudah dicocokkan'}
              </p>
            </div>
          ) : (
            <>
              {/* Select all header (only for unreconciled) */}
              {!showReconciled && unreconciledTransactions.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-800/50">
                  <button onClick={selectAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    {unreconciledTransactions.every((t) => selectedIds.has(t.id))
                      ? 'Batalkan semua'
                      : 'Pilih semua'}
                  </button>
                </div>
              )}
              {displayedTransactions.map((t) => (
                <ReconciliationRow
                  key={t.id}
                  transaction={t}
                  isSelected={selectedIds.has(t.id)}
                  isReconciled={showReconciled}
                  onToggle={() => toggleSelect(t.id)}
                  onUnreconcile={() => unreconcile(t.id)}
                  saving={saving}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReconciliationRow({
  transaction: t,
  isSelected,
  isReconciled,
  onToggle,
  onUnreconcile,
  saving,
}: {
  transaction: Transaction;
  isSelected: boolean;
  isReconciled: boolean;
  onToggle: () => void;
  onUnreconcile: () => void;
  saving: boolean;
}) {
  const direction = getCashDirection(t);
  const amount = Number(t.amount);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${
        isSelected ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''
      }`}
      onClick={!isReconciled ? onToggle : undefined}
    >
      {/* Checkbox / Status */}
      <div className="flex-shrink-0">
        {isReconciled ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : isSelected ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : (
          <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
        )}
      </div>

      {/* Date */}
      <div className="w-24 flex-shrink-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      </div>

      {/* Name & Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{t.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{t.description}</p>
      </div>

      {/* Category */}
      <span className={`text-xs font-medium ${CATEGORY_COLORS[t.category] || 'text-gray-500'}`}>
        {t.category}
      </span>

      {/* Amount */}
      <div className="w-32 text-right flex-shrink-0">
        <p className={`text-sm font-semibold ${amount === 0 ? 'text-gray-500 dark:text-gray-400' : direction === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
          {amount === 0 ? '' : direction === 'in' ? '+' : '-'}{formatCurrency(amount)}
        </p>
      </div>

      {/* Un-reconcile action */}
      {isReconciled && (
        <button
          onClick={(e) => { e.stopPropagation(); onUnreconcile(); }}
          disabled={saving}
          className="flex-shrink-0 p-1.5 text-gray-400 hover:text-amber-500 transition-colors disabled:opacity-50"
          title="Batalkan rekonsiliasi"
        >
          <Undo2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default function ReconciliationPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
      </div>
    }>
      <ReconciliationPageInner />
    </Suspense>
  );
}

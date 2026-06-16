'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  CheckSquare,
  Square,
  Calendar,
  Check,
  Undo2,
  AlertTriangle,
  Upload,
  Scale,
  Link as LinkIcon,
  Landmark,
} from 'lucide-react';
import { useReconciliation } from '@/hooks/useReconciliation';
import { formatCurrency } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import type { Transaction } from '@/types';
import { CATEGORY_BADGE_CLASSES } from '@/lib/categoryColors';
import { BankStatementImportModal } from '@/components/reconciliation/BankStatementImportModal';
import { SideBySideMatcher } from '@/components/reconciliation/SideBySideMatcher';
import { Tabs } from '@/components/ui/Tabs';

const CATEGORY_COLORS = CATEGORY_BADGE_CLASSES;

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
  const { t } = useLanguage();
  const [importOpen, setImportOpen] = useState(false);
  const [mode, setMode] = useState<'balance' | 'match'>('balance');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setShowDateDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
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
          <p className="text-gray-500 dark:text-gray-400">{t.reconciliation.loadingData}</p>
        </div>
      </div>
    );
  }

  if (!activeBusiness) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500 dark:text-gray-400">{t.common.selectBusinessFirst}</p>
      </div>
    );
  }

  const isBalanced = Math.abs(difference) < 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Title + subtitle */}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
              <Landmark className="w-7 h-7 text-primary-500 dark:text-primary-400" />
              {t.reconciliation.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
              {t.reconciliation.subtitle.replace('{name}', activeBusiness.business_name)}
            </p>
          </div>

          {/* Right side: mode toggle + import + date range */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Mode toggle — komponen kanonik dengan framer motion */}
            <Tabs<'balance' | 'match'>
              value={mode}
              onChange={setMode}
              tabs={[
                { value: 'balance', label: t.reconciliation.modeBalance, icon: <Scale className="w-4 h-4" /> },
                { value: 'match', label: t.reconciliation.modeMatch, icon: <LinkIcon className="w-4 h-4" /> },
              ]}
            />

            {/* Import button */}
            <button
              onClick={() => setImportOpen(true)}
              className="btn-ghost flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {t.reconciliation.importMutasi}
            </button>
          </div>
        </div>
      </div>

      {mode === 'match' && (
        <SideBySideMatcher
          businessId={activeBusiness.id}
          dateFrom={dateRange.start}
          dateTo={dateRange.end}
          unreconciledLedgerTx={unreconciledTransactions}
        />
      )}

      {mode === 'balance' && (
      <>
      {/* Balance Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Book Balance */}
        <div className="card-static !p-5">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <p className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase">{t.reconciliation.bookBalance}</p>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${bookBalance < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{formatCurrency(bookBalance)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            {t.reconciliation.cashBankTransactions.replace('{n}', String(unreconciledTransactions.length + reconciledTransactions.length))}
          </p>
        </div>

        {/* Bank Balance Input */}
        <div className={`card-static !p-5 transition-colors ${
          bankBalance ? 'ring-1 ring-primary-200 dark:ring-primary-500/30' : ''
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <LinkIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <label htmlFor="bank-balance-input" className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase cursor-text">{t.reconciliation.bankBalance}</label>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-bold ${bankBalance ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600'}`}>Rp</span>
            <input
              id="bank-balance-input"
              type="text"
              inputMode="numeric"
              value={bankBalance ? Number(bankBalance.replace(/\./g, '')).toLocaleString('id-ID') : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                setBankBalance(raw);
              }}
              placeholder="0"
              className="w-full min-w-0 text-2xl font-bold tabular-nums bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{t.reconciliation.fromBankStatement}</p>
        </div>

        {/* Difference */}
        <div className={`rounded-2xl border p-5 transition-colors ${
          !bankBalance ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700' :
          isBalanced ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' :
          'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={
              !bankBalance ? 'text-gray-400 dark:text-gray-500' :
              isBalanced ? 'text-emerald-500 dark:text-emerald-400' :
              'text-amber-500 dark:text-amber-400'
            }>
              {!bankBalance ? (
                <Landmark className="w-4 h-4" />
              ) : isBalanced ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
            </span>
            <p className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase">{t.reconciliation.difference}</p>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${
            !bankBalance ? 'text-gray-300 dark:text-gray-600' :
            isBalanced ? 'text-emerald-600 dark:text-emerald-400' :
            'text-amber-600 dark:text-amber-400'
          }`}>
            {bankBalance ? formatCurrency(difference) : '—'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            {!bankBalance ? t.reconciliation.enterBankBalance : isBalanced ? t.reconciliation.balanceMatched : t.reconciliation.bankMinusBook}
          </p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
          {/* Left: tab toggle + select all */}
          <div className="flex items-center gap-3">
            {/* Tab toggle — komponen kanonik dengan framer motion */}
            <Tabs<'unreconciled' | 'reconciled'>
              value={showReconciled ? 'reconciled' : 'unreconciled'}
              onChange={(v) => setShowReconciled(v === 'reconciled')}
              tabs={[
                {
                  value: 'unreconciled',
                  label: t.reconciliation.unreconciled,
                  badge: (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                      !showReconciled
                        ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {unreconciledTransactions.length}
                    </span>
                  ),
                },
                {
                  value: 'reconciled',
                  label: t.reconciliation.reconciled,
                  badge: (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                      reconciledTransactions.length === 0
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {reconciledTransactions.length}
                    </span>
                  ),
                },
              ]}
            />

            {/* Select all — hanya tampil di tab Unreconciled */}
            {!showReconciled && unreconciledTransactions.length > 0 && (
              <button
                onClick={selectAll}
                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                {unreconciledTransactions.every((tx) => selectedIds.has(tx.id))
                  ? t.reconciliation.deselectAll
                  : t.reconciliation.selectAll}
              </button>
            )}
          </div>

          {/* Right: date dropdown + reconcile button */}
          <div className="flex items-center gap-2">
            {/* Date filter — dropdown pattern sesuai TransactionList */}
            <div className="relative" ref={dateDropdownRef}>
              <button
                onClick={() => setShowDateDropdown((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                {dateRange.start || dateRange.end
                  ? `${dateRange.start ? new Date(dateRange.start).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '…'} — ${dateRange.end ? new Date(dateRange.end).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '…'}`
                  : 'Periode'}
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showDateDropdown && (
                <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 min-w-[200px] z-20">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Dari</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange((d) => ({ ...d, start: e.target.value }))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 mb-2"
                  />
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Sampai</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange((d) => ({ ...d, end: e.target.value }))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 mb-2"
                  />
                  {(dateRange.start || dateRange.end) && (
                    <button
                      onClick={() => { setDateRange({ start: '', end: '' }); setShowDateDropdown(false); }}
                      className="w-full text-center text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 py-1 transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}
            </div>

            {!showReconciled && selectedIds.size > 0 && (
              <button
                onClick={reconcileSelected}
                disabled={saving}
                className="btn-primary-glow flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {t.reconciliation.reconcileButton.replace('{n}', String(selectedIds.size)).replace('{amount}', formatCurrency(selectedAmount))}
              </button>
            )}
          </div>
        </div>

        {/* Table Header */}
        <div className="hidden sm:grid grid-cols-[32px_100px_1fr_80px_112px_36px] gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700">
          <span />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Tanggal</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Transaksi</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Kategori</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 text-right">Jumlah</span>
          <span />
        </div>

        {/* Transaction List */}
        <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
          {displayedTransactions.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700/50 text-gray-400 mb-4">
                {showReconciled ? <Landmark className="w-7 h-7" /> : <CheckCircle2 className="w-7 h-7" />}
              </div>
              <p className="font-semibold text-gray-700 dark:text-gray-200">
                {showReconciled ? t.reconciliation.noReconciled : t.reconciliation.allReconciled}
              </p>
            </div>
          ) : (
            <>
{displayedTransactions.map((tx) => (
                <ReconciliationRow
                  key={tx.id}
                  transaction={tx}
                  isSelected={selectedIds.has(tx.id)}
                  isReconciled={showReconciled}
                  onToggle={() => toggleSelect(tx.id)}
                  onUnreconcile={() => unreconcile(tx.id)}
                  saving={saving}
                />
              ))}
            </>
          )}
        </div>
      </div>
      </>
      )}

      {activeBusiness && (
        <BankStatementImportModal
          businessId={activeBusiness.id}
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            // Refresh data setelah import sukses. useReconciliation belum punya
            // bank_transactions integration, jadi cukup trigger reload page-level
            // via window event (akan dipakai oleh Fase B matching).
            window.dispatchEvent(new Event('bank-statement-imported'));
          }}
        />
      )}
    </div>
  );
}

function ReconciliationRow({
  transaction,
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
  const { t, locale } = useLanguage();
  const direction = getCashDirection(transaction);
  const amount = Number(transaction.amount);

  const isSettlement = !!transaction.meta?.settlement_of_transaction_id;
  const categoryLabel = isSettlement ? 'SETTLE' : transaction.category;
  const categoryColor = isSettlement ? CATEGORY_COLORS['SETTLE'] : (CATEGORY_COLORS[transaction.category] || 'text-gray-500 dark:text-gray-400');

  const dateStr = new Date(transaction.date).toLocaleDateString(
    locale === 'id' ? 'id-ID' : 'en-US',
    { day: '2-digit', month: 'short', year: 'numeric' },
  );

  return (
    <div
      className={`group transition-colors border-l-2 ${!isReconciled ? 'cursor-pointer' : ''} ${
        isSelected ? 'bg-primary-50/60 dark:bg-primary-900/15 border-primary-500' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/40'
      }`}
      onClick={!isReconciled ? onToggle : undefined}
    >
      {/* Desktop grid row — matches header columns */}
      <div className="hidden sm:grid grid-cols-[32px_100px_1fr_80px_112px_36px] gap-3 items-center px-4 py-3">
        {/* Checkbox */}
        <div className="flex-shrink-0">
          {isReconciled || isSelected ? (
            <CheckSquare className="w-5 h-5 text-gray-900 dark:text-gray-100" />
          ) : (
            <Square className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors" />
          )}
        </div>

        {/* Date */}
        <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{dateStr}</p>

        {/* Name & Description */}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{transaction.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{transaction.description}</p>
        </div>

        {/* Category */}
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold w-fit ${categoryColor}`}>
          {categoryLabel}
        </span>

        {/* Amount */}
        <p className={`text-sm font-bold tabular-nums text-right ${amount === 0 ? 'text-gray-500 dark:text-gray-400' : direction === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
          {amount === 0 ? '—' : direction === 'in' ? '+' : '−'}{formatCurrency(amount)}
        </p>

        {/* Un-reconcile */}
        <div className="flex justify-center">
          {isReconciled && (
            <button
              onClick={(e) => { e.stopPropagation(); onUnreconcile(); }}
              disabled={saving}
              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50"
              title={t.reconciliation.cancelReconciliation}
              aria-label={t.reconciliation.cancelReconciliation}
            >
              <Undo2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile row */}
      <div className="flex sm:hidden items-center gap-3 px-4 py-3">
        <div className="flex-shrink-0">
          {isReconciled || isSelected ? (
            <CheckSquare className="w-5 h-5 text-gray-900 dark:text-gray-100" />
          ) : (
            <Square className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 transition-colors" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{transaction.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{dateStr}</p>
        </div>
        <p className={`text-sm font-bold tabular-nums shrink-0 ${amount === 0 ? 'text-gray-500' : direction === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
          {amount === 0 ? '—' : direction === 'in' ? '+' : '−'}{formatCurrency(amount)}
        </p>
        {isReconciled && (
          <button
            onClick={(e) => { e.stopPropagation(); onUnreconcile(); }}
            disabled={saving}
            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 transition-colors disabled:opacity-50"
            aria-label={t.reconciliation.cancelReconciliation}
          >
            <Undo2 className="w-4 h-4" />
          </button>
        )}
      </div>
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

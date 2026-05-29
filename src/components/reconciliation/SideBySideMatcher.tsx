'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Link as LinkIcon, AlertCircle, Loader2, Unlink, Inbox } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { useBankTransactions, type BankTransaction } from '@/hooks/useBankTransactions';
import type { Transaction } from '@/types';

interface Props {
  businessId: string;
  bankAccountId?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Transaksi ledger yang belum di-reconcile (sumber data dari useReconciliation). */
  unreconciledLedgerTx: Transaction[];
}

/**
 * UI dua kolom untuk match bank lines (kiri) ↔ ledger transactions (kanan).
 *
 * Interaksi:
 *   1. User klik bank line di kiri → highlighted
 *   2. Sistem otomatis highlight ledger tx yang amount-nya cocok
 *   3. User klik salah satu ledger tx → "Match" button enabled
 *   4. Klik "Match" → POST /api/bank-transactions/[id]/match
 *
 * Bank line yang sudah matched ditampilkan dengan link icon + tombol "Unmatch".
 */
export function SideBySideMatcher({
  businessId,
  bankAccountId,
  dateFrom,
  dateTo,
  unreconciledLedgerTx,
}: Props) {
  const { t } = useLanguage();
  const {
    bankTransactions,
    loading,
    error,
    match,
    unmatch,
  } = useBankTransactions({
    businessId,
    accountId: bankAccountId,
    from: dateFrom,
    to: dateTo,
  });

  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [actioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedBank = useMemo(
    () => bankTransactions.find(b => b.id === selectedBankId) ?? null,
    [bankTransactions, selectedBankId]
  );

  // Suggest match by amount: kalau bank line dipilih, tandai tx yang amount-nya
  // sama (toleransi Rp 1) sebagai "suggested".
  const suggestedTxIds = useMemo(() => {
    if (!selectedBank) return new Set<string>();
    const target = Math.abs(selectedBank.amount);
    return new Set(
      unreconciledLedgerTx
        .filter(tx => Math.abs(Math.abs(Number(tx.amount)) - target) < 1)
        .map(tx => tx.id)
    );
  }, [selectedBank, unreconciledLedgerTx]);

  const handleMatch = async () => {
    if (!selectedBankId || !selectedTxId) return;
    setActioning(true);
    setActionError(null);
    try {
      await match(selectedBankId, selectedTxId);
      setSelectedBankId(null);
      setSelectedTxId(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Gagal match');
    } finally {
      setActioning(false);
    }
  };

  const handleUnmatch = async (bankId: string) => {
    setActioning(true);
    setActionError(null);
    try {
      await unmatch(bankId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Gagal unmatch');
    } finally {
      setActioning(false);
    }
  };

  const unmatchedBank = bankTransactions.filter(b => b.match_status === 'unmatched');
  const matchedBank = bankTransactions.filter(b => b.match_status !== 'unmatched');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-start gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    );
  }

  if (bankTransactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Inbox className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="font-medium">{t.reconciliation.sideBySideEmpty}</p>
        <p className="text-xs mt-1">{t.reconciliation.sideBySideEmptyHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {selectedBank ? (
            <span>
              {t.reconciliation.sideBySidePickedBank.replace('{amount}', formatCurrency(selectedBank.amount))}
              {selectedTxId ? ` · ${t.reconciliation.sideBySideReadyMatch}` : ` · ${t.reconciliation.sideBySidePickLedger}`}
            </span>
          ) : (
            <span>{t.reconciliation.sideBySidePickBank}</span>
          )}
        </div>
        <button
          onClick={handleMatch}
          disabled={!selectedBankId || !selectedTxId || actioning}
          className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
        >
          {actioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
          {t.reconciliation.sideBySideMatchButton}
        </button>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-xs">
          {actionError}
        </div>
      )}

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bank lines column */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              {t.reconciliation.sideBySideBankLines}
            </h3>
            <span className="text-xs text-gray-500">
              {t.reconciliation.sideBySideUnmatchedCount
                .replace('{u}', String(unmatchedBank.length))
                .replace('{m}', String(matchedBank.length))}
            </span>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 max-h-[600px] overflow-y-auto">
            {unmatchedBank.map(b => (
              <BankLineRow
                key={b.id}
                bank={b}
                selected={selectedBankId === b.id}
                onSelect={() => setSelectedBankId(prev => (prev === b.id ? null : b.id))}
              />
            ))}
            {matchedBank.length > 0 && (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 text-[10px] uppercase text-gray-500 font-medium">
                {t.reconciliation.sideBySideMatchedSection}
              </div>
            )}
            {matchedBank.map(b => (
              <BankLineRow
                key={b.id}
                bank={b}
                selected={false}
                onSelect={() => { /* matched rows hanya bisa unmatch */ }}
                onUnmatch={() => handleUnmatch(b.id)}
              />
            ))}
          </div>
        </div>

        {/* Ledger transactions column */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              {t.reconciliation.sideBySideLedgerLines}
            </h3>
            <span className="text-xs text-gray-500">
              {t.reconciliation.sideBySideUnreconciledCount.replace('{n}', String(unreconciledLedgerTx.length))}
            </span>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 max-h-[600px] overflow-y-auto">
            {unreconciledLedgerTx.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">
                {t.reconciliation.allReconciled}
              </div>
            ) : (
              unreconciledLedgerTx.map(tx => (
                <LedgerRow
                  key={tx.id}
                  tx={tx}
                  selected={selectedTxId === tx.id}
                  suggested={suggestedTxIds.has(tx.id)}
                  disabled={!selectedBankId}
                  onSelect={() => setSelectedTxId(prev => (prev === tx.id ? null : tx.id))}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BankLineRow({
  bank,
  selected,
  onSelect,
  onUnmatch,
}: {
  bank: BankTransaction;
  selected: boolean;
  onSelect: () => void;
  onUnmatch?: () => void;
}) {
  const isMatched = bank.match_status !== 'unmatched';
  const amountColor = bank.amount >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2.5 transition-colors ${
        isMatched
          ? 'bg-gray-50 dark:bg-gray-800/30'
          : selected
            ? 'bg-indigo-50 dark:bg-indigo-900/20 cursor-pointer'
            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer'
      }`}
      onClick={!isMatched ? onSelect : undefined}
    >
      <div className="flex-shrink-0 mt-0.5">
        {isMatched ? (
          <LinkIcon className="w-4 h-4 text-emerald-500" />
        ) : selected ? (
          <CheckCircle2 className="w-4 h-4 text-indigo-500" />
        ) : (
          <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">{bank.posted_at}</p>
          <p className={`text-sm font-semibold ${amountColor}`}>
            {bank.amount >= 0 ? '+' : ''}{formatCurrency(bank.amount)}
          </p>
        </div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {bank.counterparty_name ?? bank.description ?? '—'}
        </p>
        {bank.reference_code && (
          <p className="text-[10px] text-gray-400 truncate">{bank.reference_code}</p>
        )}
      </div>
      {isMatched && onUnmatch && (
        <button
          onClick={(e) => { e.stopPropagation(); onUnmatch(); }}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-amber-500"
          title="Unmatch"
        >
          <Unlink className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function LedgerRow({
  tx,
  selected,
  suggested,
  disabled,
  onSelect,
}: {
  tx: Transaction;
  selected: boolean;
  suggested: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const amount = Number(tx.amount);
  const direction = getCashDirection(tx);
  const amountColor = direction === 'in'
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2.5 transition-colors ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : selected
            ? 'bg-emerald-50 dark:bg-emerald-900/20 cursor-pointer'
            : suggested
              ? 'bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer'
      }`}
      onClick={!disabled ? onSelect : undefined}
    >
      <div className="flex-shrink-0 mt-0.5">
        {selected ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : (
          <Circle className={`w-4 h-4 ${suggested ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">{tx.date}</p>
          <p className={`text-sm font-semibold ${amountColor}`}>
            {direction === 'in' ? '+' : '-'}{formatCurrency(amount)}
          </p>
        </div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {tx.name || '—'}
        </p>
        {tx.description && (
          <p className="text-[10px] text-gray-400 truncate">{tx.description}</p>
        )}
      </div>
    </div>
  );
}

function getCashDirection(t: Transaction): 'in' | 'out' {
  if (t.is_double_entry) {
    const dc = t.debit_account?.account_code;
    if (dc === '1100' || dc === '1200') return 'in';
    return 'out';
  }
  if (t.category === 'EARN' || t.category === 'FIN') return 'in';
  return 'out';
}

'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBusinessContext } from '@/context/BusinessContext';
import { createClient } from '@/lib/supabase';
import {
  getActiveReconciliationSession,
  upsertActiveReconciliationSession,
  completeReconciliationSession,
  saveSessionMatches,
  getSessionMatchedTransactionIds,
  type ReconciliationSession,
} from '@/lib/api/reconciliationSessions';
import type { Account, Transaction } from '@/types';

/**
 * Cek apakah akun adalah kas/setara kas — pakai flag is_cash_equivalent dari DB,
 * fallback ke kode legacy 1100/1200 saat flag belum di-set di akun lama.
 */
function isCashEquivalent(acc: Pick<Account, 'account_code' | 'is_cash_equivalent'> | null | undefined): boolean {
  if (!acc) return false;
  if (acc.is_cash_equivalent === true) return true;
  return acc.account_code === '1100' || acc.account_code === '1200';
}

/**
 * Check if a transaction touches a cash/bank account.
 */
function isCashTransaction(t: Transaction): boolean {
  if (t.is_multi_line) {
    return (t.journal_lines ?? []).some((l) => isCashEquivalent(l.account));
  }
  if (t.is_double_entry) {
    return isCashEquivalent(t.debit_account) || isCashEquivalent(t.credit_account);
  }
  // Legacy transactions always affect cash
  return true;
}

/**
 * Fetch posted transactions for a business.
 */
async function fetchTransactions(businessId: string): Promise<Transaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      debit_account:accounts!transactions_debit_account_id_fkey(*),
      credit_account:accounts!transactions_credit_account_id_fkey(*),
      journal_lines(*, account:accounts(*))
    `)
    .eq('business_id', businessId)
    .eq('status', 'posted')
    .is('deleted_at', null)
    .order('date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export function useReconciliation() {
  const { activeBusiness, activeBusinessId: businessId, user } = useBusinessContext();
  const queryClient = useQueryClient();

  // Filter state
  const [showReconciled, setShowReconciled] = useState(false);
  const [bankBalance, setBankBalance] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });

  // Active reconciliation session (persisted in DB)
  const [activeSession, setActiveSession] = useState<ReconciliationSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const hasRestoredSession = useRef(false);

  // Fetch transactions
  const { data: allTransactions = [], isLoading: loading } = useQuery({
    queryKey: ['transactions', businessId],
    queryFn: () => fetchTransactions(businessId!),
    enabled: !!businessId,
  });

  // Restore active reconciliation session saat businessId atau dateRange berubah.
  // Memuat saldo bank dan match progress yang sebelumnya sudah user kerjakan.
  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    setSessionLoading(true);
    (async () => {
      try {
        const session = await getActiveReconciliationSession(
          businessId,
          dateRange.start,
          dateRange.end
        );
        if (cancelled) return;
        setActiveSession(session);
        if (session) {
          // Restore saldo bank — sebelumnya hilang saat refresh
          setBankBalance(String(session.bank_statement_balance ?? ''));
          // Restore match progress
          const matchedIds = await getSessionMatchedTransactionIds(session.id);
          if (!cancelled) setSelectedIds(new Set(matchedIds));
        } else {
          setBankBalance('');
          setSelectedIds(new Set());
        }
        hasRestoredSession.current = true;
      } catch (err) {
        console.error('Failed to restore reconciliation session:', err);
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      hasRestoredSession.current = false;
    };
  }, [businessId, dateRange.start, dateRange.end]);

  // Filter: only cash/bank transactions + date range
  const cashTransactions = useMemo(() => {
    return allTransactions
      .filter(isCashTransaction)
      .filter((t) => {
        if (dateRange.start && t.date < dateRange.start) return false;
        if (dateRange.end && t.date > dateRange.end) return false;
        return true;
      });
  }, [allTransactions, dateRange]);

  // Split into reconciled/unreconciled
  const unreconciledTransactions = useMemo(
    () => cashTransactions.filter((t) => !t.is_reconciled),
    [cashTransactions]
  );

  const reconciledTransactions = useMemo(
    () => cashTransactions.filter((t) => t.is_reconciled),
    [cashTransactions]
  );

  const displayedTransactions = showReconciled ? reconciledTransactions : unreconciledTransactions;

  // Compute book balance from filtered transactions
  const bookBalance = useMemo(() => {
    let balance = 0;
    for (const t of cashTransactions) {
      const amount = Number(t.amount);
      if (t.is_multi_line) {
        for (const line of (t.journal_lines ?? [])) {
          if (isCashEquivalent(line.account)) {
            balance += line.debit_amount - line.credit_amount;
          }
        }
      } else if (t.is_double_entry) {
        if (isCashEquivalent(t.debit_account)) {
          balance += amount;
        }
        if (isCashEquivalent(t.credit_account)) {
          balance -= amount;
        }
      } else {
        // Legacy
        if (t.category === 'EARN' || t.category === 'FIN') balance += amount;
        else balance -= amount;
      }
    }
    return balance;
  }, [cashTransactions]);

  // Difference
  const bankBalanceNum = parseFloat(bankBalance) || 0;
  const difference = bankBalanceNum - bookBalance;

  // Auto-save saldo bank ke DB (debounced) — agar tidak hilang saat refresh
  useEffect(() => {
    if (!businessId || !user) return;
    if (!hasRestoredSession.current) return; // Jangan save sebelum selesai restore
    if (bankBalance === '') return; // Jangan buat sesi kosong

    const timeout = setTimeout(async () => {
      try {
        const session = await upsertActiveReconciliationSession({
          business_id: businessId,
          created_by: user.id,
          period_start: dateRange.start,
          period_end: dateRange.end,
          bank_statement_balance: bankBalanceNum,
          book_balance_snapshot: bookBalance,
          difference,
        });
        setActiveSession(session);
      } catch (err) {
        console.error('Failed to auto-save reconciliation session:', err);
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [
    bankBalance,
    bankBalanceNum,
    bookBalance,
    difference,
    businessId,
    user,
    dateRange.start,
    dateRange.end,
  ]);

  // Selected amount
  const selectedAmount = useMemo(() => {
    let total = 0;
    for (const id of selectedIds) {
      const t = unreconciledTransactions.find((tx) => tx.id === id);
      if (t) total += Number(t.amount);
    }
    return total;
  }, [selectedIds, unreconciledTransactions]);

  // Toggle selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Select all unreconciled
  const selectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allIds = new Set(unreconciledTransactions.map((t) => t.id));
      const allSelected = unreconciledTransactions.every((t) => prev.has(t.id));
      return allSelected ? new Set() : allIds;
    });
  }, [unreconciledTransactions]);

  // Reconcile selected transactions
  const reconcileSelected = useCallback(async () => {
    if (selectedIds.size === 0 || !user) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('transactions')
        .update({
          is_reconciled: true,
          reconciled_at: now,
          reconciled_by: user.id,
        })
        .in('id', [...selectedIds]);

      if (error) throw error;

      // Setelah di-reconcile ke flag transactions, bersihkan match rows di sesi
      // (karena transaksi sudah permanen reconciled, tidak butuh progres)
      if (activeSession) {
        try {
          await saveSessionMatches(activeSession.id, [], user.id);
        } catch (err) {
          console.error('Failed to clear session matches:', err);
        }
      }

      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['transactions', businessId] });
    } catch (err: any) {
      alert(err.message || 'Gagal reconcile transaksi');
    } finally {
      setSaving(false);
    }
  }, [selectedIds, user, businessId, queryClient, activeSession]);

  // Simpan progres pilihan ke DB (user klik "Simpan Progres")
  const saveProgress = useCallback(async () => {
    if (!user || !businessId) return;
    setSaving(true);
    try {
      // Pastikan ada session — kalau belum ada, buat satu berdasarkan bankBalance saat ini
      let session = activeSession;
      if (!session) {
        session = await upsertActiveReconciliationSession({
          business_id: businessId,
          created_by: user.id,
          period_start: dateRange.start,
          period_end: dateRange.end,
          bank_statement_balance: bankBalanceNum,
          book_balance_snapshot: bookBalance,
          difference,
        });
        setActiveSession(session);
      }
      await saveSessionMatches(session.id, [...selectedIds], user.id);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan progres');
    } finally {
      setSaving(false);
    }
  }, [
    user,
    businessId,
    activeSession,
    selectedIds,
    dateRange,
    bankBalanceNum,
    bookBalance,
    difference,
  ]);

  // Finalize session — tandai sesi sebagai completed
  const finalizeSession = useCallback(async () => {
    if (!activeSession || !user) return;
    setSaving(true);
    try {
      const completed = await completeReconciliationSession(activeSession.id, user.id);
      setActiveSession(completed);
    } catch (err: any) {
      alert(err.message || 'Gagal menyelesaikan sesi rekonsiliasi');
    } finally {
      setSaving(false);
    }
  }, [activeSession, user]);

  // Un-reconcile a single transaction
  const unreconcile = useCallback(async (id: string) => {
    if (!user) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('transactions')
        .update({
          is_reconciled: false,
          reconciled_at: null,
          reconciled_by: null,
        })
        .eq('id', id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['transactions', businessId] });
    } catch (err: any) {
      alert(err.message || 'Gagal un-reconcile transaksi');
    } finally {
      setSaving(false);
    }
  }, [user, businessId, queryClient]);

  return {
    activeBusiness,
    loading,
    saving,
    sessionLoading,
    // Transactions
    displayedTransactions,
    unreconciledTransactions,
    reconciledTransactions,
    cashTransactions,
    // Balances
    bookBalance,
    bankBalance,
    setBankBalance,
    bankBalanceNum,
    difference,
    // Filter
    showReconciled,
    setShowReconciled,
    dateRange,
    setDateRange,
    // Selection
    selectedIds,
    toggleSelect,
    selectAll,
    selectedAmount,
    // Session (persisted)
    activeSession,
    saveProgress,
    finalizeSession,
    // Actions
    reconcileSelected,
    unreconcile,
  };
}

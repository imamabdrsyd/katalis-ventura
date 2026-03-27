'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBusinessContext } from '@/context/BusinessContext';
import { createClient } from '@/lib/supabase';
import type { Transaction } from '@/types';

/**
 * Check if a transaction touches a cash/bank account (1100 or 1200).
 */
function isCashTransaction(t: Transaction): boolean {
  if (t.is_multi_line) {
    return (t.journal_lines ?? []).some(
      (l) => l.account && (l.account.account_code === '1100' || l.account.account_code === '1200')
    );
  }
  if (t.is_double_entry) {
    const dc = t.debit_account?.account_code;
    const cc = t.credit_account?.account_code;
    return dc === '1100' || dc === '1200' || cc === '1100' || cc === '1200';
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

  // Fetch transactions
  const { data: allTransactions = [], isLoading: loading } = useQuery({
    queryKey: ['transactions', businessId],
    queryFn: () => fetchTransactions(businessId!),
    enabled: !!businessId,
  });

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
          if (line.account?.account_code === '1100' || line.account?.account_code === '1200') {
            balance += line.debit_amount - line.credit_amount;
          }
        }
      } else if (t.is_double_entry) {
        if (t.debit_account?.account_code === '1100' || t.debit_account?.account_code === '1200') {
          balance += amount;
        }
        if (t.credit_account?.account_code === '1100' || t.credit_account?.account_code === '1200') {
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

      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['transactions', businessId] });
    } catch (err: any) {
      alert(err.message || 'Gagal reconcile transaksi');
    } finally {
      setSaving(false);
    }
  }, [selectedIds, user, businessId, queryClient]);

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
    // Actions
    reconcileSelected,
    unreconcile,
  };
}

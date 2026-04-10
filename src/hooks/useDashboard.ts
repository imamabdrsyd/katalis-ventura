'use client';

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBusinessContext } from '@/context/BusinessContext';
import { calculateFinancialSummary, calculateROI, calculateCategoryCounts, calculateBalanceSheet } from '@/lib/calculations';
import * as transactionsApi from '@/lib/api/transactions';
import { generateDueRecurringTransactions } from '@/lib/api/recurring';
import {
  getFinancialCache,
  upsertFinancialCache,
  type DashboardPayload,
} from '@/lib/api/financialCache';
import type { Transaction } from '@/types';

export function useDashboard() {
  const { activeBusiness: business, activeBusinessId: businessId, loading: businessLoading, userRole, user } = useBusinessContext();
  const canManageTransactions = userRole === 'business_manager' || userRole === 'both';
  const queryClient = useQueryClient();

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const firstName = userName.split(' ')[0];

  // Use TanStack Query — shared cache with useReportData (same queryKey)
  const { data: allTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', businessId],
    queryFn: () => transactionsApi.getTransactions(businessId!),
    enabled: !!businessId,
  });

  // Hydrate dari DB cache (fast-path untuk dashboard KPIs)
  // Kalau cache masih valid, initial render tidak perlu tunggu transactions
  const { data: dashboardCache } = useQuery({
    queryKey: ['financial-cache', businessId, 'dashboard'],
    queryFn: () =>
      getFinancialCache<DashboardPayload>({
        businessId: businessId!,
        cacheType: 'dashboard',
      }),
    enabled: !!businessId,
    staleTime: 30_000,
  });

  // Auto-generate due recurring transactions on dashboard load (once per day)
  useEffect(() => {
    if (!businessId || !user) return;
    const today = new Date().toISOString().split('T')[0];
    const key = `recurring_checked_${businessId}_${today}`;
    if (sessionStorage.getItem(key)) return;

    generateDueRecurringTransactions(businessId, user.id)
      .then((count) => {
        sessionStorage.setItem(key, '1');
        if (count > 0) {
          queryClient.invalidateQueries({ queryKey: ['transactions', businessId] });
        }
      })
      .catch((err) => console.error('[useDashboard] Recurring generation failed:', err));
  }, [businessId, user, queryClient]);

  // Invalidate cache when FloatingQuickAdd saves a transaction
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', businessId] });
    };
    window.addEventListener('transaction-saved', handler);
    return () => window.removeEventListener('transaction-saved', handler);
  }, [queryClient, businessId]);

  // Dashboard KPIs only use posted transactions
  const transactions = useMemo(
    () => allTransactions.filter((t: Transaction) => t.status === 'posted'),
    [allTransactions]
  );

  // Combine all calculations in single useMemo — one pass trigger instead of 5
  const { summary, roi, categoryCounts, balanceSheet } = useMemo(() => {
    const sum = calculateFinancialSummary(transactions);
    const capital = business?.capital_investment || 0;
    return {
      summary: sum,
      roi: calculateROI(sum.netProfit, capital),
      categoryCounts: calculateCategoryCounts(transactions),
      balanceSheet: calculateBalanceSheet(transactions, capital),
    };
  }, [transactions, business?.capital_investment]);

  // Write-through cache: simpan hasil kalkulasi ke DB setelah compute selesai.
  // Dijalankan setiap kali transaksi berubah sehingga cache selalu fresh.
  // Fire-and-forget — kegagalan tidak mempengaruhi UI.
  useEffect(() => {
    if (!businessId || !user) return;
    if (transactionsLoading) return;
    if (transactions.length === 0) return;

    const capital = business?.capital_investment || 0;
    const payload: DashboardPayload = {
      summary,
      roi,
      categoryCounts,
      balanceSheet,
      capital,
    };

    upsertFinancialCache({
      businessId,
      cacheType: 'dashboard',
      payload,
      transactionCount: transactions.length,
      computedBy: user.id,
    }).catch((err) => console.error('[useDashboard] Failed to persist cache:', err));
  }, [
    businessId,
    user,
    transactionsLoading,
    transactions.length,
    summary,
    roi,
    categoryCounts,
    balanceSheet,
    business?.capital_investment,
  ]);

  // Hasil akhir: kalau transactions sudah loaded, pakai nilai computed;
  // kalau belum loaded tapi cache valid, pakai cache payload
  const effectiveSummary = transactionsLoading && dashboardCache?.payload
    ? dashboardCache.payload.summary
    : summary;
  const effectiveRoi = transactionsLoading && dashboardCache?.payload
    ? dashboardCache.payload.roi
    : roi;
  const effectiveCategoryCounts = transactionsLoading && dashboardCache?.payload
    ? dashboardCache.payload.categoryCounts
    : categoryCounts;
  const effectiveBalanceSheet = transactionsLoading && dashboardCache?.payload
    ? dashboardCache.payload.balanceSheet
    : balanceSheet;

  return {
    business,
    businessId,
    businessLoading,
    canManageTransactions,
    user,
    firstName,
    transactions,
    transactionsLoading,
    summary: effectiveSummary,
    roi: effectiveRoi,
    categoryCounts: effectiveCategoryCounts,
    balanceSheet: effectiveBalanceSheet,
    // Indikator "data dari cache" untuk UI (misalnya menampilkan "cached X menit lalu")
    isHydratedFromCache: transactionsLoading && !!dashboardCache?.payload,
    cacheComputedAt: dashboardCache?.computed_at ?? null,
  };
}

'use client';

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBusinessContext } from '@/context/BusinessContext';
import { isManagerRole } from '@/lib/roles';
import { calculateFinancialSummary, calculateBalanceSheet, calculateInvestedCapital } from '@/lib/calculations';
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
  const canManageTransactions = isManagerRole(userRole);
  const queryClient = useQueryClient();

  // Use TanStack Query — shared cache with useReportData (same queryKey)
  const { data: allTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', businessId],
    queryFn: () => transactionsApi.getTransactions(businessId!),
    enabled: !!businessId,
  });

  // Hydrate dari DB cache (fast-path untuk dashboard KPIs)
  // Cache hanya menyimpan figures all-time (summary + balance sheet) yang dipakai
  // untuk runway & ROI di dashboard. Numbers per year/month tetap dihitung di page
  // setelah transactions ter-load.
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
    if (!businessId || !user?.id) return;
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
  }, [businessId, user?.id, queryClient]);

  // Dashboard KPIs only use posted transactions
  // Transaksi lama sebelum fitur draft/posted memiliki status=null — dianggap posted
  const transactions = useMemo(
    () => allTransactions.filter((t: Transaction) => !t.status || t.status === 'posted'),
    [allTransactions]
  );

  // Hanya compute all-time figures yang dipakai dashboard page untuk
  // runway calc & ROI all-time. Numbers per year/month dihitung di page
  // dari `transactions` yang sudah ter-load.
  const capital = business?.capital_investment ?? 0;
  const { summary, balanceSheet, investedCapital } = useMemo(
    () => ({
      summary: calculateFinancialSummary(transactions),
      balanceSheet: calculateBalanceSheet(transactions, capital),
      investedCapital: calculateInvestedCapital(transactions, capital),
    }),
    [transactions, capital]
  );

  // Write-through cache: simpan hasil kalkulasi ke DB setelah compute selesai.
  // Dijalankan setiap kali transaksi berubah sehingga cache selalu fresh.
  // Fire-and-forget — kegagalan tidak mempengaruhi UI.
  // Dependencies pakai primitive (transactions.length, capital) bukan object
  // identity supaya tidak re-fire saat compute mengembalikan struktur yang sama.
  useEffect(() => {
    if (!businessId || !user) return;
    if (transactionsLoading) return;
    if (transactions.length === 0) return;

    const payload: DashboardPayload = {
      summary,
      balanceSheet,
      capital,
      investedCapital,
    };

    upsertFinancialCache({
      businessId,
      cacheType: 'dashboard',
      payload,
      transactionCount: transactions.length,
      computedBy: user.id,
    }).catch((err) => console.error('[useDashboard] Failed to persist cache:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, user?.id, transactionsLoading, transactions.length, capital]);

  // Hasil akhir: kalau transactions sudah loaded, pakai nilai computed;
  // kalau belum loaded tapi cache valid, pakai cache payload
  const effectiveSummary = transactionsLoading && dashboardCache?.payload
    ? dashboardCache.payload.summary
    : summary;
  const effectiveBalanceSheet = transactionsLoading && dashboardCache?.payload
    ? dashboardCache.payload.balanceSheet
    : balanceSheet;
  const effectiveInvestedCapital = transactionsLoading && dashboardCache?.payload?.investedCapital
    ? dashboardCache.payload.investedCapital
    : investedCapital;

  return {
    business,
    businessId,
    businessLoading,
    canManageTransactions,
    user,
    transactions,
    transactionsLoading,
    summary: effectiveSummary,
    balanceSheet: effectiveBalanceSheet,
    investedCapital: effectiveInvestedCapital,
    // Indikator "data dari cache" untuk UI (misalnya menampilkan "cached X menit lalu")
    isHydratedFromCache: transactionsLoading && !!dashboardCache?.payload,
    cacheComputedAt: dashboardCache?.computed_at ?? null,
  };
}

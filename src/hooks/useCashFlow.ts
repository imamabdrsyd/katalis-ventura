'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBusinessContext } from '@/context/BusinessContext';
import { useReportData } from './useReportData';
import { calculateCashFlow } from '@/lib/calculations';
import {
  getFinancialCache,
  upsertFinancialCache,
  type CashFlowPayload,
} from '@/lib/api/financialCache';

export interface UseCashFlowReturn extends ReturnType<typeof useReportData> {
  cashFlow: ReturnType<typeof calculateCashFlow>;
  handleExportPDF: () => Promise<void>;
  handleExportExcel: () => Promise<void>;
}

export function useCashFlow(): UseCashFlowReturn {
  const reportData = useReportData();
  const { activeBusiness, transactions, filteredTransactions, startDate, endDate, setShowExportMenu, loading: transactionsLoading } = reportData;
  const { user } = useBusinessContext();
  const activeBusinessId = activeBusiness?.id ?? null;

  // Get capital from business settings (used as fallback if no equity transactions exist)
  const capital = activeBusiness?.capital_investment ?? 0;

  // Hydrate dari DB cache (fast-path saat transactions belum loaded)
  const { data: cashFlowCache } = useQuery({
    queryKey: ['financial-cache', activeBusinessId, 'cash_flow', startDate, endDate],
    queryFn: () =>
      getFinancialCache<CashFlowPayload>({
        businessId: activeBusinessId!,
        cacheType: 'cash_flow',
        periodStart: startDate,
        periodEnd: endDate,
      }),
    enabled: !!activeBusinessId && !!startDate && !!endDate,
    staleTime: 30_000,
  });

  const computedCashFlow = useMemo(
    () => calculateCashFlow(filteredTransactions, capital, transactions, startDate),
    [filteredTransactions, capital, transactions, startDate]
  );

  // Hasil akhir: pakai cache saat transactions masih loading dan cache valid.
  const cashFlow = transactionsLoading && cashFlowCache?.payload
    ? cashFlowCache.payload
    : computedCashFlow;

  // Override loading di reportData supaya page tidak skeleton kalau cache sudah ada.
  const effectiveLoading = transactionsLoading && !cashFlowCache?.payload;

  // Write-through cache: simpan hasil ke DB setelah compute selesai.
  useEffect(() => {
    if (!activeBusinessId || !user || !startDate || !endDate) return;
    if (transactionsLoading) return;
    if (filteredTransactions.length === 0) return;

    upsertFinancialCache({
      businessId: activeBusinessId,
      cacheType: 'cash_flow',
      periodStart: startDate,
      periodEnd: endDate,
      payload: computedCashFlow,
      transactionCount: filteredTransactions.length,
      computedBy: user.id,
    }).catch((err) => console.error('[useCashFlow] Failed to persist cache:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, user?.id, transactionsLoading, filteredTransactions.length, startDate, endDate, capital]);

  const handleExportPDF = useCallback(async () => {
    if (!activeBusiness) return;
    const { exportCashFlowToPDF } = await import('@/lib/export');
    const periodLabel = `${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - ${new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    exportCashFlowToPDF(activeBusiness.business_name, periodLabel, cashFlow);
    setShowExportMenu(false);
  }, [activeBusiness, startDate, endDate, cashFlow, setShowExportMenu]);

  const handleExportExcel = useCallback(async () => {
    if (!activeBusiness) return;
    const { exportCashFlowToExcel } = await import('@/lib/export');
    const periodLabel = `${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - ${new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    exportCashFlowToExcel(activeBusiness.business_name, periodLabel, cashFlow);
    setShowExportMenu(false);
  }, [activeBusiness, startDate, endDate, cashFlow, setShowExportMenu]);

  return {
    ...reportData,
    loading: effectiveLoading,
    cashFlow,
    handleExportPDF,
    handleExportExcel,
  };
}

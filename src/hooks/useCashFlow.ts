'use client';

import { useCallback, useMemo } from 'react';
import { useReportData } from './useReportData';
import { calculateCashFlow } from '@/lib/calculations';

export interface UseCashFlowReturn extends ReturnType<typeof useReportData> {
  cashFlow: ReturnType<typeof calculateCashFlow>;
  handleExportPDF: () => Promise<void>;
  handleExportExcel: () => Promise<void>;
}

export function useCashFlow(): UseCashFlowReturn {
  const reportData = useReportData();
  const { activeBusiness, transactions, filteredTransactions, startDate, endDate, setShowExportMenu } = reportData;

  // Get capital from business settings (used as fallback if no equity transactions exist)
  const capital = activeBusiness?.capital_investment ?? 0;

  const cashFlow = useMemo(
    () => calculateCashFlow(filteredTransactions, capital, transactions, startDate),
    [filteredTransactions, capital, transactions, startDate]
  );

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
    cashFlow,
    handleExportPDF,
    handleExportExcel,
  };
}

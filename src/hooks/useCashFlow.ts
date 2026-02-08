'use client';

import { useCallback } from 'react';
import { useReportData } from './useReportData';
import { calculateCashFlow } from '@/lib/calculations';
import { exportCashFlowToPDF, exportCashFlowToExcel } from '@/lib/export';

export interface UseCashFlowReturn extends ReturnType<typeof useReportData> {
  cashFlow: ReturnType<typeof calculateCashFlow>;
  handleExportPDF: () => void;
  handleExportExcel: () => void;
}

export function useCashFlow(): UseCashFlowReturn {
  const reportData = useReportData();
  const { activeBusiness, filteredTransactions, startDate, endDate, setShowExportMenu } = reportData;

  // Get capital from business settings
  const capital = activeBusiness?.capital_investment ?? 0;

  const cashFlow = calculateCashFlow(filteredTransactions, capital);

  const handleExportPDF = useCallback(() => {
    if (!activeBusiness) return;
    const periodLabel = `${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - ${new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    exportCashFlowToPDF(activeBusiness.business_name, periodLabel, cashFlow);
    setShowExportMenu(false);
  }, [activeBusiness, startDate, endDate, cashFlow, setShowExportMenu]);

  const handleExportExcel = useCallback(() => {
    if (!activeBusiness) return;
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

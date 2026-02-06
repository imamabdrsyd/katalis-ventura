'use client';

import { useCallback } from 'react';
import { useReportData } from './useReportData';
import { calculateFinancialSummary, calculateIncomeStatementMetrics } from '@/lib/calculations';
import { exportIncomeStatementToPDF, exportIncomeStatementToExcel } from '@/lib/export';

export interface UseIncomeStatementReturn extends ReturnType<typeof useReportData> {
  summary: ReturnType<typeof calculateFinancialSummary>;
  metrics: ReturnType<typeof calculateIncomeStatementMetrics>;
  handleExportPDF: () => void;
  handleExportExcel: () => void;
}

export function useIncomeStatement(): UseIncomeStatementReturn {
  const reportData = useReportData();
  const { activeBusiness, filteredTransactions, startDate, endDate, setShowExportMenu } = reportData;

  const summary = calculateFinancialSummary(filteredTransactions);
  const metrics = calculateIncomeStatementMetrics(summary);

  const handleExportPDF = useCallback(() => {
    if (!activeBusiness) return;
    const periodLabel = `${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - ${new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    exportIncomeStatementToPDF(activeBusiness.business_name, periodLabel, summary);
    setShowExportMenu(false);
  }, [activeBusiness, startDate, endDate, summary, setShowExportMenu]);

  const handleExportExcel = useCallback(() => {
    if (!activeBusiness) return;
    const periodLabel = `${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - ${new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    exportIncomeStatementToExcel(activeBusiness.business_name, periodLabel, summary);
    setShowExportMenu(false);
  }, [activeBusiness, startDate, endDate, summary, setShowExportMenu]);

  return {
    ...reportData,
    summary,
    metrics,
    handleExportPDF,
    handleExportExcel,
  };
}

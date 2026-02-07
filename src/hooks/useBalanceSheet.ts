'use client';

import { useCallback } from 'react';
import { useReportData } from './useReportData';
import { calculateBalanceSheet } from '@/lib/calculations';
import { exportBalanceSheetToPDF, exportBalanceSheetToExcel } from '@/lib/export';

export interface UseBalanceSheetReturn extends ReturnType<typeof useReportData> {
  balanceSheet: ReturnType<typeof calculateBalanceSheet>;
  isBalanced: boolean;
  handleExportPDF: () => void;
  handleExportExcel: () => void;
}

export function useBalanceSheet(): UseBalanceSheetReturn {
  const reportData = useReportData();
  const { activeBusiness, filteredTransactions, endDate, setShowExportMenu } = reportData;

  const balanceSheet = calculateBalanceSheet(filteredTransactions);

  // Check if accounting equation is balanced
  const isBalanced = Math.abs(
    balanceSheet.assets.totalAssets -
    (balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity)
  ) < 0.01;

  const handleExportPDF = useCallback(() => {
    if (!activeBusiness) return;
    const asOfDate = new Date(endDate).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    exportBalanceSheetToPDF(activeBusiness.business_name, asOfDate, balanceSheet);
    setShowExportMenu(false);
  }, [activeBusiness, endDate, balanceSheet, setShowExportMenu]);

  const handleExportExcel = useCallback(() => {
    if (!activeBusiness) return;
    const asOfDate = new Date(endDate).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    exportBalanceSheetToExcel(activeBusiness.business_name, asOfDate, balanceSheet);
    setShowExportMenu(false);
  }, [activeBusiness, endDate, balanceSheet, setShowExportMenu]);

  return {
    ...reportData,
    balanceSheet,
    isBalanced,
    handleExportPDF,
    handleExportExcel,
  };
}

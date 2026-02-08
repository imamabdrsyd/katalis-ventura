'use client';

import { useCallback, useMemo } from 'react';
import { useReportData } from './useReportData';
import { calculateBalanceSheet, filterTransactionsUpToDate } from '@/lib/calculations';
import { exportBalanceSheetToPDF, exportBalanceSheetToExcel } from '@/lib/export';

export interface UseBalanceSheetReturn extends ReturnType<typeof useReportData> {
  balanceSheet: ReturnType<typeof calculateBalanceSheet>;
  isBalanced: boolean;
  handleExportPDF: () => void;
  handleExportExcel: () => void;
}

export function useBalanceSheet(): UseBalanceSheetReturn {
  const reportData = useReportData();
  const { activeBusiness, transactions, endDate, setShowExportMenu } = reportData;

  // Balance Sheet uses cumulative transactions up to endDate (not just within period)
  const cumulativeTransactions = useMemo(() => {
    if (!endDate) return transactions;
    return filterTransactionsUpToDate(transactions, endDate);
  }, [transactions, endDate]);

  // Get capital from business settings
  const capital = activeBusiness?.capital_investment ?? 0;

  const balanceSheet = calculateBalanceSheet(cumulativeTransactions, capital);

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

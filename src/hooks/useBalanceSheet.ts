'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useReportData } from './useReportData';
import { calculateBalanceSheet, filterTransactionsUpToDate } from '@/lib/calculations';
import * as accountsApi from '@/lib/api/accounts';
import type { Account } from '@/types';

export interface UseBalanceSheetReturn extends ReturnType<typeof useReportData> {
  balanceSheet: ReturnType<typeof calculateBalanceSheet>;
  isBalanced: boolean;
  handleExportPDF: () => Promise<void>;
  handleExportExcel: () => Promise<void>;
}

export function useBalanceSheet(): UseBalanceSheetReturn {
  const reportData = useReportData();
  const { activeBusiness, transactions, endDate, setShowExportMenu } = reportData;

  // Fetch accounts for depreciation calculation
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    if (!activeBusiness) return;
    accountsApi
      .getAccounts(activeBusiness.id, false)
      .then(setAccounts)
      .catch((err) => console.error('[useBalanceSheet] Failed to load accounts for depreciation:', err));
  }, [activeBusiness]);

  // Balance Sheet uses cumulative transactions up to endDate (not just within period)
  const cumulativeTransactions = useMemo(() => {
    if (!endDate) return transactions;
    return filterTransactionsUpToDate(transactions, endDate);
  }, [transactions, endDate]);

  // Get capital from business settings
  const capital = activeBusiness?.capital_investment ?? 0;

  const balanceSheet = useMemo(
    () => calculateBalanceSheet(
      cumulativeTransactions,
      capital,
      accounts,
      endDate ? new Date(endDate) : undefined
    ),
    [cumulativeTransactions, capital, accounts, endDate]
  );

  // Check if accounting equation is balanced
  const isBalanced = useMemo(() => Math.abs(
    balanceSheet.assets.totalAssets -
    (balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity)
  ) < 0.01, [balanceSheet]);

  const handleExportPDF = useCallback(async () => {
    if (!activeBusiness) return;
    const { exportBalanceSheetToPDF } = await import('@/lib/export');
    const asOfDate = new Date(endDate).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    exportBalanceSheetToPDF(activeBusiness.business_name, asOfDate, balanceSheet);
    setShowExportMenu(false);
  }, [activeBusiness, endDate, balanceSheet, setShowExportMenu]);

  const handleExportExcel = useCallback(async () => {
    if (!activeBusiness) return;
    const { exportBalanceSheetToExcel } = await import('@/lib/export');
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

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBusinessContext } from '@/context/BusinessContext';
import { calculateBalanceSheet, filterTransactionsUpToDate } from '@/lib/calculations';
import * as accountsApi from '@/lib/api/accounts';
import * as transactionsApi from '@/lib/api/transactions';
import type { Account } from '@/types';

export interface UseBalanceSheetReturn {
  activeBusiness: ReturnType<typeof useBusinessContext>['activeBusiness'];
  loading: boolean;
  asOfDate: string;
  setAsOfDate: React.Dispatch<React.SetStateAction<string>>;
  showExportMenu: boolean;
  setShowExportMenu: React.Dispatch<React.SetStateAction<boolean>>;
  exportButtonRef: React.RefObject<HTMLDivElement>;
  balanceSheet: ReturnType<typeof calculateBalanceSheet>;
  isBalanced: boolean;
  handleExportPDF: () => Promise<void>;
  handleExportExcel: () => Promise<void>;
}

export function useBalanceSheet(): UseBalanceSheetReturn {
  const { activeBusiness } = useBusinessContext();
  const activeBusinessId = activeBusiness?.id ?? null;
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];
  const [asOfDate, setAsOfDate] = useState<string>(today);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportButtonRef = useRef<HTMLDivElement>(null);

  // Fetch all transactions (no period filter — balance sheet is cumulative)
  const { data: allTransactions = [], isLoading: loading } = useQuery({
    queryKey: ['transactions', activeBusinessId],
    queryFn: () => transactionsApi.getTransactions(activeBusinessId!),
    enabled: !!activeBusinessId,
  });

  // Only posted transactions — null status (transaksi lama) dianggap posted
  const transactions = useMemo(
    () => allTransactions.filter((t) => !t.status || t.status === 'posted'),
    [allTransactions]
  );

  // Invalidate cache when FloatingQuickAdd saves a transaction
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', activeBusinessId] });
    };
    window.addEventListener('transaction-saved', handler);
    return () => window.removeEventListener('transaction-saved', handler);
  }, [queryClient, activeBusinessId]);

  // Fetch accounts for depreciation calculation
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    if (!activeBusiness) return;
    accountsApi
      .getAccounts(activeBusiness.id, false)
      .then(setAccounts)
      .catch((err) => console.error('[useBalanceSheet] Failed to load accounts for depreciation:', err));
  }, [activeBusiness]);

  // Cumulative transactions up to asOfDate (inclusive)
  const cumulativeTransactions = useMemo(
    () => filterTransactionsUpToDate(transactions, asOfDate),
    [transactions, asOfDate]
  );

  const capital = activeBusiness?.capital_investment ?? 0;

  const balanceSheet = useMemo(
    () => calculateBalanceSheet(
      cumulativeTransactions,
      capital,
      accounts,
      new Date(asOfDate)
    ),
    [cumulativeTransactions, capital, accounts, asOfDate]
  );

  const isBalanced = useMemo(() => Math.abs(
    balanceSheet.assets.totalAssets -
    (balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity)
  ) < 0.01, [balanceSheet]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportButtonRef.current && !exportButtonRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

  const handleExportPDF = useCallback(async () => {
    if (!activeBusiness) return;
    const { exportBalanceSheetToPDF } = await import('@/lib/export');
    const dateLabel = new Date(asOfDate).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    exportBalanceSheetToPDF(activeBusiness.business_name, dateLabel, balanceSheet);
    setShowExportMenu(false);
  }, [activeBusiness, asOfDate, balanceSheet]);

  const handleExportExcel = useCallback(async () => {
    if (!activeBusiness) return;
    const { exportBalanceSheetToExcel } = await import('@/lib/export');
    const dateLabel = new Date(asOfDate).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    exportBalanceSheetToExcel(activeBusiness.business_name, dateLabel, balanceSheet);
    setShowExportMenu(false);
  }, [activeBusiness, asOfDate, balanceSheet]);

  return {
    activeBusiness,
    loading,
    asOfDate,
    setAsOfDate,
    showExportMenu,
    setShowExportMenu,
    exportButtonRef,
    balanceSheet,
    isBalanced,
    handleExportPDF,
    handleExportExcel,
  };
}

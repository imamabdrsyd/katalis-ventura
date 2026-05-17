'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBusinessContext } from '@/context/BusinessContext';
import { calculateBalanceSheet, calculateCapTable, filterTransactionsUpToDate } from '@/lib/calculations';
import * as accountsApi from '@/lib/api/accounts';
import * as transactionsApi from '@/lib/api/transactions';
import {
  getFinancialCache,
  upsertFinancialCache,
  type BalanceSheetPayload,
} from '@/lib/api/financialCache';
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
  capTable: ReturnType<typeof calculateCapTable>;
  isBalanced: boolean;
  handleExportPDF: () => Promise<void>;
  handleExportExcel: () => Promise<void>;
}

export function useBalanceSheet(): UseBalanceSheetReturn {
  const { activeBusiness, user } = useBusinessContext();
  const activeBusinessId = activeBusiness?.id ?? null;

  const today = new Date().toISOString().split('T')[0];
  const [asOfDate, setAsOfDate] = useState<string>(today);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportButtonRef = useRef<HTMLDivElement>(null);

  // Fetch all transactions (no period filter — balance sheet is cumulative)
  const { data: allTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', activeBusinessId],
    queryFn: () => transactionsApi.getTransactions(activeBusinessId!),
    enabled: !!activeBusinessId,
  });

  // Hydrate dari DB cache (fast-path saat transactions belum loaded)
  // Cache di-key oleh business_id + cache_type + period_end=asOfDate, period_start=null.
  const { data: balanceSheetCache } = useQuery({
    queryKey: ['financial-cache', activeBusinessId, 'balance_sheet', asOfDate],
    queryFn: () =>
      getFinancialCache<BalanceSheetPayload>({
        businessId: activeBusinessId!,
        cacheType: 'balance_sheet',
        periodStart: null,
        periodEnd: asOfDate,
      }),
    enabled: !!activeBusinessId,
    staleTime: 30_000,
  });

  // Only posted transactions — null status (transaksi lama) dianggap posted
  const transactions = useMemo(
    () => allTransactions.filter((t) => !t.status || t.status === 'posted'),
    [allTransactions]
  );

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

  const computedBalanceSheet = useMemo(
    () => calculateBalanceSheet(
      cumulativeTransactions,
      capital,
      accounts,
      new Date(asOfDate)
    ),
    [cumulativeTransactions, capital, accounts, asOfDate]
  );

  // Hasil akhir: kalau transactions masih loading tapi cache valid, pakai cache;
  // saat transactions sudah load, switch ke computed.
  const balanceSheet = transactionsLoading && balanceSheetCache?.payload
    ? balanceSheetCache.payload
    : computedBalanceSheet;

  // Override loading: kalau cache sudah ada, UI tidak perlu skeleton.
  const loading = transactionsLoading && !balanceSheetCache?.payload;

  // Write-through cache: simpan hasil ke DB setelah compute selesai.
  // Dependencies pakai primitive supaya tidak re-fire saat compute return struktur sama.
  useEffect(() => {
    if (!activeBusinessId || !user) return;
    if (transactionsLoading) return;
    if (cumulativeTransactions.length === 0) return;

    upsertFinancialCache({
      businessId: activeBusinessId,
      cacheType: 'balance_sheet',
      periodStart: null,
      periodEnd: asOfDate,
      payload: computedBalanceSheet,
      transactionCount: cumulativeTransactions.length,
      computedBy: user.id,
    }).catch((err) => console.error('[useBalanceSheet] Failed to persist cache:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, user?.id, transactionsLoading, cumulativeTransactions.length, asOfDate, capital, accounts.length]);

  const capTable = useMemo(
    () => calculateCapTable(cumulativeTransactions),
    [cumulativeTransactions]
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
    capTable,
    isBalanced,
    handleExportPDF,
    handleExportExcel,
  };
}

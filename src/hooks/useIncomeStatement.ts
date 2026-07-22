'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import { useReportData } from './useReportData';
import { runExportToast } from '@/lib/exportToast';
import { calculateFinancialSummary, calculateIncomeStatementMetrics, applyDepreciationToSummary, extractIncomeStatementLineItems, buildFixedAssetCostMap } from '@/lib/calculations';
import { calculateDepreciationSummary } from '@/lib/accounting/depreciation';
import * as accountsApi from '@/lib/api/accounts';
import {
  upsertFinancialCache,
  type IncomeStatementPayload,
} from '@/lib/api/financialCache';
import type { Transaction, Account } from '@/types';
import type { IncomeStatementLineItems } from '@/lib/calculations';

export interface TransactionsByCategory {
  revenue: Transaction[];
  cogs: Transaction[];
  opex: Transaction[];
  tax: Transaction[];
  interest: Transaction[];
}

export interface UseIncomeStatementReturn extends ReturnType<typeof useReportData> {
  summary: ReturnType<typeof calculateFinancialSummary>;
  metrics: ReturnType<typeof calculateIncomeStatementMetrics>;
  transactionsByCategory: TransactionsByCategory;
  lineItems: IncomeStatementLineItems;
  accounts: Account[];
  refetchAccounts: () => Promise<void>;
  handleExportPDF: () => Promise<void>;
  handleExportExcel: () => Promise<void>;
}

export function useIncomeStatement(): UseIncomeStatementReturn {
  const reportData = useReportData();
  const { activeBusiness, transactions, filteredTransactions, startDate, endDate, setShowExportMenu, loading: transactionsLoading } = reportData;
  const { user } = useBusinessContext();
  const activeBusinessId = activeBusiness?.id ?? null;

  // Fetch accounts for depreciation calculation + income statement config
  const [accounts, setAccounts] = useState<Account[]>([]);
  const refetchAccounts = useCallback(async () => {
    if (!activeBusiness) return;
    try {
      const data = await accountsApi.getAccounts(activeBusiness.id, false);
      setAccounts(data);
    } catch (err) {
      console.error('[useIncomeStatement] Failed to load accounts:', err);
    }
  }, [activeBusiness]);
  useEffect(() => {
    refetchAccounts();
  }, [refetchAccounts]);

  // Base summary without depreciation
  const baseSummary = useMemo(
    () => calculateFinancialSummary(filteredTransactions),
    [filteredTransactions]
  );

  // Calculate period depreciation and apply to summary
  const computedSummary = useMemo(() => {
    if (!accounts.length || !startDate || !endDate) return baseSummary;

    // Build fixed asset cost map from ALL transactions (cumulative, not period-filtered)
    // because asset cost is cumulative — we need total cost to compute depreciation rate.
    // Uses shared helper so multi-line journal entries are included (same as Balance Sheet).
    const fixedAssetCosts = buildFixedAssetCostMap(transactions);

    const depSummary = calculateDepreciationSummary(
      accounts,
      (accountId) => fixedAssetCosts.get(accountId) ?? 0,
      new Date(endDate),
      new Date(startDate)
    );

    return applyDepreciationToSummary(baseSummary, depSummary.periodDepreciation);
  }, [baseSummary, accounts, transactions, startDate, endDate]);

  const computedMetrics = useMemo(
    () => calculateIncomeStatementMetrics(computedSummary),
    [computedSummary]
  );

  // Income statement UI butuh lineItems & transactionsByCategory yang sumbernya
  // raw transactions — tidak praktis di-cache (payload jadi besar karena include
  // ribuan transactions). Hydration cache hanya berguna untuk consumer non-UI
  // (server, future API), jadi summary/metrics tetap pakai computed values.
  const summary = computedSummary;
  const metrics = computedMetrics;

  const lineItems = useMemo(
    () => extractIncomeStatementLineItems(filteredTransactions),
    [filteredTransactions]
  );

  const transactionsByCategory: TransactionsByCategory = useMemo(() => ({
    revenue: filteredTransactions.filter(t =>
      t.category === 'EARN' &&
      // Exclude settlement entries (Dr Kas / Cr Piutang) — ASSET-to-ASSET, no revenue recognized
      !(t.is_double_entry && t.credit_account?.account_type !== 'REVENUE')
    ),
    cogs: filteredTransactions.filter(t =>
      t.category === 'VAR' &&
      // Exclude inventory purchases (debit to ASSET) — not COGS until sold
      !(t.is_double_entry && t.debit_account?.account_type === 'ASSET')
    ),
    opex: filteredTransactions.filter(t => t.category === 'OPEX'),
    tax: filteredTransactions.filter(t => t.category === 'TAX'),
    interest: filteredTransactions.filter(t =>
      t.category === 'FIN' && (
        (t.is_double_entry && t.debit_account?.account_type === 'EXPENSE') ||
        !t.is_double_entry
      )
    ),
  }), [filteredTransactions]);

  // Write-through cache: simpan hasil income statement ke DB setelah compute.
  // Di-key oleh business_id + period, sehingga laporan yang sama bisa di-load
  // ulang dari cache tanpa recompute dari raw transactions.
  // Dependencies pakai primitive supaya tidak re-fire saat compute return struktur sama.
  useEffect(() => {
    if (!activeBusinessId || !user || !startDate || !endDate) return;
    if (transactionsLoading) return;
    if (filteredTransactions.length === 0) return;

    const payload: IncomeStatementPayload = { summary: computedSummary, metrics: computedMetrics };

    upsertFinancialCache({
      businessId: activeBusinessId,
      cacheType: 'income_statement',
      periodStart: startDate,
      periodEnd: endDate,
      payload,
      transactionCount: filteredTransactions.length,
      computedBy: user.id,
    }).catch((err) =>
      console.error('[useIncomeStatement] Failed to persist cache:', err)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, user?.id, transactionsLoading, startDate, endDate, filteredTransactions.length, accounts.length]);


  const handleExportPDF = useCallback(async () => {
    if (!activeBusiness) return;
    setShowExportMenu(false);
    const periodLabel = `${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - ${new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    await runExportToast('pdf', async () => {
      const { exportIncomeStatementToPDF } = await import('@/lib/export');
      await exportIncomeStatementToPDF(activeBusiness.business_name, periodLabel, summary, transactionsByCategory, lineItems);
    });
  }, [activeBusiness, startDate, endDate, summary, transactionsByCategory, lineItems, setShowExportMenu]);

  const handleExportExcel = useCallback(async () => {
    if (!activeBusiness) return;
    setShowExportMenu(false);
    const periodLabel = `${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - ${new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    await runExportToast('excel', async () => {
      const { exportIncomeStatementToExcel } = await import('@/lib/export');
      await exportIncomeStatementToExcel(activeBusiness.business_name, periodLabel, summary);
    });
  }, [activeBusiness, startDate, endDate, summary, setShowExportMenu]);

  return {
    ...reportData,
    summary,
    metrics,
    transactionsByCategory,
    lineItems,
    accounts,
    refetchAccounts,
    handleExportPDF,
    handleExportExcel,
  };
}

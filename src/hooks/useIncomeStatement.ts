'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import { useReportData } from './useReportData';
import { calculateFinancialSummary, calculateIncomeStatementMetrics, applyDepreciationToSummary, extractIncomeStatementLineItems } from '@/lib/calculations';
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
  handleExportPDF: () => Promise<void>;
  handleExportExcel: () => Promise<void>;
}

export function useIncomeStatement(): UseIncomeStatementReturn {
  const reportData = useReportData();
  const { activeBusiness, transactions, filteredTransactions, startDate, endDate, setShowExportMenu } = reportData;
  const { user } = useBusinessContext();

  // Fetch accounts for depreciation calculation
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    if (!activeBusiness) return;
    accountsApi
      .getAccounts(activeBusiness.id, false)
      .then(setAccounts)
      .catch((err) => console.error('[useIncomeStatement] Failed to load accounts for depreciation:', err));
  }, [activeBusiness]);

  // Base summary without depreciation
  const baseSummary = useMemo(
    () => calculateFinancialSummary(filteredTransactions),
    [filteredTransactions]
  );

  // Calculate period depreciation and apply to summary
  const summary = useMemo(() => {
    if (!accounts.length || !startDate || !endDate) return baseSummary;

    // Build fixed asset cost map from ALL transactions (cumulative, not period-filtered)
    // because asset cost is cumulative — we need total cost to compute depreciation rate
    const fixedAssetCosts = new Map<string, number>();
    for (const t of transactions) {
      if (!t.is_double_entry) continue;
      const amount = Number(t.amount);
      if (t.debit_account?.account_type === 'ASSET' && t.debit_account.default_category === 'CAPEX') {
        fixedAssetCosts.set(t.debit_account.id, (fixedAssetCosts.get(t.debit_account.id) ?? 0) + amount);
      }
      if (t.credit_account?.account_type === 'ASSET' && t.credit_account.default_category === 'CAPEX') {
        fixedAssetCosts.set(t.credit_account.id, (fixedAssetCosts.get(t.credit_account.id) ?? 0) - amount);
      }
    }

    const depSummary = calculateDepreciationSummary(
      accounts,
      (accountId) => fixedAssetCosts.get(accountId) ?? 0,
      new Date(endDate),
      new Date(startDate)
    );

    return applyDepreciationToSummary(baseSummary, depSummary.periodDepreciation);
  }, [baseSummary, accounts, transactions, startDate, endDate]);

  const metrics = useMemo(
    () => calculateIncomeStatementMetrics(summary),
    [summary]
  );

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
  useEffect(() => {
    if (!activeBusiness || !user || !startDate || !endDate) return;
    if (filteredTransactions.length === 0) return;

    const payload: IncomeStatementPayload = { summary, metrics };

    upsertFinancialCache({
      businessId: activeBusiness.id,
      cacheType: 'income_statement',
      periodStart: startDate,
      periodEnd: endDate,
      payload,
      transactionCount: filteredTransactions.length,
      computedBy: user.id,
    }).catch((err) =>
      console.error('[useIncomeStatement] Failed to persist cache:', err)
    );
  }, [
    activeBusiness,
    user,
    startDate,
    endDate,
    filteredTransactions.length,
    summary,
    metrics,
  ]);

  const handleExportPDF = useCallback(async () => {
    if (!activeBusiness) return;
    const { exportIncomeStatementToPDF } = await import('@/lib/export');
    const periodLabel = `${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - ${new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    await exportIncomeStatementToPDF(activeBusiness.business_name, periodLabel, summary, transactionsByCategory, lineItems);
    setShowExportMenu(false);
  }, [activeBusiness, startDate, endDate, summary, transactionsByCategory, lineItems, setShowExportMenu]);

  const handleExportExcel = useCallback(async () => {
    if (!activeBusiness) return;
    const { exportIncomeStatementToExcel } = await import('@/lib/export');
    const periodLabel = `${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - ${new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    exportIncomeStatementToExcel(activeBusiness.business_name, periodLabel, summary);
    setShowExportMenu(false);
  }, [activeBusiness, startDate, endDate, summary, setShowExportMenu]);

  return {
    ...reportData,
    summary,
    metrics,
    transactionsByCategory,
    lineItems,
    handleExportPDF,
    handleExportExcel,
  };
}

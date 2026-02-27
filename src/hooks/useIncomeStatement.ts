'use client';

import { useCallback, useMemo } from 'react';
import { useReportData } from './useReportData';
import { calculateFinancialSummary, calculateIncomeStatementMetrics } from '@/lib/calculations';
import { exportIncomeStatementToPDF, exportIncomeStatementToExcel } from '@/lib/export';
import type { Transaction } from '@/types';

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
  handleExportPDF: () => void;
  handleExportExcel: () => void;
}

export function useIncomeStatement(): UseIncomeStatementReturn {
  const reportData = useReportData();
  const { activeBusiness, filteredTransactions, startDate, endDate, setShowExportMenu } = reportData;

  const summary = useMemo(
    () => calculateFinancialSummary(filteredTransactions),
    [filteredTransactions]
  );

  const metrics = useMemo(
    () => calculateIncomeStatementMetrics(summary),
    [summary]
  );

  const transactionsByCategory: TransactionsByCategory = useMemo(() => ({
    revenue: filteredTransactions.filter(t => t.category === 'EARN'),
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
    transactionsByCategory,
    handleExportPDF,
    handleExportExcel,
  };
}

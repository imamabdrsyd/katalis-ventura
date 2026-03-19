import { useState, useEffect } from 'react';
import { getDatabase } from '@/db';
import {
  calculateIncomeStatementMetrics,
  calculateFinancialSummary,
  calculateBalanceSheet,
  calculateCashFlow,
  filterTransactionsByDateRange,
} from '@shared/calculations';
import type { Transaction, IncomeStatementMetrics, BalanceSheetData, CashFlowData } from '@shared/types';

interface UseReportsResult {
  incomeStatement: {
    metrics: IncomeStatementMetrics | null;
    transactions: Transaction[];
  };
  balanceSheet: BalanceSheetData | null;
  cashFlow: CashFlowData | null;
  isLoading: boolean;
  error: Error | null;
}

export function useReports(
  businessId: string,
  startDate: string,
  endDate: string
): UseReportsResult {
  const [incomeStatement, setIncomeStatement] = useState<{
    metrics: IncomeStatementMetrics | null;
    transactions: Transaction[];
  }>({
    metrics: null,
    transactions: [],
  });
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!businessId || !startDate || !endDate) {
      setIsLoading(false);
      return;
    }

    const fetchReportData = async () => {
      try {
        const db = getDatabase();
        const collection = db.collections.get('transactions');
        const records: any[] = await collection.query().fetch();

        // Filter by business
        const businessTxs = records.filter(
          (tx) => tx.business_id === businessId && !tx.deleted_at && tx.status === 'posted'
        );

        // Filter by date range
        const filtered = filterTransactionsByDateRange(businessTxs, startDate, endDate);

        // Calculate income statement
        const summary = calculateFinancialSummary(filtered);
        const metrics = calculateIncomeStatementMetrics(summary);

        // Calculate balance sheet
        const bs = calculateBalanceSheet(
          businessTxs,
          summary.totalCapitalInvested || 0
        );

        // Calculate cash flow
        const cf = calculateCashFlow(
          filtered,
          summary.totalCapitalInvested || 0,
          businessTxs,
          startDate
        );

        setIncomeStatement({
          metrics,
          transactions: filtered,
        });
        setBalanceSheet(bs);
        setCashFlow(cf);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, [businessId, startDate, endDate]);

  return {
    incomeStatement,
    balanceSheet,
    cashFlow,
    isLoading,
    error,
  };
}

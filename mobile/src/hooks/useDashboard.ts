import { useState, useEffect } from 'react';
import { getDatabase } from '@/db';
import {
  calculateFinancialSummary,
  calculateBalanceSheet,
  calculateROI,
  filterTransactionsByDateRange,
  calculateCategoryCounts,
} from '@shared/calculations';
import type { Transaction, FinancialSummary, BalanceSheetData } from '@shared/types';

interface UseDashboardResult {
  transactions: Transaction[];
  summary: FinancialSummary | null;
  roi: number;
  balanceSheet: BalanceSheetData | null;
  categoryCounts: Record<string, number>;
  isLoading: boolean;
  error: Error | null;
}

export function useDashboard(businessId: string, year: number, month?: number): UseDashboardResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [roi, setRoi] = useState(0);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!businessId) {
      setTransactions([]);
      setSummary(null);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const db = getDatabase();
        const collection = db.collections.get('transactions');
        const records: any[] = await collection.query().fetch();

        // Filter by business and date range
        const businessTxs = records.filter(
          (tx) =>
            tx.business_id === businessId &&
            !tx.deleted_at &&
            tx.status === 'posted'
        );

        // Calculate date range
        const startDate = new Date(year, month ?? 0, 1).toISOString().split('T')[0];
        const endDate = month !== undefined
          ? new Date(year, month + 1, 0).toISOString().split('T')[0]
          : new Date(year + 1, 0, 0).toISOString().split('T')[0];

        const filtered = filterTransactionsByDateRange(businessTxs, startDate, endDate);

        // Calculate metrics
        const financialSummary = calculateFinancialSummary(filtered);
        const counts = calculateCategoryCounts(filtered);
        const roiValue = calculateROI(
          financialSummary.netProfit,
          financialSummary.totalCapitalInvested || 0
        );

        // Calculate balance sheet
        const bs = calculateBalanceSheet(
          businessTxs,
          financialSummary.totalCapitalInvested || 0
        );

        setTransactions(filtered);
        setSummary(financialSummary);
        setRoi(roiValue);
        setBalanceSheet(bs);
        setCategoryCounts(counts);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [businessId, year, month]);

  return {
    transactions,
    summary,
    roi,
    balanceSheet,
    categoryCounts,
    isLoading,
    error,
  };
}

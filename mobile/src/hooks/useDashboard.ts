import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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
        setIsLoading(true);

        // Fetch transactions directly from Supabase
        const { data, error: fetchError } = await supabase
          .from('transactions')
          .select(
            `*,
            debit_account:accounts!transactions_debit_account_id_fkey(id, account_code, account_name, account_type),
            credit_account:accounts!transactions_credit_account_id_fkey(id, account_code, account_name, account_type)`
          )
          .eq('business_id', businessId)
          .is('deleted_at', null)
          .eq('status', 'posted')
          .order('date', { ascending: false });

        if (fetchError) throw new Error(fetchError.message);

        const allTxs = (data || []) as Transaction[];

        // Calculate date range
        const startDate = new Date(year, month ?? 0, 1).toISOString().split('T')[0];
        const endDate = month !== undefined
          ? new Date(year, month + 1, 0).toISOString().split('T')[0]
          : new Date(year + 1, 0, 0).toISOString().split('T')[0];

        const filtered = filterTransactionsByDateRange(allTxs, startDate, endDate);

        // Fetch business capital
        const { data: biz } = await supabase
          .from('businesses')
          .select('capital_investment')
          .eq('id', businessId)
          .single();

        const capital = biz?.capital_investment || 0;

        // Calculate metrics
        const financialSummary = calculateFinancialSummary(filtered);
        const counts = calculateCategoryCounts(filtered);
        const roiValue = calculateROI(financialSummary.netProfit, capital);
        const bs = calculateBalanceSheet(allTxs, capital);

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

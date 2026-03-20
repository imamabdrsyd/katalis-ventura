import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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
        setIsLoading(true);

        // Fetch all transactions from Supabase
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

        // Fetch business capital
        const { data: biz } = await supabase
          .from('businesses')
          .select('capital_investment')
          .eq('id', businessId)
          .single();

        const capital = biz?.capital_investment || 0;

        // Filter by date range
        const filtered = filterTransactionsByDateRange(allTxs, startDate, endDate);

        // Calculate income statement
        const summary = calculateFinancialSummary(filtered);
        const metrics = calculateIncomeStatementMetrics(summary);

        // Calculate balance sheet
        const bs = calculateBalanceSheet(allTxs, capital);

        // Calculate cash flow
        const cf = calculateCashFlow(filtered, capital, allTxs, startDate);

        setIncomeStatement({ metrics, transactions: filtered });
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

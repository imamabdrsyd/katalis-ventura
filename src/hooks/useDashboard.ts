'use client';

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBusinessContext } from '@/context/BusinessContext';
import { calculateFinancialSummary, calculateROI, calculateCategoryCounts, calculateBalanceSheet } from '@/lib/calculations';
import * as transactionsApi from '@/lib/api/transactions';
import type { Transaction } from '@/types';

export function useDashboard() {
  const { activeBusiness: business, activeBusinessId: businessId, loading: businessLoading, userRole, user } = useBusinessContext();
  const canManageTransactions = userRole === 'business_manager' || userRole === 'both';
  const queryClient = useQueryClient();

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const firstName = userName.split(' ')[0];

  // Use TanStack Query — shared cache with useReportData (same queryKey)
  const { data: allTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', businessId],
    queryFn: () => transactionsApi.getTransactions(businessId!),
    enabled: !!businessId,
  });

  // Invalidate cache when FloatingQuickAdd saves a transaction
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', businessId] });
    };
    window.addEventListener('transaction-saved', handler);
    return () => window.removeEventListener('transaction-saved', handler);
  }, [queryClient, businessId]);

  // Dashboard KPIs only use posted transactions
  const transactions = useMemo(
    () => allTransactions.filter((t: Transaction) => t.status === 'posted'),
    [allTransactions]
  );

  // Combine all calculations in single useMemo — one pass trigger instead of 5
  const { summary, roi, categoryCounts, balanceSheet } = useMemo(() => {
    const sum = calculateFinancialSummary(transactions);
    const capital = business?.capital_investment || 0;
    return {
      summary: sum,
      roi: calculateROI(sum.netProfit, capital),
      categoryCounts: calculateCategoryCounts(transactions),
      balanceSheet: calculateBalanceSheet(transactions, capital),
    };
  }, [transactions, business?.capital_investment]);

  return {
    business,
    businessId,
    businessLoading,
    canManageTransactions,
    user,
    firstName,
    transactions,
    transactionsLoading,
    summary,
    roi,
    categoryCounts,
    balanceSheet,
  };
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import { calculateFinancialSummary, calculateROI, calculateCategoryCounts, calculateInitialCapital, calculateBalanceSheet } from '@/lib/calculations';
import * as transactionsApi from '@/lib/api/transactions';
import type { Transaction, TransactionCategory, FinancialSummary } from '@/types';

export function useDashboard() {
  const { activeBusiness: business, activeBusinessId: businessId, loading: businessLoading, userRole, user } = useBusinessContext();
  const canManageTransactions = userRole === 'business_manager' || userRole === 'both';

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const firstName = userName.split(' ')[0];

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    if (!businessId) return;
    setTransactionsLoading(true);
    try {
      const data = await transactionsApi.getTransactions(businessId);
      setTransactions(data);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setTransactionsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      fetchTransactions();
    }
  }, [businessId, fetchTransactions]);

  const summary: FinancialSummary = calculateFinancialSummary(transactions);
  // Calculate initial capital from transactions for ROI
  const initialCapital = calculateInitialCapital(transactions);
  const roi = calculateROI(summary.netProfit, initialCapital);
  const categoryCounts: Record<TransactionCategory, number> = calculateCategoryCounts(transactions);
  const balanceSheet = calculateBalanceSheet(transactions, business?.capital_investment || 0);

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

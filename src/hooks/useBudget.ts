'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useBusinessContext } from '@/context/BusinessContext';
import { isManagerRole } from '@/lib/roles';
import * as budgetsApi from '@/lib/api/budgets';
import { getAccounts } from '@/lib/api/accounts';
import { getTransactions } from '@/lib/api/transactions';
import {
  calculateBudgetVsActual,
  calculateBudgetSummaryKPI,
  projectBudgetTrend,
} from '@/lib/calculations';
import type {
  Budget, BudgetFormData, BudgetLineInput, BudgetStatus,
  BudgetVsActualRow, BudgetSummaryKPI, ProjectedMonth,
  Account, Transaction,
} from '@/types';

export type BudgetTab = 'overview' | 'input' | 'variance' | 'projection';

export function useBudget() {
  const { user, activeBusiness, activeBusinessId: businessId, loading: businessLoading, userRole } = useBusinessContext();
  const canManage = isManagerRole(userRole);

  // Data state
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<BudgetTab>('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectionMonths, setProjectionMonths] = useState<number>(6);

  // Fetch budgets list
  const fetchBudgets = useCallback(async () => {
    if (!businessId) return;
    try {
      const data = await budgetsApi.getBudgets(businessId);
      setBudgets(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat budget';
      setError(message);
    }
  }, [businessId]);

  // Fetch selected budget with lines
  const fetchBudgetDetail = useCallback(async (budgetId: string) => {
    try {
      const data = await budgetsApi.getBudget(budgetId);
      setSelectedBudget(data);
    } catch (err: unknown) {
      console.error('Failed to fetch budget detail:', err);
    }
  }, []);

  // Fetch accounts & transactions
  const fetchSupportingData = useCallback(async () => {
    if (!businessId) return;
    try {
      const [accs, txns] = await Promise.all([
        getAccounts(businessId, false),
        getTransactions(businessId),
      ]);
      setAccounts(accs);
      setTransactions(txns);
    } catch (err: unknown) {
      console.error('Failed to fetch supporting data:', err);
    }
  }, [businessId]);

  // Initial load
  useEffect(() => {
    if (businessId) {
      setLoading(true);
      setError(null);
      Promise.all([fetchBudgets(), fetchSupportingData()])
        .finally(() => setLoading(false));
    }
  }, [businessId, fetchBudgets, fetchSupportingData]);

  // Auto-select latest budget
  useEffect(() => {
    if (budgets.length > 0 && !selectedBudgetId) {
      setSelectedBudgetId(budgets[0].id);
    }
  }, [budgets, selectedBudgetId]);

  // Fetch detail when selection changes
  useEffect(() => {
    if (selectedBudgetId) {
      fetchBudgetDetail(selectedBudgetId);
    } else {
      setSelectedBudget(null);
    }
  }, [selectedBudgetId, fetchBudgetDetail]);

  // Filter transactions to budget period (only posted)
  const periodTransactions = useMemo(() => {
    if (!selectedBudget) return [];
    return transactions.filter((t) =>
      (!t.status || t.status === 'posted') &&
      t.date >= selectedBudget.start_date &&
      t.date <= selectedBudget.end_date
    );
  }, [transactions, selectedBudget]);

  // Computed: Budget vs Actual rows
  const varianceRows: BudgetVsActualRow[] = useMemo(() => {
    if (!selectedBudget?.lines || selectedBudget.lines.length === 0) return [];
    return calculateBudgetVsActual(selectedBudget.lines, periodTransactions, accounts);
  }, [selectedBudget, periodTransactions, accounts]);

  // Computed: Summary KPIs
  const summaryKPI: BudgetSummaryKPI | null = useMemo(() => {
    if (varianceRows.length === 0 || !selectedBudget) return null;
    return calculateBudgetSummaryKPI(varianceRows, selectedBudget);
  }, [varianceRows, selectedBudget]);

  // Computed: Trend projection
  const projections: ProjectedMonth[] = useMemo(() => {
    if (!selectedBudget?.lines || selectedBudget.lines.length === 0) return [];
    return projectBudgetTrend(
      selectedBudget.lines,
      periodTransactions,
      accounts,
      projectionMonths
    );
  }, [selectedBudget, periodTransactions, accounts, projectionMonths]);

  // Relevant accounts for budget input (REVENUE + EXPENSE leaf accounts)
  const relevantAccounts = useMemo(() => {
    const parentIds = new Set(accounts.filter(a => a.parent_account_id).map(a => a.parent_account_id));
    return accounts.filter((a) =>
      (a.account_type === 'REVENUE' || a.account_type === 'EXPENSE') &&
      a.is_active &&
      !parentIds.has(a.id) // Only leaf accounts
    ).sort((a, b) => a.account_code.localeCompare(b.account_code));
  }, [accounts]);

  // Generate month keys for a budget period
  const generateMonths = useCallback((startDate: string, endDate: string): string[] => {
    const months: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start.getFullYear(), start.getMonth(), 1);

    while (current <= end) {
      months.push(
        `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-01`
      );
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  }, []);

  // Distribute annual amount evenly across months
  const distributeAmount = useCallback((total: number, monthCount: number): number => {
    return Math.round((total / monthCount) * 100) / 100;
  }, []);

  // === ACTIONS ===

  const handleCreateBudget = useCallback(async (data: BudgetFormData) => {
    if (!businessId || !user) return;
    setSaving(true);
    try {
      const budget = await budgetsApi.createBudget(businessId, user.id, data);
      setShowCreateModal(false);
      await fetchBudgets();
      setSelectedBudgetId(budget.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal membuat budget';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [businessId, user, fetchBudgets]);

  const handleUpdateBudget = useCallback(async (data: Partial<BudgetFormData>) => {
    if (!selectedBudgetId) return;
    setSaving(true);
    try {
      await budgetsApi.updateBudget(selectedBudgetId, data);
      setShowEditModal(false);
      await fetchBudgets();
      await fetchBudgetDetail(selectedBudgetId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mengupdate budget';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [selectedBudgetId, fetchBudgets, fetchBudgetDetail]);

  const handleSaveBudgetLines = useCallback(async (lines: BudgetLineInput[]) => {
    if (!selectedBudgetId) return;
    setSaving(true);
    try {
      await budgetsApi.upsertBudgetLines(selectedBudgetId, lines);
      await fetchBudgetDetail(selectedBudgetId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan budget lines';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [selectedBudgetId, fetchBudgetDetail]);

  const handleUpdateStatus = useCallback(async (status: BudgetStatus) => {
    if (!selectedBudgetId) return;
    setSaving(true);
    try {
      await budgetsApi.updateBudgetStatus(selectedBudgetId, status);
      await fetchBudgets();
      await fetchBudgetDetail(selectedBudgetId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mengubah status budget';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [selectedBudgetId, fetchBudgets, fetchBudgetDetail]);

  const handleDeleteBudget = useCallback(async () => {
    if (!selectedBudgetId) return;
    setSaving(true);
    try {
      await budgetsApi.deleteBudget(selectedBudgetId);
      setShowDeleteConfirm(false);
      setSelectedBudgetId(null);
      setSelectedBudget(null);
      await fetchBudgets();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus budget';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [selectedBudgetId, fetchBudgets]);

  const handleCopyFromPrevious = useCallback(async (sourceBudgetId: string) => {
    if (!selectedBudgetId) return;
    setSaving(true);
    try {
      await budgetsApi.copyBudgetLines(sourceBudgetId, selectedBudgetId);
      await fetchBudgetDetail(selectedBudgetId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menyalin budget';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [selectedBudgetId, fetchBudgetDetail]);

  return {
    // Data
    budgets,
    selectedBudget,
    selectedBudgetId,
    accounts,
    relevantAccounts,
    transactions: periodTransactions,
    varianceRows,
    summaryKPI,
    projections,
    // Loading
    loading: loading || businessLoading,
    saving,
    error,
    // UI state
    activeTab, setActiveTab,
    showCreateModal, setShowCreateModal,
    showEditModal, setShowEditModal,
    showDeleteConfirm, setShowDeleteConfirm,
    projectionMonths, setProjectionMonths,
    // Actions
    setSelectedBudgetId,
    handleCreateBudget,
    handleUpdateBudget,
    handleSaveBudgetLines,
    handleUpdateStatus,
    handleDeleteBudget,
    handleCopyFromPrevious,
    // Helpers
    canManage,
    activeBusiness,
    generateMonths,
    distributeAmount,
  };
}

'use client';

import { useState, useMemo } from 'react';
import { useReportData } from './useReportData';
import {
  calculateFinancialSummary,
  calculateIncomeStatementMetrics,
  groupTransactionsByMonth,
} from '@/lib/calculations';

export interface ScenarioAssumptions {
  revenueGrowth: number;      // % change
  cogsGrowth: number;         // % change
  opexGrowth: number;         // % change
  taxRate: number;            // % of EBT
  interestGrowth: number;     // % change
}

export interface ScenarioResult {
  label: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  operatingIncome: number;
  interest: number;
  ebt: number;
  tax: number;
  netIncome: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
}

export interface ProjectionMonth {
  month: string;
  revenue: number;
  netIncome: number;
  cumulativeNetIncome: number;
}

const DEFAULT_ASSUMPTIONS: ScenarioAssumptions = {
  revenueGrowth: 0,
  cogsGrowth: 0,
  opexGrowth: 0,
  taxRate: 0,
  interestGrowth: 0,
};

function applyScenario(
  baseline: ScenarioResult,
  assumptions: ScenarioAssumptions
): ScenarioResult {
  const revenue = baseline.revenue * (1 + assumptions.revenueGrowth / 100);
  const cogs = baseline.cogs * (1 + assumptions.cogsGrowth / 100);
  const grossProfit = revenue - cogs;
  const opex = baseline.opex * (1 + assumptions.opexGrowth / 100);
  const operatingIncome = grossProfit - opex;
  const interest = baseline.interest * (1 + assumptions.interestGrowth / 100);
  const ebt = operatingIncome - interest;
  const tax = assumptions.taxRate > 0 ? Math.max(0, ebt * (assumptions.taxRate / 100)) : baseline.tax;
  const netIncome = ebt - tax;

  return {
    label: '',
    revenue,
    cogs,
    grossProfit,
    opex,
    operatingIncome,
    interest,
    ebt,
    tax,
    netIncome,
    grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    operatingMargin: revenue > 0 ? (operatingIncome / revenue) * 100 : 0,
    netMargin: revenue > 0 ? (netIncome / revenue) * 100 : 0,
  };
}

export function useScenarioModeling() {
  const reportData = useReportData();
  const { activeBusiness, filteredTransactions, transactions } = reportData;

  const [optimisticAssumptions, setOptimisticAssumptions] = useState<ScenarioAssumptions>({
    revenueGrowth: 20,
    cogsGrowth: 10,
    opexGrowth: 5,
    taxRate: 0,
    interestGrowth: 0,
  });

  const [pessimisticAssumptions, setPessimisticAssumptions] = useState<ScenarioAssumptions>({
    revenueGrowth: -10,
    cogsGrowth: 15,
    opexGrowth: 10,
    taxRate: 0,
    interestGrowth: 5,
  });

  const [customAssumptions, setCustomAssumptions] = useState<ScenarioAssumptions>({
    ...DEFAULT_ASSUMPTIONS,
  });

  const [projectionMonths, setProjectionMonths] = useState(6);

  // Baseline from actual data
  const baseline = useMemo<ScenarioResult>(() => {
    const summary = calculateFinancialSummary(filteredTransactions);
    const metrics = calculateIncomeStatementMetrics(summary);

    return {
      label: 'Baseline (Aktual)',
      revenue: summary.totalEarn,
      cogs: summary.totalVar,
      grossProfit: summary.grossProfit,
      opex: summary.totalOpex,
      operatingIncome: metrics.operatingIncome,
      interest: summary.totalInterest,
      ebt: metrics.ebt,
      tax: summary.totalTax,
      netIncome: summary.netProfit,
      grossMargin: metrics.grossMargin,
      operatingMargin: metrics.operatingMargin,
      netMargin: metrics.netMargin,
    };
  }, [filteredTransactions]);

  // Scenario results
  const optimistic = useMemo(() => {
    const result = applyScenario(baseline, optimisticAssumptions);
    result.label = 'Optimistic';
    return result;
  }, [baseline, optimisticAssumptions]);

  const pessimistic = useMemo(() => {
    const result = applyScenario(baseline, pessimisticAssumptions);
    result.label = 'Pessimistic';
    return result;
  }, [baseline, pessimisticAssumptions]);

  const custom = useMemo(() => {
    const result = applyScenario(baseline, customAssumptions);
    result.label = 'Custom';
    return result;
  }, [baseline, customAssumptions]);

  // Monthly trend for projection chart
  const monthlyData = useMemo(() => {
    return groupTransactionsByMonth(transactions);
  }, [transactions]);

  // Simple projection based on average monthly performance
  const projections = useMemo<ProjectionMonth[]>(() => {
    if (monthlyData.length === 0) return [];

    const avgRevenue = monthlyData.reduce((s, m) => s + m.earn, 0) / monthlyData.length;
    const avgNet = monthlyData.reduce((s, m) => s + m.netProfit, 0) / monthlyData.length;

    const months: ProjectionMonth[] = [];
    const now = new Date();
    let cumulative = 0;

    for (let i = 1; i <= projectionMonths; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthLabel = date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });

      // Apply custom growth rate to projections
      const growthFactor = Math.pow(1 + customAssumptions.revenueGrowth / 100 / 12, i);
      const projectedRevenue = avgRevenue * growthFactor;
      const projectedNet = avgNet * growthFactor;
      cumulative += projectedNet;

      months.push({
        month: monthLabel,
        revenue: projectedRevenue,
        netIncome: projectedNet,
        cumulativeNetIncome: cumulative,
      });
    }

    return months;
  }, [monthlyData, projectionMonths, customAssumptions.revenueGrowth]);

  return {
    ...reportData,
    baseline,
    optimistic,
    pessimistic,
    custom,
    optimisticAssumptions,
    pessimisticAssumptions,
    customAssumptions,
    setOptimisticAssumptions,
    setPessimisticAssumptions,
    setCustomAssumptions,
    projectionMonths,
    setProjectionMonths,
    projections,
    monthlyData,
  };
}

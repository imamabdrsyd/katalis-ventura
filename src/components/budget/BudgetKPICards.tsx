'use client';

import { TrendingUp, TrendingDown, Wallet, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { BudgetSummaryKPI } from '@/types';

interface BudgetKPICardsProps {
  kpi: BudgetSummaryKPI;
}

export function BudgetKPICards({ kpi }: BudgetKPICardsProps) {
  const cards = [
    {
      label: 'Pendapatan',
      icon: TrendingUp,
      value: formatCurrency(kpi.totalActualRevenue),
      subValue: `dari ${formatCurrency(kpi.totalBudgetedRevenue)}`,
      percent: kpi.revenueVariancePercent,
      favorable: kpi.revenueVariance >= 0,
    },
    {
      label: 'Pengeluaran',
      icon: TrendingDown,
      value: formatCurrency(kpi.totalActualExpense),
      subValue: `dari ${formatCurrency(kpi.totalBudgetedExpense)}`,
      percent: kpi.expenseVariancePercent,
      favorable: kpi.expenseVariance >= 0,
    },
    {
      label: 'Burn Rate',
      icon: Wallet,
      value: formatCurrency(kpi.burnRate),
      subValue: 'per bulan',
      percent: null,
      favorable: null,
    },
    {
      label: 'Sisa Periode',
      icon: Clock,
      value: `${kpi.monthsRemaining} bulan`,
      subValue: `Utilisasi ${kpi.budgetUtilization.toFixed(1)}%`,
      percent: null,
      favorable: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <card.icon className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {card.label}
            </span>
          </div>
          <div className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {card.value}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {card.subValue}
            </span>
            {card.percent !== null && (
              <span
                className={`text-xs font-medium ${
                  card.favorable
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {card.percent >= 0 ? '+' : ''}{card.percent.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

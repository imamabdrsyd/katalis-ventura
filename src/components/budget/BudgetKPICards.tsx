'use client';

import { TrendingUp, TrendingDown, Wallet, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { BudgetSummaryKPI } from '@/types';
import { useLanguage } from '@/context/LanguageContext';

interface BudgetKPICardsProps {
  kpi: BudgetSummaryKPI;
}

export function BudgetKPICards({ kpi }: BudgetKPICardsProps) {
  const { t } = useLanguage();
  const tb = t.budget;
  const cards = [
    {
      label: tb.revenue,
      icon: TrendingUp,
      value: formatCurrency(kpi.totalActualRevenue),
      subValue: tb.ofBudget(formatCurrency(kpi.totalBudgetedRevenue)),
      percent: kpi.revenueVariancePercent,
      favorable: kpi.revenueVariance >= 0,
    },
    {
      label: tb.expenseKpi,
      icon: TrendingDown,
      value: formatCurrency(kpi.totalActualExpense),
      subValue: tb.ofBudget(formatCurrency(kpi.totalBudgetedExpense)),
      percent: kpi.expenseVariancePercent,
      favorable: kpi.expenseVariance >= 0,
    },
    {
      label: tb.burnRate,
      icon: Wallet,
      value: formatCurrency(kpi.burnRate),
      subValue: tb.perMonth,
      percent: null,
      favorable: null,
    },
    {
      label: tb.remainingPeriod,
      icon: Clock,
      value: tb.monthsLeft(kpi.monthsRemaining),
      subValue: tb.utilization(kpi.budgetUtilization.toFixed(1)),
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
                  card.percent === 0
                    ? 'text-gray-500 dark:text-gray-400'
                    : card.favorable
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                }`}
              >
                {card.percent > 0 ? '+' : ''}{card.percent.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

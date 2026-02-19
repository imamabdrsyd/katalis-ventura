'use client';

import { useMemo, useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import type { Transaction } from '@/types';
import { formatCurrency } from '@/lib/utils';

ChartJS.register(ArcElement, Tooltip, Legend);

const EXPENSE_COLORS = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#3b82f6', // blue
  '#ec4899', // pink
  '#9ca3af', // gray (for "Others")
];

interface ExpenseBreakdownChartProps {
  transactions: Transaction[];
  loading?: boolean;
}

export default function ExpenseBreakdownChart({ transactions, loading = false }: ExpenseBreakdownChartProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  const expenseData = useMemo(() => {
    const expenseMap = new Map<string, number>();

    transactions.forEach((t) => {
      // Only count expense categories
      if (t.category !== 'OPEX' && t.category !== 'VAR' && t.category !== 'TAX') return;

      const amount = Number(t.amount);
      // Use debit account name if available (sub-account), otherwise use description
      const accountName = t.debit_account?.account_name || t.description || t.category;

      expenseMap.set(accountName, (expenseMap.get(accountName) || 0) + amount);
    });

    // Sort by amount descending and take top 5
    const sorted = Array.from(expenseMap.entries())
      .sort(([, a], [, b]) => b - a);

    if (sorted.length <= 5) return sorted;

    const top5 = sorted.slice(0, 5);
    const othersTotal = sorted.slice(5).reduce((sum, [, amount]) => sum + amount, 0);
    if (othersTotal > 0) {
      top5.push(['Lainnya', othersTotal]);
    }

    return top5;
  }, [transactions]);

  const totalExpense = useMemo(() => {
    return expenseData.reduce((sum, [, amount]) => sum + amount, 0);
  }, [expenseData]);

  const chartData = useMemo(() => ({
    labels: expenseData.map(([name]) => name),
    datasets: [{
      data: expenseData.map(([, amount]) => amount),
      backgroundColor: expenseData.map((_, i) => EXPENSE_COLORS[i % EXPENSE_COLORS.length]),
      borderColor: isDark ? '#1f2937' : '#ffffff',
      borderWidth: 2,
      hoverOffset: 6,
    }],
  }), [expenseData, isDark]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        titleColor: isDark ? '#f3f4f6' : '#1f2937',
        bodyColor: isDark ? '#f3f4f6' : '#1f2937',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: function (context: any) {
            const value = context.parsed;
            const percentage = totalExpense > 0 ? ((value / totalExpense) * 100).toFixed(1) : '0';
            return `${formatCurrency(value)} (${percentage}%)`;
          },
        },
      },
    },
  }), [isDark, totalExpense]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-full min-h-[400px] bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col h-full">
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Expense Breakdown</h3>

      {expenseData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
          <p>Belum ada data expense</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div style={{ height: 200 }} className="mb-4">
            <Doughnut data={chartData} options={options} />
          </div>

          {/* Legend */}
          <div className="space-y-2">
            {expenseData.map(([name, amount], index) => {
              const percentage = totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : '0';
              return (
                <div key={name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: EXPENSE_COLORS[index % EXPENSE_COLORS.length] }}
                    />
                    <span className="text-gray-700 dark:text-gray-300 truncate">{name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-gray-500 dark:text-gray-400 text-xs">{percentage}%</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(amount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

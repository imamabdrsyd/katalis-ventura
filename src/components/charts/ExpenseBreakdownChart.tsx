'use client';

import { useMemo, useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Doughnut } from 'react-chartjs-2';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  '#ef4444',
  '#f59e0b',
  '#8b5cf6',
  '#3b82f6',
  '#ec4899',
  '#10b981',
  '#f97316',
  '#06b6d4',
  '#84cc16',
  '#6366f1',
];

const PAGE_SIZE = 5;

interface ExpenseBreakdownChartProps {
  transactions: Transaction[];
  loading?: boolean;
  selectedYear: number;
  selectedMonth?: number | null;
}

export default function ExpenseBreakdownChart({ transactions, loading = false, selectedYear, selectedMonth = null }: ExpenseBreakdownChartProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  const allExpenseData = useMemo(() => {
    const expenseMap = new Map<string, number>();

    transactions.forEach((t) => {
      if (t.category !== 'OPEX' && t.category !== 'VAR' && t.category !== 'TAX') return;
      const d = new Date(t.date);
      if (d.getFullYear() !== selectedYear) return;
      if (selectedMonth !== null && d.getMonth() !== selectedMonth) return;

      const amount = Number(t.amount);
      const accountName = t.debit_account?.account_name || t.description || t.category;
      expenseMap.set(accountName, (expenseMap.get(accountName) || 0) + amount);
    });

    return Array.from(expenseMap.entries()).sort(([, a], [, b]) => b - a);
  }, [transactions, selectedYear, selectedMonth]);

  const totalPages = Math.ceil(allExpenseData.length / PAGE_SIZE);

  // Reset page when data changes
  useEffect(() => { setPage(0); }, [allExpenseData]);

  const pagedData = useMemo(() => {
    const start = page * PAGE_SIZE;
    return allExpenseData.slice(start, start + PAGE_SIZE);
  }, [allExpenseData, page]);

  const totalExpense = useMemo(() => {
    return allExpenseData.reduce((sum, [, amount]) => sum + amount, 0);
  }, [allExpenseData]);

  const chartData = useMemo(() => ({
    labels: pagedData.map(([name]) => name),
    datasets: [{
      data: pagedData.map(([, amount]) => amount),
      backgroundColor: pagedData.map((_, i) => EXPENSE_COLORS[(page * PAGE_SIZE + i) % EXPENSE_COLORS.length]),
      borderColor: isDark ? '#1f2937' : '#ffffff',
      borderWidth: 2,
      hoverOffset: 6,
    }],
  }), [pagedData, isDark, page]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: { display: false },
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

      {allExpenseData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
          <p>Belum ada data expense</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div style={{ height: 200 }} className="mb-4">
            <Doughnut data={chartData} options={options} />
          </div>

          <div className="space-y-2 flex-1">
            {pagedData.map(([name, amount], index) => {
              const colorIndex = page * PAGE_SIZE + index;
              const percentage = totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : '0';
              return (
                <div key={name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: EXPENSE_COLORS[colorIndex % EXPENSE_COLORS.length] }}
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

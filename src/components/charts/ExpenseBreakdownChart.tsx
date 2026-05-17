'use client';

import { useMemo, useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { Doughnut } from 'react-chartjs-2';
import { ArrowUpRight } from 'lucide-react';
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

const OTHERS_COLOR = '#9ca3af';
const TOP_N = 5;

interface ExpenseBreakdownChartProps {
  transactions: Transaction[];
  loading?: boolean;
  selectedYear: number;
  selectedMonth?: number | null;
}

export default function ExpenseBreakdownChart({ transactions, loading = false, selectedYear, selectedMonth = null }: ExpenseBreakdownChartProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  const allExpenseData = useMemo(() => {
    const expenseMap = new Map<string, number>();

    transactions.forEach((t) => {
      if (t.category !== 'OPEX' && t.category !== 'VAR' && t.category !== 'TAX') return;
      // Skip inventory purchases (VAR + debit ASSET) — these are balance sheet movements,
      // not expenses until recognized as COGS. Konsisten dengan calculateFinancialSummary.
      if (
        t.category === 'VAR' &&
        t.is_double_entry &&
        t.debit_account?.account_type === 'ASSET'
      ) return;

      const d = new Date(t.date);
      if (d.getFullYear() !== selectedYear) return;
      if (selectedMonth !== null && d.getMonth() !== selectedMonth) return;

      const amount = Number(t.amount);
      const accountName = t.debit_account?.account_name || t.description || t.category;
      expenseMap.set(accountName, (expenseMap.get(accountName) || 0) + amount);
    });

    return Array.from(expenseMap.entries()).sort(([, a], [, b]) => b - a);
  }, [transactions, selectedYear, selectedMonth]);


  const totalExpense = useMemo(() => {
    return allExpenseData.reduce((sum, [, amount]) => sum + amount, 0);
  }, [allExpenseData]);

  // Top-N + Others rollup untuk display list (chart tetap pakai all data agar donut akurat)
  const displayRows = useMemo(() => {
    if (allExpenseData.length <= TOP_N) {
      return allExpenseData.map(([name, amount], idx) => ({
        name,
        amount,
        color: EXPENSE_COLORS[idx % EXPENSE_COLORS.length],
        isOthers: false,
      }));
    }
    const top = allExpenseData.slice(0, TOP_N).map(([name, amount], idx) => ({
      name,
      amount,
      color: EXPENSE_COLORS[idx % EXPENSE_COLORS.length],
      isOthers: false,
    }));
    const othersAmount = allExpenseData.slice(TOP_N).reduce((sum, [, a]) => sum + a, 0);
    const othersCount = allExpenseData.length - TOP_N;
    if (othersAmount > 0) {
      top.push({
        name: `Lainnya (${othersCount})`,
        amount: othersAmount,
        color: OTHERS_COLOR,
        isOthers: true,
      });
    }
    return top;
  }, [allExpenseData]);

  const chartData = useMemo(() => ({
    labels: allExpenseData.map(([name]) => name),
    datasets: [{
      data: allExpenseData.map(([, amount]) => amount),
      backgroundColor: allExpenseData.map((_, i) => EXPENSE_COLORS[i % EXPENSE_COLORS.length]),
      borderColor: isDark ? '#1f2937' : '#ffffff',
      borderWidth: 2,
      hoverOffset: 6,
    }],
  }), [allExpenseData, isDark]);

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

  const hasMore = allExpenseData.length > TOP_N;

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Expense Breakdown</h3>
        {hasMore && (
          <button
            type="button"
            onClick={() => router.push('/income-statement')}
            aria-label="Lihat semua expense di Income Statement"
            className="p-1.5 rounded-lg text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {allExpenseData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
          <p>Belum ada data expense</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div style={{ height: 200 }} className="mb-4">
            <Doughnut data={chartData} options={options} />
          </div>

          <div className="space-y-2">
            {displayRows.map((row) => {
              const percentage = totalExpense > 0 ? ((row.amount / totalExpense) * 100).toFixed(1) : '0';
              return (
                <div key={row.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className={`truncate ${row.isOthers ? 'text-gray-500 dark:text-gray-400 italic' : 'text-gray-700 dark:text-gray-300'}`}>
                      {row.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-gray-500 dark:text-gray-400 text-xs">{percentage}%</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(row.amount)}</span>
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

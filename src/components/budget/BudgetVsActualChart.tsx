'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import type { BudgetVsActualRow } from '@/types';
import { formatCurrency } from '@/lib/utils';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type FilterType = 'all' | 'revenue' | 'expense';

interface BudgetVsActualChartProps {
  rows: BudgetVsActualRow[];
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

export function BudgetVsActualChart({ rows }: BudgetVsActualChartProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  // Aggregate by month
  const monthlyData = useMemo(() => {
    const filtered = filter === 'all'
      ? rows
      : filter === 'revenue'
        ? rows.filter((r) => r.accountType === 'REVENUE')
        : rows.filter((r) => r.accountType === 'EXPENSE');

    const map = new Map<string, { budgeted: number; actual: number }>();
    filtered.forEach((row) => {
      const existing = map.get(row.month) || { budgeted: 0, actual: 0 };
      existing.budgeted += row.budgeted;
      existing.actual += row.actual;
      map.set(row.month, existing);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        const [, m] = month.split('-');
        const monthIdx = parseInt(m, 10) - 1;
        return {
          label: MONTH_LABELS[monthIdx] || month,
          ...data,
        };
      });
  }, [rows, filter]);

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500">
        Belum ada data budget untuk ditampilkan.
      </div>
    );
  }

  const chartData = {
    labels: monthlyData.map((d) => d.label),
    datasets: [
      {
        label: 'Budget',
        data: monthlyData.map((d) => d.budgeted),
        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.6)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'Aktual',
        data: monthlyData.map((d) => d.actual),
        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.6)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: isDark ? '#9CA3AF' : '#6B7280',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: { size: 12 },
        },
      },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) =>
            `${ctx.dataset.label || ''}: ${formatCurrency(ctx.raw as number)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#9CA3AF' : '#6B7280', font: { size: 11 } },
      },
      y: {
        grid: { color: isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 0.8)' },
        ticks: {
          color: isDark ? '#9CA3AF' : '#6B7280',
          font: { size: 11 },
          callback: (value: unknown) => {
            const num = value as number;
            if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(0)}jt`;
            if (num >= 1_000) return `${(num / 1_000).toFixed(0)}rb`;
            return String(num);
          },
        },
      },
    },
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {(['all', 'revenue', 'expense'] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === f
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {f === 'all' ? 'Semua' : f === 'revenue' ? 'Pendapatan' : 'Beban'}
          </button>
        ))}
      </div>
      <div className="h-[300px]">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}

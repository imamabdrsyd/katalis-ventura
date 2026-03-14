'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import type { ProjectedMonth } from '@/types';
import { formatCurrency } from '@/lib/utils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

interface BudgetTrendChartProps {
  projections: ProjectedMonth[];
  projectionMonths: number;
  onProjectionMonthsChange: (months: number) => void;
}

export function BudgetTrendChart({ projections, projectionMonths, onProjectionMonthsChange }: BudgetTrendChartProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const labels = useMemo(() =>
    projections.map((p) => {
      const [, m] = p.month.split('-');
      return MONTH_LABELS[parseInt(m, 10) - 1] || p.month;
    }),
    [projections]
  );

  // Split actual vs projected line
  const actualData = useMemo(() =>
    projections.map((p) => p.month <= currentMonth ? p.actual : null),
    [projections, currentMonth]
  );

  const projectedData = useMemo(() =>
    projections.map((p) => p.month >= currentMonth ? p.projected : null),
    [projections, currentMonth]
  );

  const budgetData = useMemo(() =>
    projections.map((p) => p.budgeted),
    [projections]
  );

  if (projections.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500">
        Belum ada data untuk proyeksi.
      </div>
    );
  }

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Aktual',
        data: actualData,
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: 'rgb(16, 185, 129)',
        fill: false,
        spanGaps: false,
      },
      {
        label: 'Proyeksi',
        data: projectedData,
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        borderWidth: 2.5,
        borderDash: [6, 4],
        pointRadius: 4,
        pointBackgroundColor: 'rgb(99, 102, 241)',
        fill: true,
        spanGaps: false,
      },
      {
        label: 'Target Budget',
        data: budgetData,
        borderColor: isDark ? 'rgba(156, 163, 175, 0.4)' : 'rgba(156, 163, 175, 0.6)',
        backgroundColor: isDark ? 'rgba(156, 163, 175, 0.05)' : 'rgba(156, 163, 175, 0.1)',
        borderWidth: 1.5,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: true,
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
          label: (ctx: any) => {
            if (ctx.raw === null) return '';
            return `${ctx.dataset.label || ''}: ${formatCurrency(ctx.raw as number)}`;
          },
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
        <span className="text-xs text-gray-500 dark:text-gray-400">Proyeksi:</span>
        {[3, 6, 12].map((m) => (
          <button
            key={m}
            onClick={() => onProjectionMonthsChange(m)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              projectionMonths === m
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {m} bulan
          </button>
        ))}
      </div>
      <div className="h-[300px]">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}

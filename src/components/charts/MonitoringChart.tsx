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
import type { Transaction } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type PeriodType = 'monthly' | 'yearly';
type IntervalType = '1m' | '1d' | '3d' | '1w';

interface MonitoringChartProps {
  transactions: Transaction[];
  loading?: boolean;
  selectedYear: number;
}

interface ChartDataPoint {
  label: string;
  earning: number;
  expense: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayOfYear(date: Date, yearStart: Date): number {
  return Math.floor((date.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
}

export default function MonitoringChart({ transactions, loading = false, selectedYear }: MonitoringChartProps) {
  const [period, setPeriod] = useState<PeriodType>('monthly');
  const [interval, setInterval] = useState<IntervalType>('1m');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (period === 'monthly') setInterval('1m');
  }, [period]);

  const isDark = mounted && resolvedTheme === 'dark';

  const chartDataPoints = useMemo(() => {
    if (period === 'monthly') {
      const now = new Date();
      const isCurrentYear = selectedYear === now.getFullYear();
      const cutoff = isCurrentYear ? now : new Date(selectedYear, 11, 31);
      const yearStart = new Date(selectedYear, 0, 1);

      const dataMap = new Map<string, ChartDataPoint>();

      transactions.forEach((t) => {
        const date = new Date(t.date);
        if (date.getFullYear() !== selectedYear) return;
        if (date > cutoff) return;

        const day = dayOfYear(date, yearStart);
        let key: string;
        let label: string;

        if (interval === '1m') {
          const m = date.getMonth();
          key = `${selectedYear}-${String(m).padStart(2, '0')}`;
          label = MONTH_NAMES[m];
        } else if (interval === '1d') {
          key = t.date;
          label = `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
        } else if (interval === '3d') {
          const blockIdx = Math.floor(day / 3);
          key = `${selectedYear}-3d-${String(blockIdx).padStart(3, '0')}`;
          const blockStart = new Date(yearStart.getTime() + blockIdx * 3 * 24 * 60 * 60 * 1000);
          label = `${blockStart.getDate()} ${MONTH_NAMES[blockStart.getMonth()]}`;
        } else {
          const weekIdx = Math.floor(day / 7);
          key = `${selectedYear}-1w-${String(weekIdx).padStart(3, '0')}`;
          const weekStart = new Date(yearStart.getTime() + weekIdx * 7 * 24 * 60 * 60 * 1000);
          label = `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]}`;
        }

        if (!dataMap.has(key)) {
          dataMap.set(key, { label, earning: 0, expense: 0 });
        }

        const point = dataMap.get(key)!;
        const amount = Number(t.amount);
        const isSettlementEntry = t.is_double_entry && t.credit_account?.account_type !== 'REVENUE';
        const debitsExpense = t.debit_account?.account_type === 'EXPENSE';
        if (t.category === 'EARN' && !isSettlementEntry) point.earning += amount;
        else if (t.category === 'OPEX') point.expense += amount;
        else if (t.category === 'VAR' && debitsExpense) point.expense += amount;
      });

      return Array.from(dataMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v);
    } else {
      const dataMap = new Map<string, ChartDataPoint>();

      transactions.forEach((t) => {
        const date = new Date(t.date);
        const key = `${date.getFullYear()}`;
        const label = `${date.getFullYear()}`;

        if (!dataMap.has(key)) {
          dataMap.set(key, { label, earning: 0, expense: 0 });
        }

        const point = dataMap.get(key)!;
        const amount = Number(t.amount);
        const isSettlementEntry = t.is_double_entry && t.credit_account?.account_type !== 'REVENUE';
        const debitsExpense = t.debit_account?.account_type === 'EXPENSE';

        if (t.category === 'EARN' && !isSettlementEntry) {
          point.earning += amount;
        } else if (t.category === 'OPEX') {
          point.expense += amount;
        } else if (t.category === 'VAR' && debitsExpense) {
          point.expense += amount;
        }
      });

      return Array.from(dataMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, value]) => value);
    }
  }, [transactions, period, interval, selectedYear]);

  const pointRadius = chartDataPoints.length > 30 ? 3 : 6;
  const pointHoverRadius = chartDataPoints.length > 30 ? 5 : 8;

  const { chartData, maxValue } = useMemo(() => {
    const labels: string[] = [];
    const earningData: number[] = [];
    const expenseData: number[] = [];
    let max = 0;

    for (const d of chartDataPoints) {
      labels.push(d.label);
      earningData.push(d.earning);
      expenseData.push(d.expense);
      if (d.earning > max) max = d.earning;
      if (d.expense > max) max = d.expense;
    }

    return {
      chartData: {
        labels,
        datasets: [
          {
            label: 'Revenue',
            data: earningData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointHoverRadius,
          },
          {
            label: 'Expenses',
            data: expenseData,
            borderColor: '#f87171',
            backgroundColor: 'rgba(248, 113, 113, 0.1)',
            borderWidth: 3,
            borderDash: [5, 5],
            fill: true,
            tension: 0.4,
            pointRadius,
            pointBackgroundColor: '#f87171',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointHoverRadius,
          },
        ],
      },
      maxValue: max * 1.1 || 100000,
    };
  }, [chartDataPoints, pointRadius, pointHoverRadius]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        align: 'center' as const,
        labels: {
          usePointStyle: true,
          padding: 10,
          font: {
            size: 14,
            weight: 500 as const,
            family: "'Plus Jakarta Sans', sans-serif",
          },
          color: isDark ? '#9ca3af' : '#6b7280',
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 600 as const,
        },
        titleColor: isDark ? '#f3f4f6' : '#1f2937',
        bodyFont: {
          size: 13,
          weight: 500 as const,
        },
        bodyColor: isDark ? '#f3f4f6' : '#1f2937',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        borderWidth: 1,
        displayColors: true,
        usePointStyle: true,
        boxPadding: 6,
        callbacks: {
          labelTextColor: function (context: any) {
            return context.datasetIndex === 0 ? '#3b82f6' : '#f87171';
          },
          label: function (context: any) {
            return formatCurrency(context.parsed.y);
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: true,
          color: isDark ? '#374151' : '#f3f4f6',
        },
        ticks: {
          color: isDark ? '#9ca3af' : '#9ca3af',
          maxTicksLimit: 12,
          maxRotation: 0,
          font: {
            size: 12,
            family: "'Plus Jakarta Sans', sans-serif",
          },
        },
      },
      y: {
        beginAtZero: true,
        max: maxValue,
        grid: {
          display: true,
          color: isDark ? '#374151' : '#f3f4f6',
        },
        ticks: {
          color: isDark ? '#9ca3af' : '#9ca3af',
          font: {
            size: 12,
            family: "'Plus Jakarta Sans', sans-serif",
          },
          callback: function (value: any) {
            if (value >= 1000000) {
              return (value / 1000000).toFixed(0) + 'M';
            }
            return (value / 1000).toFixed(0) + 'K';
          },
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  }), [isDark, maxValue]);

  const hasData = chartDataPoints.some((d) => d.earning > 0 || d.expense > 0);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Monitoring Overview</h3>
        <div className="flex items-center gap-2">
          {period === 'monthly' && (
            <div className="flex items-center gap-3">
              {(['1d', '3d', '1w'] as Exclude<IntervalType, '1m'>[]).map((iv) => (
                <button
                  key={iv}
                  onClick={() => setInterval(iv === interval ? '1m' : iv)}
                  className={`text-sm transition-colors ${
                    interval === iv
                      ? 'font-semibold text-indigo-600 dark:text-indigo-400'
                      : 'font-normal text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  {iv}
                </button>
              ))}
            </div>
          )}
          <SegmentedToggle
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly' },
            ]}
            ariaLabel="Period"
          />
        </div>
      </div>

      {!hasData ? (
        <div className="h-80 flex items-center justify-center text-gray-400 dark:text-gray-500">
          <p>Belum ada data untuk ditampilkan</p>
        </div>
      ) : (
        <div style={{ height: 320 }}>
          <Line data={chartData} options={options} />
        </div>
      )}
    </div>
  );
}

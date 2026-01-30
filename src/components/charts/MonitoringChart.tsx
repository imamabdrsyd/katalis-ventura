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

interface MonitoringChartProps {
  transactions: Transaction[];
  loading?: boolean;
}

interface ChartDataPoint {
  label: string;
  earning: number;
  expense: number;
}

export default function MonitoringChart({ transactions, loading = false }: MonitoringChartProps) {
  const [period, setPeriod] = useState<PeriodType>('monthly');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  const chartDataPoints = useMemo(() => {
    const dataMap = new Map<string, ChartDataPoint>();

    transactions.forEach((t) => {
      const date = new Date(t.date);
      let key: string;
      let label: string;

      if (period === 'monthly') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = monthNames[date.getMonth()];
      } else {
        key = `${date.getFullYear()}`;
        label = `${date.getFullYear()}`;
      }

      if (!dataMap.has(key)) {
        dataMap.set(key, {
          label,
          earning: 0,
          expense: 0,
        });
      }

      const point = dataMap.get(key)!;
      const amount = Number(t.amount);

      if (t.category === 'EARN') {
        point.earning += amount;
      } else if (t.category === 'OPEX' || t.category === 'VAR') {
        point.expense += amount;
      }
    });

    // Sort by key and return values
    return Array.from(dataMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value);
  }, [transactions, period]);

  const chartData = useMemo(() => {
    const labels = chartDataPoints.length > 0 ? chartDataPoints.map((d) => d.label) : [];
    const earningData = chartDataPoints.length > 0 ? chartDataPoints.map((d) => d.earning) : [];
    const expenseData = chartDataPoints.length > 0 ? chartDataPoints.map((d) => d.expense) : [];

    return {
      labels,
      datasets: [
        {
          label: 'Earnings',
          data: earningData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 6,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointHoverRadius: 8,
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
          pointRadius: 6,
          pointBackgroundColor: '#f87171',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointHoverRadius: 8,
        },
      ],
    };
  }, [chartDataPoints]);

  const maxValue = useMemo(() => {
    const allValues = [
      ...chartDataPoints.map((d) => d.earning),
      ...chartDataPoints.map((d) => d.expense),
    ];
    return Math.max(...allValues, 0) * 1.1 || 100000;
  }, [chartDataPoints]);

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
        <div className="flex p-1.5 rounded-full" style={{ backgroundColor: '#818cf8' }}>
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-5 py-2 text-sm rounded-full transition-all ${
              period === 'monthly'
                ? 'bg-white text-gray-900 font-semibold shadow-md'
                : 'bg-transparent text-white font-normal hover:text-white/80'
            }`}
            style={period === 'monthly' ? { boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)' } : {}}
          >
            Monthly
          </button>
          <button
            onClick={() => setPeriod('yearly')}
            className={`px-5 py-2 text-sm rounded-full transition-all ${
              period === 'yearly'
                ? 'bg-white text-gray-900 font-semibold shadow-md'
                : 'bg-transparent text-white font-normal hover:text-white/80'
            }`}
            style={period === 'yearly' ? { boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)' } : {}}
          >
            Yearly
          </button>
        </div>
      </div>

      {chartDataPoints.length === 0 ? (
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

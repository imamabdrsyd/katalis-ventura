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
import {
  buildMonitoringDataPoints,
  type MonitoringInterval,
  type MonitoringPeriod,
} from '@/lib/monitoring';

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

interface MonitoringChartProps {
  transactions: Transaction[];
  loading?: boolean;
  selectedYear: number;
}

export default function MonitoringChart({ transactions, loading = false, selectedYear }: MonitoringChartProps) {
  const [period, setPeriod] = useState<MonitoringPeriod>('monthly');
  const [interval, setInterval] = useState<MonitoringInterval>('1m');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (period === 'monthly') setInterval('1m');
  }, [period]);

  const isDark = mounted && resolvedTheme === 'dark';

  const chartDataPoints = useMemo(
    () => buildMonitoringDataPoints({ transactions, period, interval, selectedYear }),
    [transactions, period, interval, selectedYear]
  );

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
          lineWidth: 1.5,
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
          lineWidth: 1.5,
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
    <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-card border border-transparent dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Monitoring Overview</h3>
        <div className="flex items-center gap-2">
          {period === 'monthly' && (
            <div className="flex items-center gap-3">
              {(['1d', '3d', '1w'] as Exclude<MonitoringInterval, '1m'>[]).map((iv) => (
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

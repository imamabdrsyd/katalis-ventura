'use client';

import { useState, useMemo } from 'react';
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

interface CashFlowData {
  month: string;
  income: number;
  expense: number;
}

interface CashFlowChartProps {
  data: CashFlowData[];
  loading?: boolean;
}

export default function CashFlowChart({ data, loading = false }: CashFlowChartProps) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const chartData = useMemo(() => {
    const labels = data.length > 0 ? data.map((d) => d.month) : months;
    const incomeData = data.length > 0 ? data.map((d) => d.income) : new Array(12).fill(0);
    const expenseData = data.length > 0 ? data.map((d) => d.expense) : new Array(12).fill(0);

    return {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
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
          label: 'Expense',
          data: expenseData,
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.05)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 6,
          pointBackgroundColor: '#16a34a',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointHoverRadius: 8,
        },
      ],
    };
  }, [data, months]);

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 14,
            weight: 500 as const,
            family: "'Plus Jakarta Sans', sans-serif",
          },
          color: '#6b7280',
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 600 as const,
        },
        bodyFont: {
          size: 13,
        },
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        callbacks: {
          label: function (context: any) {
            return (
              context.dataset.label +
              ': $' +
              context.parsed.y.toLocaleString('en-US', { maximumFractionDigits: 0 })
            );
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: true,
          color: '#f3f4f6',
          drawBorder: false,
        },
        ticks: {
          color: '#9ca3af',
          font: {
            size: 12,
            family: "'Plus Jakarta Sans', sans-serif",
          },
        },
      },
      y: {
        beginAtZero: true,
        max: Math.max(...chartData.datasets.map((d) => Math.max(...(d.data as number[])))) * 1.1,
        grid: {
          display: true,
          color: '#f3f4f6',
          drawBorder: false,
        },
        ticks: {
          color: '#9ca3af',
          font: {
            size: 12,
            family: "'Plus Jakarta Sans', sans-serif",
          },
          callback: function (value: any) {
            return '$' + (value / 1000).toFixed(0) + 'K';
          },
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-80 bg-gray-200 rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div style={{ height: 400 }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}

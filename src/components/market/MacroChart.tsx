'use client';

import { useEffect, useMemo, useState } from 'react';
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
import type { MacroSeries } from '@/lib/marketData/types';

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

interface MacroChartProps {
  series: MacroSeries | null;
  height?: number;
}

export default function MacroChart({ series, height = 320 }: MacroChartProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  const chartData = useMemo(() => {
    if (!series) return null;
    const labels = series.observations.map((o) => o.date);
    const values = series.observations.map((o) => o.value ?? 0);
    return {
      labels,
      datasets: [
        {
          label: series.title,
          data: values,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.12)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: '#6366f1',
        },
      ],
    };
  }, [series]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#1f2937' : '#ffffff',
          titleColor: isDark ? '#f3f4f6' : '#1f2937',
          bodyColor: isDark ? '#f3f4f6' : '#1f2937',
          borderColor: isDark ? '#374151' : '#e5e7eb',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx: { parsed: { y: number | null } }) => {
              const v = ctx.parsed.y;
              if (v === null) return '';
              return `${v}${series?.units ? ' ' + series.units : ''}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: isDark ? '#374151' : '#f3f4f6' },
          ticks: {
            color: isDark ? '#9ca3af' : '#9ca3af',
            maxTicksLimit: 8,
            maxRotation: 0,
            font: { size: 11 },
          },
        },
        y: {
          grid: { color: isDark ? '#374151' : '#f3f4f6' },
          ticks: { color: isDark ? '#9ca3af' : '#9ca3af', font: { size: 11 } },
        },
      },
    }),
    [isDark, series]
  );

  if (!series || !chartData || series.observations.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm"
        style={{ height }}
      >
        Data makroekonomi belum tersedia
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
}

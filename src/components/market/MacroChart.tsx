'use client';

import { useMemo } from 'react';
import { useChartPalette } from '@/hooks/useThemeMode';
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
  const chart = useChartPalette();

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
          backgroundColor: chart.surface,
          titleColor: chart.text,
          bodyColor: chart.text,
          borderColor: chart.border,
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
          grid: { color: chart.grid },
          ticks: {
            color: chart.axis,
            maxTicksLimit: 8,
            maxRotation: 0,
            font: { size: 11 },
          },
        },
        y: {
          grid: { color: chart.grid },
          ticks: { color: chart.axis, font: { size: 11 } },
        },
      },
    }),
    [chart, series]
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

import type { Transaction } from '@/types';
import { calculateFinancialSummary } from '@/lib/calculations';

export type MonitoringPeriod = 'monthly' | 'yearly';
export type MonitoringInterval = '1m' | '1d' | '3d' | '1w';

export interface MonitoringDataPoint {
  label: string;
  earning: number;
  expense: number;
}

export interface MonthlyProfitAndLossSeries {
  revenue: number[];
  expense: number[];
  netProfit: number[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayOfYear(date: Date, yearStart: Date): number {
  return Math.floor((date.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
}

function recognizedExpenses(summary: ReturnType<typeof calculateFinancialSummary>): number {
  return summary.totalOpex + summary.totalVar + summary.totalTax + summary.totalInterest;
}

export function buildMonitoringDataPoints({
  transactions,
  period,
  interval,
  selectedYear,
  now = new Date(),
}: {
  transactions: Transaction[];
  period: MonitoringPeriod;
  interval: MonitoringInterval;
  selectedYear: number;
  now?: Date;
}): MonitoringDataPoint[] {
  const buckets = new Map<string, { label: string; transactions: Transaction[] }>();
  const yearStart = new Date(selectedYear, 0, 1);
  const cutoff = selectedYear === now.getFullYear()
    ? now
    : new Date(selectedYear, 11, 31, 23, 59, 59, 999);

  for (const transaction of transactions) {
    const date = new Date(transaction.date);
    let key: string;
    let label: string;

    if (period === 'monthly') {
      if (date.getFullYear() !== selectedYear || date > cutoff) continue;

      const day = dayOfYear(date, yearStart);
      if (interval === '1m') {
        const month = date.getMonth();
        key = `${selectedYear}-${String(month).padStart(2, '0')}`;
        label = MONTH_NAMES[month];
      } else if (interval === '1d') {
        key = transaction.date;
        label = `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
      } else if (interval === '3d') {
        const blockIndex = Math.floor(day / 3);
        key = `${selectedYear}-3d-${String(blockIndex).padStart(3, '0')}`;
        const blockStart = new Date(yearStart.getTime() + blockIndex * 3 * 24 * 60 * 60 * 1000);
        label = `${blockStart.getDate()} ${MONTH_NAMES[blockStart.getMonth()]}`;
      } else {
        const weekIndex = Math.floor(day / 7);
        key = `${selectedYear}-1w-${String(weekIndex).padStart(3, '0')}`;
        const weekStart = new Date(yearStart.getTime() + weekIndex * 7 * 24 * 60 * 60 * 1000);
        label = `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]}`;
      }
    } else {
      key = `${date.getFullYear()}`;
      label = key;
    }

    const bucket = buckets.get(key);
    if (bucket) {
      bucket.transactions.push(transaction);
    } else {
      buckets.set(key, { label, transactions: [transaction] });
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, bucket]) => {
      const summary = calculateFinancialSummary(bucket.transactions);
      return {
        label: bucket.label,
        earning: summary.totalEarn,
        expense: recognizedExpenses(summary),
      };
    });
}

export function buildMonthlyProfitAndLossSeries(
  transactions: Transaction[],
  selectedYear: number
): MonthlyProfitAndLossSeries {
  const monthlyTransactions = Array.from({ length: 12 }, () => [] as Transaction[]);

  for (const transaction of transactions) {
    const date = new Date(transaction.date);
    if (date.getFullYear() === selectedYear) {
      monthlyTransactions[date.getMonth()].push(transaction);
    }
  }

  const revenue = Array(12).fill(0) as number[];
  const expense = Array(12).fill(0) as number[];
  const netProfit = Array(12).fill(0) as number[];

  monthlyTransactions.forEach((monthTransactions, month) => {
    const summary = calculateFinancialSummary(monthTransactions);
    revenue[month] = summary.totalEarn;
    expense[month] = recognizedExpenses(summary);
    netProfit[month] = summary.netProfit;
  });

  return { revenue, expense, netProfit };
}

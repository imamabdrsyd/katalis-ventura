'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { calculateCapTable } from '@/lib/calculations';
import { formatCurrency } from '@/lib/utils';
import type { Transaction } from '@/types';

const OWNER_COLORS = [
  '#6366f1',
  '#3b82f6',
  '#ec4899',
  '#10b981',
  '#f59e0b',
  '#06b6d4',
  '#8b5cf6',
  '#ef4444',
  '#84cc16',
];

interface CapTableWidgetProps {
  transactions: Transaction[];
  loading?: boolean;
}

/**
 * Inline section yang dipasang di dalam card lain (mis. Financial Summary).
 * Tidak punya wrapper card sendiri — pakai border-bottom sebagai separator.
 */
export default function CapTableWidget({ transactions, loading = false }: CapTableWidgetProps) {
  const router = useRouter();

  const capTable = useMemo(() => calculateCapTable(transactions), [transactions]);

  if (loading) {
    return (
      <div className="pb-4 mb-4 border-b border-gray-100 dark:border-gray-700 animate-pulse">
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
        <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded mb-3" />
        <div className="space-y-2">
          <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  // Tidak render apapun kalau tidak ada modal disetor — di financial summary sebagai inline section,
  // empty state kurang berguna dan malah bikin clutter.
  const isEmpty = capTable.entries.length === 0 || capTable.totalContributed <= 0;
  if (isEmpty) return null;

  return (
    <div className="pb-4 mb-4 border-b border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Cap Table
          </p>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
            {formatCurrency(capTable.totalContributed)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => router.push('/balance-sheet')}
          aria-label="Lihat detail di Balance Sheet"
          className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stacked ownership bar */}
      <div className="flex rounded-md overflow-hidden h-2 bg-gray-100 dark:bg-gray-700 mb-3">
        {capTable.entries
          .filter((e) => e.contributed > 0)
          .map((entry, idx) => (
            <div
              key={entry.accountId}
              style={{
                width: `${entry.percentage}%`,
                backgroundColor: OWNER_COLORS[idx % OWNER_COLORS.length],
              }}
              title={`${entry.accountName}: ${entry.percentage.toFixed(2)}%`}
            />
          ))}
      </div>

      {/* List per pemilik */}
      <div className="space-y-1.5">
        {capTable.entries.map((entry, idx) => (
          <div key={entry.accountId} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: OWNER_COLORS[idx % OWNER_COLORS.length] }}
              />
              <span className="text-gray-700 dark:text-gray-300 truncate">
                {entry.accountName}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums w-14 text-right">
                {entry.percentage.toFixed(2)}%
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums w-24 text-right">
                {formatCurrency(entry.contributed)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

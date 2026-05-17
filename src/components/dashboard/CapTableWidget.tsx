'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ArrowUpRight } from 'lucide-react'; // Users dipakai di empty state
import { calculateCapTable } from '@/lib/calculations';
import { formatCurrency } from '@/lib/utils';
import type { Transaction } from '@/types';

const OWNER_COLORS = [
  '#6366f1',
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

export default function CapTableWidget({ transactions, loading = false }: CapTableWidgetProps) {
  const router = useRouter();

  const capTable = useMemo(() => calculateCapTable(transactions), [transactions]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 h-full animate-pulse">
        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  const isEmpty = capTable.entries.length === 0 || capTable.totalContributed <= 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Cap Table</h2>
        <button
          type="button"
          onClick={() => router.push('/balance-sheet')}
          aria-label="Lihat detail di Balance Sheet"
          className="p-1.5 rounded-lg text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer"
        >
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
            <Users className="w-7 h-7 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Belum ada modal disetor</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Tandai akun ekuitas pemilik sebagai &quot;Modal Disetor&quot; untuk mulai tracking kepemilikan.
          </p>
        </div>
      ) : (
        <>
          {/* Total modal disetor */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
              Total Modal Disetor
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
              {formatCurrency(capTable.totalContributed)}
            </div>
          </div>

          {/* Stacked ownership bar */}
          <div className="flex rounded-lg overflow-hidden h-2.5 bg-gray-100 dark:bg-gray-700 mb-4">
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
          <div className="space-y-3 flex-1">
            {capTable.entries.map((entry, idx) => (
              <div key={entry.accountId} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: OWNER_COLORS[idx % OWNER_COLORS.length] }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {entry.accountName}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums w-16 text-right">
                    {entry.percentage.toFixed(2)}%
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums w-28 text-right">
                    {formatCurrency(entry.contributed)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

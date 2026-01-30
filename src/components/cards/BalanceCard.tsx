'use client';

import { useMemo } from 'react';
import type { FinancialSummary } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface BalanceCardProps {
  summary: FinancialSummary;
  loading?: boolean;
}

export default function BalanceCard({ summary, loading = false }: BalanceCardProps) {
  // Balance = Earning - Expense (OPEX + VAR) - Financing - Taxes
  const balance = useMemo(() => {
    const expense = summary.totalOpex + summary.totalVar;
    return summary.totalEarn - expense - summary.totalFin - summary.totalTax;
  }, [summary]);

  const isPositive = balance >= 0;

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-gray-200 rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-indigo-200">Balance (Saldo)</h3>
        <div className="p-2 bg-white/10 rounded-lg">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>

      <div className="mb-4">
        <div className={`text-2xl md:text-3xl font-bold ${isPositive ? 'text-white' : 'text-red-300'}`}>
          {formatCurrency(balance)}
        </div>
        <p className="text-xs text-indigo-200 mt-1">
          Earning - Expenses - Financing - Taxes
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/20">
        <div>
          <p className="text-xs text-indigo-200">Total Masuk</p>
          <p className="text-sm font-semibold text-emerald-300">
            +{formatCurrency(summary.totalEarn)}
          </p>
        </div>
        <div>
          <p className="text-xs text-indigo-200">Total Keluar</p>
          <p className="text-sm font-semibold text-red-300">
            -{formatCurrency(summary.totalOpex + summary.totalVar + summary.totalFin + summary.totalTax)}
          </p>
        </div>
      </div>
    </div>
  );
}

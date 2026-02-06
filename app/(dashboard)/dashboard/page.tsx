'use client';

import { useRouter } from 'next/navigation';
import { useDashboard } from '@/hooks/useDashboard';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import MonitoringChart from '@/components/charts/MonitoringChart';

export default function DashboardPage() {
  const {
    business,
    businessLoading,
    canManageTransactions,
    transactions,
    transactionsLoading,
    summary,
    roi,
    categoryCounts,
  } = useDashboard();

  const router = useRouter();

  if (businessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Revenue</div>
          <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 break-all">
            {transactionsLoading ? '...' : formatCurrency(summary.totalEarn)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">From earnings</div>
        </div>

        <div className="card">
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Net Profit</div>
          <div className={`text-xl md:text-2xl font-bold break-all ${summary.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {transactionsLoading ? '...' : formatCurrency(summary.netProfit)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">After all expenses</div>
        </div>

        <div className="card">
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">ROI</div>
          <div className={`text-xl md:text-2xl font-bold ${roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {transactionsLoading ? '...' : formatPercentage(roi)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">Year to date</div>
        </div>

        <div className="card">
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Transactions</div>
          <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
            {transactionsLoading ? '...' : transactions.length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">Total recorded</div>
        </div>
      </div>

      {/* Monitoring Chart */}
      <div className="mb-8">
        <MonitoringChart transactions={transactions} loading={transactionsLoading} />
      </div>

      {/* Financial Summary */}
      {transactions.length > 0 && (
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Ringkasan Keuangan</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">Earnings</div>
                <div className="text-xs text-emerald-500 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">{categoryCounts.EARN} record</div>
              </div>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-1">{formatCurrency(summary.totalEarn)}</div>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-red-600 dark:text-red-400 font-semibold">OPEX</div>
                <div className="text-xs text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded-full">{categoryCounts.OPEX} record</div>
              </div>
              <div className="text-lg font-bold text-red-700 dark:text-red-300 mt-1">{formatCurrency(summary.totalOpex)}</div>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-amber-600 dark:text-amber-400 font-semibold">Variable</div>
                <div className="text-xs text-amber-500 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">{categoryCounts.VAR} record</div>
              </div>
              <div className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-1">{formatCurrency(summary.totalVar)}</div>
            </div>
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold">CAPEX</div>
                <div className="text-xs text-indigo-500 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded-full">{categoryCounts.CAPEX} record</div>
              </div>
              <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300 mt-1">{formatCurrency(summary.totalCapex)}</div>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-purple-600 dark:text-purple-400 font-semibold">Taxes</div>
                <div className="text-xs text-purple-500 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded-full">{categoryCounts.TAX} record</div>
              </div>
              <div className="text-lg font-bold text-purple-700 dark:text-purple-300 mt-1">{formatCurrency(summary.totalTax)}</div>
            </div>
            <div className="p-4 bg-pink-50 dark:bg-pink-900/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-pink-600 dark:text-pink-400 font-semibold">Financing</div>
                <div className="text-xs text-pink-500 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/50 px-2 py-0.5 rounded-full">{categoryCounts.FIN} record</div>
              </div>
              <div className="text-lg font-bold text-pink-700 dark:text-pink-300 mt-1">{formatCurrency(summary.totalFin)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {canManageTransactions && (
            <button
              onClick={() => router.push('/transactions')}
              className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors text-left"
            >
              <div className="text-2xl mb-2">📝</div>
              <div className="font-semibold text-gray-800 dark:text-gray-100">Add Transaction</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Record income or expense</div>
            </button>
          )}

          <button
            onClick={() => router.push('/transactions')}
            className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors text-left"
          >
            <div className="text-2xl mb-2">📋</div>
            <div className="font-semibold text-gray-800 dark:text-gray-100">View Transactions</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">See all transactions</div>
          </button>

          <button className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors text-left opacity-50 cursor-not-allowed">
            <div className="text-2xl mb-2">📊</div>
            <div className="font-semibold text-gray-800 dark:text-gray-100">View Reports</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Coming soon</div>
          </button>

          <button className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors text-left opacity-50 cursor-not-allowed">
            <div className="text-2xl mb-2">👥</div>
            <div className="font-semibold text-gray-800 dark:text-gray-100">Manage Team</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Coming soon</div>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {!transactionsLoading && transactions.length === 0 && (
        <div className="mt-8 p-6 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-xl text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-2">Belum ada transaksi</h3>
          <p className="text-sm text-indigo-700 dark:text-indigo-400 mb-4">
            {canManageTransactions
              ? 'Mulai dengan menambahkan transaksi pertama Anda untuk melihat statistik keuangan.'
              : 'Belum ada transaksi yang tercatat untuk bisnis ini.'}
          </p>
          {canManageTransactions && (
            <button
              onClick={() => router.push('/transactions')}
              className="btn-primary"
            >
              Tambah Transaksi Pertama
            </button>
          )}
        </div>
      )}
    </div>
  );
}

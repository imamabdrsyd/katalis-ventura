'use client';

import { useRouter } from 'next/navigation';
import { useDashboard } from '@/hooks/useDashboard';
import { formatCurrency, formatPercentage, formatDateShort } from '@/lib/utils';
import MonitoringChart from '@/components/charts/MonitoringChart';
import ExpenseBreakdownChart from '@/components/charts/ExpenseBreakdownChart';

export default function DashboardPage() {
  const {
    businessLoading,
    canManageTransactions,
    transactions,
    transactionsLoading,
    summary,
    roi,
    categoryCounts,
    balanceSheet,
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

  const recentTransactions = transactions.slice(0, 10);

  // --- Revenue: growth vs last month ---
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
  const lastMonth = lastMonthDate.getMonth();
  const lastMonthYear = lastMonthDate.getFullYear();

  const revenueThisMonth = transactions
    .filter((t) => {
      const d = new Date(t.date);
      return t.category === 'EARN' && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    })
    .reduce((s, t) => s + Number(t.amount), 0);

  const revenueLastMonth = transactions
    .filter((t) => {
      const d = new Date(t.date);
      return t.category === 'EARN' && d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    })
    .reduce((s, t) => s + Number(t.amount), 0);

  const revenueGrowth =
    revenueLastMonth > 0
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
      : null;

  // --- Profit/Loss: net margin & expense ratio ---
  const netMargin =
    summary.totalEarn > 0
      ? (summary.netProfit / summary.totalEarn) * 100
      : null;

  const totalExpenses = summary.totalOpex + summary.totalVar + summary.totalTax + summary.totalInterest;
  const expenseRatio =
    summary.totalEarn > 0
      ? (totalExpenses / summary.totalEarn) * 100
      : null;

  // --- ROI: breakeven status ---
  const initialCapital = balanceSheet.equity.capital > 0 ? balanceSheet.equity.capital : null;
  const roiLabel =
    roi === 0 || initialCapital === null
      ? 'Modal belum tercatat'
      : roi > 0
        ? 'Modal sudah balik'
        : 'Modal belum balik';
  const roiLabelColor =
    roi > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';

  // --- Cash Balance: runway in months ---
  const avgMonthlyExpense = (() => {
    if (totalExpenses === 0) return 0;
    const expenseMonths = new Set(
      transactions
        .filter((t) => t.category === 'OPEX' || t.category === 'VAR' || t.category === 'TAX')
        .map((t) => {
          const d = new Date(t.date);
          return `${d.getFullYear()}-${d.getMonth()}`;
        })
    ).size;
    return expenseMonths > 0 ? totalExpenses / expenseMonths : totalExpenses;
  })();

  const cashRunwayMonths =
    avgMonthlyExpense > 0 && balanceSheet.assets.cash > 0
      ? Math.floor(balanceSheet.assets.cash / avgMonthlyExpense)
      : null;

  const cashVsRevenue =
    summary.totalEarn > 0 && balanceSheet.assets.cash >= 0
      ? (balanceSheet.assets.cash / summary.totalEarn) * 100
      : null;

  const categoryBadgeStyles: Record<string, string> = {
    EARN: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
    OPEX: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
    VAR: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
    CAPEX: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300',
    TAX: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
    FIN: 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300',
  };

  return (
    <div className="p-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div
          className="card cursor-pointer"
          onClick={() => router.push('/transactions?category=EARN')}
        >
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Revenue</div>
          <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 break-all">
            {transactionsLoading ? '...' : formatCurrency(summary.totalEarn)}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {transactionsLoading ? '...' : `${categoryCounts.EARN} transaksi masuk`}
            </div>
            {!transactionsLoading && revenueGrowth !== null && (
              <div className={`flex items-center gap-0.5 text-xs font-semibold ${revenueGrowth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                <span>{revenueGrowth >= 0 ? '▲' : '▼'}</span>
                <span>{Math.abs(revenueGrowth).toFixed(1)}% vs bln lalu</span>
              </div>
            )}
            {!transactionsLoading && revenueGrowth === null && revenueLastMonth === 0 && revenueThisMonth > 0 && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Baru bulan ini</div>
            )}
          </div>
        </div>

        <div
          className="card cursor-pointer"
          onClick={() => router.push('/income-statement?scrollTo=net-income')}
        >
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Profit/Loss</div>
          <div className={`text-xl md:text-2xl font-bold break-all ${summary.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {transactionsLoading ? '...' : formatCurrency(summary.netProfit)}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {transactionsLoading
                ? '...'
                : expenseRatio !== null
                  ? `${expenseRatio.toFixed(1)}% dari revenue terpakai`
                  : 'Belum ada pemasukan'}
            </div>
            {!transactionsLoading && netMargin !== null && (
              <div className={`text-xs font-semibold ${netMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                Margin {netMargin.toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">ROI</div>
          <div className={`text-xl md:text-2xl font-bold ${roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {transactionsLoading ? '...' : formatPercentage(roi)}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">Return on Investment</div>
            {!transactionsLoading && initialCapital !== null && (
              <div className={`text-xs font-semibold ${roiLabelColor}`}>{roiLabel}</div>
            )}
          </div>
        </div>

        <div
          className="card cursor-pointer"
          onClick={() => router.push('/general-ledger?filterType=ASSET')}
        >
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Cash Balance</div>
          <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 break-all">
            {transactionsLoading ? '...' : formatCurrency(balanceSheet.assets.cash)}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {transactionsLoading
                ? '...'
                : cashRunwayMonths !== null
                  ? `Cukup ~${cashRunwayMonths} bln ke depan`
                  : avgMonthlyExpense === 0
                    ? 'Belum ada pengeluaran'
                    : 'Kas tidak mencukupi'}
            </div>
            {!transactionsLoading && cashVsRevenue !== null && (
              <div className={`text-xs font-semibold ${cashVsRevenue >= 50 ? 'text-emerald-600 dark:text-emerald-400' : cashVsRevenue >= 20 ? 'text-amber-500 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`}>
                {cashVsRevenue.toFixed(0)}% dari revenue
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monitoring Chart + Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <MonitoringChart transactions={transactions} loading={transactionsLoading} />
        </div>
        <div className="lg:col-span-1">
          <ExpenseBreakdownChart transactions={transactions} loading={transactionsLoading} />
        </div>
      </div>

      {/* Financial Summary */}
      {transactions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Ringkasan Keuangan</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">Earnings</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600/50 px-2 py-0.5 rounded-full">{categoryCounts.EARN} record</div>
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(summary.totalEarn)}</div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-red-600 dark:text-red-400 font-semibold">OPEX</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600/50 px-2 py-0.5 rounded-full">{categoryCounts.OPEX} record</div>
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(summary.totalOpex)}</div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-amber-600 dark:text-amber-400 font-semibold">Variable</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600/50 px-2 py-0.5 rounded-full">{categoryCounts.VAR} record</div>
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(summary.totalVar)}</div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold">CAPEX</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600/50 px-2 py-0.5 rounded-full">{categoryCounts.CAPEX} record</div>
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(summary.totalCapex)}</div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-purple-600 dark:text-purple-400 font-semibold">Taxes</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600/50 px-2 py-0.5 rounded-full">{categoryCounts.TAX} record</div>
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(summary.totalTax)}</div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-pink-600 dark:text-pink-400 font-semibold">Financing</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600/50 px-2 py-0.5 rounded-full">{categoryCounts.FIN} record</div>
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(summary.totalFin)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Recent Transactions</h2>
            <button
              onClick={() => router.push('/transactions')}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
            >
              View all
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Description</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {recentTransactions.map((t) => (
                  <tr key={t.id}>
                    <td className="py-3 pr-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDateShort(t.date)}
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-800 dark:text-gray-200 font-medium truncate max-w-[200px]">
                      {t.name || t.description}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryBadgeStyles[t.category] || ''}`}>
                        {t.category}
                      </span>
                    </td>
                    <td className={`py-3 text-sm font-semibold text-right whitespace-nowrap ${
                      t.category === 'EARN' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {t.category === 'EARN' ? '+' : '-'}{formatCurrency(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

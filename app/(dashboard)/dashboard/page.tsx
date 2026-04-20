'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ChevronLeft, ChevronRight, TrendingUp, BarChart3, Target, Wallet, Calendar, ClipboardList, HandCoins, ArrowRight } from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import { useLanguage } from '@/context/LanguageContext';
import { calculateFinancialSummary, calculateCategoryCounts, calculateIncomeStatementMetrics } from '@/lib/calculations';
import { formatCurrency, formatPercentage, formatDateShort } from '@/lib/utils';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { CATEGORY_TEXT_CLASSES } from '@/lib/categoryColors';
import { isTradeReceivableTransaction, isSettled, isSettlementEntry, getOutstandingAmount } from '@/lib/accounting/guidance/receivableSettlement';

// Lazy-load chart components — chart.js (~6.2 MB) only loads when charts render
const MonitoringChart = dynamic(() => import('@/components/charts/MonitoringChart'), {
  loading: () => <div className="animate-pulse h-80 bg-gray-200 dark:bg-gray-700 rounded-lg" />,
});
const ExpenseBreakdownChart = dynamic(() => import('@/components/charts/ExpenseBreakdownChart'), {
  loading: () => <div className="animate-pulse h-80 bg-gray-200 dark:bg-gray-700 rounded-lg" />,
});


function formatRelativeTime(createdAt: string, txDate: string): string {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay <= 3) return `${diffDay}d ago`;
  return formatDateShort(txDate);
}

export default function DashboardPage() {
  const {
    businessLoading,
    canManageTransactions,
    transactions,
    transactionsLoading,
    balanceSheet,
    summary: allTimeSummary,
  } = useDashboard();

  const router = useRouter();
  const { t } = useLanguage();

  // --- Global year + month filter ---
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // null = Yearly, 0-11 = specific month
  const userPickedYearRef = useRef(false);

  const MONTH_LABELS = t.dashboard.months;

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    transactions.forEach((t) => years.add(new Date(t.date).getFullYear()));
    const sorted = Array.from(years).sort();
    if (sorted.length === 0) sorted.push(new Date().getFullYear());
    return sorted;
  }, [transactions]);

  // Kalau tahun sekarang tidak punya transaksi, snap ke tahun terbaru yang ada datanya.
  // Hanya berlaku untuk initial render — setelah user ganti tahun manual, biarkan.
  useEffect(() => {
    if (userPickedYearRef.current) return;
    if (transactions.length === 0) return;
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[availableYears.length - 1]);
    }
  }, [availableYears, selectedYear, transactions.length]);

  const minYear = availableYears[0];
  const maxYear = availableYears[availableYears.length - 1];

  const yearTransactions = useMemo(
    () => transactions.filter((t) => new Date(t.date).getFullYear() === selectedYear),
    [transactions, selectedYear]
  );

  const filteredTransactions = useMemo(
    () => selectedMonth === null
      ? yearTransactions
      : yearTransactions.filter((t) => new Date(t.date).getMonth() === selectedMonth),
    [yearTransactions, selectedMonth]
  );

  const summary = useMemo(() => calculateFinancialSummary(filteredTransactions), [filteredTransactions]);
  const categoryCounts = useMemo(() => calculateCategoryCounts(filteredTransactions), [filteredTransactions]);

  // --- AR Tracker: outstanding piutang across all time, bucketed by age ---
  const arData = useMemo(() => {
    const today = new Date();
    const outstanding = transactions.filter(
      (tx) => isTradeReceivableTransaction(tx) && !isSettled(tx) && !isSettlementEntry(tx)
    );

    const buckets = { current: 0, b30: 0, b60: 0, b90: 0, over90: 0 };
    const byContact = new Map<string, number>();
    let total = 0;

    for (const tx of outstanding) {
      const amount = getOutstandingAmount(tx);
      if (amount <= 0) continue;
      total += amount;

      const txDate = new Date(tx.date);
      const days = Math.floor((today.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 0) buckets.current += amount;
      else if (days <= 30) buckets.b30 += amount;
      else if (days <= 60) buckets.b60 += amount;
      else if (days <= 90) buckets.b90 += amount;
      else buckets.over90 += amount;

      const contactName = tx.name || 'Tanpa Nama';
      byContact.set(contactName, (byContact.get(contactName) || 0) + amount);
    }

    const topDebtors = Array.from(byContact.entries())
      .map(([name, amt]) => ({ name, amount: amt }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    return { total, buckets, topDebtors, count: outstanding.length };
  }, [transactions]);
  // --- Revenue: growth comparison ---
  // Monthly filter: compare vs previous month
  // Yearly filter: compare total revenue this year vs total revenue last year
  const revenueGrowthData = useMemo(() => {
    const currentRevenue = summary.totalEarn;

    if (selectedMonth !== null) {
      // Monthly: compare with previous month
      const prevMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
      const prevMonth = prevMonthDate.getMonth();
      const prevMonthYear = prevMonthDate.getFullYear();
      const prevRevenue = transactions
        .filter((t) => {
          const d = new Date(t.date);
          return t.category === 'EARN' && d.getMonth() === prevMonth && d.getFullYear() === prevMonthYear;
        })
        .reduce((s, t) => s + Number(t.amount), 0);

      if (prevRevenue > 0) {
        return {
          growth: ((currentRevenue - prevRevenue) / prevRevenue) * 100,
          label: `vs ${MONTH_LABELS[prevMonth]}`,
        };
      }
      return { growth: null, label: null, isNew: currentRevenue > 0 };
    } else {
      // Yearly: compare total revenue this year vs total revenue last year
      const lastYearRevenue = transactions
        .filter((t) => {
          const d = new Date(t.date);
          return t.category === 'EARN' && d.getFullYear() === selectedYear - 1;
        })
        .reduce((s, t) => s + Number(t.amount), 0);

      if (lastYearRevenue > 0) {
        return {
          growth: ((currentRevenue - lastYearRevenue) / lastYearRevenue) * 100,
          label: `vs ${selectedYear - 1}`,
        };
      }
      return { growth: null, label: null, isNew: currentRevenue > 0 };
    }
  }, [transactions, summary.totalEarn, selectedYear, selectedMonth, MONTH_LABELS]);

  if (businessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  const recentTransactions = transactions.slice(0, 10);

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

  // --- ROI: all-time Net Profit / all-time CAPEX ---
  const roi = allTimeSummary.totalCapex > 0
    ? (allTimeSummary.netProfit / allTimeSummary.totalCapex) * 100
    : 0;
  const roiLabel =
    allTimeSummary.totalCapex === 0
      ? ''
      : '';
  const roiLabelColor =
    roi === 0 ? 'text-gray-500 dark:text-gray-400' : roi > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';

  // --- Cash Balance: runway in months (uses all-time data, not year-filtered) ---
  const totalAllTimeExpenses = allTimeSummary.totalOpex + allTimeSummary.totalVar + allTimeSummary.totalTax + allTimeSummary.totalInterest;
  const avgMonthlyExpense = (() => {
    if (totalAllTimeExpenses === 0) return 0;
    const expenseMonths = new Set(
      transactions
        .filter((t) => t.category === 'OPEX' || t.category === 'VAR' || t.category === 'TAX')
        .map((t) => {
          const d = new Date(t.date);
          return `${d.getFullYear()}-${d.getMonth()}`;
        })
    ).size;
    return expenseMonths > 0 ? totalAllTimeExpenses / expenseMonths : totalAllTimeExpenses;
  })();

  const cashRunwayMonths =
    avgMonthlyExpense > 0 && balanceSheet.assets.cash > 0
      ? Math.floor(balanceSheet.assets.cash / avgMonthlyExpense)
      : null;

  const cashVsRevenue =
    summary.totalEarn > 0 && balanceSheet.assets.cash >= 0
      ? (balanceSheet.assets.cash / summary.totalEarn) * 100
      : null;


  return (
    <div className="p-8">
      {/* Global Year + Month Filter */}
      <div className="w-full overflow-x-auto mb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="flex items-center gap-1.5 min-w-max">
        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 shadow-sm">
          <button
            onClick={() => {
              userPickedYearRef.current = true;
              setSelectedYear((y) => y - 1);
            }}
            disabled={selectedYear <= minYear}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200 min-w-[3rem] text-center">
            {selectedYear}
          </span>
          <button
            onClick={() => {
              userPickedYearRef.current = true;
              setSelectedYear((y) => y + 1);
            }}
            disabled={selectedYear >= maxYear}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
        <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
        <button
          onClick={() => setSelectedMonth(null)}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
            selectedMonth === null
              ? 'bg-indigo-500 text-white shadow-sm'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          {t.dashboard.yearly}
        </button>
        {MONTH_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => setSelectedMonth(i)}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
              selectedMonth === i
                ? 'bg-indigo-500 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div
          className="card cursor-pointer flex flex-col"
          onClick={() => router.push('/transactions?category=EARN')}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.dashboard.revenue}</div>
            <TrendingUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>
          <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 break-all">
            {transactionsLoading ? '...' : formatCurrency(summary.totalEarn)}
          </div>
          <div className="flex items-center justify-between mt-2 min-h-[2.5rem]">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {transactionsLoading ? '...' : t.dashboard.transactionsIn.replace('{n}', String(categoryCounts.EARN))}
            </div>
            {!transactionsLoading && revenueGrowthData.growth !== null && (
              <div className={`flex items-center gap-0.5 text-xs font-semibold ${revenueGrowthData.growth === 0 ? 'text-gray-500 dark:text-gray-400' : revenueGrowthData.growth > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                <span>{revenueGrowthData.growth >= 0 ? '▲' : '▼'}</span>
                <span>{Math.abs(revenueGrowthData.growth).toFixed(1)}% {revenueGrowthData.label}</span>
              </div>
            )}
            {!transactionsLoading && revenueGrowthData.growth === null && revenueGrowthData.isNew && (
              <div className="text-xs text-emerald-500 dark:text-emerald-400 font-semibold">{t.dashboard.noComparisonData}</div>
            )}
          </div>
        </div>

        <div
          className="card cursor-pointer flex flex-col"
          onClick={() => {
            const start = selectedMonth === null
              ? `${selectedYear}-01-01`
              : `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
            const end = selectedMonth === null
              ? `${selectedYear}-12-31`
              : new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];
            router.push(`/income-statement?startDate=${start}&endDate=${end}&scrollTo=net-income`);
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.dashboard.profitLoss}</div>
            <BarChart3 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>
          <div className={`text-xl md:text-2xl font-bold break-all ${summary.netProfit === 0 ? 'text-gray-500 dark:text-gray-400' : summary.netProfit > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            {transactionsLoading ? '...' : formatCurrency(summary.netProfit)}
          </div>
          <div className="flex items-center justify-between mt-2 min-h-[2.5rem]">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {transactionsLoading
                ? '...'
                : expenseRatio !== null
                  ? t.dashboard.ofRevenueUsed.replace('{n}', expenseRatio.toFixed(1))
                  : ''}
            </div>
            {!transactionsLoading && netMargin !== null && (
              <div className={`text-xs font-semibold ${netMargin === 0 ? 'text-gray-500 dark:text-gray-400' : netMargin > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {t.dashboard.margin.replace('{n}', netMargin.toFixed(1))}
              </div>
            )}
          </div>
        </div>

        <div className="card flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.dashboard.roi}</div>
            <Target className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>
          <div className={`text-xl md:text-2xl font-bold ${roi === 0 ? 'text-gray-500 dark:text-gray-400' : roi > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            {transactionsLoading ? '...' : formatPercentage(roi)}
          </div>
          <div className="mt-2 min-h-[2.5rem] flex flex-col justify-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">{t.dashboard.yearToDate}</div>
          </div>
        </div>

        <div
          className="card cursor-pointer flex flex-col"
          onClick={() => router.push('/general-ledger?filterType=ASSET')}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.dashboard.cashBalance}</div>
            <Wallet className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>
          <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 break-all">
            {transactionsLoading ? '...' : formatCurrency(balanceSheet.assets.cash)}
          </div>
          <div className="mt-2 min-h-[2.5rem] flex flex-col justify-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">{t.dashboard.cashAndBank}</div>
          </div>
        </div>
      </div>

      {/* Monitoring Chart + Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <MonitoringChart transactions={transactions} loading={transactionsLoading} selectedYear={selectedYear} />
        </div>
        <div className="lg:col-span-1">
          <ExpenseBreakdownChart transactions={transactions} loading={transactionsLoading} selectedYear={selectedYear} selectedMonth={selectedMonth} />
        </div>
      </div>

      {/* AR Tracker (Monitor Piutang) */}
      {transactions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t.dashboard.arTrackerTitle}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {arData.count > 0
                  ? t.dashboard.arTrackerSubtitle
                      .replace('{n}', String(arData.count))
                      .replace('{c}', String(arData.topDebtors.length > 0 ? new Set(arData.topDebtors.map(d => d.name)).size : 0))
                  : t.dashboard.arTrackerEmptyDesc}
              </p>
            </div>
            <button
              onClick={() => router.push('/ar-ap')}
              className="flex items-center gap-1 text-sm text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-medium transition-colors"
            >
              {t.dashboard.viewAll}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {arData.total === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 mx-auto rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                <HandCoins className="w-7 h-7 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{t.dashboard.arTrackerEmpty}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t.dashboard.arTrackerEmptyDesc}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Total + aging breakdown */}
              <div className="lg:col-span-2">
                <div className="mb-4">
                  <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{t.dashboard.arTotalOutstanding}</div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(arData.total)}</div>
                </div>
                {/* Aging bar */}
                <div className="flex rounded-lg overflow-hidden h-2 bg-gray-100 dark:bg-gray-700 mb-3">
                  {([
                    { key: 'current', value: arData.buckets.current, color: 'bg-emerald-400 dark:bg-emerald-500' },
                    { key: 'b30', value: arData.buckets.b30, color: 'bg-sky-400 dark:bg-sky-500' },
                    { key: 'b60', value: arData.buckets.b60, color: 'bg-amber-400 dark:bg-amber-500' },
                    { key: 'b90', value: arData.buckets.b90, color: 'bg-orange-400 dark:bg-orange-500' },
                    { key: 'over90', value: arData.buckets.over90, color: 'bg-red-500 dark:bg-red-500' },
                  ] as const)
                    .filter((b) => b.value > 0)
                    .map((b) => (
                      <div
                        key={b.key}
                        className={b.color}
                        style={{ width: `${(b.value / arData.total) * 100}%` }}
                        title={formatCurrency(b.value)}
                      />
                    ))}
                </div>
                {/* Aging chips */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {([
                    { label: t.arAp.current, value: arData.buckets.current, dot: 'bg-emerald-400 dark:bg-emerald-500' },
                    { label: t.arAp.days1to30, value: arData.buckets.b30, dot: 'bg-sky-400 dark:bg-sky-500' },
                    { label: t.arAp.days31to60, value: arData.buckets.b60, dot: 'bg-amber-400 dark:bg-amber-500' },
                    { label: t.arAp.days61to90, value: arData.buckets.b90, dot: 'bg-orange-400 dark:bg-orange-500' },
                    { label: t.arAp.daysOver90, value: arData.buckets.over90, dot: 'bg-red-500 dark:bg-red-500' },
                  ] as const).map((bucket) => (
                    <div key={bucket.label} className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${bucket.dot}`} />
                        <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{bucket.label}</div>
                      </div>
                      <div className={`text-sm font-bold ${bucket.value === 0 ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                        {bucket.value === 0 ? '—' : formatCurrency(bucket.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Top debtors */}
              <div className="lg:col-span-1">
                <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">{t.dashboard.arTopDebtors}</div>
                <div className="space-y-2">
                  {arData.topDebtors.map((debtor, idx) => {
                    const pct = (debtor.amount / arData.total) * 100;
                    return (
                      <div key={debtor.name} className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                              {idx + 1}
                            </div>
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{debtor.name}</div>
                          </div>
                          <div className="text-sm font-bold text-gray-900 dark:text-gray-100 flex-shrink-0 ml-2">
                            {formatCurrency(debtor.amount)}
                          </div>
                        </div>
                        <div className="h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dual Panel: Financial Summary + Recent Transactions */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Financial Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">{t.dashboard.financialSummary}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { label: t.dashboard.earnings, cat: 'EARN', value: summary.totalEarn, count: categoryCounts.EARN },
                { label: t.dashboard.opex, cat: 'OPEX', value: summary.totalOpex, count: categoryCounts.OPEX },
                { label: t.dashboard.variable, cat: 'VAR', value: summary.totalVar, count: categoryCounts.VAR },
                { label: t.dashboard.capex, cat: 'CAPEX', value: summary.totalCapex, count: categoryCounts.CAPEX },
                { label: t.dashboard.taxes, cat: 'TAX', value: summary.totalTax, count: categoryCounts.TAX },
                { label: t.dashboard.financing, cat: 'FIN', value: summary.totalFin, count: categoryCounts.FIN },
              ] as const).map((item) => (
                <div key={item.label} className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className={`text-sm font-semibold ${CATEGORY_TEXT_CLASSES[item.cat]}`}>{item.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600/50 px-2 py-0.5 rounded-full">{t.dashboard.records.replace('{n}', String(item.count))}</div>
                  </div>
                  <div className="text-base font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(item.value)}</div>
                </div>
              ))}
            </div>

            {/* Mini P&L Summary */}
            {(() => {
              const metrics = calculateIncomeStatementMetrics(summary);
              const hasRevenue = summary.totalEarn > 0;
              const rows = [
                { label: 'Laba Kotor', value: summary.grossProfit, margin: hasRevenue ? metrics.grossMargin : null },
                { label: 'Laba Usaha', value: metrics.operatingIncome, margin: hasRevenue ? metrics.operatingMargin : null },
                { label: 'Laba Bersih', value: summary.netProfit, margin: hasRevenue ? metrics.netMargin : null, bold: true },
              ];
              return (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Hasil</p>
                  <div className="space-y-1.5">
                    {rows.map((row) => {
                      const isPositive = row.value >= 0;
                      return (
                        <div
                          key={row.label}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg ${row.bold ? 'bg-gray-50 dark:bg-gray-700/40' : ''}`}
                        >
                          <span className={`text-sm ${row.bold ? 'font-bold text-gray-700 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
                            {row.label}
                          </span>
                          <div className="flex items-center gap-2">
                            {row.margin !== null && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                row.margin >= 0
                                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400'
                              }`}>
                                {formatPercentage(row.margin)}
                              </span>
                            )}
                            <span className={`text-sm ${row.bold ? 'font-bold' : 'font-semibold'} ${
                              isPositive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-500 dark:text-red-400'
                            }`}>
                              {!isPositive && '('}
                              {formatCurrency(Math.abs(row.value))}
                              {!isPositive && ')'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Recent Transactions */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t.dashboard.recentTransactions}</h2>
            <button
              onClick={() => router.push('/transactions')}
              className="flex items-center gap-1 text-sm text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300 font-medium transition-colors"
            >
              {t.dashboard.viewAll}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  <th className="pb-3 pr-4">{t.common.date}</th>
                  <th className="pb-3 pr-4">{t.common.description}</th>
                  <th className="pb-3 pr-4">{t.common.category}</th>
                  <th className="pb-3 text-right">{t.common.amount}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {recentTransactions.map((t) => (
                  <tr key={t.id}>
                    <td className="py-3 pr-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatRelativeTime(t.created_at, t.date)}
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-800 dark:text-gray-200 font-medium truncate max-w-[200px]">
                      {t.description || t.name}
                    </td>
                    <td className="py-3 pr-4">
                      <CategoryBadge category={t.category} size="xs" />
                    </td>
                    <td className={`py-3 text-sm font-semibold text-right whitespace-nowrap ${
                      t.amount === 0 ? 'text-gray-500 dark:text-gray-400' : t.category === 'EARN' ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                    }`}>
                      {t.amount === 0 ? '' : t.category === 'EARN' ? '+' : '-'}{formatCurrency(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!transactionsLoading && transactions.length === 0 && (
        <div className="mt-8 p-6 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-xl text-center">
          <div className="flex justify-center mb-4"><ClipboardList className="w-10 h-10 text-indigo-400" /></div>
          <h3 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-2">{t.dashboard.noTransactions}</h3>
          <p className="text-sm text-indigo-500 dark:text-indigo-400 mb-4">
            {canManageTransactions
              ? t.dashboard.noTransactionsDesc
              : t.dashboard.noTransactionsForBusiness}
          </p>
          {canManageTransactions && (
            <button
              onClick={() => router.push('/transactions')}
              className="btn-primary"
            >
              {t.dashboard.addFirstTransaction}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

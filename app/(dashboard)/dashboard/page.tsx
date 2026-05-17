'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ChevronLeft, ChevronRight, TrendingUp, BarChart3, Target, Wallet, ClipboardList, HandCoins, ArrowRight } from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import { useLanguage } from '@/context/LanguageContext';
import { calculateFinancialSummary, calculateCategoryCounts, calculateIncomeStatementMetrics } from '@/lib/calculations';
import { formatCurrency, formatPercentage, formatDateShort } from '@/lib/utils';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { Sparkline } from '@/components/ui/Sparkline';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { FxMiniWidget } from '@/components/market/FxMiniWidget';
import { isTradeReceivableTransaction, isSettled, isSettlementEntry, getOutstandingAmount } from '@/lib/accounting/guidance/receivableSettlement';

// Lazy-load chart components — chart.js (~6.2 MB) only loads when charts render
const MonitoringChart = dynamic(() => import('@/components/charts/MonitoringChart'), {
  loading: () => <div className="animate-pulse h-80 bg-gray-200 dark:bg-gray-700 rounded-lg" />,
});
const ExpenseBreakdownChart = dynamic(() => import('@/components/charts/ExpenseBreakdownChart'), {
  loading: () => <div className="animate-pulse h-80 bg-gray-200 dark:bg-gray-700 rounded-lg" />,
});
const CapTableWidget = dynamic(() => import('@/components/dashboard/CapTableWidget'), {
  loading: () => <div className="animate-pulse h-60 bg-gray-200 dark:bg-gray-700 rounded-2xl" />,
});

const DASHBOARD_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

const DASHBOARD_STAGGER_VARIANTS: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const formatAnimatedCurrency = (value: number) => formatCurrency(value);
const formatAnimatedPercentage = (value: number) => formatPercentage(value);

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
    business,
    businessLoading,
    canManageTransactions,
    transactions,
    transactionsLoading,
    balanceSheet,
    summary: allTimeSummary,
    investedCapital,
  } = useDashboard();

  const router = useRouter();
  const { t } = useLanguage();
  const shouldReduceMotion = useReducedMotion();

  // --- Global year + month filter ---
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // null = Yearly, 0-11 = specific month
  const userPickedYearRef = useRef(false);
  const dashboardAnimationKey = `${selectedYear}-${selectedMonth ?? 'year'}-${transactionsLoading ? 'loading' : 'ready'}`;

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

  // --- Monthly series untuk sparkline KPI cards (basis: tahun terpilih) ---
  const monthlySeries = useMemo(() => {
    const revenue = Array(12).fill(0) as number[];
    const expense = Array(12).fill(0) as number[];
    for (const tx of yearTransactions) {
      const m = new Date(tx.date).getMonth();
      const amt = Number(tx.amount);
      if (tx.category === 'EARN') revenue[m] += amt;
      else if (tx.category === 'OPEX' || tx.category === 'TAX') {
        expense[m] += amt;
      } else if (
        tx.category === 'VAR' &&
        // Hanya hitung VAR sebagai expense kalau debit ke EXPENSE (HPP recognition).
        // VAR + debit ASSET = pembelian inventory, bukan expense. Konsisten dgn calculateFinancialSummary.
        !(tx.is_double_entry && tx.debit_account?.account_type === 'ASSET')
      ) {
        expense[m] += amt;
      }
    }
    const netProfit = revenue.map((r, i) => r - expense[i]);
    // Trim ke bulan-bulan yang relevan: kalau yearly, gunakan 12 bulan;
    // kalau monthly filter aktif, sparkline tetap 12 bulan supaya tetap memberi konteks tren.
    return { revenue, netProfit, expense };
  }, [yearTransactions]);

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
      if (days <= 30) buckets.current += amount;
      else if (days <= 60) buckets.b30 += amount;
      else if (days <= 90) buckets.b60 += amount;
      else if (days <= 120) buckets.b90 += amount;
      else buckets.over90 += amount;

      const contactName = tx.name || 'Tanpa Nama';
      byContact.set(contactName, (byContact.get(contactName) || 0) + amount);
    }

    const topDebtors = Array.from(byContact.entries())
      .map(([name, amt]) => ({ name, amount: amt }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    return { total, buckets, topDebtors, count: outstanding.length, contactCount: byContact.size };
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

  // Periode ROI:
  // - Jika business.operations_start_date di-set → hitung sejak tanggal tsb
  //   (operating period ROI: hanya menilai fase operasi aktif).
  // - Jika tidak → fallback ke tanggal transaksi pertama
  //   (holding period return: sejak modal pertama dikeluarkan).
  // NOTE: harus di atas early-return supaya order hooks stabil.
  const roiPeriod = useMemo(() => {
    if (transactions.length === 0) return null;

    let earliest: Date;
    let basis: 'operations_start' | 'first_transaction';

    if (business?.operations_start_date) {
      earliest = new Date(business.operations_start_date);
      basis = 'operations_start';
    } else {
      earliest = new Date(transactions[0].date);
      for (const t of transactions) {
        const d = new Date(t.date);
        if (d < earliest) earliest = d;
      }
      basis = 'first_transaction';
    }

    const now = new Date();
    const months = Math.max(
      1,
      (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth())
    );
    const sinceLabel = `${MONTH_LABELS[earliest.getMonth()]} ${earliest.getFullYear()}`;
    return { months, sinceLabel, basis };
  }, [transactions, MONTH_LABELS, business?.operations_start_date]);

  if (businessLoading) {
    return (
      <div className="p-8 animate-pulse">
        {/* Filter bar skeleton */}
        <div className="h-9 w-full max-w-2xl bg-gray-200 dark:bg-gray-700 rounded-lg mb-6" />
        {/* Stats cards skeleton — 4 kolom */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          ))}
        </div>
        {/* Charts skeleton — 2 kolom */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
        </div>
        {/* Recent transactions skeleton */}
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
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

  // --- ROI: Net Profit / invested capital ---
  // Jika operations_start_date di-set, hitung net profit hanya dari transaksi
  // sejak tanggal tsb (operating ROI). Jika tidak, pakai net profit all-time
  // (holding period return). Penyebut (invested capital) tetap all-time karena
  // modal investor sudah masuk sejak hari pertama, terlepas dari kapan bisnis
  // mulai beroperasi.
  const roiNetProfit = (() => {
    if (!business?.operations_start_date) return allTimeSummary.netProfit;
    const opStart = new Date(business.operations_start_date);
    const operatingTxns = transactions.filter((t) => new Date(t.date) >= opStart);
    return calculateFinancialSummary(operatingTxns).netProfit;
  })();

  const roi = investedCapital.grossInvestedCapital > 0
    ? (roiNetProfit / investedCapital.grossInvestedCapital) * 100
    : 0;
  const remainingCapitalRoi = investedCapital.remainingInvestedCapital > 0
    ? (roiNetProfit / investedCapital.remainingInvestedCapital) * 100
    : 0;

  // --- Cash Balance: runway in months (uses all-time data, not year-filtered) ---
  const totalAllTimeExpenses = allTimeSummary.totalOpex + allTimeSummary.totalVar + allTimeSummary.totalTax + allTimeSummary.totalInterest;
  const avgMonthlyExpense = (() => {
    if (totalAllTimeExpenses === 0) return 0;
    const expenseMonths = new Set(
      transactions
        .filter((t) => {
          if (t.category === 'OPEX' || t.category === 'TAX') return true;
          if (t.category !== 'VAR') return false;
          // Skip inventory purchases — bukan expense bulan tersebut
          return !(t.is_double_entry && t.debit_account?.account_type === 'ASSET');
        })
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
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex items-center gap-2 min-w-max">
          {/* Year nav pill */}
          <div className="inline-flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => {
                userPickedYearRef.current = true;
                setSelectedYear((y) => y - 1);
              }}
              disabled={selectedYear <= minYear}
              aria-label="Previous year"
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-sm font-bold text-gray-800 dark:text-gray-100 min-w-[3rem] text-center tabular-nums">
              {selectedYear}
            </span>
            <button
              onClick={() => {
                userPickedYearRef.current = true;
                setSelectedYear((y) => y + 1);
              }}
              disabled={selectedYear >= maxYear}
              aria-label="Next year"
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Month tabs pill */}
          <div className="inline-flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setSelectedMonth(null)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                selectedMonth === null
                  ? 'bg-white dark:bg-gray-700 text-primary-500 dark:text-primary-400 font-bold shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 font-normal hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t.dashboard.yearly}
            </button>
            {MONTH_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => setSelectedMonth(i)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  selectedMonth === i
                    ? 'bg-white dark:bg-gray-700 text-primary-500 dark:text-primary-400 font-bold shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 font-normal hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        </div>
        <FxMiniWidget className="hidden xl:flex flex-shrink-0" />
      </div>

      {/* Stats Cards */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        initial={shouldReduceMotion ? false : 'hidden'}
        animate={shouldReduceMotion ? undefined : 'visible'}
        variants={shouldReduceMotion ? undefined : DASHBOARD_STAGGER_VARIANTS}
      >
        {/* Revenue */}
        <motion.div variants={shouldReduceMotion ? undefined : DASHBOARD_ITEM_VARIANTS}>
          <div
            className="card cursor-pointer flex flex-col group"
            onClick={() => router.push('/transactions?category=EARN')}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              {!transactionsLoading && revenueGrowthData.growth !== null && (
                <div className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${revenueGrowthData.growth === 0 ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' : revenueGrowthData.growth > 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400'}`}>
                  <span>{revenueGrowthData.growth >= 0 ? '▲' : '▼'}</span>
                  <span>{Math.abs(revenueGrowthData.growth).toFixed(1)}%</span>
                </div>
              )}
              {!transactionsLoading && revenueGrowthData.growth === null && revenueGrowthData.isNew && (
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  {t.dashboard.noComparisonData}
                </div>
              )}
            </div>
            <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{t.dashboard.revenue}</div>
            <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 break-all">
              {transactionsLoading ? '...' : (
                <AnimatedNumber
                  value={summary.totalEarn}
                  formatter={formatAnimatedCurrency}
                  replayKey={dashboardAnimationKey}
                />
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {transactionsLoading ? '...' : t.dashboard.transactionsIn.replace('{n}', String(categoryCounts.EARN))}
              {revenueGrowthData.label && <span className="text-gray-400 dark:text-gray-500"> · {revenueGrowthData.label}</span>}
            </div>
            {monthlySeries.revenue.some((v) => v > 0) && (
              <div className="mt-3 text-emerald-500 dark:text-emerald-400">
                <Sparkline data={monthlySeries.revenue} height={28} variant="area" />
              </div>
            )}
          </div>
        </motion.div>

        {/* Profit / Loss */}
        <motion.div variants={shouldReduceMotion ? undefined : DASHBOARD_ITEM_VARIANTS}>
          <div
            className="card cursor-pointer flex flex-col group"
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
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              {!transactionsLoading && netMargin !== null && (
                <div className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${netMargin === 0 ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' : netMargin > 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400'}`}>
                  {t.dashboard.margin.replace('{n}', netMargin.toFixed(1))}
                </div>
              )}
            </div>
            <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{t.dashboard.profitLoss}</div>
            <div className={`text-xl md:text-2xl font-bold break-all ${summary.netProfit === 0 ? 'text-gray-500 dark:text-gray-400' : summary.netProfit > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              {transactionsLoading ? '...' : (
                <AnimatedNumber
                  value={summary.netProfit}
                  formatter={formatAnimatedCurrency}
                  replayKey={dashboardAnimationKey}
                />
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {transactionsLoading
                ? '...'
                : expenseRatio !== null
                  ? t.dashboard.ofRevenueUsed.replace('{n}', expenseRatio.toFixed(1))
                  : '—'}
            </div>
            {monthlySeries.netProfit.some((v) => v !== 0) && (
              <div className={`mt-3 ${summary.netProfit >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                <Sparkline data={monthlySeries.netProfit} height={28} variant="bar" />
              </div>
            )}
          </div>
        </motion.div>

        {/* ROI */}
        <motion.div variants={shouldReduceMotion ? undefined : DASHBOARD_ITEM_VARIANTS}>
          <div className="card flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
              {!transactionsLoading && investedCapital.remainingInvestedCapital > 0 && (
                <div
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${remainingCapitalRoi === 0 ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' : remainingCapitalRoi > 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400'}`}
                  title="ROI atas modal yang masih tertanam"
                >
                  {t.dashboard.remainingCapitalRoi.replace('{n}', formatPercentage(remainingCapitalRoi))}
                </div>
              )}
            </div>
            <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{t.dashboard.roi}</div>
            <div className={`text-xl md:text-2xl font-bold ${roi === 0 ? 'text-gray-500 dark:text-gray-400' : roi > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              {transactionsLoading ? '...' : (
                <AnimatedNumber
                  value={roi}
                  formatter={formatAnimatedPercentage}
                  replayKey={dashboardAnimationKey}
                />
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {roiPeriod?.basis === 'operations_start'
                ? `Sejak ${roiPeriod.sinceLabel}`
                : t.dashboard.allTime}
              {roiPeriod && (
                <span className="text-gray-400 dark:text-gray-500"> · {t.dashboard.roiPeriodMonths.replace('{n}', String(roiPeriod.months))}</span>
              )}
            </div>
            {/* Progress bar: clamp ke 30% target reference, sebelah kiri zero kalau negatif */}
            <div className="mt-3 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden relative">
              {!transactionsLoading && (() => {
                const target = 30; // reference: 30% ROI sebagai full bar
                const pct = Math.min(100, Math.abs(roi) / target * 100);
                const isNeg = roi < 0;
                return (
                  <div
                    className={`h-full rounded-full ${isNeg ? 'bg-red-400 dark:bg-red-500' : roi === 0 ? 'bg-gray-300 dark:bg-gray-600' : 'bg-primary-500 dark:bg-primary-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                );
              })()}
            </div>
          </div>
        </motion.div>

        {/* Cash Balance */}
        <motion.div variants={shouldReduceMotion ? undefined : DASHBOARD_ITEM_VARIANTS}>
          <div
            className="card cursor-pointer flex flex-col"
            onClick={() => router.push('/general-ledger?filterType=ASSET')}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              {!transactionsLoading && cashRunwayMonths !== null && cashRunwayMonths > 0 && (
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  ~{cashRunwayMonths}mo runway
                </div>
              )}
            </div>
            <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{t.dashboard.cashBalance}</div>
            <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 break-all">
              {transactionsLoading ? '...' : (
                <AnimatedNumber
                  value={balanceSheet.assets.cash}
                  formatter={formatAnimatedCurrency}
                  replayKey={dashboardAnimationKey}
                />
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t.dashboard.cashAndBank}
              {cashVsRevenue !== null && (
                <span className="text-gray-400 dark:text-gray-500"> · {cashVsRevenue.toFixed(0)}% rev</span>
              )}
            </div>
            {/* Runway bar: 12 bulan = full */}
            <div className="mt-3 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              {!transactionsLoading && cashRunwayMonths !== null && cashRunwayMonths > 0 && (
                <div
                  className={`h-full rounded-full ${cashRunwayMonths >= 3 ? 'bg-primary-500 dark:bg-primary-400' : 'bg-red-400 dark:bg-red-500'}`}
                  style={{ width: `${Math.min(100, (cashRunwayMonths / 12) * 100)}%` }}
                />
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Monitoring Chart + Expense Breakdown */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6"
        initial={shouldReduceMotion ? false : 'hidden'}
        animate={shouldReduceMotion ? undefined : 'visible'}
        variants={shouldReduceMotion ? undefined : DASHBOARD_STAGGER_VARIANTS}
      >
        <motion.div className="lg:col-span-2 flex flex-col" variants={shouldReduceMotion ? undefined : DASHBOARD_ITEM_VARIANTS}>
          <MonitoringChart transactions={transactions} loading={transactionsLoading} selectedYear={selectedYear} />
        </motion.div>
        <motion.div className="lg:col-span-1 flex flex-col" variants={shouldReduceMotion ? undefined : DASHBOARD_ITEM_VARIANTS}>
          <ExpenseBreakdownChart transactions={transactions} loading={transactionsLoading} selectedYear={selectedYear} selectedMonth={selectedMonth} />
        </motion.div>
      </motion.div>

      {/* AR Tracker + Cap Table — paired "who" widgets, layout 2/3 + 1/3 */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t.dashboard.arTrackerTitle}</h2>
              {arData.count > 0 && (
                <div className="flex items-center gap-1">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-600 dark:text-gray-300">
                    {arData.count}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">{t.dashboard.arTrackerOutstandingLabel}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-600 mr-1">{t.dashboard.arTrackerFrom}</span>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-600 dark:text-gray-300">
                    {arData.contactCount}{arData.contactCount > 1 ? '+' : ''}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t.dashboard.arTrackerContactsLabel}</span>
                </div>
              )}
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
        <div className="lg:col-span-1">
          <CapTableWidget transactions={transactions} loading={transactionsLoading} />
        </div>
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
                    <div className="text-sm text-gray-600 dark:text-gray-400">{item.label}</div>
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
                { label: t.incomeStatement.grossProfit, value: summary.grossProfit, margin: hasRevenue ? metrics.grossMargin : null },
                { label: t.incomeStatement.operatingIncome, value: metrics.operatingIncome, margin: hasRevenue ? metrics.operatingMargin : null },
                { label: t.incomeStatement.netIncome, value: summary.netProfit, margin: hasRevenue ? metrics.netMargin : null, bold: true },
              ];
              return (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">{t.dashboard.financialResults}</p>
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
                                row.bold
                                  ? row.margin >= 0
                                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                              }`}>
                                {formatPercentage(row.margin)}
                              </span>
                            )}
                            <span className={`text-sm ${row.bold ? 'font-bold' : 'font-semibold'} ${
                              row.bold
                                ? isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                                : 'text-gray-700 dark:text-gray-200'
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
                      t.amount === 0
                        ? 'text-gray-500 dark:text-gray-400'
                        : t.category === 'EARN'
                          ? 'text-emerald-500 dark:text-emerald-400'
                          : (t.category === 'VAR' || t.category === 'OPEX')
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-gray-800 dark:text-gray-200'
                    }`}>
                      {t.category === 'EARN' ? '+' : ''}{formatCurrency(t.amount)}
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

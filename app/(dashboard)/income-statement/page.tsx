'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { TrendingUp, TrendingDown, Info, DollarSign, ChevronRight, Building2, Settings2 } from 'lucide-react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useIncomeStatement } from '@/hooks/useIncomeStatement';
import { useLanguage } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/utils';
import type { Transaction } from '@/types';
import type { AccountLineItem } from '@/lib/calculations';
import { TransactionDetailModal } from '@/components/transactions/TransactionDetailModal';
import { IncomeStatementConfigModal } from '@/components/reports/IncomeStatementConfigModal';
import { PeriodFilterCard } from '@/components/reports/PeriodFilterCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

function formatTransactionCount(count: number, locale: string): string {
  if (locale === 'id') return `${count} transaksi`;
  return `${count} ${count === 1 ? 'transaction' : 'transactions'}`;
}

function TransactionRow({ tx, onClick }: { tx: Transaction; onClick: (tx: Transaction) => void }) {
  return (
    <div onClick={() => onClick(tx)} className="flex items-start gap-3 py-2.5 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{tx.name}</p>
            {tx.description && (
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{tx.description}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {formatCurrency(tx.amount)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountBreakdownSection({
  items,
  onTransactionClick,
  amountColor = 'default',
  locale,
}: {
  items: AccountLineItem[];
  onTransactionClick: (tx: Transaction) => void;
  amountColor?: 'green' | 'red' | 'default';
  locale: string;
}) {
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  if (items.length === 0) return null;

  const amountClass = amountColor === 'green'
    ? 'text-green-600 dark:text-green-400'
    : amountColor === 'red'
      ? 'text-red-500 dark:text-red-400'
      : 'text-gray-800 dark:text-gray-100';

  return (
    <motion.div
      className="divide-y divide-gray-100 dark:divide-gray-700/60"
      initial="hidden"
      animate="visible"
      variants={shouldReduceMotion ? {} : {
        visible: { transition: { staggerChildren: 0.04 } },
      }}
    >
      {items.map((item) => {
        const isExpanded = expandedAccount === item.accountId;
        return (
          <motion.div
            key={item.accountId}
            variants={shouldReduceMotion ? {} : {
              hidden: { opacity: 0, y: 6 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
            }}
          >
            <button
              onClick={() => setExpandedAccount(isExpanded ? null : item.accountId)}
              className="w-full flex items-center justify-between px-2 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-md transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <ChevronRight className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                {item.accountCode && (
                  <span className="font-mono text-[11px] text-gray-400 dark:text-gray-500 tracking-tight">
                    {item.accountCode}
                  </span>
                )}
                <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                  {item.accountName}
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                  · {formatTransactionCount(item.transactions.length, locale)}
                </span>
              </div>
              <span className={`text-sm font-medium tabular-nums flex-shrink-0 ml-3 ${amountClass}`}>
                {amountColor === 'red' ? `(${formatCurrency(item.total)})` : formatCurrency(item.total)}
              </span>
            </button>

            {isExpanded && (
              <div className="ml-6 my-1 border-l-2 border-gray-100 dark:border-gray-700 max-h-[280px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/60">
                {item.transactions.map(tx => (
                  <TransactionRow key={tx.id} tx={tx} onClick={onTransactionClick} />
                ))}
              </div>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

type BreakdownItem = { label: string; value: number; color: 'green' | 'red' | 'white' };

function Tooltip({ title, color, formula, breakdown }: {
  title: string;
  color: string;
  formula?: string;
  breakdown?: BreakdownItem[];
}) {
  return (
    <div className="absolute left-0 bottom-full mb-2 z-50 hidden group-hover:block max-w-[calc(100vw-2rem)] sm:w-80 bg-gray-900 dark:bg-gray-950 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none ring-1 ring-white/10">
      <p className={`font-semibold mb-2 ${color}`}>{title}</p>

      {formula && (
        <>
          <p className="text-gray-400 mb-0.5">Formula:</p>
          <p className="text-white font-medium mb-2">{formula}</p>
        </>
      )}

      {breakdown && (
        <div className="space-y-1">
          {breakdown.map((item, i) => (
            <div key={i} className="flex justify-between text-[11px] tabular-nums">
              <span className="text-gray-300">{item.label}</span>
              <span className={
                item.color === 'green' ? 'text-green-300' :
                item.color === 'red' ? 'text-red-300' : 'text-white font-semibold'
              }>{item.color === 'red' ? `−${formatCurrency(item.value)}` : formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-950"></div>
    </div>
  );
}

/* ============================================================
 * Section — wrapper untuk grup line items dengan header minimal
 * ============================================================ */
function Section({
  title,
  accent = 'neutral',
  children,
}: {
  title: string;
  accent?: 'green' | 'red' | 'neutral';
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const shouldReduceMotion = useReducedMotion();

  const accentClass =
    accent === 'green' ? 'text-emerald-600 dark:text-emerald-400' :
    accent === 'red' ? 'text-red-500 dark:text-red-400' :
    'text-gray-500 dark:text-gray-400';

  return (
    <motion.section
      ref={ref}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={shouldReduceMotion ? {} : (isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 })}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700/60">
        <span className={`w-1 h-3.5 rounded-full ${
          accent === 'green' ? 'bg-emerald-500 dark:bg-emerald-400' :
          accent === 'red' ? 'bg-red-500 dark:bg-red-400' :
          'bg-gray-400 dark:bg-gray-500'
        }`} />
        <h3 className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${accentClass}`}>
          {title}
        </h3>
      </div>
      {children}
    </motion.section>
  );
}

/* ============================================================
 * SubtotalRow — total per section, blend dengan content
 * ============================================================ */
function SubtotalRow({
  label,
  value,
  color = 'default',
  negative = false,
}: {
  label: string;
  value: number;
  color?: 'green' | 'red' | 'default';
  negative?: boolean;
}) {
  const colorClass =
    value === 0 ? 'text-gray-500 dark:text-gray-400' :
    color === 'green' ? 'text-emerald-600 dark:text-emerald-400' :
    color === 'red' ? 'text-red-500 dark:text-red-400' :
    'text-gray-800 dark:text-gray-100';

  return (
    <div className="flex justify-between items-center px-2 py-3 mt-1 border-t border-gray-200 dark:border-gray-700/60">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${colorClass}`}>
        {negative ? `(${formatCurrency(value)})` : formatCurrency(value)}
      </span>
    </div>
  );
}

/* ============================================================
 * KeySubtotalCard — Tier 2 (Gross Profit, Operating Income)
 * ============================================================ */
function KeySubtotalCard({
  label,
  sublabel,
  value,
  margin,
  tooltipTitle,
  tooltipColor,
  tooltipFormula,
  tooltipBreakdown,
}: {
  label: string;
  sublabel?: string;
  value: number;
  margin?: number;
  tooltipTitle: string;
  tooltipColor: string;
  tooltipFormula: string;
  tooltipBreakdown: BreakdownItem[];
}) {
  const valueClass =
    value === 0 ? 'text-gray-500 dark:text-gray-400' :
    value > 0 ? 'text-emerald-600 dark:text-emerald-400' :
    'text-red-500 dark:text-red-400';

  const borderClass =
    value === 0 ? 'border-gray-200 dark:border-gray-700' :
    value > 0 ? 'border-emerald-200 dark:border-emerald-800/60' :
    'border-red-200 dark:border-red-800/60';

  const bgClass =
    value === 0 ? 'bg-gray-50/50 dark:bg-gray-800/40' :
    value > 0 ? 'bg-emerald-50/60 dark:bg-emerald-950/20' :
    'bg-red-50/60 dark:bg-red-950/20';

  return (
    <div className={`relative group rounded-xl border ${borderClass} ${bgClass} px-5 py-4 cursor-default`}>
      <div className="flex justify-between items-center gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
              {label}
            </h3>
            {sublabel && (
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-normal">
                ({sublabel})
              </span>
            )}
            <Info className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          </div>
          {typeof margin === 'number' && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
              Margin {margin.toFixed(2)}%
            </p>
          )}
        </div>
        <span className={`text-2xl font-bold tabular-nums ${valueClass}`}>
          {formatCurrency(value)}
        </span>
      </div>
      <Tooltip
        title={tooltipTitle}
        color={tooltipColor}
        formula={tooltipFormula}
        breakdown={tooltipBreakdown}
      />
    </div>
  );
}

/* ============================================================
 * InlineSubtotal — Tier 3 (EBITDA, EBT) — slimmer than KeySubtotalCard
 * ============================================================ */
function InlineSubtotal({
  label,
  sublabel,
  value,
  margin,
  tooltipTitle,
  tooltipColor,
  tooltipFormula,
  tooltipBreakdown,
}: {
  label: string;
  sublabel?: string;
  value: number;
  margin?: number;
  tooltipTitle: string;
  tooltipColor: string;
  tooltipFormula: string;
  tooltipBreakdown: BreakdownItem[];
}) {
  const valueClass =
    value === 0 ? 'text-gray-500 dark:text-gray-400' :
    value > 0 ? 'text-emerald-600 dark:text-emerald-400' :
    'text-red-500 dark:text-red-400';

  return (
    <div className="relative group flex justify-between items-center px-5 py-3 rounded-lg bg-gray-100/70 dark:bg-gray-800/50 cursor-default">
      <div className="flex items-baseline gap-2 flex-wrap min-w-0">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
          {label}
        </h4>
        {sublabel && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500">({sublabel})</span>
        )}
        <Info className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        {typeof margin === 'number' && (
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            · {margin.toFixed(2)}%
          </span>
        )}
      </div>
      <span className={`text-lg font-bold tabular-nums ${valueClass}`}>
        {formatCurrency(value)}
      </span>
      <Tooltip
        title={tooltipTitle}
        color={tooltipColor}
        formula={tooltipFormula}
        breakdown={tooltipBreakdown}
      />
    </div>
  );
}

/* ============================================================
 * NetIncomeCard — Hero / Tier 1
 * ============================================================ */
function NetIncomeCard({
  netProfit,
  netMargin,
  summary,
}: {
  netProfit: number;
  netMargin: number;
  summary: {
    totalEarn: number;
    totalVar: number;
    totalOpex: number;
    totalDepreciation: number;
    totalInterest: number;
    totalTax: number;
    netProfit: number;
  };
}) {
  const gradient =
    netProfit === 0
      ? 'from-gray-400 to-gray-500'
      : netProfit > 0
        ? 'from-emerald-500 via-emerald-500 to-teal-500'
        : 'from-red-500 via-red-500 to-rose-500';

  const subTextClass =
    netProfit === 0 ? 'text-gray-100' : netProfit > 0 ? 'text-emerald-50' : 'text-red-50';

  return (
    <div
      id="net-income"
      className={`relative group rounded-2xl p-6 text-white cursor-default bg-gradient-to-br ${gradient} shadow-lg shadow-emerald-500/10 dark:shadow-emerald-900/20 mt-4`}
    >
      {/* Decorative accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex justify-between items-center gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/80">
              Net Income
            </h3>
            <Info className="w-3.5 h-3.5 text-white/60" />
          </div>
          <p className={`text-sm ${subTextClass} tabular-nums`}>
            Net Margin {netMargin.toFixed(2)}%
          </p>
        </div>
        <div className="text-right flex items-center gap-3">
          {netProfit > 0 ? (
            <TrendingUp className="w-7 h-7 text-white/80" strokeWidth={2.5} />
          ) : netProfit < 0 ? (
            <TrendingDown className="w-7 h-7 text-white/80" strokeWidth={2.5} />
          ) : null}
          <span className="text-3xl font-bold tabular-nums">
            {formatCurrency(netProfit)}
          </span>
        </div>
      </div>

      {/* Tooltip */}
      <div className="absolute left-4 bottom-full mb-2 z-50 hidden group-hover:block w-80 bg-gray-900 dark:bg-gray-950 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none ring-1 ring-white/10">
        <p className="font-semibold mb-2 text-emerald-300">Net Income / Laba Bersih</p>
        <p className="text-gray-400 mb-0.5">Formula:</p>
        <p className="text-white font-medium mb-2">Revenue − Cost of Revenue − OpEx − Depreciation − Financing − Tax</p>
        <div className="space-y-1 text-[11px] tabular-nums">
          <div className="flex justify-between">
            <span className="text-gray-300">Revenue</span>
            <span className="text-green-300">{formatCurrency(summary.totalEarn)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Cost of Revenue</span>
            <span className="text-red-300">−{formatCurrency(summary.totalVar)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Operating Expenses</span>
            <span className="text-red-300">−{formatCurrency(summary.totalOpex)}</span>
          </div>
          {summary.totalDepreciation > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-300">Depreciation</span>
              <span className="text-red-300">−{formatCurrency(summary.totalDepreciation)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-300">Financing</span>
            <span className={summary.totalInterest === 0 ? 'text-gray-500' : 'text-red-300'}>−{formatCurrency(summary.totalInterest)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Tax</span>
            <span className={summary.totalTax === 0 ? 'text-gray-500' : 'text-red-300'}>−{formatCurrency(summary.totalTax)}</span>
          </div>
          <div className="flex justify-between font-semibold text-white border-t border-gray-700 pt-1 mt-1">
            <span>Net Income</span>
            <span className={summary.netProfit === 0 ? 'text-gray-400' : summary.netProfit > 0 ? 'text-emerald-300' : 'text-red-300'}>{formatCurrency(summary.netProfit)}</span>
          </div>
        </div>
        <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-950"></div>
      </div>
    </div>
  );
}

/* ============================================================
 * WaterfallRow — mini summary line for sidebar
 * ============================================================ */
function WaterfallRow({
  label,
  value,
  color = 'default',
  indent = false,
  bold = false,
}: {
  label: string;
  value: number;
  color?: 'green' | 'red' | 'default';
  indent?: boolean;
  bold?: boolean;
}) {
  const colorClass =
    value === 0 ? 'text-gray-400 dark:text-gray-500' :
    color === 'green' ? 'text-emerald-600 dark:text-emerald-400' :
    color === 'red' ? 'text-red-500 dark:text-red-400' :
    'text-gray-700 dark:text-gray-200';

  const labelClass = bold
    ? 'font-semibold text-gray-700 dark:text-gray-200'
    : indent
      ? 'text-gray-500 dark:text-gray-400 pl-3'
      : 'text-gray-600 dark:text-gray-300';

  return (
    <div className={`flex justify-between items-center ${bold ? 'pt-1.5 mt-0.5 border-t border-gray-100 dark:border-gray-700/40' : ''}`}>
      <span className={labelClass}>{label}</span>
      <AnimatedNumber
        value={value}
        formatter={(v) => color === 'red' && v !== 0 ? `(${formatCurrency(v)})` : formatCurrency(v)}
        className={`tabular-nums ${bold ? 'font-semibold' : 'font-medium'} ${colorClass}`}
      />
    </div>
  );
}

/* ============================================================
 * MarginCell — compact margin metric for sidebar grid
 * ============================================================ */
function MarginCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg p-2.5 bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/40">
      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold tabular-nums text-gray-700 dark:text-gray-200 mt-0.5">{value.toFixed(2)}%</p>
    </div>
  );
}

function IncomeStatementPageInner() {
  const {
    activeBusiness,
    loading,
    period,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    handlePeriodChange,
    summary,
    metrics,
    lineItems,
    accounts,
    refetchAccounts,
    handleExportPDF,
    handleExportExcel,
  } = useIncomeStatement();

  const { locale, t } = useLanguage();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Scroll to section from URL param (e.g., /income-statement?scrollTo=net-income)
  const searchParams = useSearchParams();
  useEffect(() => {
    const scrollTo = searchParams.get('scrollTo');
    if (scrollTo && !loading) {
      const el = document.getElementById(scrollTo);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    }
  }, [searchParams, loading]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!activeBusiness) {
    return (
      <div className="p-8">
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="flex justify-center mb-4"><Building2 className="w-10 h-10 text-gray-400" /></div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Tidak ada bisnis aktif
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Pilih atau buat bisnis terlebih dahulu
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
          Profit & Loss
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Laporan Laba Rugi - {activeBusiness.business_name}
        </p>
      </div>

      {/* Side-by-side layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT COLUMN — Filters + Summary */}
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 space-y-6">
          {/* Period Filter Card */}
          <PeriodFilterCard
            period={period}
            startDate={startDate}
            endDate={endDate}
            onPeriodChange={handlePeriodChange}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onExportPDF={handleExportPDF}
            onExportExcel={handleExportExcel}
            months={t.dashboard.months}
          />

          {/* Summary Card — clean waterfall */}
          <div className="card-static space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                Summary
              </h4>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                summary.netProfit > 0
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : summary.netProfit < 0
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {summary.netProfit > 0 ? 'PROFIT' : summary.netProfit < 0 ? 'LOSS' : 'BREAK EVEN'}
              </span>
            </div>

            {/* Hero: Net Income */}
            <div className="space-y-1">
              <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Net Income</p>
              <AnimatedNumber
                value={summary.netProfit}
                formatter={formatCurrency}
                className={`text-2xl font-bold tabular-nums ${
                  summary.netProfit === 0 ? 'text-gray-500 dark:text-gray-400' :
                  summary.netProfit > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                  'text-red-500 dark:text-red-400'
                }`}
              />
              <p className={`text-xs tabular-nums ${
                summary.netProfit > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                summary.netProfit < 0 ? 'text-red-500 dark:text-red-400' :
                'text-gray-500 dark:text-gray-400'
              }`}>
                Net Margin {metrics.netMargin.toFixed(2)}%
              </p>
            </div>

            {/* Waterfall mini */}
            <div className="space-y-1.5 text-xs pt-3 border-t border-gray-200 dark:border-gray-700/60">
              <WaterfallRow label="Revenue" value={summary.totalEarn} color="green" />
              <WaterfallRow label="Cost of Revenue" value={summary.totalVar} color="red" indent />
              <WaterfallRow label="Gross Profit" value={summary.grossProfit} color={summary.grossProfit >= 0 ? 'green' : 'red'} bold />
              <WaterfallRow label="OpEx" value={summary.totalOpex} color="red" indent />
              {summary.totalDepreciation > 0 && (
                <>
                  <WaterfallRow label="EBITDA" value={metrics.ebitda} color={metrics.ebitda >= 0 ? 'green' : 'red'} bold />
                  <WaterfallRow label="Depreciation" value={summary.totalDepreciation} color="red" indent />
                </>
              )}
              <WaterfallRow label="Operating Income" value={metrics.operatingIncome} color={metrics.operatingIncome >= 0 ? 'green' : 'red'} bold />
              {summary.totalInterest > 0 && <WaterfallRow label="Financing" value={summary.totalInterest} color="red" indent />}
              {summary.totalTax > 0 && <WaterfallRow label="Tax" value={summary.totalTax} color="red" indent />}
            </div>

            {/* Margin metrics */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-200 dark:border-gray-700/60">
              <MarginCell label="Gross Margin" value={metrics.grossMargin} />
              <MarginCell label="Operating" value={metrics.operatingMargin} />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — Main Content */}
        <div className="flex-1 min-w-0">
          <div className="card-static">
            <div className="flex items-center justify-between pb-5 mb-6 border-b border-gray-200 dark:border-gray-700/60">
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  Income Statement
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                  {new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} — {new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => setShowConfigModal(true)}
                className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer"
                title="Konfigurasi klasifikasi expense"
                aria-label="Configure income statement"
              >
                <Settings2 className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="space-y-8">
              {/* REVENUE */}
              <Section title="Revenue" accent="green">
                <AccountBreakdownSection items={lineItems.revenue} onTransactionClick={setSelectedTransaction} amountColor="green" locale={locale} />
                <SubtotalRow label="Total Revenue" value={summary.totalEarn} color="green" />
              </Section>

              {/* COST OF REVENUE */}
              <Section title="Cost of Revenue" accent="red">
                <AccountBreakdownSection items={lineItems.cogs} onTransactionClick={setSelectedTransaction} amountColor="red" locale={locale} />
                <SubtotalRow label="Total Cost of Revenue" value={summary.totalVar} color="red" negative />
              </Section>

              {/* GROSS PROFIT — Tier 2 subtotal */}
              <KeySubtotalCard
                label="Gross Profit"
                value={summary.grossProfit}
                margin={metrics.grossMargin}
                tooltipTitle="Gross Profit"
                tooltipColor="text-indigo-300"
                tooltipFormula="Revenue − Cost of Revenue"
                tooltipBreakdown={[
                  { label: 'Revenue', value: summary.totalEarn, color: 'green' },
                  { label: 'Cost of Revenue', value: summary.totalVar, color: 'red' },
                  { label: 'Gross Profit', value: summary.grossProfit, color: summary.grossProfit >= 0 ? 'green' : 'red' },
                ]}
              />

              {/* OPERATING EXPENSES */}
              <Section title="Operating Expenses" accent="red">
                <AccountBreakdownSection items={lineItems.opex} onTransactionClick={setSelectedTransaction} amountColor="red" locale={locale} />
                <SubtotalRow label="Total Operating Expenses" value={summary.totalOpex} color="red" negative />
              </Section>

              {/* EBITDA — Tier 3 inline subtotal, only if depreciation > 0 */}
              {summary.totalDepreciation > 0 && (
                <InlineSubtotal
                  label="EBITDA"
                  value={metrics.ebitda}
                  margin={metrics.ebitdaMargin}
                  tooltipTitle="EBITDA"
                  tooltipColor="text-emerald-300"
                  tooltipFormula="Gross Profit − Operating Expenses"
                  tooltipBreakdown={[
                    { label: 'Gross Profit', value: summary.grossProfit, color: summary.grossProfit >= 0 ? 'green' : 'red' },
                    { label: 'Operating Expenses', value: summary.totalOpex, color: 'red' },
                    { label: 'EBITDA', value: metrics.ebitda, color: metrics.ebitda >= 0 ? 'green' : 'red' },
                  ]}
                />
              )}

              {/* DEPRECIATION — only if > 0 */}
              {summary.totalDepreciation > 0 && (
                <Section title="Depreciation" accent="red">
                  <div className="flex items-center justify-between px-2 py-3">
                    <span className="text-sm text-gray-700 dark:text-gray-200">Penyusutan Aset Tetap (Straight-Line)</span>
                    <span className="text-sm font-medium tabular-nums text-red-500 dark:text-red-400">({formatCurrency(summary.totalDepreciation)})</span>
                  </div>
                  <SubtotalRow label="Total Depreciation" value={summary.totalDepreciation} color="red" negative />
                </Section>
              )}

              {/* OPERATING INCOME — Tier 2 */}
              <KeySubtotalCard
                label="Operating Income"
                sublabel="EBIT"
                value={metrics.operatingIncome}
                margin={metrics.operatingMargin}
                tooltipTitle="Operating Income (EBIT)"
                tooltipColor="text-purple-300"
                tooltipFormula={summary.totalDepreciation > 0 ? "Gross Profit − OpEx − Depreciation" : "Gross Profit − OpEx"}
                tooltipBreakdown={[
                  { label: 'Gross Profit', value: summary.grossProfit, color: summary.grossProfit >= 0 ? 'green' : 'red' },
                  { label: 'Operating Expenses', value: summary.totalOpex, color: 'red' },
                  ...(summary.totalDepreciation > 0 ? [{ label: 'Depreciation', value: summary.totalDepreciation, color: 'red' as const }] : []),
                  { label: 'Operating Income', value: metrics.operatingIncome, color: metrics.operatingIncome >= 0 ? 'green' : 'red' },
                ]}
              />

              {/* FINANCING COSTS — render only if has items */}
              {lineItems.interest.length > 0 && (
                <Section title="Financing Costs" accent="red">
                  <AccountBreakdownSection items={lineItems.interest} onTransactionClick={setSelectedTransaction} amountColor="red" locale={locale} />
                  <SubtotalRow label="Total Financing Costs" value={summary.totalInterest} color="red" negative />
                </Section>
              )}

              {/* EBT — Tier 3 inline subtotal */}
              <InlineSubtotal
                label="EBT"
                sublabel="Earnings Before Tax"
                value={metrics.ebt}
                tooltipTitle="EBT (Earnings Before Tax)"
                tooltipColor="text-blue-300"
                tooltipFormula="Operating Income − Financing Costs"
                tooltipBreakdown={[
                  { label: 'Operating Income', value: metrics.operatingIncome, color: metrics.operatingIncome >= 0 ? 'green' : 'red' },
                  { label: 'Financing Costs', value: summary.totalInterest, color: 'red' },
                  { label: 'EBT', value: metrics.ebt, color: metrics.ebt >= 0 ? 'green' : 'red' },
                ]}
              />

              {/* TAX — render only if has items */}
              {lineItems.tax.length > 0 && (
                <Section title="Tax Expense" accent="red">
                  <AccountBreakdownSection items={lineItems.tax} onTransactionClick={setSelectedTransaction} amountColor="red" locale={locale} />
                  <SubtotalRow label="Total Tax" value={summary.totalTax} color="red" negative />
                </Section>
              )}

              {/* NET INCOME — Hero */}
              <NetIncomeCard
                netProfit={summary.netProfit}
                netMargin={metrics.netMargin}
                summary={summary}
              />
            </div>
          </div>
        </div>
      </div>

      <TransactionDetailModal
        transaction={selectedTransaction}
        isOpen={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />

      <IncomeStatementConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        accounts={accounts}
        businessId={activeBusiness.id}
        onSaved={async () => {
          await refetchAccounts();
          // Refresh transactions cache supaya debit/credit account yang di-embed ikut ter-update
          window.dispatchEvent(new Event('transaction-saved'));
        }}
      />
    </div>
  );
}

export default function IncomeStatementPage() {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center min-h-[50vh]"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <IncomeStatementPageInner />
    </Suspense>
  );
}

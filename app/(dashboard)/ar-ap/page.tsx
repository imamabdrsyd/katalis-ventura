'use client';

import { Suspense, useState } from 'react';
import { Users, Calendar, AlertTriangle, TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { useArApAging } from '@/hooks/useArApAging';
import { useLanguage } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/utils';
import type { Period } from '@/hooks/useReportData';
import type { ArApSummary, AgingRow, RepaymentSummary } from '@/types';

// ─── Aging Table Component ─────────────────────────────────────

function AgingTable({ summary, type }: { summary: ArApSummary; type: 'ar' | 'ap' }) {
  const { t } = useLanguage();
  const label = type === 'ar' ? t.arAp.receivables : t.arAp.payables;

  if (summary.rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="font-medium">{t.arAp.noOutstanding.replace('{label}', label.toLowerCase())}</p>
        <p className="text-sm mt-1">{t.arAp.allSettled.replace('{label}', label.toLowerCase())}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
            <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">{t.arAp.contactName}</th>
            <th className="py-3 px-3 font-semibold text-gray-600 dark:text-gray-300 text-right">{t.arAp.current}</th>
            <th className="py-3 px-3 font-semibold text-gray-600 dark:text-gray-300 text-right">{t.arAp.days1to30}</th>
            <th className="py-3 px-3 font-semibold text-gray-600 dark:text-gray-300 text-right">{t.arAp.days31to60}</th>
            <th className="py-3 px-3 font-semibold text-gray-600 dark:text-gray-300 text-right">{t.arAp.days61to90}</th>
            <th className="py-3 px-3 font-semibold text-gray-600 dark:text-gray-300 text-right">{t.arAp.daysOver90}</th>
            <th className="py-3 px-3 font-semibold text-gray-600 dark:text-gray-300 text-right">{t.common.total}</th>
          </tr>
        </thead>
        <tbody>
          {summary.rows.map((row, i) => (
            <AgingTableRow key={row.contactId || row.contactName + i} row={row} />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold">
            <td className="py-3 px-4">Total</td>
            <td className="py-3 px-3 text-right">{formatCurrency(summary.totalCurrent)}</td>
            <td className="py-3 px-3 text-right">{formatCurrency(summary.total30)}</td>
            <td className="py-3 px-3 text-right">{formatCurrency(summary.total60)}</td>
            <td className="py-3 px-3 text-right">{formatCurrency(summary.total90)}</td>
            <td className={`py-3 px-3 text-right ${summary.totalOver90 > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
              {formatCurrency(summary.totalOver90)}
            </td>
            <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(summary.grandTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function AgingTableRow({ row }: { row: AgingRow }) {
  const { t } = useLanguage();
  const hasOverdue = row.bucket60 > 0 || row.bucket90 > 0 || row.bucketOver90 > 0;

  return (
    <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold text-xs">
            {row.contactName.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-gray-100">{row.contactName}</span>
            {row.contactType && (
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                {row.contactType === 'customer' ? t.arAp.customerType : row.contactType === 'vendor' ? t.arAp.vendorType : t.arAp.otherType}
              </span>
            )}
            {hasOverdue && (
              <AlertTriangle className="inline w-3.5 h-3.5 ml-1.5 text-amber-500" />
            )}
          </div>
        </div>
      </td>
      <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">{row.current > 0 ? formatCurrency(row.current) : '-'}</td>
      <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">{row.bucket30 > 0 ? formatCurrency(row.bucket30) : '-'}</td>
      <td className="py-3 px-3 text-right text-amber-600 dark:text-amber-400">{row.bucket60 > 0 ? formatCurrency(row.bucket60) : '-'}</td>
      <td className="py-3 px-3 text-right text-orange-600 dark:text-orange-400">{row.bucket90 > 0 ? formatCurrency(row.bucket90) : '-'}</td>
      <td className="py-3 px-3 text-right text-red-600 dark:text-red-400 font-medium">{row.bucketOver90 > 0 ? formatCurrency(row.bucketOver90) : '-'}</td>
      <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(row.total)}</td>
    </tr>
  );
}

// ─── Summary Cards ─────────────────────────────────────────────

function SummaryCards({ arSummary, apSummary, netArTotal, netApTotal }: {
  arSummary: ArApSummary;
  apSummary: ArApSummary;
  netArTotal: number;
  netApTotal: number;
}) {
  const { t } = useLanguage();
  const netPosition = netArTotal - netApTotal;
  const overdueAR = arSummary.total60 + arSummary.total90 + arSummary.totalOver90;
  const overdueAP = apSummary.total60 + apSummary.total90 + apSummary.totalOver90;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Receivables */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t.arAp.receivables}</span>
        </div>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(Math.max(0, netArTotal))}</p>
        <p className="text-xs text-gray-500 mt-1">{t.arAp.contacts.replace('{n}', String(arSummary.rows.length))}</p>
      </div>

      {/* Payables */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t.arAp.payables}</span>
        </div>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(Math.max(0, netApTotal))}</p>
        <p className="text-xs text-gray-500 mt-1">{t.arAp.contacts.replace('{n}', String(apSummary.rows.length))}</p>
      </div>

      {/* Net Position */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t.arAp.netPosition}</span>
        </div>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {formatCurrency(netPosition)}
        </p>
        <p className="text-xs text-gray-500 mt-1">{netPosition >= 0 ? t.arAp.moreReceived : t.arAp.morePaid}</p>
      </div>

      {/* Overdue */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t.arAp.overdueLabel}</span>
        </div>
        <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(overdueAR + overdueAP)}</p>
        <p className="text-xs text-gray-500 mt-1">
          AR: {formatCurrency(overdueAR)} | AP: {formatCurrency(overdueAP)}
        </p>
      </div>
    </div>
  );
}

// ─── Repayment History Table ────────────────────────────────────

function RepaymentTable({ summary }: { summary: RepaymentSummary }) {
  const { t } = useLanguage();

  if (summary.rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="font-medium">{t.arAp.noPaymentHistory}</p>
        <p className="text-sm mt-1">{t.arAp.paymentHistoryHint}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 text-sm flex-wrap">
        <span className="text-gray-500 dark:text-gray-400">{t.arAp.totalPaid}</span>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
            {t.arAp.payDebt}
          </span>
          <span className="font-semibold text-gray-800 dark:text-gray-100">{formatCurrency(summary.totalApRepaid)}</span>
        </div>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            {t.arAp.receivePayment}
          </span>
          <span className="font-semibold text-gray-800 dark:text-gray-100">{formatCurrency(summary.totalArCollected)}</span>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
            <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">{t.common.date}</th>
            <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">{t.arAp.contactName}</th>
            <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">{t.common.description}</th>
            <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">{t.common.type}</th>
            <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300 text-right">{t.common.amount}</th>
          </tr>
        </thead>
        <tbody>
          {summary.rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <td className="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {new Date(row.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    {row.contactName.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{row.contactName}</span>
                </div>
              </td>
              <td className="py-3 px-4 text-gray-600 dark:text-gray-400 max-w-[300px] truncate">{row.description}</td>
              <td className="py-3 px-4">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  row.type === 'ap'
                    ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {row.type === 'ap' ? t.arAp.payDebt : t.arAp.receivePayment}
                </span>
              </td>
              <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

function ArApPageInner() {
  const {
    activeBusiness,
    loading,
    period,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    handlePeriodChange,
    arSummary,
    apSummary,
    repaymentSummary,
    netArTotal,
    netApTotal,
  } = useArApAging();

  const { t } = useLanguage();

  const PERIOD_LABELS: Record<Period, string> = {
    month: t.period.thisMonth,
    quarter: t.period.quarter,
    year: t.period.thisYear,
    custom: t.period.custom,
  };

  const [activeTab, setActiveTab] = useState<'ar' | 'ap' | 'repayment'>('ar');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (!activeBusiness) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500 dark:text-gray-400">Pilih bisnis terlebih dahulu.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
            <Users className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
            {t.arAp.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t.arAp.subtitle.replace('{name}', activeBusiness.business_name)}
          </p>
        </div>

        {/* Period Filter */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <Tabs<Period>
            value={period}
            onChange={handlePeriodChange}
            tabs={(['month', 'quarter', 'year', 'custom'] as Period[]).map((p) => ({ value: p, label: PERIOD_LABELS[p] }))}
          />
          {period === 'custom' && (
            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
              />
              <span className="text-xs text-gray-400">—</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards arSummary={arSummary} apSummary={apSummary} netArTotal={netArTotal} netApTotal={netApTotal} />

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab('ar')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'ar'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.arAp.arTab}
              {arSummary.rows.length > 0 && (
                <span className="ml-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs px-2 py-0.5 rounded-full">
                  {arSummary.rows.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('ap')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'ap'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.arAp.apTab}
              {apSummary.rows.length > 0 && (
                <span className="ml-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs px-2 py-0.5 rounded-full">
                  {apSummary.rows.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('repayment')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'repayment'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.arAp.paymentHistory}
              {repaymentSummary.rows.length > 0 && (
                <span className="ml-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs px-2 py-0.5 rounded-full">
                  {repaymentSummary.rows.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="p-0">
          {activeTab === 'ar' && <AgingTable summary={arSummary} type="ar" />}
          {activeTab === 'ap' && <AgingTable summary={apSummary} type="ap" />}
          {activeTab === 'repayment' && <RepaymentTable summary={repaymentSummary} />}
        </div>
      </div>
    </div>
  );
}

export default function ArApPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
      </div>
    }>
      <ArApPageInner />
    </Suspense>
  );
}

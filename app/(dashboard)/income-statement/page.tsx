'use client';

import { Calendar, TrendingUp, TrendingDown, Download, FileText, FileSpreadsheet, Info } from 'lucide-react';
import { useIncomeStatement } from '@/hooks/useIncomeStatement';
import { formatCurrency } from '@/lib/utils';
import type { Period } from '@/hooks/useReportData';
import type { Transaction } from '@/types';

function TransactionList({ transactions }: { transactions: Transaction[] }) {
  const MAX_SHOWN = 5;
  const shown = transactions.slice(0, MAX_SHOWN);
  const remaining = transactions.length - MAX_SHOWN;

  if (transactions.length === 0) {
    return <p className="text-gray-400 italic">Tidak ada transaksi</p>;
  }

  return (
    <div className="space-y-1.5">
      {shown.map((t) => (
        <div key={t.id} className="flex justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-white truncate font-medium">{t.name}</p>
            {t.description && (
              <p className="text-gray-400 truncate text-[10px]">{t.description}</p>
            )}
            <p className="text-gray-500 text-[10px]">
              {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <span className="shrink-0 text-right font-medium text-[11px] text-white">
            {formatCurrency(t.amount)}
          </span>
        </div>
      ))}
      {remaining > 0 && (
        <p className="text-gray-400 text-[10px] pt-1 border-t border-gray-700">
          +{remaining} transaksi lainnya...
        </p>
      )}
    </div>
  );
}

function Tooltip({ title, color, transactions, formula, breakdown }: {
  title: string;
  color: string;
  transactions?: Transaction[];
  formula?: string;
  breakdown?: { label: string; value: number; color: 'green' | 'red' | 'white' }[];
}) {
  return (
    <div className="absolute left-0 bottom-full mb-2 z-50 hidden group-hover:block w-80 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none">
      <p className={`font-semibold mb-2 ${color}`}>{title}</p>

      {formula && (
        <>
          <p className="text-gray-400 mb-0.5">Formula:</p>
          <p className="text-white font-medium mb-2">{formula}</p>
        </>
      )}

      {breakdown && (
        <div className="space-y-1 mb-2">
          {breakdown.map((item, i) => (
            <div key={i} className="flex justify-between text-[11px]">
              <span className="text-gray-300">{item.label}</span>
              <span className={
                item.color === 'green' ? 'text-green-300' :
                item.color === 'red' ? 'text-red-300' : 'text-white font-semibold'
              }>{item.color === 'red' ? `−${formatCurrency(item.value)}` : formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      )}

      {transactions !== undefined && (
        <>
          {breakdown && <div className="border-t border-gray-700 my-2" />}
          <p className="text-gray-400 mb-1.5">
            Dari {transactions.length} transaksi:
          </p>
          <TransactionList transactions={transactions} />
        </>
      )}

      <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-800"></div>
    </div>
  );
}

export default function IncomeStatementPage() {
  const {
    activeBusiness,
    loading,
    period,
    startDate,
    endDate,
    showExportMenu,
    exportButtonRef,
    setPeriod,
    setStartDate,
    setEndDate,
    setShowExportMenu,
    handlePeriodChange,
    summary,
    metrics,
    transactionsByCategory,
    handleExportPDF,
    handleExportExcel,
  } = useIncomeStatement();

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
          <div className="text-4xl mb-4">🏢</div>
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
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Income Statement</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Laporan Laba Rugi - {activeBusiness.business_name}
        </p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          {/* Period Selector */}
          <div className="flex-1">
            <label className="label">Periode</label>
            <div className="flex gap-2">
              {(['month', 'quarter', 'year', 'custom'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    period === p
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {p === 'month' ? 'Bulan Ini' : p === 'quarter' ? 'Kuartal' : p === 'year' ? 'Tahun Ini' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="flex gap-3 items-end">
            <div>
              <label className="label flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPeriod('custom');
                }}
                className="input"
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPeriod('custom');
                }}
                className="input"
              />
            </div>
          </div>

          {/* Export Button */}
          <div className="relative" ref={exportButtonRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            {/* Export Dropdown */}
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-10">
                <button
                  onClick={handleExportPDF}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                >
                  <FileText className="w-4 h-4 text-red-500" />
                  Export as PDF
                </button>
                <button
                  onClick={handleExportExcel}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-500" />
                  Export as Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Income Statement */}
      <div className="card">
        <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            Income Statement
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Period: {new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - {new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <div className="space-y-6">
          {/* REVENUE */}
          <div>
            <div className="flex items-center justify-between py-3 border-b-2 border-gray-300 dark:border-gray-600">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 uppercase text-sm">Revenue</h3>
            </div>
            <div className="relative group flex justify-between py-2 pl-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded cursor-default">
              <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1">
                Earnings
                <Info className="w-3 h-3 text-gray-400 dark:text-gray-500" />
              </span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(summary.totalEarn)}
              </span>
              <Tooltip
                title="Earnings / Revenue (EARN)"
                color="text-green-300"
                transactions={transactionsByCategory.revenue}
              />
            </div>
            <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-semibold border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-800 dark:text-gray-100">Total Revenue</span>
              <span className="text-gray-800 dark:text-gray-100">{formatCurrency(summary.totalEarn)}</span>
            </div>
          </div>

          {/* COST OF GOODS SOLD */}
          <div>
            <div className="flex items-center justify-between py-3 border-b-2 border-gray-300 dark:border-gray-600">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 uppercase text-sm">Cost of Goods Sold</h3>
            </div>
            <div className="relative group flex justify-between py-2 pl-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded cursor-default">
              <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1">
                Variable Costs
                <Info className="w-3 h-3 text-gray-400 dark:text-gray-500" />
              </span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                ({formatCurrency(summary.totalVar)})
              </span>
              <Tooltip
                title="Variable Costs / COGS (VAR)"
                color="text-red-300"
                transactions={transactionsByCategory.cogs}
              />
            </div>
            <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-semibold border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-800 dark:text-gray-100">Total COGS</span>
              <span className="text-red-600 dark:text-red-400">({formatCurrency(summary.totalVar)})</span>
            </div>
          </div>

          {/* GROSS PROFIT */}
          <div className="relative group bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/30 cursor-default">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-indigo-900 dark:text-indigo-100 text-lg flex items-center gap-1">
                  GROSS PROFIT
                  <Info className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-500" />
                </h3>
                <p className="text-sm text-indigo-600 dark:text-indigo-400">Margin: {metrics.grossMargin.toFixed(2)}%</p>
              </div>
              <div className="text-right">
                <span className={`text-2xl font-bold ${summary.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(summary.grossProfit)}
                </span>
              </div>
            </div>
            <Tooltip
              title="Gross Profit"
              color="text-indigo-300"
              formula="Revenue − Variable Costs"
              breakdown={[
                { label: 'Revenue (Earnings)', value: summary.totalEarn, color: 'green' },
                { label: 'Variable Costs (COGS)', value: summary.totalVar, color: 'red' },
                { label: 'Gross Profit', value: summary.grossProfit, color: summary.grossProfit >= 0 ? 'green' : 'red' },
              ]}
            />
          </div>

          {/* OPERATING EXPENSES */}
          <div>
            <div className="flex items-center justify-between py-3 border-b-2 border-gray-300 dark:border-gray-600">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 uppercase text-sm">Operating Expenses</h3>
            </div>
            <div className="relative group flex justify-between py-2 pl-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded cursor-default">
              <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1">
                Operating Expenses
                <Info className="w-3 h-3 text-gray-400 dark:text-gray-500" />
              </span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                ({formatCurrency(summary.totalOpex)})
              </span>
              <Tooltip
                title="Operating Expenses (OPEX)"
                color="text-red-300"
                transactions={transactionsByCategory.opex}
              />
            </div>
            <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-semibold border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-800 dark:text-gray-100">Total Operating Expenses</span>
              <span className="text-red-600 dark:text-red-400">({formatCurrency(summary.totalOpex)})</span>
            </div>
          </div>

          {/* OPERATING INCOME */}
          <div className="relative group bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 hover:bg-purple-100/70 dark:hover:bg-purple-900/30 cursor-default">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-purple-900 dark:text-purple-100 text-lg flex items-center gap-1">
                  OPERATING INCOME
                  <Info className="w-3.5 h-3.5 text-purple-400 dark:text-purple-500" />
                </h3>
                <p className="text-sm text-purple-600 dark:text-purple-400">Margin: {metrics.operatingMargin.toFixed(2)}%</p>
              </div>
              <span className={`text-xl font-bold ${metrics.operatingIncome >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(metrics.operatingIncome)}
              </span>
            </div>
            <Tooltip
              title="Operating Income (EBIT)"
              color="text-purple-300"
              formula="Gross Profit − Operating Expenses"
              breakdown={[
                { label: 'Gross Profit', value: summary.grossProfit, color: summary.grossProfit >= 0 ? 'green' : 'red' },
                { label: 'Operating Expenses', value: summary.totalOpex, color: 'red' },
                { label: 'Operating Income', value: metrics.operatingIncome, color: metrics.operatingIncome >= 0 ? 'green' : 'red' },
              ]}
            />
          </div>

          {/* FINANCING COSTS */}
          <div>
            <div className="flex items-center justify-between py-3 border-b-2 border-gray-300 dark:border-gray-600">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 uppercase text-sm">Financing Costs</h3>
            </div>
            <div className="relative group flex justify-between py-2 pl-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded cursor-default">
              <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1">
                Interest & Financing Expenses
                <Info className="w-3 h-3 text-gray-400 dark:text-gray-500" />
              </span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                ({formatCurrency(summary.totalInterest)})
              </span>
              <Tooltip
                title="Interest & Financing Expenses (FIN)"
                color="text-pink-300"
                transactions={transactionsByCategory.interest}
              />
            </div>
          </div>

          {/* EBT */}
          <div className="relative group bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 hover:bg-blue-100/70 dark:hover:bg-blue-900/30 cursor-default">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-blue-900 dark:text-blue-100 text-lg flex items-center gap-1">
                EBT (Earnings Before Tax)
                <Info className="w-3.5 h-3.5 text-blue-400 dark:text-blue-500" />
              </h3>
              <span className={`text-xl font-bold ${metrics.ebt >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(metrics.ebt)}
              </span>
            </div>
            <Tooltip
              title="EBT (Earnings Before Tax)"
              color="text-blue-300"
              formula="Operating Income − Financing Costs"
              breakdown={[
                { label: 'Operating Income', value: metrics.operatingIncome, color: metrics.operatingIncome >= 0 ? 'green' : 'red' },
                { label: 'Financing Costs', value: summary.totalInterest, color: 'red' },
                { label: 'EBT', value: metrics.ebt, color: metrics.ebt >= 0 ? 'green' : 'red' },
              ]}
            />
          </div>

          {/* TAX */}
          <div>
            <div className="relative group flex justify-between py-2 pl-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded cursor-default">
              <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1">
                Tax
                <Info className="w-3 h-3 text-gray-400 dark:text-gray-500" />
              </span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                ({formatCurrency(summary.totalTax)})
              </span>
              <Tooltip
                title="Tax / Pajak (TAX)"
                color="text-purple-300"
                transactions={transactionsByCategory.tax}
              />
            </div>
          </div>

          {/* NET INCOME */}
          <div className={`relative group rounded-xl p-6 text-white cursor-default ${
            summary.netProfit >= 0
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
              : 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600'
          }`}>
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xl mb-1 flex items-center gap-1">
                  NET INCOME
                  <Info className="w-4 h-4 text-white/60" />
                </h3>
                <p className={`text-sm ${
                  summary.netProfit >= 0 ? 'text-green-100' : 'text-red-100'
                }`}>Net Margin: {metrics.netMargin.toFixed(2)}%</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  {summary.netProfit >= 0 ? (
                    <TrendingUp className="w-6 h-6" />
                  ) : (
                    <TrendingDown className="w-6 h-6" />
                  )}
                </div>
                <span className="text-3xl font-bold">
                  {formatCurrency(summary.netProfit)}
                </span>
              </div>
            </div>
            <div className="absolute left-4 bottom-full mb-2 z-50 hidden group-hover:block w-80 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none">
              <p className="font-semibold mb-2 text-green-300">Net Income / Laba Bersih</p>
              <p className="text-gray-400 mb-0.5">Formula:</p>
              <p className="text-white font-medium mb-2">Revenue − COGS − OpEx − Financing − Tax</p>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-300">Revenue (Earnings)</span>
                  <span className="text-green-300">{formatCurrency(summary.totalEarn)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Variable Costs (COGS)</span>
                  <span className="text-red-300">−{formatCurrency(summary.totalVar)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Operating Expenses</span>
                  <span className="text-red-300">−{formatCurrency(summary.totalOpex)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Financing Costs</span>
                  <span className="text-red-300">−{formatCurrency(summary.totalInterest)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Tax</span>
                  <span className="text-red-300">−{formatCurrency(summary.totalTax)}</span>
                </div>
                <div className="flex justify-between font-semibold text-white border-t border-gray-700 pt-1 mt-1">
                  <span>Net Income</span>
                  <span className={summary.netProfit >= 0 ? 'text-green-300' : 'text-red-300'}>{formatCurrency(summary.netProfit)}</span>
                </div>
              </div>
              <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="card bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <h4 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">Gross Margin</h4>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{metrics.grossMargin.toFixed(2)}%</p>
        </div>
        <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">Operating Margin</h4>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {metrics.operatingMargin.toFixed(2)}%
          </p>
        </div>
        <div className="card bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-300 mb-2">Net Margin</h4>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{metrics.netMargin.toFixed(2)}%</p>
        </div>
      </div>
    </div>
  );
}

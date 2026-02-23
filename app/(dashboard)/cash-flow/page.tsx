'use client';

import { useState } from 'react';
import { Calendar, TrendingUp, TrendingDown, Download, Wallet, FileText, FileSpreadsheet, ChevronDown, ChevronRight, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight } from 'lucide-react';
import { useCashFlow } from '@/hooks/useCashFlow';
import { formatCurrency } from '@/lib/utils';
import type { Period } from '@/hooks/useReportData';
import type { CashFlowTransaction } from '@/types';

function TransactionRow({ tx }: { tx: CashFlowTransaction }) {
  const isIn = tx.amount >= 0;
  return (
    <div className="flex items-start gap-3 py-2.5 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors">
      <div className="mt-0.5 flex-shrink-0">
        {isIn ? (
          <ArrowUpCircle className="w-4 h-4 text-green-500" />
        ) : (
          <ArrowDownCircle className="w-4 h-4 text-red-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{tx.name}</p>
            {tx.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{tx.description}</p>
            )}
            {(tx.debitAccount || tx.creditAccount) && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Dr: {tx.debitAccount ?? '-'} / Cr: {tx.creditAccount ?? '-'}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`text-sm font-semibold ${isIn ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {isIn ? '+' : ''}{formatCurrency(tx.amount)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ActivitySectionProps {
  title: string;
  subtitle: string;
  total: number;
  totalLabel: string;
  transactions: CashFlowTransaction[];
}

function ActivitySection({ title, subtitle, total, totalLabel, transactions }: ActivitySectionProps) {
  const [open, setOpen] = useState(false);
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div>
      <div className="flex items-center justify-between py-3 border-b-2 border-gray-300 dark:border-gray-600">
        <h3 className="font-bold text-gray-800 dark:text-gray-100 uppercase text-sm">{title}</h3>
      </div>
      <div className="flex justify-between py-3 pl-4">
        <span className="text-gray-700 dark:text-gray-300">
          {subtitle}
        </span>
        <span className={`font-semibold text-xl ${
          total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        }`}>
          {formatCurrency(total)}
        </span>
      </div>

      {/* Collapsible transactions */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
        >
          <span className="text-gray-600 dark:text-gray-400 font-medium">
            {transactions.length} transaksi
          </span>
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <span className="text-xs">{open ? 'Sembunyikan' : 'Lihat detail'}</span>
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </button>

        {open && (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {sorted.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                Tidak ada transaksi
              </p>
            ) : (
              sorted.map(tx => <TransactionRow key={tx.id} tx={tx} />)
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-semibold border-t border-gray-200 dark:border-gray-700 mt-1">
        <span className="text-gray-800 dark:text-gray-100">{totalLabel}</span>
        <span className={total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

export default function CashFlowPage() {
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
    cashFlow,
    handleExportPDF,
    handleExportExcel,
  } = useCashFlow();

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
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
          <ArrowLeftRight className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          Cash Flow Statement
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Laporan Arus Kas - {activeBusiness.business_name}
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

      {/* Cash Flow Statement */}
      <div className="card">
        <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            Cash Flow Statement
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Period: {new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - {new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <div className="space-y-6">
          {/* Opening Balance */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-blue-900 dark:text-blue-100 text-lg">Opening Balance</h3>
              </div>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(cashFlow.openingBalance)}
              </span>
            </div>
          </div>

          {/* CASH FLOW FROM OPERATING ACTIVITIES */}
          <ActivitySection
            title="Cash Flow from Operating Activities"
            subtitle="Net Cash from Operations"
            total={cashFlow.operating}
            totalLabel="Total Operating Cash Flow"
            transactions={cashFlow.operatingTransactions}
          />

          {/* CASH FLOW FROM INVESTING ACTIVITIES */}
          <ActivitySection
            title="Cash Flow from Investing Activities"
            subtitle="Capital Expenditure"
            total={cashFlow.investing}
            totalLabel="Total Investing Cash Flow"
            transactions={cashFlow.investingTransactions}
          />

          {/* CASH FLOW FROM FINANCING ACTIVITIES */}
          <ActivitySection
            title="Cash Flow from Financing Activities"
            subtitle="Finance/Interest & Loans"
            total={cashFlow.financing}
            totalLabel="Total Financing Cash Flow"
            transactions={cashFlow.financingTransactions}
          />

          {/* NET CASH FLOW */}
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xl mb-1">NET CASH FLOW</h3>
                <p className="text-purple-100 text-sm">
                  Operating + Investing + Financing
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  {cashFlow.netCashFlow >= 0 ? (
                    <TrendingUp className="w-6 h-6" />
                  ) : (
                    <TrendingDown className="w-6 h-6" />
                  )}
                </div>
                <span className="text-3xl font-bold">
                  {formatCurrency(cashFlow.netCashFlow)}
                </span>
              </div>
            </div>
          </div>

          {/* Closing Balance */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl p-6 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xl mb-1">CLOSING BALANCE</h3>
                <p className="text-indigo-100 text-sm">
                  Opening Balance + Net Cash Flow
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  <Wallet className="w-6 h-6" />
                </div>
                <span className="text-3xl font-bold">
                  {formatCurrency(cashFlow.closingBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown Summary */}
          <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 text-sm uppercase">
              Cash Flow Summary
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Beginning Cash Balance:</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {formatCurrency(cashFlow.openingBalance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400 pl-4">+ Operating Activities:</span>
                <span className={`font-medium ${cashFlow.operating >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(cashFlow.operating)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400 pl-4">+ Investing Activities:</span>
                <span className={`font-medium ${cashFlow.investing >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(cashFlow.investing)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400 pl-4">+ Financing Activities:</span>
                <span className={`font-medium ${cashFlow.financing >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(cashFlow.financing)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="font-semibold text-gray-800 dark:text-gray-200">Ending Cash Balance:</span>
                <span className="font-bold text-lg text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(cashFlow.closingBalance)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className={`card ${
          cashFlow.operating >= 0
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <h4 className={`text-sm font-semibold mb-2 ${
            cashFlow.operating >= 0
              ? 'text-green-800 dark:text-green-300'
              : 'text-red-800 dark:text-red-300'
          }`}>
            Operating
          </h4>
          <p className={`text-2xl font-bold ${
            cashFlow.operating >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {formatCurrency(cashFlow.operating)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {cashFlow.operatingTransactions.length} transaksi
          </p>
        </div>
        <div className={`card ${
          cashFlow.investing >= 0
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <h4 className={`text-sm font-semibold mb-2 ${
            cashFlow.investing >= 0
              ? 'text-green-800 dark:text-green-300'
              : 'text-red-800 dark:text-red-300'
          }`}>
            Investing
          </h4>
          <p className={`text-2xl font-bold ${
            cashFlow.investing >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {formatCurrency(cashFlow.investing)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {cashFlow.investingTransactions.length} transaksi
          </p>
        </div>
        <div className={`card ${
          cashFlow.financing >= 0
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <h4 className={`text-sm font-semibold mb-2 ${
            cashFlow.financing >= 0
              ? 'text-green-800 dark:text-green-300'
              : 'text-red-800 dark:text-red-300'
          }`}>
            Financing
          </h4>
          <p className={`text-2xl font-bold ${
            cashFlow.financing >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {formatCurrency(cashFlow.financing)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {cashFlow.financingTransactions.length} transaksi
          </p>
        </div>
      </div>
    </div>
  );
}

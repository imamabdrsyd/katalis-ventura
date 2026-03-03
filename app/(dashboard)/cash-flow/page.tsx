'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, TrendingUp, TrendingDown, Download, Wallet, FileText, FileSpreadsheet, ChevronDown, ChevronRight, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Info, ExternalLink } from 'lucide-react';
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
            <p className={`text-sm font-semibold ${isIn ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
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
  transactionLink?: string;
}

function ActivitySection({ title, subtitle, total, totalLabel, transactions, transactionLink }: ActivitySectionProps) {
  const [open, setOpen] = useState(false);
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div>
      <div className="flex items-center justify-between py-3 border-b-2 border-gray-300 dark:border-gray-600">
        <h3 className="font-bold text-gray-800 dark:text-gray-100 uppercase text-sm">{title}</h3>
      </div>

      {/* Collapsible transactions */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mt-3">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
        >
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
            <span className="text-gray-800 dark:text-gray-200 font-medium">{subtitle}</span>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">{transactions.length} transaksi</span>
        </button>

        {open && (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-[400px] overflow-y-auto">
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
        {transactionLink ? (
          <Link
            href={transactionLink}
            className={`flex items-center gap-1 hover:underline underline-offset-2 ${total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
          >
            {formatCurrency(total)}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </Link>
        ) : (
          <span className={total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
            {formatCurrency(total)}
          </span>
        )}
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

  // Pre-compute safe date labels and URLs — guard against invalid dates
  const safeFormat = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const startDateLabel = safeFormat(startDate);
  const endDateLabel = safeFormat(endDate);

  const openingBalanceLink = (() => {
    if (!startDate) return '/transactions';
    const d = new Date(startDate);
    if (isNaN(d.getTime())) return '/transactions';
    d.setDate(d.getDate() - 1);
    return `/transactions?end=${d.toISOString().split('T')[0]}&highlight=equity`;
  })();

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
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
          <ArrowLeftRight className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
          Cash Flow Statement
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Laporan Arus Kas - {activeBusiness.business_name}
        </p>
      </div>

      {/* Side-by-side layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT COLUMN — Filters + Summary */}
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 space-y-6">
          {/* Filters */}
          <div className="card-static">
            <div className="space-y-4">
              {/* Period Selector */}
              <div>
                <label className="label">Periode</label>
                <div className="flex flex-wrap gap-2">
                  {(['month', 'quarter', 'year', 'custom'] as Period[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => handlePeriodChange(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        period === p
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {p === 'month' ? 'Bulan Ini' : p === 'quarter' ? 'Kuartal' : p === 'year' ? 'Tahun Ini' : 'Custom'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label flex items-center gap-1.5 text-xs">
                    <Calendar className="w-3.5 h-3.5" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setPeriod('custom');
                    }}
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="label text-xs">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPeriod('custom');
                    }}
                    className="input text-sm"
                  />
                </div>
              </div>

              {/* Export Button */}
              <div className="relative" ref={exportButtonRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="btn-secondary flex items-center gap-2 w-full justify-center"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>

                {showExportMenu && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-10">
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

          {/* Summary */}
          <div className="card-static space-y-4">
            <h4 className="font-semibold text-gray-700 dark:text-gray-300 text-sm uppercase">
              Cash Flow Summary
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Beginning Cash Balance:</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {formatCurrency(cashFlow.openingBalance)}
                </span>
              </div>
              {[
                { label: 'Operating', value: cashFlow.operating, count: cashFlow.operatingTransactions.length },
                { label: 'Investing', value: cashFlow.investing, count: cashFlow.investingTransactions.length },
                { label: 'Financing', value: cashFlow.financing, count: cashFlow.financingTransactions.length },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center pl-2">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">+ {item.label}:</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">({item.count} tx)</span>
                  </div>
                  <span className={`font-medium ${item.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                    {formatCurrency(item.value)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="font-semibold text-gray-800 dark:text-gray-200">Ending Cash:</span>
                <span className="font-bold text-gray-800 dark:text-gray-100">
                  {formatCurrency(cashFlow.closingBalance)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — Main Content */}
        <div className="flex-1 min-w-0">
          <div className="card-static">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                Cash Flow Statement
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Period: {startDateLabel} - {endDateLabel}
              </p>
            </div>

            <div className="space-y-6">
              {/* Opening Balance */}
              <div className="relative group bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 cursor-default">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-bold text-blue-900 dark:text-blue-100 text-lg flex items-center gap-1">
                      Opening Balance
                      <Info className="w-3.5 h-3.5 text-blue-400 dark:text-blue-500" />
                    </h3>
                  </div>
                  <Link
                    href={openingBalanceLink}
                    className="text-2xl font-bold text-blue-600 dark:text-blue-400 hover:underline underline-offset-2 flex items-center gap-1.5"
                  >
                    {formatCurrency(cashFlow.openingBalance)}
                    <ExternalLink className="w-4 h-4 opacity-60" />
                  </Link>
                </div>
                {/* Tooltip */}
                <div className="absolute left-0 right-0 sm:left-4 sm:right-auto bottom-full mb-2 z-50 hidden group-hover:block max-w-[calc(100vw-2rem)] sm:w-96 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none">
                  <p className="font-semibold mb-2 text-blue-300">Opening Balance — Cara Hitung</p>
                  <p className="text-gray-300 mb-3 leading-relaxed">
                    Saldo kas pada awal periode, dihitung dari transaksi double-entry sebelum <span className="text-blue-300 font-medium">{startDateLabel}</span>. Klik nominal untuk melihat transaksinya.
                  </p>
                  <div className="space-y-2 text-[11px] border-t border-gray-700 pt-2">
                    <p className="text-gray-400 font-semibold uppercase tracking-wide">Transaksi yang dihitung:</p>
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <span className="text-green-400 flex-shrink-0">+</span>
                        <span className="text-gray-300"><span className="text-white font-medium">Injeksi modal</span> — Dr Kas (1100/1200) / Cr Ekuitas (3xxx)</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-red-400 flex-shrink-0">−</span>
                        <span className="text-gray-300"><span className="text-white font-medium">Prive / penarikan</span> — Dr Ekuitas (3xxx) / Cr Kas (1100/1200)</span>
                      </div>
                    </div>
                    <div className="border-t border-gray-700 pt-2 text-gray-400 leading-relaxed">
                      Jika belum ada transaksi ekuitas sama sekali, nilai fallback ke <span className="text-yellow-300 font-medium">Modal Awal Bisnis</span> yang diisi saat setup bisnis.
                    </div>
                  </div>
                  <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              </div>

              {/* CASH FLOW FROM OPERATING ACTIVITIES */}
              <ActivitySection
                title="Cash Flow from Operating Activities"
                subtitle="Net Cash from Operations"
                total={cashFlow.operating}
                totalLabel="Total Operating Cash Flow"
                transactions={cashFlow.operatingTransactions}
                transactionLink={`/transactions?start=${startDate}&end=${endDate}&category=EARN`}
              />

              {/* CASH FLOW FROM INVESTING ACTIVITIES */}
              <ActivitySection
                title="Cash Flow from Investing Activities"
                subtitle="Capital Expenditure"
                total={cashFlow.investing}
                totalLabel="Total Investing Cash Flow"
                transactions={cashFlow.investingTransactions}
                transactionLink={`/transactions?start=${startDate}&end=${endDate}&category=CAPEX`}
              />

              {/* CASH FLOW FROM FINANCING ACTIVITIES */}
              <ActivitySection
                title="Cash Flow from Financing Activities"
                subtitle="Finance/Interest & Loans"
                total={cashFlow.financing}
                totalLabel="Total Financing Cash Flow"
                transactions={cashFlow.financingTransactions}
                transactionLink={`/transactions?start=${startDate}&end=${endDate}&category=FIN`}
              />

              {/* NET CASH FLOW */}
              <div className={`bg-white dark:bg-gray-800 rounded-xl p-6 border-2 ${cashFlow.netCashFlow >= 0 ? 'border-green-400 dark:border-green-500' : 'border-red-400 dark:border-red-500'}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className={`font-bold text-xl mb-1 ${cashFlow.netCashFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>NET CASH FLOW</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      Operating + Investing + Financing
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`flex items-center gap-2 justify-end mb-1 ${cashFlow.netCashFlow >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {cashFlow.netCashFlow >= 0 ? (
                        <TrendingUp className="w-6 h-6" />
                      ) : (
                        <TrendingDown className="w-6 h-6" />
                      )}
                    </div>
                    <span className={`text-3xl font-bold ${cashFlow.netCashFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {formatCurrency(cashFlow.netCashFlow)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Closing Balance */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-xl mb-1 text-blue-900 dark:text-blue-100">CLOSING BALANCE</h3>
                    <p className="text-blue-500 dark:text-blue-400 text-sm">
                      Opening Balance + Net Cash Flow
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 justify-end mb-1 text-blue-600 dark:text-blue-400">
                      <Wallet className="w-6 h-6" />
                    </div>
                    <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(cashFlow.closingBalance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

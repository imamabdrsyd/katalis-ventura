'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Wallet, ChevronRight, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Info, ExternalLink, Building2 } from 'lucide-react';
import { useCashFlow } from '@/hooks/useCashFlow';
import { useLanguage } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/utils';
import type { CashFlowTransaction, Transaction } from '@/types';
import { TransactionDetailModal } from '@/components/transactions/TransactionDetailModal';
import { PeriodFilterCard } from '@/components/reports/PeriodFilterCard';

function formatTransactionCount(count: number, locale: string): string {
  if (locale === 'id') return `${count} transaksi`;
  return `${count} ${count === 1 ? 'transaction' : 'transactions'}`;
}

function TransactionRow({ tx, onClick }: { tx: CashFlowTransaction; onClick: (tx: CashFlowTransaction) => void }) {
  const isIn = tx.amount >= 0;
  return (
    <div onClick={() => onClick(tx)} className="flex items-start gap-3 py-2.5 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
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
            {tx.amount < 0 && tx.description ? (
              <>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{tx.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{tx.name}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{tx.name}</p>
                {tx.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{tx.description}</p>
                )}
              </>
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
  onTransactionClick: (tx: CashFlowTransaction) => void;
  transactionCountLabel: string;
}

function ActivitySection({ title, subtitle, total, totalLabel, transactions, transactionLink, onTransactionClick, transactionCountLabel }: ActivitySectionProps) {
  const [open, setOpen] = useState(false);
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalColor = total === 0
    ? 'text-gray-500 dark:text-gray-400'
    : total > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-500 dark:text-red-400';

  return (
    <section>
      {/* Section header — same pattern as income statement */}
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700/60">
        <span className="w-1 h-3.5 rounded-full bg-gray-400 dark:bg-gray-500" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
          {title}
        </h3>
      </div>

      {/* Collapsible row */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-2 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-md transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ChevronRight className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
          <span className="text-sm text-gray-700 dark:text-gray-200">{subtitle}</span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">· {transactionCountLabel}</span>
        </div>
        <span className={`text-sm font-medium tabular-nums flex-shrink-0 ml-3 ${totalColor}`}>
          {formatCurrency(total)}
        </span>
      </button>

      {open && (
        <div className="ml-6 my-1 border-l-2 border-gray-100 dark:border-gray-700 max-h-[400px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/60">
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Tidak ada transaksi</p>
          ) : (
            sorted.map(tx => <TransactionRow key={tx.id} tx={tx} onClick={onTransactionClick} />)
          )}
        </div>
      )}

      {/* Subtotal row — no bg, just border-top */}
      <div className="flex justify-between items-center px-2 py-3 mt-1 border-t border-gray-200 dark:border-gray-700/60">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{totalLabel}</span>
        {transactionLink ? (
          <Link
            href={transactionLink}
            className={`flex items-center gap-1 text-sm font-semibold tabular-nums hover:underline underline-offset-2 ${totalColor}`}
          >
            {formatCurrency(total)}
            <ExternalLink className="w-3 h-3 opacity-50" />
          </Link>
        ) : (
          <span className={`text-sm font-semibold tabular-nums ${totalColor}`}>
            {formatCurrency(total)}
          </span>
        )}
      </div>
    </section>
  );
}

function CashFlowPageInner() {
  const {
    activeBusiness,
    transactions,
    loading,
    period,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    handlePeriodChange,
    cashFlow,
    handleExportPDF,
    handleExportExcel,
  } = useCashFlow();

  const { locale, t } = useLanguage();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const handleTransactionClick = (tx: CashFlowTransaction) => {
    const full = transactions.find(t => t.id === tx.id) ?? null;
    setSelectedTransaction(full);
  };

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
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">({formatTransactionCount(item.count, locale)})</span>
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
            <div className="flex items-center justify-between pb-5 mb-6 border-b border-gray-200 dark:border-gray-700/60">
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  Cash Flow Statement
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                  {startDateLabel} — {endDateLabel}
                </p>
              </div>
            </div>

            <div className="space-y-8">
              {/* Opening Balance */}
              <div className="relative group rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 px-5 py-4 cursor-default">
                <div className="flex justify-between items-center gap-4">
                  <div className="flex items-baseline gap-2">
                    <Wallet className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mb-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200 flex items-center gap-1">
                        Opening Balance
                        <Info className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Saldo kas awal periode</p>
                    </div>
                  </div>
                  <Link
                    href={openingBalanceLink}
                    className="text-2xl font-bold tabular-nums text-gray-800 dark:text-gray-100 hover:underline underline-offset-2 flex items-center gap-1.5 flex-shrink-0"
                  >
                    {formatCurrency(cashFlow.openingBalance)}
                    <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                  </Link>
                </div>
                {/* Tooltip */}
                <div className="absolute left-0 right-0 sm:left-4 sm:right-auto bottom-full mb-2 z-50 hidden group-hover:block max-w-[calc(100vw-2rem)] sm:w-96 bg-gray-900 dark:bg-gray-950 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none ring-1 ring-white/10">
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
                  <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-950"></div>
                </div>
              </div>

              {/* Activity sections */}
              <ActivitySection
                title="Cash Flow from Operating Activities"
                subtitle="Net Cash from Operations"
                total={cashFlow.operating}
                totalLabel="Total Operating Cash Flow"
                transactions={cashFlow.operatingTransactions}
                transactionLink={`/transactions?start=${startDate}&end=${endDate}&category=EARN`}
                onTransactionClick={handleTransactionClick}
                transactionCountLabel={formatTransactionCount(cashFlow.operatingTransactions.length, locale)}
              />

              <ActivitySection
                title="Cash Flow from Investing Activities"
                subtitle="Capital Expenditure"
                total={cashFlow.investing}
                totalLabel="Total Investing Cash Flow"
                transactions={cashFlow.investingTransactions}
                transactionLink={`/transactions?start=${startDate}&end=${endDate}&category=CAPEX`}
                onTransactionClick={handleTransactionClick}
                transactionCountLabel={formatTransactionCount(cashFlow.investingTransactions.length, locale)}
              />

              <ActivitySection
                title="Cash Flow from Financing Activities"
                subtitle="Finance/Interest & Loans"
                total={cashFlow.financing}
                totalLabel="Total Financing Cash Flow"
                transactions={cashFlow.financingTransactions}
                transactionLink={`/transactions?start=${startDate}&end=${endDate}&category=FIN`}
                onTransactionClick={handleTransactionClick}
                transactionCountLabel={formatTransactionCount(cashFlow.financingTransactions.length, locale)}
              />

              {/* NET CASH FLOW — Hero */}
              <div className={`relative rounded-2xl p-6 text-white bg-gradient-to-br shadow-lg mt-4 ${
                cashFlow.netCashFlow >= 0
                  ? 'from-emerald-500 via-emerald-500 to-teal-500 shadow-emerald-500/10'
                  : 'from-red-500 via-red-500 to-rose-500 shadow-red-500/10'
              }`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative flex justify-between items-center gap-4">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/80 mb-1">Net Cash Flow</h3>
                    <p className={`text-sm ${cashFlow.netCashFlow >= 0 ? 'text-emerald-50' : 'text-red-50'}`}>
                      Operating + Investing + Financing
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {cashFlow.netCashFlow >= 0
                      ? <TrendingUp className="w-7 h-7 text-white/80" strokeWidth={2.5} />
                      : <TrendingDown className="w-7 h-7 text-white/80" strokeWidth={2.5} />
                    }
                    <span className="text-3xl font-bold tabular-nums">
                      {formatCurrency(cashFlow.netCashFlow)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Closing Balance */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 px-5 py-4">
                <div className="flex justify-between items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                        Closing Balance
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Opening Balance + Net Cash Flow</p>
                  </div>
                  <span className="text-2xl font-bold tabular-nums text-gray-800 dark:text-gray-100 flex-shrink-0">
                    {formatCurrency(cashFlow.closingBalance)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TransactionDetailModal
        transaction={selectedTransaction}
        isOpen={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </div>
  );
}

export default function CashFlowPage() {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center min-h-[50vh]"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <CashFlowPageInner />
    </Suspense>
  );
}

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpenCheck, AlertCircle, FileText, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useGeneralLedger, type AccountTypeFilter } from '@/hooks/useGeneralLedger';
import { useLanguage } from '@/context/LanguageContext';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import type { Period } from '@/hooks/useReportData';
import type { AccountType, Transaction } from '@/types';
import { TransactionDetailModal } from '@/components/transactions/TransactionDetailModal';

// Account type labels are now dynamic via useLanguage - see component body

const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  ASSET: 'text-blue-600 dark:text-blue-400',
  LIABILITY: 'text-amber-500 dark:text-amber-400',
  EQUITY: 'text-purple-500 dark:text-purple-400',
  REVENUE: 'text-green-600 dark:text-green-400',
  EXPENSE: 'text-red-500 dark:text-red-400',
};

const ACCOUNT_TYPE_BG: Record<AccountType, string> = {
  ASSET: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  LIABILITY: 'bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-300',
  EQUITY: 'bg-purple-50 dark:bg-purple-900/20 text-purple-500 dark:text-purple-300',
  REVENUE: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  EXPENSE: 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-300',
};

function GeneralLedgerPageInner() {
  const {
    activeBusiness,
    loading,
    accountsLoading,
    period,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    setPeriod,
    handlePeriodChange,
    accounts,
    selectedAccountId,
    setSelectedAccountId,
    filterType,
    setFilterType,
    selectedAccount,
    ledger,
    allLedgers,
    filteredTransactions,
  } = useGeneralLedger();

  const { t } = useLanguage();
  const [viewTransaction, setViewTransaction] = useState<Transaction | null>(null);
  const [legacyNoticeDismissed, setLegacyNoticeDismissed] = useState(false);
  const [legacyExpanded, setLegacyExpanded] = useState(false);

  const legacyTransactions = filteredTransactions.filter((t) => !t.is_double_entry && !t.is_multi_line);

  const ACCOUNT_TYPE_LABELS: Record<AccountTypeFilter, string> = {
    ALL: t.generalLedger.allTypes,
    ASSET: t.generalLedger.asset,
    LIABILITY: t.generalLedger.liability,
    EQUITY: t.generalLedger.equityLabel,
    REVENUE: t.generalLedger.revenueLabel,
    EXPENSE: t.generalLedger.expense,
  };

  const PERIOD_LABELS: Record<Period, string> = {
    month: t.generalLedger.thisMonth,
    quarter: t.generalLedger.thisQuarter,
    year: t.generalLedger.thisYear,
    custom: t.generalLedger.custom,
  };

  // Reset legacy notice when switching accounts
  useEffect(() => {
    setLegacyNoticeDismissed(false);
    setLegacyExpanded(false);
  }, [selectedAccountId]);

  // "All Time" = custom period with no date bounds
  const isAllTime = period === 'custom' && !startDate && !endDate;

  const handleAllTime = () => {
    setPeriod('custom');
    setStartDate('');
    setEndDate('');
  };

  // Default to All Time on mount
  useEffect(() => {
    handleAllTime();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read filterType from URL search params (e.g., /general-ledger?filterType=ASSET)
  const searchParams = useSearchParams();
  useEffect(() => {
    const type = searchParams.get('filterType');
    const validTypes: AccountTypeFilter[] = ['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
    if (type && validTypes.includes(type as AccountTypeFilter)) {
      setFilterType(type as AccountTypeFilter);
    }
  }, [searchParams, setFilterType]);

  if (!activeBusiness && !loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="card-static text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            Pilih bisnis terlebih dahulu untuk melihat General Ledger.
          </p>
        </div>
      </div>
    );
  }

  const allFilterTypes: AccountTypeFilter[] = [
    'ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE',
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
          <BookOpenCheck className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
          {t.generalLedger.title}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t.generalLedger.subtitle}
        </p>
      </div>

      {/* Period Filter */}
      <div className="card-static mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {t.period.period}
            </label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleAllTime}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isAllTime
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t.generalLedger.allTime}
              </button>
              {(['month', 'quarter', 'year', 'custom'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    period === p && !isAllTime
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {period === 'custom' && (
            <div className="flex gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Dari</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sampai</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Two-Panel Layout */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* LEFT PANEL: Account List */}
        <div className="lg:w-72 xl:w-80 flex-shrink-0">
          <div className="card-static p-0 overflow-hidden">
            {/* Account Type Filter Tabs */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-1">
                {allFilterTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      filterType === type
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {ACCOUNT_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            {/* Account List */}
            <div className="overflow-y-auto max-h-[600px]">
              {loading || accountsLoading ? (
                <div className="p-6 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mx-auto"></div>
                </div>
              ) : allLedgers.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  {t.generalLedger.noAccountsFound}
                </div>
              ) : (
                allLedgers.map((al) => {
                  const isSelected = selectedAccountId === al.account.id;
                  const isPositive = al.closingBalance >= 0;
                  return (
                    <button
                      key={al.account.id}
                      onClick={() => setSelectedAccountId(al.account.id)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 transition-colors ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 border-l-2 border-l-indigo-500'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                              {al.account.account_code}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ACCOUNT_TYPE_BG[al.account.account_type]}`}>
                              {ACCOUNT_TYPE_LABELS[al.account.account_type]}
                            </span>
                          </div>
                          <p className={`text-sm font-medium truncate ${
                            isSelected
                              ? 'text-indigo-500 dark:text-indigo-300'
                              : 'text-gray-800 dark:text-gray-200'
                          }`}>
                            {al.account.account_name}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-xs font-semibold ${
                            isPositive
                              ? 'text-gray-700 dark:text-gray-300'
                              : 'text-red-500 dark:text-red-400'
                          }`}>
                            {isPositive ? '' : '('}
                            {formatCurrency(Math.abs(al.closingBalance))}
                            {isPositive ? '' : ')'}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {al.entries.length} entri
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Ledger Detail */}
        <div className="flex-1 min-w-0">
          {!selectedAccount || !ledger ? (
            <div className="card-static flex flex-col items-center justify-center py-16 text-center">
              <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {t.generalLedger.selectAccountHint}
              </p>
            </div>
          ) : (
            <div className="card-static p-0 overflow-hidden">
              {/* Ledger Header */}
              <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-gray-400 dark:text-gray-500">
                        {selectedAccount.account_code}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACCOUNT_TYPE_BG[selectedAccount.account_type]}`}>
                        {ACCOUNT_TYPE_LABELS[selectedAccount.account_type]}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium">
                        Normal: {selectedAccount.normal_balance}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {selectedAccount.account_name}
                    </h2>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {isAllTime
                        ? `As of ${formatDateShort(new Date().toISOString().slice(0, 10))}`
                        : `Periode: ${startDate ? formatDateShort(startDate) : '—'} — ${endDate ? formatDateShort(endDate) : '—'}`
                      }
                    </p>
                  </div>

                  {/* Summary Cards */}
                  <div className="flex gap-3">
                    <div className="text-center px-3 py-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t.generalLedger.totalDebit}</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(ledger.totalDebits)}
                      </p>
                    </div>
                    <div className="text-center px-3 py-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t.generalLedger.totalCredit}</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(ledger.totalCredits)}
                      </p>
                    </div>
                    <div className="text-center px-3 py-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t.generalLedger.closingBalance}</p>
                      <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        {ledger.closingBalance < 0 ? '(' : ''}
                        {formatCurrency(Math.abs(ledger.closingBalance))}
                        {ledger.closingBalance < 0 ? ')' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legacy Transactions Notice */}
              {ledger.legacyCount > 0 && !legacyNoticeDismissed && (
                <div className="mx-4 md:mx-6 mt-4 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex-1">
                      <strong>{ledger.legacyCount} transaksi lama</strong> tidak ditampilkan di sini karena tidak menggunakan sistem double-entry. Transaksi tersebut tetap dihitung di laporan keuangan.{' '}
                      {legacyTransactions.length > 0 && (
                        <button
                          onClick={() => setLegacyExpanded(!legacyExpanded)}
                          className="inline-flex items-center gap-0.5 text-indigo-500 dark:text-indigo-400 hover:underline font-medium"
                        >
                          {legacyExpanded ? 'Sembunyikan' : 'Lihat transaksi'}
                          {legacyExpanded
                            ? <ChevronDown className="w-3 h-3" />
                            : <ChevronRight className="w-3 h-3" />}
                        </button>
                      )}
                    </p>
                    <button
                      onClick={() => setLegacyNoticeDismissed(true)}
                      className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {legacyExpanded && legacyTransactions.length > 0 && (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-[240px] overflow-y-auto">
                      {legacyTransactions.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setViewTransaction(t)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{t.name || t.description}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{t.description || t.account}</p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatCurrency(t.amount)}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{formatDateShort(t.date)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Ledger Table */}
              <div className="p-4 md:p-6 pt-4">
                {ledger.entries.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      Tidak ada transaksi untuk akun ini pada periode yang dipilih
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <table className="w-full min-w-[640px]">
                      <thead>
                        <tr className="border-b-2 border-gray-200 dark:border-gray-600">
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                            Tanggal
                          </th>
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Keterangan
                          </th>
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t.generalLedger.counterAccount}
                          </th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                            Debit
                          </th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                            Kredit
                          </th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">
                            Saldo
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {/* Opening Balance Row */}
                        <tr className="bg-gray-50 dark:bg-gray-800/50">
                          <td className="py-2 px-3 text-xs text-gray-400 dark:text-gray-500" colSpan={5}>
                            {t.generalLedger.openingBalance}
                          </td>
                          <td className="py-2 px-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                            {formatCurrency(0)}
                          </td>
                        </tr>

                        {ledger.entries.map((entry, idx) => (
                          <tr
                            key={entry.transactionId + idx}
                            onClick={() => {
                              const tx = filteredTransactions.find((t) => t.id === entry.transactionId);
                              if (tx) setViewTransaction(tx);
                            }}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                          >
                            <td className="py-2.5 px-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {formatDateShort(entry.date)}
                            </td>
                            <td className="py-2.5 px-3 text-sm text-gray-800 dark:text-gray-200 max-w-[200px]">
                              <p className="truncate font-medium">{entry.description}</p>
                            </td>
                            <td className="py-2.5 px-3 text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                                  {entry.counterAccountCode}
                                </span>
                                <span className="truncate max-w-[100px]">{entry.counterAccountName}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right text-sm font-medium">
                              {entry.debitAmount > 0 ? (
                                <span className="text-gray-800 dark:text-gray-200">
                                  {formatCurrency(entry.debitAmount)}
                                </span>
                              ) : (
                                <span className="text-gray-300 dark:text-gray-600">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right text-sm font-medium">
                              {entry.creditAmount > 0 ? (
                                <span className="text-gray-800 dark:text-gray-200">
                                  {formatCurrency(entry.creditAmount)}
                                </span>
                              ) : (
                                <span className="text-gray-300 dark:text-gray-600">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right text-sm font-semibold">
                              <span className={entry.balance >= 0 ? 'text-gray-800 dark:text-gray-200' : 'text-red-500 dark:text-red-400'}>
                                {entry.balance < 0 ? '(' : ''}
                                {formatCurrency(Math.abs(entry.balance))}
                                {entry.balance < 0 ? ')' : ''}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      {/* Footer: Totals */}
                      <tfoot>
                        <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
                          <td colSpan={3} className="py-3 px-3 text-sm font-bold text-gray-700 dark:text-gray-300">
                            TOTAL
                          </td>
                          <td className="py-3 px-3 text-right text-sm font-bold text-gray-900 dark:text-gray-100">
                            {formatCurrency(ledger.totalDebits)}
                          </td>
                          <td className="py-3 px-3 text-right text-sm font-bold text-gray-900 dark:text-gray-100">
                            {formatCurrency(ledger.totalCredits)}
                          </td>
                          <td className="py-3 px-3 text-right text-sm font-bold">
                            <span className={ledger.closingBalance >= 0 ? 'text-gray-800 dark:text-gray-200' : 'text-red-500 dark:text-red-400'}>
                              {ledger.closingBalance < 0 ? '(' : ''}
                              {formatCurrency(Math.abs(ledger.closingBalance))}
                              {ledger.closingBalance < 0 ? ')' : ''}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {viewTransaction && (
        <TransactionDetailModal
          isOpen={true}
          onClose={() => setViewTransaction(null)}
          transaction={viewTransaction}
          accounts={accounts}
          allTransactions={filteredTransactions}
          onShowRelatedTransaction={setViewTransaction}
        />
      )}
    </div>
  );
}


export default function GeneralLedgerPage() {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center min-h-[50vh]"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <GeneralLedgerPageInner />
    </Suspense>
  );
}

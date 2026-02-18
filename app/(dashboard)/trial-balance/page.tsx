'use client';

import React from 'react';
import { ClipboardCheck, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { useTrialBalance } from '@/hooks/useTrialBalance';
import { formatCurrency } from '@/lib/utils';
import type { Period } from '@/hooks/useReportData';
import type { AccountType } from '@/types';

const ACCOUNT_TYPE_BG: Record<AccountType, string> = {
  ASSET: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  LIABILITY: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  EQUITY: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
  REVENUE: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  EXPENSE: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
};

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Aset',
  LIABILITY: 'Liabilitas',
  EQUITY: 'Ekuitas',
  REVENUE: 'Pendapatan',
  EXPENSE: 'Beban',
};

const PERIOD_LABELS: Record<Period, string> = {
  month: 'Bulan Ini',
  quarter: 'Kuartal Ini',
  year: 'Tahun Ini',
  custom: 'Kustom',
};

export default function TrialBalancePage() {
  const {
    activeBusiness,
    loading,
    accountsLoading,
    period,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    handlePeriodChange,
    trialBalance,
  } = useTrialBalance();

  if (loading || accountsLoading) {
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
        <div className="text-center">
          <ClipboardCheck className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Pilih bisnis untuk melihat Trial Balance</p>
        </div>
      </div>
    );
  }

  // Group rows by account type for visual separation
  const groupedRows: { type: AccountType; label: string; rows: typeof trialBalance.rows }[] = [];
  const typeOrder: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

  for (const type of typeOrder) {
    const rows = trialBalance.rows.filter((r) => r.account.account_type === type);
    if (rows.length > 0) {
      groupedRows.push({ type, label: ACCOUNT_TYPE_LABELS[type], rows });
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
          <ClipboardCheck className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          Trial Balance
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Neraca Saldo — {activeBusiness.business_name}
        </p>
      </div>

      {/* Period Filter */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Periode
            </label>
            <div className="flex gap-2 flex-wrap">
              {(['month', 'quarter', 'year', 'custom'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    period === p
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
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
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Dari
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Sampai
                </label>
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

      {/* Trial Balance Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b-2 border-gray-200 dark:border-gray-600">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                  Kode
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Nama Akun
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider w-36">
                  Debit
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider w-36">
                  Kredit
                </th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                    Tidak ada transaksi pada periode ini
                  </td>
                </tr>
              ) : (
                groupedRows.map((group) => (
                  <React.Fragment key={group.type}>
                    {/* Group Header */}
                    <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                      <td colSpan={4} className="py-2 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${ACCOUNT_TYPE_BG[group.type]}`}>
                          {group.label}
                        </span>
                      </td>
                    </tr>
                    {/* Account Rows */}
                    {group.rows.map((row) => (
                      <tr
                        key={row.account.id}
                        className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <td className="py-2.5 px-4 text-sm font-mono text-gray-400 dark:text-gray-500">
                          {row.account.account_code}
                        </td>
                        <td className="py-2.5 px-4 text-sm text-gray-800 dark:text-gray-200 font-medium">
                          {row.account.account_name}
                        </td>
                        <td className="py-2.5 px-4 text-right text-sm font-medium">
                          {row.debitBalance > 0 ? (
                            <span className="text-blue-600 dark:text-blue-400">
                              {formatCurrency(row.debitBalance)}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">&mdash;</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right text-sm font-medium">
                          {row.creditBalance > 0 ? (
                            <span className="text-red-600 dark:text-red-400">
                              {formatCurrency(row.creditBalance)}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">&mdash;</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>

            {/* Footer: Totals */}
            {trialBalance.rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
                  <td colSpan={2} className="py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300">
                    TOTAL
                  </td>
                  <td className="py-3 px-4 text-right text-sm font-bold text-blue-700 dark:text-blue-300">
                    {formatCurrency(trialBalance.totalDebits)}
                  </td>
                  <td className="py-3 px-4 text-right text-sm font-bold text-red-700 dark:text-red-300">
                    {formatCurrency(trialBalance.totalCredits)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Balance Check */}
      {trialBalance.rows.length > 0 && (
        <div className={`card mt-4 ${
          trialBalance.isBalanced
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-3">
            {trialBalance.isBalanced ? (
              <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className={`font-semibold ${
                trialBalance.isBalanced
                  ? 'text-emerald-900 dark:text-emerald-100'
                  : 'text-red-900 dark:text-red-100'
              }`}>
                {trialBalance.isBalanced ? '\u2713 Neraca Saldo Seimbang' : '\u26A0\uFE0F Neraca Saldo Tidak Seimbang'}
              </p>
              <p className={`text-sm mt-1 ${
                trialBalance.isBalanced
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-red-700 dark:text-red-300'
              }`}>
                Total Debit ({formatCurrency(trialBalance.totalDebits)})
                {trialBalance.isBalanced ? ' = ' : ' \u2260 '}
                Total Kredit ({formatCurrency(trialBalance.totalCredits)})
                {!trialBalance.isBalanced && (
                  <span className="ml-2 font-semibold">
                    | Selisih: {formatCurrency(trialBalance.difference)}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

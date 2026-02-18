'use client';

import { Calendar, Scale, Download, FileText, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { useBalanceSheet } from '@/hooks/useBalanceSheet';
import { formatCurrency } from '@/lib/utils';
import type { Period } from '@/hooks/useReportData';

export default function BalanceSheetPage() {
  const {
    activeBusiness,
    loading,
    period,
    startDate,
    endDate,
    showExportMenu,
    exportButtonRef,
    setStartDate,
    setEndDate,
    setShowExportMenu,
    handlePeriodChange,
    balanceSheet,
    isBalanced,
    handleExportPDF,
    handleExportExcel,
  } = useBalanceSheet();

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
        <div className="text-center">
          <Scale className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Pilih bisnis untuk melihat neraca</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
          <Scale className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          Balance Sheet
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Neraca Keuangan - {activeBusiness?.business_name}
        </p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
          {/* Period Selector */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Periode</label>
            <div className="flex gap-2 flex-wrap">
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

          {/* Date Range (when custom is selected) */}
          {period === 'custom' && (
            <div className="flex gap-3 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Tanggal Akhir
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          )}

          {/* Export Button */}
          <div className="relative" ref={exportButtonRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

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

      {/* As of Date Display */}
      <div className="text-center mb-6">
        <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          As of {new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Balance Sheet Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* ASSETS */}
        <div className="card">
          <div className="border-b-2 border-gray-300 dark:border-gray-600 pb-3 mb-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 uppercase text-sm">
              ASET (Assets)
            </h2>
          </div>

          <div className="space-y-6">
            {/* Current Assets */}
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Aset Lancar</h3>
              <div className="flex justify-between py-2 pl-4">
                <span className="text-gray-700 dark:text-gray-300">Kas & Bank</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(balanceSheet.assets.cash)}
                </span>
              </div>
              {balanceSheet.assets.inventory !== 0 && (
                <div className="flex justify-between py-2 pl-4">
                  <span className="text-gray-700 dark:text-gray-300">Persediaan</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(balanceSheet.assets.inventory)}
                  </span>
                </div>
              )}
              {balanceSheet.assets.receivables !== 0 && (
                <div className="flex justify-between py-2 pl-4">
                  <span className="text-gray-700 dark:text-gray-300">Piutang Usaha</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(balanceSheet.assets.receivables)}
                  </span>
                </div>
              )}
              {balanceSheet.assets.otherCurrentAssets !== 0 && (
                <div className="flex justify-between py-2 pl-4">
                  <span className="text-gray-700 dark:text-gray-300">Aset Lancar Lainnya</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(balanceSheet.assets.otherCurrentAssets)}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 pl-4 border-t border-gray-200 dark:border-gray-700 font-semibold">
                <span className="text-gray-800 dark:text-gray-200">Total Aset Lancar</span>
                <span className="text-gray-900 dark:text-gray-100">
                  {formatCurrency(balanceSheet.assets.totalCurrentAssets)}
                </span>
              </div>
            </div>

            {/* Fixed Assets */}
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Aset Tetap</h3>
              <div className="flex justify-between py-2 pl-4">
                <span className="text-gray-700 dark:text-gray-300">Properti & Peralatan</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(balanceSheet.assets.fixedAssets)}
                </span>
              </div>
              <div className="flex justify-between py-2 pl-4 border-t border-gray-200 dark:border-gray-700 font-semibold">
                <span className="text-gray-800 dark:text-gray-200">Total Aset Tetap</span>
                <span className="text-gray-900 dark:text-gray-100">
                  {formatCurrency(balanceSheet.assets.totalFixedAssets)}
                </span>
              </div>
            </div>

            {/* Total Assets */}
            <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-bold border-t-2 border-gray-900 dark:border-gray-100 mt-4">
              <span className="text-lg text-gray-800 dark:text-gray-100">Total Aset</span>
              <span className="text-lg text-primary-600 dark:text-primary-400">
                {formatCurrency(balanceSheet.assets.totalAssets)}
              </span>
            </div>
          </div>
        </div>

        {/* LIABILITIES & EQUITY */}
        <div className="card">
          <div className="border-b-2 border-gray-300 dark:border-gray-600 pb-3 mb-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 uppercase text-sm">
              LIABILITAS & EKUITAS
            </h2>
          </div>

          <div className="space-y-6">
            {/* Liabilities */}
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Liabilitas (Utang)</h3>
              <div className="flex justify-between py-2 pl-4">
                <span className="text-gray-700 dark:text-gray-300">Pinjaman</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(balanceSheet.liabilities.loans)}
                </span>
              </div>
              <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-semibold border-t border-gray-200 dark:border-gray-700 mt-2">
                <span className="text-gray-800 dark:text-gray-100">Total Liabilitas</span>
                <span className="text-gray-800 dark:text-gray-100">
                  {formatCurrency(balanceSheet.liabilities.totalLiabilities)}
                </span>
              </div>
            </div>

            {/* Equity */}
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Ekuitas (Modal)</h3>
              <div className="space-y-2">
                <div className="flex justify-between py-2 pl-4">
                  <span className="text-gray-700 dark:text-gray-300">Modal Disetor</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(balanceSheet.equity.capital)}
                  </span>
                </div>
                {balanceSheet.equity.drawings > 0 && (
                  <div className="flex justify-between py-2 pl-4">
                    <span className="text-gray-700 dark:text-gray-300">Prive / Dividen</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      ({formatCurrency(balanceSheet.equity.drawings)})
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-2 pl-4">
                  <span className="text-gray-700 dark:text-gray-300">Laba Ditahan</span>
                  <span className={`font-semibold ${
                    balanceSheet.equity.retainedEarnings >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {balanceSheet.equity.retainedEarnings < 0 ? '(' : ''}
                    {formatCurrency(Math.abs(balanceSheet.equity.retainedEarnings))}
                    {balanceSheet.equity.retainedEarnings < 0 ? ')' : ''}
                  </span>
                </div>
              </div>
              <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-semibold border-t border-gray-200 dark:border-gray-700 mt-2">
                <span className="text-gray-800 dark:text-gray-100">Total Ekuitas</span>
                <span className="text-gray-800 dark:text-gray-100">
                  {formatCurrency(balanceSheet.equity.totalEquity)}
                </span>
              </div>
            </div>

            {/* Total Liabilities & Equity */}
            <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-bold border-t-2 border-gray-900 dark:border-gray-100 mt-4">
              <span className="text-lg text-gray-800 dark:text-gray-100">
                Total Liabilitas & Ekuitas
              </span>
              <span className="text-lg text-primary-600 dark:text-primary-400">
                {formatCurrency(
                  balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Accounting Equation Validation */}
      <div className={`card ${
        isBalanced
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      }`}>
        <div className="flex items-center gap-3">
          {isBalanced ? (
            <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className={`font-semibold ${
              isBalanced
                ? 'text-emerald-900 dark:text-emerald-100'
                : 'text-red-900 dark:text-red-100'
            }`}>
              {isBalanced ? '\u2713 Neraca Seimbang' : '\u26A0\uFE0F Neraca Tidak Seimbang'}
            </p>
            <p className={`text-sm mt-1 ${
              isBalanced
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-red-700 dark:text-red-300'
            }`}>
              Aset ({formatCurrency(balanceSheet.assets.totalAssets)}) = Liabilitas ({formatCurrency(balanceSheet.liabilities.totalLiabilities)}) + Ekuitas ({formatCurrency(balanceSheet.equity.totalEquity)})
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

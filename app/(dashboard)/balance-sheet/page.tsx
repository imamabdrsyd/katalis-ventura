'use client';

import { Suspense } from 'react';
import { Scale, Download, FileText, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { useBalanceSheet } from '@/hooks/useBalanceSheet';
import { useLanguage } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/utils';

function BalanceSheetPageInner() {
  const { t, locale } = useLanguage();
  const {
    activeBusiness,
    loading,
    asOfDate,
    setAsOfDate,
    showExportMenu,
    setShowExportMenu,
    exportButtonRef,
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
          <p className="text-gray-500 dark:text-gray-400">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (!activeBusiness) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Scale className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">{t.common.selectBusinessFirst}</p>
        </div>
      </div>
    );
  }

  const asOfLabel = new Date(asOfDate).toLocaleDateString(
    locale === 'id' ? 'id-ID' : 'en-US',
    { day: 'numeric', month: 'long', year: 'numeric' }
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
          <Scale className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          {t.balanceSheetPage.title}
        </h1>

        {/* Controls: date picker + export */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
              Per tanggal:
            </label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="input text-sm py-1.5 px-3"
            />
          </div>

          <div className="relative" ref={exportButtonRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {t.common.export}
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-10">
                <button
                  onClick={handleExportPDF}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                >
                  <FileText className="w-4 h-4 text-red-500" />
                  {t.common.exportPDF}
                </button>
                <button
                  onClick={handleExportExcel}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-500" />
                  {t.common.exportExcel}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* As of Date Display */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          {t.balanceSheetPage.asOf.replace('{date}', asOfLabel)}
        </p>
        {activeBusiness.logo_url && (
          <img
            src={activeBusiness.logo_url}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
        )}
      </div>

      {/* Balance Sheet Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* ASSETS */}
        <div className="card-static flex flex-col">
          <div className="border-b-2 border-gray-300 dark:border-gray-600 pb-3 mb-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 uppercase text-sm">
              {t.balanceSheetPage.assets}
            </h2>
          </div>

          <div className="flex flex-col flex-1 space-y-6">
            {/* Current Assets */}
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">{t.balanceSheetPage.currentAssets}</h3>
              <div className="flex justify-between py-2 pl-4">
                <span className="text-gray-700 dark:text-gray-300">{t.balanceSheetPage.cashAndBank}</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(balanceSheet.assets.cash)}
                </span>
              </div>
              {balanceSheet.assets.inventory !== 0 && (
                <div className="flex justify-between py-2 pl-4">
                  <span className="text-gray-700 dark:text-gray-300">{t.balanceSheetPage.inventory}</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(balanceSheet.assets.inventory)}
                  </span>
                </div>
              )}
              {balanceSheet.assets.receivables !== 0 && (
                <div className="flex justify-between py-2 pl-4">
                  <span className="text-gray-700 dark:text-gray-300">{t.balanceSheetPage.accountsReceivable}</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(balanceSheet.assets.receivables)}
                  </span>
                </div>
              )}
              {balanceSheet.assets.otherCurrentAssets !== 0 && (
                <div className="flex justify-between py-2 pl-4">
                  <span className="text-gray-700 dark:text-gray-300">{t.balanceSheetPage.otherCurrentAssets}</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(balanceSheet.assets.otherCurrentAssets)}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 pl-4 border-t border-gray-200 dark:border-gray-700 font-semibold">
                <span className="text-gray-800 dark:text-gray-200">{t.balanceSheetPage.totalCurrentAssets}</span>
                <span className="text-gray-900 dark:text-gray-100">
                  {formatCurrency(balanceSheet.assets.totalCurrentAssets)}
                </span>
              </div>
            </div>

            {/* Fixed Assets */}
            <div className="flex flex-col flex-1">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">{t.balanceSheetPage.fixedAssets}</h3>
              <div className="flex justify-between py-2 pl-4">
                <span className="text-gray-700 dark:text-gray-300">{t.balanceSheetPage.acquisitionValue}</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(balanceSheet.assets.fixedAssets)}
                </span>
              </div>
              {balanceSheet.assets.accumulatedDepreciation > 0 && (
                <div className="flex justify-between py-2 pl-4">
                  <span className="text-gray-500 dark:text-gray-400 italic">{t.balanceSheetPage.accumulatedDepreciation}</span>
                  <span className="font-semibold text-red-500 dark:text-red-400">
                    ({formatCurrency(balanceSheet.assets.accumulatedDepreciation)})
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 pl-4 border-t border-gray-200 dark:border-gray-700 font-semibold">
                <span className="text-gray-800 dark:text-gray-200">
                  {balanceSheet.assets.accumulatedDepreciation > 0 ? t.balanceSheetPage.netFixedAssets : t.balanceSheetPage.fixedAssets}
                </span>
                <span className="text-gray-900 dark:text-gray-100">
                  {formatCurrency(balanceSheet.assets.totalFixedAssets)}
                </span>
              </div>
            </div>

            {/* Total Assets */}
            <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-bold border-t-2 border-gray-900 dark:border-gray-100 mt-auto">
              <span className="text-lg text-gray-800 dark:text-gray-100">{t.balanceSheetPage.totalAssets}</span>
              <span className="text-lg text-primary-600 dark:text-primary-400">
                {formatCurrency(balanceSheet.assets.totalAssets)}
              </span>
            </div>
          </div>
        </div>

        {/* LIABILITIES & EQUITY */}
        <div className="card-static flex flex-col">
          <div className="border-b-2 border-gray-300 dark:border-gray-600 pb-3 mb-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 uppercase text-sm">
              {t.balanceSheetPage.liabilitiesAndEquity}
            </h2>
          </div>

          <div className="flex flex-col flex-1 space-y-6">
            {/* Liabilities */}
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">{t.balanceSheetPage.liabilities}</h3>
              <div className="flex justify-between py-2 pl-4">
                <span className="text-gray-700 dark:text-gray-300">{t.balanceSheetPage.loans}</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(balanceSheet.liabilities.loans)}
                </span>
              </div>
              <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-semibold border-t border-gray-200 dark:border-gray-700 mt-2">
                <span className="text-gray-800 dark:text-gray-100">{t.balanceSheetPage.totalLiabilities}</span>
                <span className="text-gray-800 dark:text-gray-100">
                  {formatCurrency(balanceSheet.liabilities.totalLiabilities)}
                </span>
              </div>
            </div>

            {/* Equity */}
            <div className="flex flex-col flex-1">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">{t.balanceSheetPage.equity}</h3>
              <div className="space-y-2">
                <div className="flex justify-between py-2 pl-4">
                  <span className="text-gray-700 dark:text-gray-300">{t.balanceSheetPage.paidInCapital}</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(balanceSheet.equity.capital)}
                  </span>
                </div>
                {balanceSheet.equity.drawings > 0 && (
                  <div className="flex justify-between py-2 pl-4">
                    <span className="text-gray-700 dark:text-gray-300">{t.balanceSheetPage.dividends}</span>
                    <span className="font-semibold text-red-500 dark:text-red-400">
                      ({formatCurrency(balanceSheet.equity.drawings)})
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-2 pl-4">
                  <span className="text-gray-700 dark:text-gray-300">{t.balanceSheetPage.retainedEarnings}</span>
                  <span className={`font-semibold ${
                    balanceSheet.equity.retainedEarnings >= 0
                      ? 'text-emerald-500 dark:text-emerald-400'
                      : 'text-red-500 dark:text-red-400'
                  }`}>
                    {balanceSheet.equity.retainedEarnings < 0 ? '(' : ''}
                    {formatCurrency(Math.abs(balanceSheet.equity.retainedEarnings))}
                    {balanceSheet.equity.retainedEarnings < 0 ? ')' : ''}
                  </span>
                </div>
              </div>
              <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-semibold border-t border-gray-200 dark:border-gray-700 mt-2">
                <span className="text-gray-800 dark:text-gray-100">{t.balanceSheetPage.totalEquity}</span>
                <span className="text-gray-800 dark:text-gray-100">
                  {formatCurrency(balanceSheet.equity.totalEquity)}
                </span>
              </div>
            </div>

            {/* Total Liabilities & Equity */}
            <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-bold border-t-2 border-gray-900 dark:border-gray-100 mt-auto">
              <span className="text-lg text-gray-800 dark:text-gray-100">
                {t.balanceSheetPage.totalLiabilitiesEquity}
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
            <CheckCircle className="w-6 h-6 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-6 h-6 text-red-500 dark:text-red-400 flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className={`font-semibold ${
              isBalanced
                ? 'text-emerald-900 dark:text-emerald-100'
                : 'text-red-900 dark:text-red-100'
            }`}>
              {isBalanced ? `\u2713 ${t.balanceSheetPage.balanced}` : `\u26A0\uFE0F ${t.balanceSheetPage.notBalanced}`}
            </p>
            <p className={`text-sm mt-1 ${
              isBalanced
                ? 'text-emerald-500 dark:text-emerald-300'
                : 'text-red-500 dark:text-red-300'
            }`}>
              {t.balanceSheetPage.totalAssets} ({formatCurrency(balanceSheet.assets.totalAssets)}) = {t.balanceSheetPage.totalLiabilities} ({formatCurrency(balanceSheet.liabilities.totalLiabilities)}) + {t.balanceSheetPage.totalEquity} ({formatCurrency(balanceSheet.equity.totalEquity)})
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BalanceSheetPage() {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center min-h-[50vh]"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <BalanceSheetPageInner />
    </Suspense>
  );
}

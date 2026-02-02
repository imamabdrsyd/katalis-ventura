'use client';

import { useState, useEffect, useRef } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import { Calendar, Scale, Download, FileText, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import * as transactionsApi from '@/lib/api/transactions';
import { calculateBalanceSheet, filterTransactionsByDateRange } from '@/lib/calculations';
import { formatCurrency } from '@/lib/utils';
import { exportBalanceSheetToPDF, exportBalanceSheetToExcel } from '@/lib/export';
import type { Transaction } from '@/types';

type Period = 'month' | 'quarter' | 'year' | 'custom';

export default function BalanceSheetPage() {
  const { activeBusiness } = useBusinessContext();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportButtonRef = useRef<HTMLDivElement>(null);

  // Initialize dates based on current month
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  }, []);

  // Fetch transactions
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!activeBusiness) return;

      setLoading(true);
      try {
        const data = await transactionsApi.getTransactions(activeBusiness.id);
        setTransactions(data);
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [activeBusiness]);

  // Filter transactions by date range
  useEffect(() => {
    if (startDate && endDate) {
      const filtered = filterTransactionsByDateRange(transactions, startDate, endDate);
      setFilteredTransactions(filtered);
    } else {
      setFilteredTransactions(transactions);
    }
  }, [transactions, startDate, endDate]);

  // Handle period change
  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (newPeriod) {
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        return;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Calculate balance sheet
  const balanceSheet = calculateBalanceSheet(
    filteredTransactions,
    activeBusiness?.capital_investment
  );

  // Check if accounting equation is balanced
  const isBalanced = Math.abs(
    balanceSheet.assets.totalAssets -
    (balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity)
  ) < 0.01; // Allow for rounding errors

  // Handle export
  const handleExportPDF = () => {
    if (!activeBusiness) return;
    const asOfDate = new Date(endDate).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    exportBalanceSheetToPDF(activeBusiness.business_name, asOfDate, balanceSheet);
    setShowExportMenu(false);
  };

  const handleExportExcel = () => {
    if (!activeBusiness) return;
    const asOfDate = new Date(endDate).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    exportBalanceSheetToExcel(activeBusiness.business_name, asOfDate, balanceSheet);
    setShowExportMenu(false);
  };

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportButtonRef.current &&
        !exportButtonRef.current.contains(event.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

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
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Scale className="w-7 h-7 text-primary-600 dark:text-primary-400" />
            Balance Sheet
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Neraca Keuangan - {activeBusiness?.business_name}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['month', 'quarter', 'year', 'custom'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  period === p
                    ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {p === 'month' ? 'Bulan' : p === 'quarter' ? 'Kuartal' : p === 'year' ? 'Tahun' : 'Custom'}
              </button>
            ))}
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

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-10">
                <button
                  onClick={handleExportPDF}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Export as PDF
                </button>
                <button
                  onClick={handleExportExcel}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Export as Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date Range */}
      {period === 'custom' && (
        <div className="card p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input w-full"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Tanggal Akhir
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* As of Date Display */}
      <div className="text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          As of {new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Balance Sheet Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ASSETS */}
        <div className="card p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
            ASET (Assets)
          </h2>

          <div className="space-y-4">
            {/* Current Assets */}
            <div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Aset Lancar</h3>
              <div className="space-y-2 ml-4">
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-600 dark:text-gray-400">Kas & Bank</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(balanceSheet.assets.cash)}
                  </span>
                </div>
              </div>
            </div>

            {/* Fixed Assets */}
            <div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Aset Tetap</h3>
              <div className="space-y-2 ml-4">
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-600 dark:text-gray-400">Properti & Peralatan</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(balanceSheet.assets.propertyValue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Assets */}
            <div className="pt-3 border-t-2 border-gray-900 dark:border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Total Aset</span>
                <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                  {formatCurrency(balanceSheet.assets.totalAssets)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* LIABILITIES & EQUITY */}
        <div className="card p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
            LIABILITAS & EKUITAS
          </h2>

          <div className="space-y-6">
            {/* Liabilities */}
            <div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Liabilitas (Utang)</h3>
              <div className="space-y-2 ml-4">
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-600 dark:text-gray-400">Pinjaman</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(balanceSheet.liabilities.loans)}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                <div className="flex justify-between items-center ml-4">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Total Liabilitas</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(balanceSheet.liabilities.totalLiabilities)}
                  </span>
                </div>
              </div>
            </div>

            {/* Equity */}
            <div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Ekuitas (Modal)</h3>
              <div className="space-y-2 ml-4">
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-600 dark:text-gray-400">Modal Awal</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(balanceSheet.equity.capital)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-600 dark:text-gray-400">Laba Ditahan</span>
                  <span className={`font-medium ${
                    balanceSheet.equity.retainedEarnings >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(balanceSheet.equity.retainedEarnings)}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                <div className="flex justify-between items-center ml-4">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Total Ekuitas</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(balanceSheet.equity.totalEquity)}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Liabilities & Equity */}
            <div className="pt-3 border-t-2 border-gray-900 dark:border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Total Liabilitas & Ekuitas
                </span>
                <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                  {formatCurrency(
                    balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accounting Equation Validation */}
      <div className={`card p-4 ${
        isBalanced
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      }`}>
        <div className="flex items-center gap-3">
          {isBalanced ? (
            <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          )}
          <div className="flex-1">
            <p className={`font-semibold ${
              isBalanced
                ? 'text-emerald-900 dark:text-emerald-100'
                : 'text-red-900 dark:text-red-100'
            }`}>
              {isBalanced ? '✓ Neraca Seimbang' : '⚠️ Neraca Tidak Seimbang'}
            </p>
            <p className={`text-sm mt-1 ${
              isBalanced
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-red-700 dark:text-red-300'
            }`}>
              Aset ({formatCurrency(balanceSheet.assets.totalAssets)}) =
              Liabilitas ({formatCurrency(balanceSheet.liabilities.totalLiabilities)}) +
              Ekuitas ({formatCurrency(balanceSheet.equity.totalEquity)})
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

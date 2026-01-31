'use client';

import { useState, useEffect, useRef } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import { Calendar, TrendingUp, TrendingDown, Download, FileText, FileSpreadsheet } from 'lucide-react';
import * as transactionsApi from '@/lib/api/transactions';
import { calculateFinancialSummary, filterTransactionsByDateRange } from '@/lib/calculations';
import { formatCurrency } from '@/lib/utils';
import { exportIncomeStatementToPDF, exportIncomeStatementToExcel } from '@/lib/export';
import type { Transaction } from '@/types';

type Period = 'month' | 'quarter' | 'year' | 'custom';

export default function IncomeStatementPage() {
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

  // Handle export
  const handleExportPDF = () => {
    if (!activeBusiness) return;
    const periodLabel = `${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - ${new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    exportIncomeStatementToPDF(activeBusiness.business_name, periodLabel, summary);
    setShowExportMenu(false);
  };

  const handleExportExcel = () => {
    if (!activeBusiness) return;
    const periodLabel = `${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - ${new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    exportIncomeStatementToExcel(activeBusiness.business_name, periodLabel, summary);
    setShowExportMenu(false);
  };

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportButtonRef.current && !exportButtonRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

  const summary = calculateFinancialSummary(filteredTransactions);

  // Calculate additional metrics
  const operatingIncome = summary.grossProfit - summary.totalOpex;
  const ebit = operatingIncome - summary.totalCapex;
  const ebt = ebit - summary.totalFin;
  const grossMargin = summary.totalEarn > 0 ? (summary.grossProfit / summary.totalEarn) * 100 : 0;
  const netMargin = summary.totalEarn > 0 ? (summary.netProfit / summary.totalEarn) * 100 : 0;

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
            <div className="flex justify-between py-2 pl-4">
              <span className="text-gray-700 dark:text-gray-300">Earnings</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(summary.totalEarn)}
              </span>
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
            <div className="flex justify-between py-2 pl-4">
              <span className="text-gray-700 dark:text-gray-300">Variable Costs</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                ({formatCurrency(summary.totalVar)})
              </span>
            </div>
            <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-semibold border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-800 dark:text-gray-100">Total COGS</span>
              <span className="text-red-600 dark:text-red-400">({formatCurrency(summary.totalVar)})</span>
            </div>
          </div>

          {/* GROSS PROFIT */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-indigo-900 dark:text-indigo-100 text-lg">GROSS PROFIT</h3>
                <p className="text-sm text-indigo-600 dark:text-indigo-400">Margin: {grossMargin.toFixed(2)}%</p>
              </div>
              <div className="text-right">
                <span className={`text-2xl font-bold ${summary.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(summary.grossProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* OPERATING EXPENSES */}
          <div>
            <div className="flex items-center justify-between py-3 border-b-2 border-gray-300 dark:border-gray-600">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 uppercase text-sm">Operating Expenses</h3>
            </div>
            <div className="flex justify-between py-2 pl-4">
              <span className="text-gray-700 dark:text-gray-300">Operating Expenses</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                ({formatCurrency(summary.totalOpex)})
              </span>
            </div>
            <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-semibold border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-800 dark:text-gray-100">Total Operating Expenses</span>
              <span className="text-red-600 dark:text-red-400">({formatCurrency(summary.totalOpex)})</span>
            </div>
          </div>

          {/* OPERATING INCOME */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-purple-900 dark:text-purple-100 text-lg">OPERATING INCOME (EBITDA)</h3>
              <span className={`text-xl font-bold ${operatingIncome >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(operatingIncome)}
              </span>
            </div>
          </div>

          {/* OTHER EXPENSES */}
          <div>
            <div className="flex items-center justify-between py-3 border-b-2 border-gray-300 dark:border-gray-600">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 uppercase text-sm">Other Items</h3>
            </div>
            <div className="flex justify-between py-2 pl-4">
              <span className="text-gray-700 dark:text-gray-300">Capital Expenditure</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                ({formatCurrency(summary.totalCapex)})
              </span>
            </div>
            <div className="flex justify-between py-2 pl-4">
              <span className="text-gray-700 dark:text-gray-300">Finance/Interest</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                ({formatCurrency(summary.totalFin)})
              </span>
            </div>
          </div>

          {/* EBIT */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-blue-900 dark:text-blue-100 text-lg">EBIT (Earnings Before Interest & Tax)</h3>
              <span className={`text-xl font-bold ${ebit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(ebit)}
              </span>
            </div>
          </div>

          {/* EBT */}
          <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-cyan-900 dark:text-cyan-100 text-lg">EBT (Earnings Before Tax)</h3>
              <span className={`text-xl font-bold ${ebt >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(ebt)}
              </span>
            </div>
          </div>

          {/* TAX */}
          <div>
            <div className="flex justify-between py-2 pl-4">
              <span className="text-gray-700 dark:text-gray-300">Tax</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                ({formatCurrency(summary.totalTax)})
              </span>
            </div>
          </div>

          {/* NET INCOME */}
          <div className={`rounded-xl p-6 text-white ${
            summary.netProfit >= 0
              ? 'bg-gradient-to-r from-green-500 to-emerald-500'
              : 'bg-gradient-to-r from-red-500 to-rose-500'
          }`}>
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xl mb-1">NET INCOME</h3>
                <p className={`text-sm ${
                  summary.netProfit >= 0 ? 'text-green-100' : 'text-red-100'
                }`}>Net Margin: {netMargin.toFixed(2)}%</p>
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
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="card bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <h4 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">Gross Margin</h4>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{grossMargin.toFixed(2)}%</p>
        </div>
        <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">Operating Margin</h4>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {summary.totalEarn > 0 ? ((operatingIncome / summary.totalEarn) * 100).toFixed(2) : 0}%
          </p>
        </div>
        <div className="card bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-300 mb-2">Net Margin</h4>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{netMargin.toFixed(2)}%</p>
        </div>
      </div>
    </div>
  );
}

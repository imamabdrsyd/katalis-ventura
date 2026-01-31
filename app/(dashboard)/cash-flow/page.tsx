'use client';

import { useState, useEffect } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import { Calendar, TrendingUp, TrendingDown, Download, Wallet } from 'lucide-react';
import * as transactionsApi from '@/lib/api/transactions';
import { calculateCashFlow, filterTransactionsByDateRange } from '@/lib/calculations';
import { formatCurrency } from '@/lib/utils';
import type { Transaction } from '@/types';

type Period = 'month' | 'quarter' | 'year' | 'custom';

export default function CashFlowPage() {
  const { activeBusiness } = useBusinessContext();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Get capital from active business
  const capital = activeBusiness?.capital_investment || 0;

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

  const cashFlow = calculateCashFlow(filteredTransactions, capital);

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
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Cash Flow Statement</h1>
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
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
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
          <div>
            <div className="flex items-center justify-between py-3 border-b-2 border-gray-300 dark:border-gray-600">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 uppercase text-sm">
                Cash Flow from Operating Activities
              </h3>
            </div>
            <div className="flex justify-between py-3 pl-4">
              <span className="text-gray-700 dark:text-gray-300">
                Net Cash from Operations
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Revenue - Operating Expenses - Variable Costs - Tax
                </p>
              </span>
              <span className={`font-semibold text-xl ${
                cashFlow.operating >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(cashFlow.operating)}
              </span>
            </div>
            <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-semibold border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-800 dark:text-gray-100">Total Operating Cash Flow</span>
              <span className={cashFlow.operating >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                {formatCurrency(cashFlow.operating)}
              </span>
            </div>
          </div>

          {/* CASH FLOW FROM INVESTING ACTIVITIES */}
          <div>
            <div className="flex items-center justify-between py-3 border-b-2 border-gray-300 dark:border-gray-600">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 uppercase text-sm">
                Cash Flow from Investing Activities
              </h3>
            </div>
            <div className="flex justify-between py-3 pl-4">
              <span className="text-gray-700 dark:text-gray-300">
                Capital Expenditure
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Purchase of fixed assets and equipment
                </p>
              </span>
              <span className={`font-semibold text-xl ${
                cashFlow.investing >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(cashFlow.investing)}
              </span>
            </div>
            <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-semibold border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-800 dark:text-gray-100">Total Investing Cash Flow</span>
              <span className={cashFlow.investing >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                {formatCurrency(cashFlow.investing)}
              </span>
            </div>
          </div>

          {/* CASH FLOW FROM FINANCING ACTIVITIES */}
          <div>
            <div className="flex items-center justify-between py-3 border-b-2 border-gray-300 dark:border-gray-600">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 uppercase text-sm">
                Cash Flow from Financing Activities
              </h3>
            </div>
            <div className="flex justify-between py-3 pl-4">
              <span className="text-gray-700 dark:text-gray-300">
                Finance/Interest & Loans
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Borrowings, repayments, and interest payments
                </p>
              </span>
              <span className={`font-semibold text-xl ${
                cashFlow.financing >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(cashFlow.financing)}
              </span>
            </div>
            <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-800 px-4 font-semibold border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-800 dark:text-gray-100">Total Financing Cash Flow</span>
              <span className={cashFlow.financing >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                {formatCurrency(cashFlow.financing)}
              </span>
            </div>
          </div>

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
        </div>
      </div>
    </div>
  );
}

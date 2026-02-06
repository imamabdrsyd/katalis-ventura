'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import { filterTransactionsByDateRange } from '@/lib/calculations';
import * as transactionsApi from '@/lib/api/transactions';
import type { Transaction } from '@/types';

export type Period = 'month' | 'quarter' | 'year' | 'custom';

export interface UseReportDataReturn {
  activeBusiness: ReturnType<typeof useBusinessContext>['activeBusiness'];
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  loading: boolean;
  period: Period;
  startDate: string;
  endDate: string;
  showExportMenu: boolean;
  exportButtonRef: React.RefObject<HTMLDivElement>;
  setPeriod: React.Dispatch<React.SetStateAction<Period>>;
  setStartDate: React.Dispatch<React.SetStateAction<string>>;
  setEndDate: React.Dispatch<React.SetStateAction<string>>;
  setShowExportMenu: React.Dispatch<React.SetStateAction<boolean>>;
  handlePeriodChange: (newPeriod: Period) => void;
}

export function useReportData(): UseReportDataReturn {
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
  const handlePeriodChange = useCallback((newPeriod: Period) => {
    setPeriod(newPeriod);
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (newPeriod) {
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'quarter': {
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
      }
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        return;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, []);

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

  return {
    activeBusiness,
    transactions,
    filteredTransactions,
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
  };
}

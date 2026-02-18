'use client';

import { useState, useEffect, useMemo } from 'react';
import { useReportData } from './useReportData';
import { calculateAccountLedger } from './useGeneralLedger';
import * as accountsApi from '@/lib/api/accounts';
import type { Account } from '@/types';

export interface TrialBalanceRow {
  account: Account;
  debitBalance: number;
  creditBalance: number;
}

export interface TrialBalanceData {
  rows: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  difference: number;
}

export interface UseTrialBalanceReturn extends ReturnType<typeof useReportData> {
  accounts: Account[];
  trialBalance: TrialBalanceData;
  accountsLoading: boolean;
}

export function useTrialBalance(): UseTrialBalanceReturn {
  const reportData = useReportData();
  const { activeBusiness, filteredTransactions } = reportData;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  // Fetch accounts
  useEffect(() => {
    if (!activeBusiness) return;
    setAccountsLoading(true);
    accountsApi
      .getAccounts(activeBusiness.id, false)
      .then((data) => {
        const subAccounts = data.filter((a) => a.parent_account_id != null);
        setAccounts(subAccounts);
      })
      .catch(console.error)
      .finally(() => setAccountsLoading(false));
  }, [activeBusiness]);

  const trialBalance = useMemo((): TrialBalanceData => {
    const rows: TrialBalanceRow[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    accounts.forEach((account) => {
      const ledger = calculateAccountLedger(account, filteredTransactions);

      // Skip accounts with no activity
      if (ledger.entries.length === 0) return;

      let debitBalance = 0;
      let creditBalance = 0;

      // Place closing balance in correct column based on normal balance
      if (account.normal_balance === 'DEBIT') {
        if (ledger.closingBalance >= 0) {
          debitBalance = ledger.closingBalance;
        } else {
          // Contra: negative debit-normal → show in credit column
          creditBalance = Math.abs(ledger.closingBalance);
        }
      } else {
        if (ledger.closingBalance >= 0) {
          creditBalance = ledger.closingBalance;
        } else {
          // Contra: negative credit-normal → show in debit column
          debitBalance = Math.abs(ledger.closingBalance);
        }
      }

      rows.push({ account, debitBalance, creditBalance });
      totalDebits += debitBalance;
      totalCredits += creditBalance;
    });

    // Sort by account code
    rows.sort((a, b) => a.account.account_code.localeCompare(b.account.account_code));

    const difference = Math.abs(totalDebits - totalCredits);
    const isBalanced = difference < 0.01;

    return { rows, totalDebits, totalCredits, isBalanced, difference };
  }, [accounts, filteredTransactions]);

  return {
    ...reportData,
    accounts,
    trialBalance,
    accountsLoading,
  };
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useReportData } from './useReportData';
import * as accountsApi from '@/lib/api/accounts';
import type { Account, AccountType, Transaction } from '@/types';

export interface LedgerEntry {
  transactionId: string;
  date: string;
  description: string;
  counterAccountName: string;
  counterAccountCode: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
}

export interface AccountLedger {
  account: Account;
  entries: LedgerEntry[];
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  legacyCount: number;
}

export type AccountTypeFilter = AccountType | 'ALL';

function calculateAccountLedger(
  account: Account,
  transactions: Transaction[]
): AccountLedger {
  // Only double-entry transactions have per-account links
  const relevant = transactions.filter(
    (t) =>
      t.is_double_entry &&
      (t.debit_account_id === account.id || t.credit_account_id === account.id)
  );

  const legacyCount = transactions.filter((t) => !t.is_double_entry).length;

  // Sort ascending by date for running balance
  const sorted = [...relevant].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.created_at.localeCompare(b.created_at);
  });

  let balance = 0;
  let totalDebits = 0;
  let totalCredits = 0;

  const entries: LedgerEntry[] = sorted.map((t) => {
    const isDebit = t.debit_account_id === account.id;
    const debitAmount = isDebit ? Number(t.amount) : 0;
    const creditAmount = !isDebit ? Number(t.amount) : 0;
    const counterAccount = isDebit ? t.credit_account : t.debit_account;

    // Normal balance rule:
    // DEBIT-normal accounts (ASSET, EXPENSE) increase with debit
    // CREDIT-normal accounts (LIABILITY, EQUITY, REVENUE) increase with credit
    if (account.normal_balance === 'DEBIT') {
      balance += debitAmount - creditAmount;
    } else {
      balance += creditAmount - debitAmount;
    }

    totalDebits += debitAmount;
    totalCredits += creditAmount;

    return {
      transactionId: t.id,
      date: t.date,
      description: t.name,
      counterAccountName: counterAccount?.account_name ?? '-',
      counterAccountCode: counterAccount?.account_code ?? '-',
      debitAmount,
      creditAmount,
      balance,
    };
  });

  return {
    account,
    entries,
    totalDebits,
    totalCredits,
    closingBalance: balance,
    legacyCount,
  };
}

export interface UseGeneralLedgerReturn extends ReturnType<typeof useReportData> {
  accounts: Account[];
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string) => void;
  filterType: AccountTypeFilter;
  setFilterType: (type: AccountTypeFilter) => void;
  selectedAccount: Account | undefined;
  ledger: AccountLedger | null;
  allLedgers: AccountLedger[];
  accountsLoading: boolean;
}

export function useGeneralLedger(): UseGeneralLedgerReturn {
  const reportData = useReportData();
  const { activeBusiness, filteredTransactions } = reportData;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<AccountTypeFilter>('ALL');
  const [accountsLoading, setAccountsLoading] = useState(true);

  // Fetch accounts for the active business
  useEffect(() => {
    if (!activeBusiness) return;
    setAccountsLoading(true);
    accountsApi
      .getAccounts(activeBusiness.id, false) // active only
      .then((data) => {
        // Only sub-accounts (not main parent categories like 1000, 2000, etc.)
        const subAccounts = data.filter((a) => a.parent_account_id != null);
        setAccounts(subAccounts);
        if (subAccounts.length > 0) {
          setSelectedAccountId(subAccounts[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setAccountsLoading(false));
  }, [activeBusiness]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // Calculate ledger for the currently selected account
  const ledger = useMemo(() => {
    if (!selectedAccount) return null;
    return calculateAccountLedger(selectedAccount, filteredTransactions);
  }, [selectedAccount, filteredTransactions]);

  // Calculate summary for all accounts (for the accounts list panel)
  const allLedgers = useMemo(() => {
    const filtered =
      filterType === 'ALL'
        ? accounts
        : accounts.filter((a) => a.account_type === filterType);
    return filtered.map((acc) =>
      calculateAccountLedger(acc, filteredTransactions)
    );
  }, [accounts, filteredTransactions, filterType]);

  return {
    ...reportData,
    accounts,
    selectedAccountId,
    setSelectedAccountId,
    filterType,
    setFilterType,
    selectedAccount,
    ledger,
    allLedgers,
    accountsLoading,
  };
}

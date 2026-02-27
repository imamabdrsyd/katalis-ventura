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

/**
 * Pre-index transaksi per account ID untuk menghindari O(n) filter berulang.
 * Return Map<accountId, Transaction[]> — single pass O(n).
 */
export function buildTransactionIndex(transactions: Transaction[]): {
  index: Map<string, Transaction[]>;
  legacyCount: number;
} {
  const index = new Map<string, Transaction[]>();
  let legacyCount = 0;

  for (const t of transactions) {
    if (!t.is_double_entry) {
      legacyCount++;
      continue;
    }
    if (t.debit_account_id) {
      const arr = index.get(t.debit_account_id);
      if (arr) arr.push(t);
      else index.set(t.debit_account_id, [t]);
    }
    if (t.credit_account_id) {
      const arr = index.get(t.credit_account_id);
      if (arr) arr.push(t);
      else index.set(t.credit_account_id, [t]);
    }
  }

  return { index, legacyCount };
}

/**
 * Hitung ledger untuk satu akun. Jika txIndex diberikan, gunakan indexed lookup O(1).
 * Fallback ke filter O(n) jika txIndex tidak ada (backward compat).
 */
export function calculateAccountLedger(
  account: Account,
  transactions: Transaction[],
  txIndex?: { index: Map<string, Transaction[]>; legacyCount: number }
): AccountLedger {
  let relevant: Transaction[];
  let legacyCount: number;

  if (txIndex) {
    // O(1) lookup dari pre-built index
    const indexed = txIndex.index.get(account.id) || [];
    // Deduplicate: transaksi yang debit DAN credit ke akun yang sama muncul 2x di index
    const seen = new Set<string>();
    relevant = [];
    for (const t of indexed) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        relevant.push(t);
      }
    }
    legacyCount = txIndex.legacyCount;
  } else {
    relevant = transactions.filter(
      (t) =>
        t.is_double_entry &&
        (t.debit_account_id === account.id || t.credit_account_id === account.id)
    );
    legacyCount = transactions.filter((t) => !t.is_double_entry).length;
  }

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

    // EARN/FIN → customer/pihak terkait name, expenses → keterangan (description)
    const keterangan = (t.category === 'EARN' || t.category === 'FIN')
      ? t.name
      : (t.description || t.debit_account?.account_name || t.name);

    return {
      transactionId: t.id,
      date: t.date,
      description: keterangan,
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

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  // Pre-build transaction index sekali — O(n) single pass
  const txIndex = useMemo(
    () => buildTransactionIndex(filteredTransactions),
    [filteredTransactions]
  );

  // Calculate ledger for the currently selected account — O(1) lookup
  const ledger = useMemo(() => {
    if (!selectedAccount) return null;
    return calculateAccountLedger(selectedAccount, filteredTransactions, txIndex);
  }, [selectedAccount, filteredTransactions, txIndex]);

  // Calculate summary for all accounts — O(accounts) instead of O(accounts × transactions)
  const allLedgers = useMemo(() => {
    const filtered =
      filterType === 'ALL'
        ? accounts
        : accounts.filter((a) => a.account_type === filterType);
    return filtered.map((acc) =>
      calculateAccountLedger(acc, filteredTransactions, txIndex)
    );
  }, [accounts, filteredTransactions, filterType, txIndex]);

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

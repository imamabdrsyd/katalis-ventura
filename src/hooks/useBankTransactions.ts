'use client';

import { useCallback, useEffect, useState } from 'react';

export type BankTransaction = {
  id: string;
  business_id: string;
  account_id: string;
  import_id: string | null;
  posted_at: string;
  value_date: string | null;
  description: string | null;
  amount: number;
  running_balance: number | null;
  reference_code: string | null;
  counterparty_name: string | null;
  match_status: 'unmatched' | 'auto_matched' | 'manual_matched' | 'ignored' | 'created_new';
  matched_transaction_id: string | null;
  match_confidence: number | null;
  created_at: string;
};

interface UseBankTransactionsParams {
  businessId: string | null | undefined;
  accountId?: string;
  from?: string;
  to?: string;
  matchStatus?: BankTransaction['match_status'];
}

/**
 * Hook untuk fetch + manage bank_transactions di UI rekonsiliasi.
 *
 * Operasi yang exposed: refresh, match(bankId, txId), unmatch(bankId).
 */
export function useBankTransactions({
  businessId,
  accountId,
  from,
  to,
  matchStatus,
}: UseBankTransactionsParams) {
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!businessId) {
      setBankTransactions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ business_id: businessId });
      if (accountId) params.set('account_id', accountId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (matchStatus) params.set('match_status', matchStatus);
      params.set('limit', '500');

      const res = await fetch(`/api/bank-transactions?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Gagal fetch mutasi');
      setBankTransactions((json.data ?? []) as BankTransaction[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal fetch mutasi');
    } finally {
      setLoading(false);
    }
  }, [businessId, accountId, from, to, matchStatus]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen ke event commit import baru
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('bank-statement-imported', handler);
    return () => window.removeEventListener('bank-statement-imported', handler);
  }, [refresh]);

  const match = useCallback(
    async (bankTxId: string, transactionId: string) => {
      const res = await fetch(`/api/bank-transactions/${bankTxId}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: transactionId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Gagal match');
      }
      await refresh();
    },
    [refresh]
  );

  const unmatch = useCallback(
    async (bankTxId: string) => {
      const res = await fetch(`/api/bank-transactions/${bankTxId}/unmatch`, { method: 'POST' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Gagal unmatch');
      }
      await refresh();
    },
    [refresh]
  );

  return {
    bankTransactions,
    loading,
    error,
    refresh,
    match,
    unmatch,
  };
}

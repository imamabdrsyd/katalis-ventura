import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Transaction } from '@shared/types';

interface UseTransactionsResult {
  transactions: Transaction[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useTransactions(businessId: string): UseTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!businessId) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select(
          `*,
          debit_account:accounts!transactions_debit_account_id_fkey(id, account_code, account_name, account_type),
          credit_account:accounts!transactions_credit_account_id_fkey(id, account_code, account_name, account_type)`
        )
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .order('date', { ascending: false });

      if (fetchError) throw new Error(fetchError.message);
      setTransactions((data || []) as Transaction[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch transactions'));
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, isLoading, error, refetch: fetchTransactions };
}

export async function createTransaction(
  businessId: string,
  data: Partial<Transaction>
): Promise<Transaction> {
  const { data: result, error } = await supabase
    .from('transactions')
    .insert({
      business_id: businessId,
      date: data.date,
      name: data.name,
      description: data.description || null,
      amount: data.amount,
      category: data.category,
      debit_account_id: data.debit_account_id || null,
      credit_account_id: data.credit_account_id || null,
      is_double_entry: data.is_double_entry || false,
      status: data.status || 'posted',
      notes: data.notes || null,
      meta: data.meta || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return result as Transaction;
}

export async function updateTransaction(
  id: string,
  data: Partial<Transaction>
): Promise<Transaction> {
  const { data: result, error } = await supabase
    .from('transactions')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return result as Transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_transaction', {
    transaction_id: id,
  });
  if (error) throw new Error(error.message);
}

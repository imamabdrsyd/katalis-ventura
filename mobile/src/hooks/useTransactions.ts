import { useState, useEffect } from 'react';
import { withObservables } from '@nozbe/with-observables';
import { Observable } from 'rxjs';
import { getDatabase } from '@/db';
import type { Transaction } from '@shared/types';

interface UseTransactionsResult {
  transactions: Transaction[];
  isLoading: boolean;
  error: Error | null;
}

export function useTransactions(businessId: string): UseTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!businessId) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    const db = getDatabase();
    const subscription = db.collections
      .get('transactions')
      .query()
      .observe()
      .subscribe({
        next: (records: any[]) => {
          const filtered = records
            .filter((tx) => tx.business_id === businessId)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setTransactions(filtered as Transaction[]);
          setIsLoading(false);
        },
        error: (err) => {
          setError(err);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, [businessId]);

  return { transactions, isLoading, error };
}

export async function createTransaction(
  businessId: string,
  data: Partial<Transaction>
): Promise<Transaction> {
  const db = getDatabase();
  const collection = db.collections.get('transactions');

  const newTransaction = await collection.create((tx) => {
    Object.assign(tx, {
      business_id: businessId,
      ...data,
      created_at: Date.now(),
      updated_at: Date.now(),
      _status: 'created',
    });
  });

  return newTransaction as Transaction;
}

export async function updateTransaction(
  id: string,
  data: Partial<Transaction>
): Promise<Transaction> {
  const db = getDatabase();
  const collection = db.collections.get('transactions');
  const tx = await collection.find(id);

  await tx.update((updater) => {
    Object.assign(updater, {
      ...data,
      updated_at: Date.now(),
      _status: 'updated',
    });
  });

  return tx as Transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = getDatabase();
  const collection = db.collections.get('transactions');
  const tx = await collection.find(id);

  await tx.update((updater) => {
    updater.deleted_at = Date.now();
    updater._status = 'deleted';
  });
}

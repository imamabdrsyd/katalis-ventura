import { createClient } from '@/lib/supabase';
import type { Transaction, TransactionCategory, TransactionMeta } from '@/types';

export interface TransactionInsert {
  business_id: string;
  date: string;
  category: TransactionCategory;
  name: string;
  description: string;
  amount: number;
  account: string; // Legacy field
  created_by: string;

  // Optional double-entry fields
  debit_account_id?: string;
  credit_account_id?: string;
  is_double_entry?: boolean;
  notes?: string;
  meta?: TransactionMeta | null;
}

export interface TransactionUpdate {
  date?: string;
  category?: TransactionCategory;
  name?: string;
  description?: string;
  amount?: number;
  account?: string;

  // Optional double-entry fields
  debit_account_id?: string;
  credit_account_id?: string;
  is_double_entry?: boolean;
  notes?: string;
  meta?: TransactionMeta | null;
}

export interface BulkImportResult {
  success: boolean;
  inserted: number;
  failed: number;
  errors: string[];
  data?: Transaction[];
}

// Get all transactions for a business
export async function getTransactions(businessId: string): Promise<Transaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      debit_account:accounts!transactions_debit_account_id_fkey(*),
      credit_account:accounts!transactions_credit_account_id_fkey(*)
    `)
    .eq('business_id', businessId)
    .is('deleted_at', null) // Only fetch non-deleted transactions
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data as Transaction[];
}

// Get transactions by date range
export async function getTransactionsByDateRange(
  businessId: string,
  startDate: string,
  endDate: string
): Promise<Transaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      debit_account:accounts!transactions_debit_account_id_fkey(*),
      credit_account:accounts!transactions_credit_account_id_fkey(*)
    `)
    .eq('business_id', businessId)
    .is('deleted_at', null) // Only fetch non-deleted transactions
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) throw new Error(error.message);
  return data as Transaction[];
}

// Validate double-entry transaction rules
function validateDoubleEntryTransaction(transaction: TransactionInsert | TransactionUpdate): void {
  // Skip validation for legacy transactions
  if (!transaction.is_double_entry) return;

  // Validate debit and credit accounts are different
  if (
    transaction.debit_account_id &&
    transaction.credit_account_id &&
    transaction.debit_account_id === transaction.credit_account_id
  ) {
    throw new Error('Akun debit dan kredit tidak boleh sama. Transaksi harus melibatkan minimal dua akun yang berbeda.');
  }

  // Validate amount is positive
  if (transaction.amount !== undefined && transaction.amount <= 0) {
    throw new Error('Jumlah transaksi harus lebih dari 0');
  }
}

// Create a new transaction
export async function createTransaction(transaction: TransactionInsert): Promise<Transaction> {
  // Validate double-entry rules before creating
  validateDoubleEntryTransaction(transaction);

  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .insert(transaction)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Transaction;
}

// Bulk import transactions
export async function createTransactionsBulk(
  transactions: TransactionInsert[],
  onProgress?: (current: number, total: number) => void
): Promise<BulkImportResult> {
  const supabase = createClient();

  // For optimal performance, we'll insert in batches
  const BATCH_SIZE = 100;
  const results: BulkImportResult = {
    success: true,
    inserted: 0,
    failed: 0,
    errors: [],
    data: [],
  };

  // If less than batch size, insert all at once
  if (transactions.length <= BATCH_SIZE) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert(transactions)
        .select();

      if (error) {
        return {
          success: false,
          inserted: 0,
          failed: transactions.length,
          errors: [error.message],
        };
      }

      return {
        success: true,
        inserted: data.length,
        failed: 0,
        errors: [],
        data: data as Transaction[],
      };
    } catch (err) {
      return {
        success: false,
        inserted: 0,
        failed: transactions.length,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
      };
    }
  }

  // For larger imports, batch the inserts
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);

    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert(batch)
        .select();

      if (error) {
        results.failed += batch.length;
        results.errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        results.success = false;
      } else {
        results.inserted += data.length;
        if (results.data) {
          results.data.push(...(data as Transaction[]));
        }
      }

      // Report progress
      if (onProgress) {
        onProgress(Math.min(i + BATCH_SIZE, transactions.length), transactions.length);
      }
    } catch (err) {
      results.failed += batch.length;
      results.errors.push(
        `Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      results.success = false;
    }
  }

  return results;
}

// Update an existing transaction
export async function updateTransaction(
  id: string,
  updates: TransactionUpdate
): Promise<Transaction> {
  // Validate double-entry rules before updating
  validateDoubleEntryTransaction(updates);

  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Transaction;
}

// Soft delete a transaction (sets deleted_at and deleted_by)
export async function deleteTransaction(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('soft_delete_transaction', {
    transaction_id: id,
  });

  if (error) throw new Error(error.message);
}

// Restore a soft-deleted transaction
export async function restoreTransaction(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('restore_transaction', {
    transaction_id: id,
  });

  if (error) throw new Error(error.message);
}

import { createClient } from '@/lib/supabase';
import type { Transaction, TransactionCategory, TransactionStatus, TransactionMeta, JournalLineInput } from '@/types';

export interface TransactionInsert {
  business_id: string;
  date: string;
  category: TransactionCategory;
  name: string;
  description: string;
  amount: number;
  account: string; // Legacy field
  created_by: string;
  status?: TransactionStatus;

  // Optional double-entry fields
  debit_account_id?: string;
  credit_account_id?: string;
  is_double_entry?: boolean;
  notes?: string;
  meta?: TransactionMeta | null;
}

export interface MultiLineTransactionInsert {
  business_id: string;
  date: string;
  category: TransactionCategory;
  name: string;
  description: string;
  notes?: string;
  status?: TransactionStatus;
  journal_lines: JournalLineInput[];
}

export interface TransactionUpdate {
  date?: string;
  category?: TransactionCategory;
  name?: string;
  description?: string;
  amount?: number;
  account?: string;
  status?: TransactionStatus;

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

// Get all transactions for a business (used by dashboard & reports that need full dataset)
export async function getTransactions(businessId: string): Promise<Transaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      debit_account:accounts!transactions_debit_account_id_fkey(*),
      credit_account:accounts!transactions_credit_account_id_fkey(*),
      journal_lines(*, account:accounts(*))
    `)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data as Transaction[];
}

// Create a multi-line journal entry (N debit + M credit lines, balanced)
export async function createMultiLineTransaction(
  insert: MultiLineTransactionInsert
): Promise<Transaction> {
  const supabase = createClient();

  const totalDebit = insert.journal_lines.reduce((s, l) => s + l.debit_amount, 0);
  const totalCredit = insert.journal_lines.reduce((s, l) => s + l.credit_amount, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error('Jurnal tidak seimbang: total debit harus sama dengan total kredit');
  }

  // Insert transaction header
  const { data: transaction, error: txnError } = await supabase
    .from('transactions')
    .insert({
      business_id: insert.business_id,
      date: insert.date,
      category: insert.category,
      name: insert.name,
      description: insert.description,
      notes: insert.notes ?? null,
      amount: totalDebit,
      account: 'Multi-line journal entry',
      status: insert.status ?? 'draft',
      is_multi_line: true,
      is_double_entry: false,
    })
    .select()
    .single();

  if (txnError || !transaction) throw new Error(txnError?.message ?? 'Failed to create transaction');

  // Insert journal lines
  const lines = insert.journal_lines.map((l, i) => ({
    transaction_id: transaction.id,
    account_id: l.account_id,
    debit_amount: l.debit_amount,
    credit_amount: l.credit_amount,
    description: l.description ?? null,
    sort_order: l.sort_order ?? i,
  }));

  const { error: linesError } = await supabase
    .from('journal_lines')
    .insert(lines);

  if (linesError) {
    // Rollback by deleting the transaction (cascade deletes lines)
    await supabase.from('transactions').delete().eq('id', transaction.id);
    throw new Error(linesError.message);
  }

  return transaction as Transaction;
}

// Update a multi-line journal entry (replaces all journal_lines)
export async function updateMultiLineTransaction(
  id: string,
  updates: Partial<Omit<MultiLineTransactionInsert, 'business_id'>>
): Promise<Transaction> {
  const supabase = createClient();

  const updateData: Record<string, unknown> = {
    date: updates.date,
    category: updates.category,
    name: updates.name,
    description: updates.description,
    notes: updates.notes ?? null,
    status: updates.status,
  };

  // Remove undefined keys
  Object.keys(updateData).forEach((k) => {
    if (updateData[k] === undefined) delete updateData[k];
  });

  if (updates.journal_lines) {
    const totalDebit = updates.journal_lines.reduce((s, l) => s + l.debit_amount, 0);
    const totalCredit = updates.journal_lines.reduce((s, l) => s + l.credit_amount, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error('Jurnal tidak seimbang: total debit harus sama dengan total kredit');
    }

    updateData.amount = totalDebit;
  }

  const { data: transaction, error: txnError } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (txnError || !transaction) throw new Error(txnError?.message ?? 'Failed to update transaction');

  if (updates.journal_lines) {
    // Delete old lines and re-insert
    await supabase.from('journal_lines').delete().eq('transaction_id', id);

    const lines = updates.journal_lines.map((l, i) => ({
      transaction_id: id,
      account_id: l.account_id,
      debit_amount: l.debit_amount,
      credit_amount: l.credit_amount,
      description: l.description ?? null,
      sort_order: l.sort_order ?? i,
    }));

    const { error: linesError } = await supabase
      .from('journal_lines')
      .insert(lines);

    if (linesError) throw new Error(linesError.message);
  }

  return transaction as Transaction;
}

// Get paginated transactions for the transactions list page
export interface PaginatedTransactions {
  data: Transaction[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TransactionFilters {
  status?: TransactionStatus | 'all';
  category?: TransactionCategory | '';
  startDate?: string;
  endDate?: string;
}

export async function getTransactionsPaginated(
  businessId: string,
  page: number = 1,
  pageSize: number = 50,
  filters?: TransactionFilters
): Promise<PaginatedTransactions> {
  const supabase = createClient();
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('transactions')
    .select(`
      *,
      debit_account:accounts!transactions_debit_account_id_fkey(*),
      credit_account:accounts!transactions_credit_account_id_fkey(*),
      journal_lines(*, account:accounts(*))
    `, { count: 'exact' })
    .eq('business_id', businessId)
    .is('deleted_at', null);

  // Apply filters
  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters?.category) {
    query = query.eq('category', filters.category);
  }
  if (filters?.startDate) {
    query = query.gte('date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('date', filters.endDate);
  }

  query = query
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  const totalCount = count ?? 0;
  return {
    data: data as Transaction[],
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
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
      credit_account:accounts!transactions_credit_account_id_fkey(*),
      journal_lines(*, account:accounts(*))
    `)
    .eq('business_id', businessId)
    .is('deleted_at', null)
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

// Create a new transaction (default status: draft)
export async function createTransaction(transaction: TransactionInsert): Promise<Transaction> {
  // Validate double-entry rules before creating
  validateDoubleEntryTransaction(transaction);

  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      ...transaction,
      status: transaction.status || 'draft',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Transaction;
}

// Post a draft transaction (draft → posted, one-way)
export async function postTransaction(id: string): Promise<Transaction> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .update({
      status: 'posted' as TransactionStatus,
      posted_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'draft') // Only draft can be posted
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Transaction;
}

// Bulk post multiple draft transactions
export async function postTransactionsBulk(ids: string[]): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .update({
      status: 'posted' as TransactionStatus,
      posted_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('status', 'draft')
    .select('id');

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
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

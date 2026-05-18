import { createClient } from '@/lib/supabase';
import type { Transaction, TransactionCategory, TransactionStatus, TransactionMeta, JournalLineInput } from '@/types';
import { apiFetch } from './_fetchHelper';

export interface TransactionInsert {
  business_id: string;
  date: string;
  category: TransactionCategory;
  name: string;
  description: string;
  amount: number;
  original_amount?: number | null;
  currency_code?: string | null;
  fx_rate?: number | null;
  fx_rate_date?: string | null;
  fx_gain_loss_amount?: number | null;
  account: string; // Legacy field
  created_by: string;
  status?: TransactionStatus;

  // Optional double-entry fields
  debit_account_id?: string;
  credit_account_id?: string;
  is_double_entry?: boolean;
  notes?: string;
  meta?: TransactionMeta | null;

  // Import batch linkage (diisi saat dibuat via bulk import)
  import_batch_id?: string;
}

export interface MultiLineTransactionInsert {
  business_id: string;
  created_by: string;
  date: string;
  category: TransactionCategory;
  name: string;
  description: string;
  notes?: string;
  status?: TransactionStatus;
  meta?: Record<string, unknown> | null;
  original_amount?: number | null;
  currency_code?: string | null;
  fx_rate?: number | null;
  fx_rate_date?: string | null;
  fx_gain_loss_amount?: number | null;
  attachments?: import('@/types').TransactionAttachment[];
  journal_lines: JournalLineInput[];
}

export interface TransactionUpdate {
  date?: string;
  category?: TransactionCategory;
  name?: string;
  description?: string;
  amount?: number;
  original_amount?: number | null;
  currency_code?: string | null;
  fx_rate?: number | null;
  fx_rate_date?: string | null;
  fx_gain_loss_amount?: number | null;
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

// Create a multi-line journal entry (routes through POST /api/transactions
// when journal_lines is in body — handled atomically server-side).
export async function createMultiLineTransaction(
  insert: MultiLineTransactionInsert
): Promise<Transaction> {
  // Build meta: merge caller-supplied meta with attachments
  const meta: Record<string, unknown> = { ...(insert.meta ?? {}) };
  if (insert.attachments && insert.attachments.length > 0) {
    meta.attachments = insert.attachments;
  }

  const lines = insert.journal_lines.map((l, i) => ({
    account_id: l.account_id,
    debit_amount: l.debit_amount,
    credit_amount: l.credit_amount,
    description: l.description ?? null,
    sort_order: l.sort_order ?? i,
    currency_code: l.currency_code ?? 'IDR',
    original_debit_amount: l.original_debit_amount ?? l.debit_amount,
    original_credit_amount: l.original_credit_amount ?? l.credit_amount,
    fx_rate: l.fx_rate ?? 1,
  }));

  return apiFetch<Transaction>('/api/transactions', {
    method: 'POST',
    body: {
      business_id: insert.business_id,
      date: insert.date,
      category: insert.category,
      name: insert.name,
      description: insert.description,
      notes: insert.notes ?? '',
      status: insert.status ?? 'draft',
      meta: Object.keys(meta).length > 0 ? meta : undefined,
      original_amount: insert.original_amount ?? undefined,
      currency_code: insert.currency_code ?? undefined,
      fx_rate: insert.fx_rate ?? undefined,
      fx_rate_date: insert.fx_rate_date ?? undefined,
      fx_gain_loss_amount: insert.fx_gain_loss_amount ?? undefined,
      journal_lines: lines,
    },
  });
}

// Update a multi-line journal entry (routes through PATCH /api/transactions/[id]/multi-line)
export async function updateMultiLineTransaction(
  id: string,
  updates: Partial<Omit<MultiLineTransactionInsert, 'business_id'>>
): Promise<Transaction> {
  if (updates.journal_lines) {
    const totalDebit = updates.journal_lines.reduce((s, l) => s + l.debit_amount, 0);
    const totalCredit = updates.journal_lines.reduce((s, l) => s + l.credit_amount, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error('Jurnal tidak seimbang: total debit harus sama dengan total kredit');
    }
  }

  const body: Record<string, unknown> = {};
  if (updates.date !== undefined) body.date = updates.date;
  if (updates.category !== undefined) body.category = updates.category;
  if (updates.name !== undefined) body.name = updates.name;
  if (updates.description !== undefined) body.description = updates.description;
  if (updates.notes !== undefined) body.notes = updates.notes;
  if (updates.status !== undefined) body.status = updates.status;
  if (updates.meta !== undefined) body.meta = updates.meta;
  if (updates.original_amount !== undefined) body.original_amount = updates.original_amount;
  if (updates.currency_code !== undefined) body.currency_code = updates.currency_code;
  if (updates.fx_rate !== undefined) body.fx_rate = updates.fx_rate;
  if (updates.fx_rate_date !== undefined) body.fx_rate_date = updates.fx_rate_date;
  if (updates.fx_gain_loss_amount !== undefined) body.fx_gain_loss_amount = updates.fx_gain_loss_amount;
  if (updates.journal_lines) {
    body.journal_lines = updates.journal_lines.map((l, i) => ({
      account_id: l.account_id,
      debit_amount: l.debit_amount,
      credit_amount: l.credit_amount,
      description: l.description ?? null,
      sort_order: l.sort_order ?? i,
      currency_code: l.currency_code ?? 'IDR',
      original_debit_amount: l.original_debit_amount ?? l.debit_amount,
      original_credit_amount: l.original_credit_amount ?? l.credit_amount,
      fx_rate: l.fx_rate ?? 1,
    }));
  }

  return apiFetch<Transaction>(`/api/transactions/${id}/multi-line`, {
    method: 'PATCH',
    body,
  });
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
  category?: TransactionCategory | 'SETTLE' | '';
  startDate?: string;
  endDate?: string;
  contact?: string;
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
  if (filters?.category === 'SETTLE') {
    query = query.not('meta->>settlement_of_transaction_id', 'is', null);
  } else if (filters?.category) {
    query = query.eq('category', filters.category);
  }
  if (filters?.contact) {
    query = query.eq('name', filters.contact);
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

// Create a new transaction (routes through POST /api/transactions)
export async function createTransaction(transaction: TransactionInsert): Promise<Transaction> {
  // Client-side pre-validation for fast feedback. Server re-validates with Zod.
  validateDoubleEntryTransaction(transaction);

  // Server fills in created_by from auth; strip if present to avoid confusion.
  const { created_by: _omit, ...payload } = transaction;
  void _omit;

  return apiFetch<Transaction>('/api/transactions', {
    method: 'POST',
    body: { ...payload, status: payload.status || 'draft' },
  });
}

// Post a draft transaction (draft → posted, one-way)
export async function postTransaction(id: string): Promise<Transaction> {
  return apiFetch<Transaction>(`/api/transactions/${id}/post`, { method: 'POST' });
}

// Bulk post multiple draft transactions
export async function postTransactionsBulk(ids: string[]): Promise<number> {
  const data = await apiFetch<{ posted: number }>('/api/transactions/bulk-post', {
    method: 'POST',
    body: { ids },
  });
  return data.posted;
}

// Bulk import transactions (routes through POST /api/transactions/bulk).
// Server inserts in batches of 100 and returns aggregate counts.
// The onProgress callback is kept for API compatibility but fires only once
// at completion since the request is now a single round-trip.
export async function createTransactionsBulk(
  transactions: TransactionInsert[],
  onProgress?: (current: number, total: number) => void
): Promise<BulkImportResult> {
  if (transactions.length === 0) {
    return { success: true, inserted: 0, failed: 0, errors: [], data: [] };
  }

  const businessIds = new Set(transactions.map((t) => t.business_id));
  if (businessIds.size > 1) {
    return {
      success: false,
      inserted: 0,
      failed: transactions.length,
      errors: ['Semua transaksi harus dalam bisnis yang sama'],
    };
  }
  const business_id = transactions[0].business_id;

  // Strip business_id and created_by from each row — server fills them in.
  const payload = transactions.map(({ business_id: _b, created_by: _c, ...rest }) => {
    void _b;
    void _c;
    return rest;
  });

  try {
    const result = await apiFetch<BulkImportResult>('/api/transactions/bulk', {
      method: 'POST',
      body: { business_id, transactions: payload },
    });
    if (onProgress) onProgress(transactions.length, transactions.length);
    return result;
  } catch (err) {
    return {
      success: false,
      inserted: 0,
      failed: transactions.length,
      errors: [err instanceof Error ? err.message : 'Unknown error'],
    };
  }
}

// Update an existing transaction (routes through PUT /api/transactions/[id])
export async function updateTransaction(
  id: string,
  updates: TransactionUpdate
): Promise<Transaction> {
  validateDoubleEntryTransaction(updates);
  return apiFetch<Transaction>(`/api/transactions/${id}`, {
    method: 'PUT',
    body: updates,
  });
}

// Soft delete a transaction (routes through DELETE /api/transactions/[id])
export async function deleteTransaction(id: string): Promise<void> {
  await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
}

// ============================================================
// Settle transaction (full atau partial) via RPC.
// Atomic — insert settlement + update meta transaksi asli dalam satu
// DB transaction dengan FOR UPDATE lock di sisi server (lihat migration 073).
// Mencegah lost update saat partial settlement parallel.
// ============================================================
export interface SettlementInput {
  date: string;
  category: TransactionCategory;
  name: string;
  description: string;
  amount?: number;
  original_amount?: number | null;
  currency_code?: string | null;
  fx_rate?: number | null;
  fx_rate_date?: string | null;
  fx_gain_loss_amount?: number | null;
  debit_account_id?: string;
  credit_account_id?: string;
  is_double_entry?: boolean;
  account?: string;
  notes?: string;
  status?: TransactionStatus;
  meta?: Record<string, unknown> | null;
}

export interface SettlementResult {
  settlement_id: string;
  updated_meta: TransactionMeta;
}

export async function settleTransaction(input: {
  originalTransactionId: string;
  settlementData: SettlementInput;
  partialAmount?: number; // undefined/null = full settle
  outstandingAmount?: number; // cross-check vs server (deteksi stale)
}): Promise<SettlementResult> {
  return apiFetch<SettlementResult>(
    `/api/transactions/${input.originalTransactionId}/settle`,
    {
      method: 'POST',
      body: {
        settlement_data: input.settlementData,
        partial_amount: input.partialAmount ?? null,
        outstanding_amount: input.outstandingAmount ?? null,
      },
    }
  );
}

// Restore a soft-deleted transaction
export async function restoreTransaction(id: string): Promise<void> {
  await apiFetch(`/api/transactions/${id}/restore`, { method: 'POST' });
}

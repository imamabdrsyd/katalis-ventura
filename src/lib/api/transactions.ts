import { createClient } from '@/lib/supabase';
import type { Transaction, TransactionCategory } from '@/types';

export interface TransactionInsert {
  business_id: string;
  date: string;
  category: TransactionCategory;
  name: string;
  description: string;
  amount: number;
  account: string;
  created_by: string;
}

export interface TransactionUpdate {
  date?: string;
  category?: TransactionCategory;
  name?: string;
  description?: string;
  amount?: number;
  account?: string;
}

// Get all transactions for a business
export async function getTransactions(businessId: string): Promise<Transaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('business_id', businessId)
    .order('date', { ascending: false });

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
    .select('*')
    .eq('business_id', businessId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) throw new Error(error.message);
  return data as Transaction[];
}

// Create a new transaction
export async function createTransaction(transaction: TransactionInsert): Promise<Transaction> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .insert(transaction)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Transaction;
}

// Update an existing transaction
export async function updateTransaction(
  id: string,
  updates: TransactionUpdate
): Promise<Transaction> {
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

// Delete a transaction
export async function deleteTransaction(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

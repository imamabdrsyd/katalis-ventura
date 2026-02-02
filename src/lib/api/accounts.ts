import { createClient } from '@/lib/supabase';
import type { Account } from '@/types';

/**
 * Get all accounts for a business (Chart of Accounts)
 * @param businessId - The business ID
 * @param includeInactive - If true, includes inactive accounts (default: true for management UI)
 */
export async function getAccounts(businessId: string, includeInactive: boolean = true): Promise<Account[]> {
  const supabase = createClient();

  let query = supabase
    .from('accounts')
    .select('*')
    .eq('business_id', businessId);

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  query = query.order('sort_order', { ascending: true });

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data as Account[];
}

/**
 * Get account by code
 */
export async function getAccountByCode(
  businessId: string,
  code: string
): Promise<Account | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('business_id', businessId)
    .eq('account_code', code)
    .eq('is_active', true)
    .single();

  if (error) {
    // PGRST116 means no rows returned
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data as Account;
}

/**
 * Get account by ID
 */
export async function getAccountById(id: string): Promise<Account | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data as Account;
}

/**
 * Create a new custom account
 */
export async function createAccount(
  account: Omit<Account, 'id' | 'created_at' | 'updated_at'>
): Promise<Account> {
  const supabase = createClient();
  const { data, error} = await supabase
    .from('accounts')
    .insert(account)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Account;
}

/**
 * Update an existing account
 */
export async function updateAccount(
  id: string,
  updates: Partial<Omit<Account, 'id' | 'business_id' | 'created_at' | 'updated_at'>>
): Promise<Account> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Account;
}

/**
 * Deactivate an account (soft delete)
 * Cannot deactivate system accounts
 */
export async function deactivateAccount(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('accounts')
    .update({ is_active: false })
    .eq('id', id)
    .eq('is_system', false); // Prevent deactivating system accounts

  if (error) throw new Error(error.message);
}

/**
 * Reactivate a deactivated account
 */
export async function activateAccount(id: string): Promise<Account> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .update({ is_active: true })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Account;
}

/**
 * Get accounts by type
 */
export async function getAccountsByType(
  businessId: string,
  accountType: Account['account_type']
): Promise<Account[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('business_id', businessId)
    .eq('account_type', accountType)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return data as Account[];
}

/**
 * Check if account code is unique for a business
 */
export async function isAccountCodeUnique(
  businessId: string,
  accountCode: string,
  excludeId?: string
): Promise<boolean> {
  const supabase = createClient();

  let query = supabase
    .from('accounts')
    .select('id')
    .eq('business_id', businessId)
    .eq('account_code', accountCode);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data.length === 0;
}

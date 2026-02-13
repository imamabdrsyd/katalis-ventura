import { createClient } from '@/lib/supabase';
import type { Account } from '@/types';

export interface AccountTreeNode extends Account {
  children: AccountTreeNode[];
  level: number;
}

/**
 * Get all accounts for a business (Chart of Accounts)
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
 * Get accounts organized as a tree structure (parent → children)
 */
export async function getAccountTree(businessId: string, includeInactive: boolean = false): Promise<AccountTreeNode[]> {
  const accounts = await getAccounts(businessId, includeInactive);
  return buildAccountTree(accounts);
}

/**
 * Build account tree from flat list
 */
export function buildAccountTree(accounts: Account[]): AccountTreeNode[] {
  const accountMap = new Map<string, AccountTreeNode>();
  const roots: AccountTreeNode[] = [];

  // First pass: create map with empty children
  accounts.forEach(acc => {
    accountMap.set(acc.id, { ...acc, children: [], level: 0 });
  });

  // Second pass: build tree
  accounts.forEach(acc => {
    const node = accountMap.get(acc.id)!;
    if (acc.parent_account_id) {
      const parent = accountMap.get(acc.parent_account_id);
      if (parent) {
        node.level = parent.level + 1;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  // Sort children by sort_order
  const sortChildren = (nodes: AccountTreeNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach(n => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

/**
 * Get only main/parent accounts (parent_account_id IS NULL)
 */
export async function getMainAccounts(businessId: string): Promise<Account[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('business_id', businessId)
    .is('parent_account_id', null)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return data as Account[];
}

/**
 * Get sub-accounts of a specific parent
 */
export async function getSubAccounts(businessId: string, parentId: string): Promise<Account[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('business_id', businessId)
    .eq('parent_account_id', parentId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return data as Account[];
}

/**
 * Generate the next available account code for a parent account
 * E.g., if parent is 1000 (Assets) and existing subs are 1100, 1200, returns "1300"
 */
export async function getNextAccountCode(
  businessId: string,
  parentAccountId: string
): Promise<string> {
  const supabase = createClient();

  // Get the parent account
  const { data: parent, error: parentError } = await supabase
    .from('accounts')
    .select('account_code')
    .eq('id', parentAccountId)
    .single();

  if (parentError || !parent) throw new Error('Parent account not found');

  // Get existing sub-accounts
  const { data: siblings, error: sibError } = await supabase
    .from('accounts')
    .select('account_code')
    .eq('business_id', businessId)
    .eq('parent_account_id', parentAccountId);

  if (sibError) throw new Error(sibError.message);

  const baseCode = parseInt(parent.account_code);

  if (!siblings || siblings.length === 0) {
    return (baseCode + 100).toString();
  }

  // Find the highest existing sub-account code
  const existingCodes = siblings
    .map(acc => parseInt(acc.account_code))
    .filter(code => !isNaN(code))
    .sort((a, b) => b - a);

  const lastCode = existingCodes[0];
  return (lastCode + 100).toString();
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
    .eq('is_system', false);

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

import { createClient } from '@/lib/supabase';
import type { Business, Database } from '@/types';
import { getAccountByCode } from './accounts';
import { createTransaction } from './transactions';

type BusinessInsert = Database['public']['Tables']['businesses']['Insert'];
type BusinessUpdate = Database['public']['Tables']['businesses']['Update'];

// Form data type without created_by (will be set by the API)
export interface CreateBusinessData {
  business_name: string;
  business_type: string;
  capital_investment?: number; // Optional for backward compatibility
  property_address?: string;
}

/**
 * Create initial capital investment transaction (double-entry)
 * Debit: Cash (1100) - Asset increases
 * Credit: Equity (3000) - Owner's capital increases
 */
async function createCapitalInvestmentTransaction(
  businessId: string,
  amount: number,
  userId: string
): Promise<void> {
  if (!amount || amount <= 0) return;

  const supabase = createClient();

  // Get Cash account (1100)
  const cashAccount = await getAccountByCode(businessId, '1100');
  if (!cashAccount) {
    throw new Error('Cash account (1100) not found. Please ensure default accounts are created.');
  }

  // Get Equity parent account (3000)
  const equityAccount = await getAccountByCode(businessId, '3000');
  if (!equityAccount) {
    throw new Error('Equity account (3000) not found. Please ensure default accounts are created.');
  }

  // Create the double-entry transaction
  // Using 'FIN' category (Financing) as capital investment is a financing activity
  await createTransaction({
    business_id: businessId,
    date: new Date().toISOString().split('T')[0], // Today's date
    category: 'FIN',
    name: 'Modal Investasi Awal',
    description: 'Setoran modal investasi awal dari pemilik',
    amount: amount,
    account: 'Cash', // Legacy field
    created_by: userId,
    debit_account_id: cashAccount.id, // Debit Cash (Asset increases)
    credit_account_id: equityAccount.id, // Credit Equity (Capital increases)
    is_double_entry: true,
    notes: 'Transaksi modal investasi awal dibuat otomatis saat pembuatan bisnis',
  });
}

/**
 * Update or create capital investment transaction when business is updated
 */
async function updateCapitalInvestmentTransaction(
  businessId: string,
  newAmount: number,
  userId: string
): Promise<void> {
  const supabase = createClient();

  // Find existing capital investment transaction
  const { data: existingTx, error: findError } = await supabase
    .from('transactions')
    .select('*')
    .eq('business_id', businessId)
    .eq('category', 'FIN')
    .eq('name', 'Modal Investasi Awal')
    .is('deleted_at', null)
    .single();

  if (findError && findError.code !== 'PGRST116') {
    throw findError;
  }

  // If no existing transaction and new amount > 0, create new transaction
  if (!existingTx && newAmount > 0) {
    await createCapitalInvestmentTransaction(businessId, newAmount, userId);
    return;
  }

  // If existing transaction found
  if (existingTx) {
    // If new amount is 0, soft delete the transaction
    if (newAmount <= 0) {
      await supabase.rpc('soft_delete_transaction', {
        transaction_id: existingTx.id,
      });
      return;
    }

    // Update existing transaction amount
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        amount: newAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingTx.id);

    if (updateError) throw updateError;
  }
}

export async function getUserBusinesses(
  userId: string,
  includeArchived = false
): Promise<Business[]> {
  const supabase = createClient();
  let query = supabase
    .from('user_business_roles')
    .select('business_id, businesses(*)')
    .eq('user_id', userId);

  const { data, error } = await query;

  if (error) throw error;

  const businesses = data
    ?.map((item) => item.businesses as unknown as Business)
    .filter((b): b is Business => b !== null) || [];

  if (!includeArchived) {
    return businesses.filter((b) => !b.is_archived);
  }

  return businesses;
}

export async function getBusinessById(businessId: string): Promise<Business | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

export async function createBusiness(
  business: CreateBusinessData,
  userId: string
): Promise<Business> {
  const supabase = createClient();
  // Create business
  const { data: newBusiness, error: businessError } = await supabase
    .from('businesses')
    .insert({
      ...business,
      capital_investment: business.capital_investment || 0,
      created_by: userId,
    })
    .select()
    .single();

  if (businessError) throw businessError;

  // Assign user as business manager
  const { error: roleError } = await supabase.from('user_business_roles').insert({
    user_id: userId,
    business_id: newBusiness.id,
    role: 'business_manager',
  });

  if (roleError) throw roleError;

  // Create default accounts for the business
  // Call the stored procedure after user role is assigned
  const { error: accountsError } = await supabase.rpc('create_default_accounts', {
    p_business_id: newBusiness.id,
  });

  if (accountsError) {
    console.warn('Failed to create default accounts:', accountsError);
    // Don't throw - allow business creation to succeed even if accounts fail
  }

  // Create capital investment transaction if amount > 0
  // This must happen AFTER accounts are created
  try {
    await createCapitalInvestmentTransaction(
      newBusiness.id,
      business.capital_investment || 0,
      userId
    );
  } catch (error) {
    console.warn('Failed to create capital investment transaction:', error);
    // Don't throw - allow business creation to succeed
  }

  return newBusiness;
}

export async function updateBusiness(
  businessId: string,
  updates: BusinessUpdate,
  userId?: string
): Promise<Business> {
  const supabase = createClient();

  // Update business
  const { data, error } = await supabase
    .from('businesses')
    .update(updates)
    .eq('id', businessId)
    .select()
    .single();

  if (error) throw error;

  // If capital_investment was updated and userId is provided, update the transaction
  if (updates.capital_investment !== undefined && userId) {
    try {
      await updateCapitalInvestmentTransaction(
        businessId,
        updates.capital_investment,
        userId
      );
    } catch (error) {
      console.warn('Failed to update capital investment transaction:', error);
      // Don't throw - allow business update to succeed
    }
  }

  return data;
}

export async function archiveBusiness(businessId: string): Promise<Business> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('businesses')
    .update({ is_archived: true })
    .eq('id', businessId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function restoreBusiness(businessId: string): Promise<Business> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('businesses')
    .update({ is_archived: false })
    .eq('id', businessId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getAvailableBusinesses(userId: string): Promise<Business[]> {
  const supabase = createClient();
  // Get businesses that user already joined
  const { data: userRoles, error: rolesError } = await supabase
    .from('user_business_roles')
    .select('business_id')
    .eq('user_id', userId);

  if (rolesError) throw rolesError;

  const joinedBusinessIds = userRoles?.map((r) => r.business_id) || [];

  // Get all active businesses
  let query = supabase
    .from('businesses')
    .select('*')
    .eq('is_archived', false)
    .order('business_name', { ascending: true });

  // Filter out businesses user already joined
  if (joinedBusinessIds.length > 0) {
    query = query.not('id', 'in', `(${joinedBusinessIds.join(',')})`);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data || [];
}

export async function joinBusiness(
  userId: string,
  businessId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('user_business_roles').insert({
    user_id: userId,
    business_id: businessId,
    role: 'investor',
  });

  if (error) throw error;
}

export async function checkUserHasBusiness(userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('user_business_roles')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (error) throw error;

  return (data?.length || 0) > 0;
}

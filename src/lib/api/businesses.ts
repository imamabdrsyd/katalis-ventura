import { createClient } from '@/lib/supabase';
import type { Business, Database } from '@/types';

type BusinessInsert = Database['public']['Tables']['businesses']['Insert'];
type BusinessUpdate = Database['public']['Tables']['businesses']['Update'];

// Form data type without created_by (will be set by the API)
export interface CreateBusinessData {
  business_name: string;
  business_type: string;
  capital_investment: number;
  property_address?: string;
}

const supabase = createClient();

export async function getUserBusinesses(
  userId: string,
  includeArchived = false
): Promise<Business[]> {
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
  // Create business
  const { data: newBusiness, error: businessError } = await supabase
    .from('businesses')
    .insert({
      ...business,
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

  return newBusiness;
}

export async function updateBusiness(
  businessId: string,
  updates: BusinessUpdate
): Promise<Business> {
  const { data, error } = await supabase
    .from('businesses')
    .update(updates)
    .eq('id', businessId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function archiveBusiness(businessId: string): Promise<Business> {
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
  const { error } = await supabase.from('user_business_roles').insert({
    user_id: userId,
    business_id: businessId,
    role: 'investor',
  });

  if (error) throw error;
}

export async function checkUserHasBusiness(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_business_roles')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (error) throw error;

  return (data?.length || 0) > 0;
}

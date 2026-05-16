import { createClient } from '@/lib/supabase';
import type { Business, Database } from '@/types';
import { apiFetch } from './_fetchHelper';

type BusinessUpdate = Database['public']['Tables']['businesses']['Update'] & {
  logo_fit?: 'cover' | 'contain' | null;
};

// Form data type without created_by (will be set by the server)
export interface CreateBusinessData {
  business_name: string;
  business_sector: string;
  business_type?: string;
  capital_investment?: number; // Optional for backward compatibility
  property_address?: string;
  logo_url?: string;
  logo_fit?: 'cover' | 'contain';
  city?: string;
  whatsapp_number?: string;
  widget_action_label?: string;
  is_public?: boolean;
}

export async function getUserBusinesses(
  userId: string,
  includeArchived = false
): Promise<Business[]> {
  const supabase = createClient();
  const [rolesResult, createdResult] = await Promise.all([
    supabase
      .from('user_business_roles')
      .select('business_id, businesses(*)')
      .eq('user_id', userId),
    supabase
      .from('businesses')
      .select('*')
      .eq('created_by', userId),
  ]);

  if (rolesResult.error) throw rolesResult.error;
  if (createdResult.error) throw createdResult.error;

  const membershipBusinesses = rolesResult.data
    ?.map((item) => item.businesses as unknown as Business)
    .filter((b): b is Business => b !== null) || [];
  const createdBusinesses = createdResult.data || [];
  const businessById = new Map<string, Business>();
  [...membershipBusinesses, ...createdBusinesses].forEach((business) => {
    businessById.set(business.id, business);
  });
  const businesses = Array.from(businessById.values());

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

/**
 * Create a new business (routes through POST /api/businesses).
 * Server provisions default accounts and initial capital transaction.
 * The userId argument is retained for backward compatibility but ignored —
 * the server derives the creator from the auth session.
 */
export async function createBusiness(
  business: CreateBusinessData,
  _userId?: string
): Promise<Business> {
  void _userId;
  return apiFetch<Business>('/api/businesses', {
    method: 'POST',
    body: business,
  });
}

/**
 * Update business fields (routes through PATCH /api/businesses/[id]).
 * Server syncs the initial capital transaction when capital_investment changes.
 */
export async function updateBusiness(
  businessId: string,
  updates: BusinessUpdate,
  _userId?: string
): Promise<Business> {
  void _userId;
  return apiFetch<Business>(`/api/businesses/${businessId}`, {
    method: 'PATCH',
    body: updates,
  });
}

export async function archiveBusiness(businessId: string): Promise<Business> {
  return apiFetch<Business>(`/api/businesses/${businessId}/archive`, {
    method: 'POST',
  });
}

export async function restoreBusiness(businessId: string): Promise<Business> {
  return apiFetch<Business>(`/api/businesses/${businessId}/archive`, {
    method: 'DELETE',
  });
}

/**
 * Hard delete a business. Superadmin-only; requires the business to be archived first.
 * FK cascade will remove all related rows (transactions, accounts, etc.).
 */
export async function hardDeleteBusiness(businessId: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/api/businesses/${businessId}/hard-delete`, {
    method: 'DELETE',
  });
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

  // Get all active businesses (is_public is for omnichannel widget, not for join access)
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

/**
 * Join a business as the authenticated user (routes through POST /api/businesses/[id]/membership).
 * Server derives the role from the user's profile.
 */
export async function joinBusiness(
  _userId: string,
  businessId: string
): Promise<void> {
  void _userId;
  await apiFetch(`/api/businesses/${businessId}/membership`, { method: 'POST' });
}

/**
 * Leave a business (routes through DELETE /api/businesses/[id]/membership).
 */
export async function leaveBusiness(
  _userId: string,
  businessId: string
): Promise<void> {
  void _userId;
  await apiFetch(`/api/businesses/${businessId}/membership`, { method: 'DELETE' });
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

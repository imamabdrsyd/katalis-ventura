import { createClient } from '@/lib/supabase';
import type { UserRole } from '@/types';

export interface BusinessMember {
  id: string;
  user_id: string;
  role: UserRole;
  joined_at: string;
  invited_by?: string;
  is_creator?: boolean;
  profile: {
    full_name: string;
    avatar_url?: string;
  } | null;
}

// Get all members of a business with their profile info
// Also includes the business creator (created_by) even if not in user_business_roles
export async function getBusinessMembers(businessId: string): Promise<BusinessMember[]> {
  const supabase = createClient();

  // Fetch roles from user_business_roles
  const { data: roles, error: rolesError } = await supabase
    .from('user_business_roles')
    .select('id, user_id, role, joined_at, invited_by')
    .eq('business_id', businessId)
    .order('joined_at', { ascending: true });

  if (rolesError) throw new Error(rolesError.message);

  // Fetch business creator info
  const { data: business } = await supabase
    .from('businesses')
    .select('created_by, created_at')
    .eq('id', businessId)
    .single();

  // Merge: start with roles, add creator if not already in the list
  const memberList = [...(roles || [])];
  const roleUserIds = new Set(memberList.map((r) => r.user_id));

  if (business?.created_by && !roleUserIds.has(business.created_by)) {
    memberList.unshift({
      id: `creator-${business.created_by}`,
      user_id: business.created_by,
      role: 'business_manager' as UserRole,
      joined_at: business.created_at,
      invited_by: undefined,
      is_creator: true,
    } as any);
  }

  if (memberList.length === 0) return [];

  // Fetch profiles for all user_ids
  const userIds = memberList.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds);

  const profileMap = new Map<string, { full_name: string; avatar_url?: string }>();
  (profiles || []).forEach((p: any) => profileMap.set(p.id, p));

  return memberList.map((item: any) => ({
    id: item.id,
    user_id: item.user_id,
    role: item.role,
    joined_at: item.joined_at,
    invited_by: item.invited_by,
    is_creator: item.is_creator ?? false,
    profile: profileMap.get(item.user_id) || null,
  }));
}

import { createClient } from '@/lib/supabase';

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface JoinRequest {
  id: string;
  business_id: string;
  requester_id: string;
  status: JoinRequestStatus;
  message: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  requester?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email?: string;
  };
}

export async function submitJoinRequest(
  businessId: string,
  requesterId: string,
  message?: string
): Promise<JoinRequest> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('business_join_requests')
    .insert({
      business_id: businessId,
      requester_id: requesterId,
      message: message || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function cancelJoinRequest(requestId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('business_join_requests')
    .delete()
    .eq('id', requestId);
  if (error) throw error;
}

export async function getMyJoinRequests(): Promise<JoinRequest[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('business_join_requests')
    .select('*')
    .eq('requester_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getBusinessJoinRequests(businessId: string): Promise<JoinRequest[]> {
  const supabase = createClient();
  const { data: requests, error } = await supabase
    .from('business_join_requests')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!requests || requests.length === 0) return [];

  const requesterIds = Array.from(new Set(requests.map((r) => r.requester_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', requesterIds);

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  return requests.map((r) => ({
    ...r,
    requester: profileMap.get(r.requester_id) || { id: r.requester_id, full_name: null, avatar_url: null },
  })) as JoinRequest[];
}

export async function getPendingRequestsCount(businessIds: string[]): Promise<number> {
  if (!businessIds.length) return 0;
  const supabase = createClient();
  const { count, error } = await supabase
    .from('business_join_requests')
    .select('*', { count: 'exact', head: true })
    .in('business_id', businessIds)
    .eq('status', 'pending');

  if (error) return 0;
  return count || 0;
}

export async function approveJoinRequest(
  requestId: string,
  reviewerId: string
): Promise<void> {
  const supabase = createClient();

  const { data: req, error: fetchErr } = await supabase
    .from('business_join_requests')
    .select('business_id, requester_id')
    .eq('id', requestId)
    .single();

  if (fetchErr || !req) throw fetchErr || new Error('Request not found');

  const { error: updateErr } = await supabase
    .from('business_join_requests')
    .update({ status: 'approved', reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', requestId);

  if (updateErr) throw updateErr;

  const { error: roleErr } = await supabase
    .from('user_business_roles')
    .insert({
      user_id: req.requester_id,
      business_id: req.business_id,
      role: 'investor',
      invited_by: reviewerId,
    });

  if (roleErr) throw roleErr;
}

export async function rejectJoinRequest(
  requestId: string,
  reviewerId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('business_join_requests')
    .update({ status: 'rejected', reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
}

export async function getExistingRequest(
  businessId: string,
  requesterId: string
): Promise<JoinRequest | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('business_join_requests')
    .select('*')
    .eq('business_id', businessId)
    .eq('requester_id', requesterId)
    .maybeSingle();

  if (error) return null;
  return data;
}

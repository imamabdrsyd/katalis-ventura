import { createClient } from '@/lib/supabase';
import type { InviteCode } from '@/types';
import { apiFetch } from './_fetchHelper';

export interface CreateInviteCodeData {
  business_id: string;
  role: 'business_manager' | 'investor';
  expires_at?: string; // ISO date string
  max_uses?: number;
}

/**
 * Create a new invite code (routes through POST /api/businesses/[id]/invite-codes).
 * Server generates the random code and sets created_by from the auth session.
 * The userId argument is retained for backward compatibility but ignored.
 */
export async function createInviteCode(
  data: CreateInviteCodeData,
  _userId?: string
): Promise<InviteCode> {
  void _userId;
  return apiFetch<InviteCode>(`/api/businesses/${data.business_id}/invite-codes`, {
    method: 'POST',
    body: {
      role: data.role,
      expires_at: data.expires_at ?? null,
      max_uses: data.max_uses,
    },
  });
}

/**
 * Get all invite codes for a business (manager-only — enforced server-side).
 */
export async function getBusinessInviteCodes(
  businessId: string
): Promise<InviteCode[]> {
  return apiFetch<InviteCode[]>(`/api/businesses/${businessId}/invite-codes`);
}

// Validate and get invite code
export async function validateInviteCode(
  code: string
): Promise<{ valid: boolean; inviteCode?: InviteCode; message?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (error || !data) {
    return { valid: false, message: 'Kode undangan tidak valid' };
  }

  const inviteCode = data as InviteCode;

  // Check if code is active
  if (!inviteCode.is_active) {
    return { valid: false, message: 'Kode undangan sudah tidak aktif' };
  }

  // Check expiration
  if (inviteCode.expires_at && new Date(inviteCode.expires_at) < new Date()) {
    return { valid: false, message: 'Kode undangan sudah kadaluarsa' };
  }

  // Check max uses
  if (inviteCode.current_uses >= inviteCode.max_uses) {
    return { valid: false, message: 'Kode undangan sudah mencapai batas penggunaan' };
  }

  return { valid: true, inviteCode };
}

// Use invite code to join business (routes through POST /api/invite-codes/use).
// The userId argument is retained for backward compatibility but ignored —
// the server derives it from the auth session.
export async function useInviteCode(
  code: string,
  _userId?: string
): Promise<{ success: boolean; message?: string; businessId?: string }> {
  void _userId;
  return apiFetch<{ success: boolean; message?: string; businessId?: string }>(
    '/api/invite-codes/use',
    { method: 'POST', body: { code } }
  );
}

// Deactivate invite code (routes through PATCH /api/invite-codes/[id])
export async function deactivateInviteCode(codeId: string): Promise<void> {
  await apiFetch(`/api/invite-codes/${codeId}`, {
    method: 'PATCH',
    body: { is_active: false },
  });
}

// Delete invite code (routes through DELETE /api/invite-codes/[id])
export async function deleteInviteCode(codeId: string): Promise<void> {
  await apiFetch(`/api/invite-codes/${codeId}`, { method: 'DELETE' });
}

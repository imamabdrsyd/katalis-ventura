import { createClient } from '@/lib/supabase';
import type { InviteCode } from '@/types';

// Generate cryptographically secure random invite code (8 characters)
function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(array[i] % chars.length);
  }
  return code;
}

export interface CreateInviteCodeData {
  business_id: string;
  role: 'business_manager' | 'investor';
  expires_at?: string; // ISO date string
  max_uses?: number;
}

// Create a new invite code
export async function createInviteCode(
  data: CreateInviteCodeData,
  userId: string
): Promise<InviteCode> {
  const supabase = createClient();
  const code = generateCode();

  const { data: inviteCode, error } = await supabase
    .from('invite_codes')
    .insert({
      business_id: data.business_id,
      code,
      role: data.role,
      created_by: userId,
      expires_at: data.expires_at,
      max_uses: data.max_uses || 10,
      current_uses: 0,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  return inviteCode;
}

// Get all invite codes for a business
export async function getBusinessInviteCodes(
  businessId: string
): Promise<InviteCode[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data || [];
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

// Use invite code to join business (transactional via RPC)
export async function useInviteCode(
  code: string,
  userId: string
): Promise<{ success: boolean; message?: string; businessId?: string }> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('use_invite_code', {
    p_code: code.toUpperCase(),
    p_user_id: userId,
  });

  if (error) {
    console.error('use_invite_code RPC error:', error);
    return { success: false, message: 'Gagal memproses kode undangan. Coba lagi.' };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { success: false, message: 'Kode undangan tidak valid' };
  }

  return {
    success: row.success,
    message: row.message ?? undefined,
    businessId: row.business_id ?? undefined,
  };
}

// Deactivate invite code
export async function deactivateInviteCode(codeId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('invite_codes')
    .update({ is_active: false })
    .eq('id', codeId);

  if (error) throw error;
}

// Delete invite code
export async function deleteInviteCode(codeId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('invite_codes')
    .delete()
    .eq('id', codeId);

  if (error) throw error;
}

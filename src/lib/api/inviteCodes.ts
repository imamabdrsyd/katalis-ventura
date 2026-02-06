import { createClient } from '@/lib/supabase';
import type { InviteCode, UserRole } from '@/types';

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

// Use invite code to join business
export async function useInviteCode(
  code: string,
  userId: string
): Promise<{ success: boolean; message?: string; businessId?: string }> {
  const supabase = createClient();

  // Validate code
  const validation = await validateInviteCode(code);
  if (!validation.valid || !validation.inviteCode) {
    return { success: false, message: validation.message };
  }

  const inviteCode = validation.inviteCode;

  // Check if user already joined this business
  const { data: existingRole } = await supabase
    .from('user_business_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('business_id', inviteCode.business_id)
    .single();

  if (existingRole) {
    return { success: false, message: 'Anda sudah tergabung di bisnis ini' };
  }

  // Atomic increment: use current_uses condition to prevent race condition.
  // Only update if current_uses hasn't changed since validation (optimistic lock).
  const { data: updatedCode, error: updateError } = await supabase
    .from('invite_codes')
    .update({ current_uses: inviteCode.current_uses + 1 })
    .eq('id', inviteCode.id)
    .eq('current_uses', inviteCode.current_uses) // Optimistic concurrency check
    .lt('current_uses', inviteCode.max_uses) // Ensure we don't exceed max
    .select()
    .single();

  if (updateError || !updatedCode) {
    // Another request used this code concurrently, or max uses reached
    return { success: false, message: 'Kode undangan sudah mencapai batas penggunaan atau sedang digunakan. Coba lagi.' };
  }

  // Add user to business
  const { error: roleError } = await supabase.from('user_business_roles').insert({
    user_id: userId,
    business_id: inviteCode.business_id,
    role: inviteCode.role,
    invited_by: inviteCode.created_by,
  });

  if (roleError) {
    // Rollback the usage counter since the join failed
    await supabase
      .from('invite_codes')
      .update({ current_uses: inviteCode.current_uses })
      .eq('id', inviteCode.id);

    console.error('Error adding user to business:', roleError);
    return { success: false, message: 'Gagal bergabung ke bisnis' };
  }

  return { success: true, businessId: inviteCode.business_id };
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

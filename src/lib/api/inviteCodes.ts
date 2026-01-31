import { createClient } from '@/lib/supabase';
import type { InviteCode, UserRole } from '@/types';

const supabase = createClient();

// Generate random invite code (8 characters)
function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
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

  // Add user to business
  const { error: roleError } = await supabase.from('user_business_roles').insert({
    user_id: userId,
    business_id: inviteCode.business_id,
    role: inviteCode.role,
    invited_by: inviteCode.created_by,
  });

  if (roleError) {
    console.error('Error adding user to business:', roleError);
    return { success: false, message: 'Gagal bergabung ke bisnis' };
  }

  // Increment current_uses
  const { error: updateError } = await supabase
    .from('invite_codes')
    .update({ current_uses: inviteCode.current_uses + 1 })
    .eq('id', inviteCode.id);

  if (updateError) {
    console.error('Error updating invite code usage:', updateError);
  }

  return { success: true, businessId: inviteCode.business_id };
}

// Deactivate invite code
export async function deactivateInviteCode(codeId: string): Promise<void> {
  const { error } = await supabase
    .from('invite_codes')
    .update({ is_active: false })
    .eq('id', codeId);

  if (error) throw error;
}

// Delete invite code
export async function deleteInviteCode(codeId: string): Promise<void> {
  const { error } = await supabase
    .from('invite_codes')
    .delete()
    .eq('id', codeId);

  if (error) throw error;
}

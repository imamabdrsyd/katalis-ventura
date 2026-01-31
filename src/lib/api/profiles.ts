import { createClient } from '@/lib/supabase';
import type { Profile } from '@/types';

// Get profile by user ID
export async function getProfileById(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data as Profile;
}

// Get profile name by user ID (lightweight)
export async function getProfileName(userId: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data?.full_name || null;
}

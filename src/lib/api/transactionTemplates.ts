import { createClient } from '@/lib/supabase';
import type { TransactionTemplate } from '@/types';

export async function getTransactionTemplates(businessId: string): Promise<TransactionTemplate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transaction_templates')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createTransactionTemplate(
  businessId: string,
  template: Omit<TransactionTemplate, 'id' | 'business_id' | 'created_by' | 'created_at'>
): Promise<TransactionTemplate> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('transaction_templates')
    .insert({
      business_id: businessId,
      created_by: user?.id,
      ...template,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTransactionTemplate(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('transaction_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

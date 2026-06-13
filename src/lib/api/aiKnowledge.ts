import { createClient } from '@/lib/supabase';
import type { AiKnowledgeFields } from '@/types';

/**
 * Akses data `business_ai_knowledge` — pengetahuan bisnis level-bisnis yang
 * dibaca AI saat membalas lead di semua channel. 1:1 dengan businesses.
 *
 * Punya 2 bagian: `content` (catatan bebas) + `fields` (terstruktur: hours,
 * location, policies, faq). Client-side langsung ke Supabase (pola catalog.ts).
 * RLS yang menjaga: hanya manager/both/superadmin yang boleh insert/update.
 */

export interface BusinessAiKnowledgeData {
  content: string;
  fields: AiKnowledgeFields;
}

/** Ambil knowledge bisnis. Return content '' + fields {} bila belum ada row. */
export async function getBusinessAiKnowledge(
  businessId: string
): Promise<BusinessAiKnowledgeData> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('business_ai_knowledge')
    .select('content, fields')
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return {
    content: data?.content ?? '',
    fields: (data?.fields as AiKnowledgeFields | null) ?? {},
  };
}

/**
 * Simpan knowledge (content + fields). `created_by` hanya di-set saat insert
 * pertama — saat update jangan overwrite (attribusi update via trigger
 * set_updated_by). Cek keberadaan row dulu agar created_by tidak tertimpa.
 */
export async function saveBusinessAiKnowledge(
  businessId: string,
  content: string,
  fields: AiKnowledgeFields,
  userId: string
): Promise<void> {
  const supabase = createClient();

  const { data: existing, error: selError } = await supabase
    .from('business_ai_knowledge')
    .select('id')
    .eq('business_id', businessId)
    .maybeSingle();
  if (selError) throw new Error(selError.message);

  if (existing) {
    const { error } = await supabase
      .from('business_ai_knowledge')
      .update({ content, fields })
      .eq('business_id', businessId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('business_ai_knowledge')
      .insert({ business_id: businessId, content, fields, created_by: userId });
    if (error) throw new Error(error.message);
  }
}

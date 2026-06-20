import { createServerClient } from '@/lib/supabase-server';

export interface AgentMemory {
  id?: string;
  user_id: string;
  business_id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
  created_at?: string;
}

export interface SessionMeta {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

/**
 * Menyimpan pesan-pesan (chat history) ke dalam tabel agent_memories di Supabase.
 */
export async function saveMessages(
  businessId: string,
  userId: string,
  sessionId: string,
  messages: Array<{ role: 'user' | 'assistant' | 'system', content: string, metadata?: any }>
) {
  if (!messages.length) return;
  
  const supabase = await createServerClient();
  
  const values = messages.map(msg => ({
    user_id: userId,
    business_id: businessId,
    session_id: sessionId,
    role: msg.role,
    content: msg.content,
    metadata: msg.metadata || {},
  }));

  try {
    // Hapus history lama untuk session ini agar tidak duplikat, lalu insert ulang state terbaru
    await supabase.from('agent_memories')
      .delete()
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .eq('session_id', sessionId);

    const { error } = await supabase.from('agent_memories').insert(values);
    if (error) throw error;
  } catch (err) {
    console.error('[memory.ts] Error saving messages to Supabase:', err);
    throw err;
  }
}

/**
 * Memuat semua pesan dari sesi tertentu (untuk me-load ulang chat saat refresh).
 */
export async function loadSession(businessId: string, userId: string, sessionId: string) {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from('agent_memories')
      .select('*')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[memory.ts] Error loading session from Supabase:', err);
    return [];
  }
}

/**
 * Menyimpan memori manual dari AIChatPanel (FAB).
 * Ini disimpan sebagai sebuah sesi khusus agar mudah dicari oleh Orchestrator nanti.
 */
export async function saveManualMemory(
  businessId: string,
  userId: string,
  summary: string,
  metadata?: any
) {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.from('agent_memories').insert({
      user_id: userId,
      business_id: businessId,
      session_id: 'manual-memory',
      role: 'system',
      content: summary,
      metadata: metadata || { source: 'aichatpanel' }
    });
    
    if (error) throw error;
  } catch (err) {
    console.error('[memory.ts] Error saving manual memory to Supabase:', err);
    throw err;
  }
}

/**
 * Memuat semua memory dari Memory Vault (History FAB + lain-lain)
 */
export async function getMemoryVault(businessId: string, userId: string) {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from('agent_memories')
      .select('*')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .eq('session_id', 'manual-memory')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[memory.ts] Error loading memory vault from Supabase:', err);
    return [];
  }
}

/**
 * Memuat semua sesi (history) yang tersimpan
 */
export async function getSessions(businessId: string, userId: string) {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from('agent_memories')
      .select('session_id, created_at, content, role')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .neq('session_id', 'manual-memory')
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    const sessionsMap = new Map<string, { session_id: string; created_at: string; content: string }>();
    for (const row of data || []) {
      if (!sessionsMap.has(row.session_id)) {
        sessionsMap.set(row.session_id, {
          session_id: row.session_id,
          created_at: row.created_at,
          content: row.role === 'user' ? row.content : 'Percakapan Kosong',
        });
      } else if (row.role === 'user' && sessionsMap.get(row.session_id)!.content === 'Percakapan Kosong') {
        // Just in case the first message wasn't user
        sessionsMap.get(row.session_id)!.content = row.content;
      }
    }
    
    return Array.from(sessionsMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (err) {
    console.error('[memory.ts] Error loading sessions from Supabase:', err);
    return [];
  }
}

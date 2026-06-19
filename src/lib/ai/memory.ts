import { gcpSql } from '@/lib/gcp';

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
 * Menyimpan pesan-pesan (chat history) ke dalam tabel agent_memories di GCP Cloud SQL.
 */
export async function saveMessages(
  businessId: string,
  userId: string,
  sessionId: string,
  messages: Array<{ role: 'user' | 'assistant' | 'system', content: string, metadata?: any }>
) {
  if (!messages.length) return;
  
  // Karena `agent_memories` memiliki struktur sederhana, kita insert langsung.
  // Untuk fase 1, kita sisipkan tanpa vector embedding (itu di Fase 2).
  
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
    await gcpSql`
      DELETE FROM agent_memories 
      WHERE business_id = ${businessId} 
        AND user_id = ${userId} 
        AND session_id = ${sessionId}
    `;

    await gcpSql`
      INSERT INTO agent_memories ${gcpSql(values, 'user_id', 'business_id', 'session_id', 'role', 'content', 'metadata')}
    `;
  } catch (err) {
    console.error('[memory.ts] Error saving messages to GCP:', err);
    throw err;
  }
}

/**
 * Memuat semua pesan dari sesi tertentu (untuk me-load ulang chat saat refresh).
 */
export async function loadSession(businessId: string, userId: string, sessionId: string) {
  try {
    const messages = await gcpSql<AgentMemory[]>`
      SELECT * FROM agent_memories
      WHERE business_id = ${businessId}
        AND user_id = ${userId}
        AND session_id = ${sessionId}
      ORDER BY created_at ASC
    `;
    
    return messages;
  } catch (err) {
    console.error('[memory.ts] Error loading session from GCP:', err);
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
    await gcpSql`
      INSERT INTO agent_memories (
        user_id, business_id, session_id, role, content, metadata
      ) VALUES (
        ${userId}, ${businessId}, 'manual-memory', 'system', ${summary}, ${metadata || { source: 'aichatpanel' }}
      )
    `;
  } catch (err) {
    console.error('[memory.ts] Error saving manual memory to GCP:', err);
    throw err;
  }
}

/**
 * Memuat semua memory dari Memory Vault (History FAB + lain-lain)
 */
export async function getMemoryVault(businessId: string, userId: string) {
  try {
    const memories = await gcpSql<AgentMemory[]>`
      SELECT * FROM agent_memories
      WHERE business_id = ${businessId}
        AND user_id = ${userId}
        AND session_id = 'manual-memory'
      ORDER BY created_at DESC
    `;
    return memories;
  } catch (err) {
    console.error('[memory.ts] Error loading memory vault from GCP:', err);
    return [];
  }
}

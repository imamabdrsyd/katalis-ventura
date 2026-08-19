import gcpSql from './gcp';

/**
 * Bootstrap skema GCP Cloud SQL untuk knowledge base AXION Agent.
 *
 * Dulu file ini juga membuat `agent_memories` (semantic memory / recall_memory)
 * dan lima tabel `olap_*` (replika analitik). Keduanya DICABUT 19 Agustus 2026
 * bersama instance Cloud SQL `axion-agents` yang dihapus 10 Agustus 2026 untuk
 * menolkan tagihan — lihat docs §26. Yang tersisa hanya tabel embedding yang
 * masih dipakai `search_knowledge_base` + `/api/ai/upload-knowledge`.
 */
export async function initGcpSchema() {
  console.log('Initializing GCP SQL Schema...');

  // Enable vector extension
  await gcpSql`CREATE EXTENSION IF NOT EXISTS vector;`;

  await gcpSql`
    CREATE TABLE IF NOT EXISTS business_knowledge_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id UUID NOT NULL,
      source_type TEXT,
      chunk_content TEXT NOT NULL,
      embedding vector(768),
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  await gcpSql`CREATE INDEX IF NOT EXISTS idx_knowledge_business ON business_knowledge_embeddings(business_id);`;

  // ANN index cosine untuk RAG search_knowledge_base. Tanpa ini tiap pencarian =
  // sequential scan eksak yang melambat linear. HNSW butuh pgvector >= 0.5.
  await gcpSql`
    CREATE INDEX IF NOT EXISTS idx_knowledge_embedding
    ON business_knowledge_embeddings USING hnsw (embedding vector_cosine_ops);
  `;

  console.log('GCP SQL Schema initialization complete.');
  return { success: true };
}

import gcpSql from '../gcp';

export interface KnowledgeChunk {
  business_id: string;
  source_type: string;
  chunk_content: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

/**
 * Menyisipkan chunk teks beserta vektor embedding ke tabel business_knowledge_embeddings.
 */
export async function insertKnowledgeChunk(chunk: KnowledgeChunk) {
  const { business_id, source_type, chunk_content, embedding, metadata } = chunk;
  
  // vector type di postgres menggunakan format [1,2,3] (sebagai string '[1,2,3]')
  const embeddingString = `[${embedding.join(',')}]`;

  await gcpSql`
    INSERT INTO business_knowledge_embeddings 
      (business_id, source_type, chunk_content, embedding, metadata)
    VALUES 
      (${business_id}, ${source_type}, ${chunk_content}, ${embeddingString}, ${metadata ? JSON.stringify(metadata) : null})
  `;
}

/**
 * Mencari knowledge chunks yang paling relevan berdasarkan cosine similarity.
 */
export async function searchKnowledgeBase(
  businessId: string, 
  queryEmbedding: number[], 
  limit: number = 10,
  similarityThreshold: number = 0.0
) {
  const embeddingString = `[${queryEmbedding.join(',')}]`;

  // `<=>` adalah operator cosine distance di pgvector. 
  // Similarity = 1 - cosine_distance. Semakin kecil distance, semakin mirip.
  // Threshold 0.0 similarity berarti distance <= 1.0
  const maxDistance = 1 - similarityThreshold;

  const results = await gcpSql`
    SELECT 
      id,
      source_type,
      chunk_content,
      metadata,
      1 - (embedding <=> ${embeddingString}) as similarity
    FROM business_knowledge_embeddings
    WHERE business_id = ${businessId}
      AND (embedding <=> ${embeddingString}) <= ${maxDistance}
    ORDER BY embedding <=> ${embeddingString}
    LIMIT ${limit}
  `;

  return results;
}

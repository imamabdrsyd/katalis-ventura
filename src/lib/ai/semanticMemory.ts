/**
 * Semantic memory untuk AXION Agent.
 *
 * Mengisi tabel GCP `agent_memories.embedding` (vector 768) yang sebelumnya dibuat
 * tapi tidak pernah ditulis, sehingga agent bisa "mengingat" lintas sesi via tool
 * recall_memory. Dua sumber memori (sesuai keputusan produk):
 *  1. Vault  — memori manual yang user simpan eksplisit (tombol Memorize). Append.
 *  2. Session summary — ringkasan sesi chat (LLM), satu baris per sesi, di-replace
 *     saat sesi bertambah panjang (debounce by message_count).
 *
 * Ingestion dipanggil non-blocking via `after()` di route memorize & memory agar
 * tidak menambah latency ke jalur simpan chat. Semua fungsi resilient: gagal embed
 * /summary tidak melempar ke pemanggil (memori semantik bersifat best-effort).
 *
 * Catatan: copy Supabase `agent_memories` (di memory.ts) tetap dipakai untuk UI
 * (reload sesi, Memory Vault). GCP copy di sini khusus untuk vector recall.
 */

import gcpSql from '@/lib/gcp';
import { getVertexTokenAndProject } from '@/lib/ai/vertexAuth';

const EMBED_MODEL = 'text-embedding-004';
const SUMMARY_MODEL = 'gemini-3.5-flash';

/** pgvector menerima literal teks '[1,2,3]' untuk kolom vector (lihat knowledge.ts). */
function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

/** Embed satu teks → vektor 768-dim. Lempar bila Vertex error. */
export async function embedText(token: string, projectId: string, text: string): Promise<number[]> {
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${EMBED_MODEL}:predict`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ instances: [{ content: text }] }),
  });
  if (!res.ok) {
    throw new Error(`Embedding gagal: ${res.status}`);
  }
  const data = await res.json();
  return data.predictions[0].embeddings.values as number[];
}

/**
 * Cari memori paling relevan secara semantik (cosine) untuk satu user+bisnis.
 * Dipakai oleh tool recall_memory.
 */
export async function searchMemories(
  businessId: string,
  userId: string,
  queryEmbedding: number[],
  limit = 5,
  similarityThreshold = 0.6,
) {
  const emb = toVectorLiteral(queryEmbedding);
  const maxDistance = 1 - similarityThreshold;

  const rows = await gcpSql`
    SELECT
      session_id,
      content,
      metadata,
      created_at,
      1 - (embedding <=> ${emb}) AS similarity
    FROM agent_memories
    WHERE business_id = ${businessId}
      AND user_id = ${userId}
      AND embedding IS NOT NULL
      AND (embedding <=> ${emb}) <= ${maxDistance}
    ORDER BY embedding <=> ${emb}
    LIMIT ${limit}
  `;
  return rows;
}

/**
 * Ingest memori Vault (manual). Setiap simpan = satu memori baru yang dapat di-recall.
 * Best-effort: kegagalan tidak dilempar.
 */
export async function ingestVaultMemory(
  businessId: string,
  userId: string,
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const auth = await getVertexTokenAndProject();
    if (!auth) return;
    const embedding = await embedText(auth.token, auth.projectId, content);
    await gcpSql`
      INSERT INTO agent_memories (business_id, user_id, session_id, role, content, embedding, metadata)
      VALUES (
        ${businessId}, ${userId}, ${'manual-memory'}, ${'system'}, ${content},
        ${toVectorLiteral(embedding)}, ${JSON.stringify({ source: 'vault', ...metadata })}
      )
    `;
  } catch (err) {
    console.error('[semanticMemory] ingestVaultMemory gagal:', err instanceof Error ? err.message : err);
  }
}

/** Ringkas transcript sesi jadi 2–4 kalimat padat via Gemini Flash. Null bila gagal. */
async function summarizeMessages(
  token: string,
  projectId: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string | null> {
  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Asisten'}: ${m.content}`)
    .join('\n')
    .slice(0, 8000);

  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${SUMMARY_MODEL}:generateContent`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              'Ringkas percakapan berikut menjadi 2–4 kalimat padat dalam Bahasa Indonesia. ' +
              'Tangkap topik utama, keputusan, angka, dan fakta penting yang berguna untuk diingat ' +
              'di percakapan mendatang. Jangan tambahkan basa-basi atau pembuka.\n\n' +
              transcript,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error('[semanticMemory] summarize gagal:', res.status);
    return null;
  }
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? '')
    .join('')
    .trim();
  return text && text.length > 0 ? text : null;
}

/**
 * Ingest ringkasan sesi chat. Satu baris ringkasan per sesi, di-replace saat sesi
 * tumbuh ≥4 pesan sejak ringkasan terakhir (debounce agar tidak summarize tiap save).
 * Best-effort: kegagalan tidak dilempar.
 */
export async function ingestSessionSummary(
  businessId: string,
  userId: string,
  sessionId: string,
  messages: Array<{ role: string; content: string }>,
): Promise<void> {
  try {
    if (messages.length < 4) return; // belum cukup substansial

    // Debounce: jangan re-summarize kalau belum ada ≥4 pesan baru.
    const existing = await gcpSql<{ mc: number | null }[]>`
      SELECT (metadata->>'message_count')::int AS mc
      FROM agent_memories
      WHERE business_id = ${businessId}
        AND user_id = ${userId}
        AND session_id = ${sessionId}
        AND metadata->>'source' = 'session_summary'
      LIMIT 1
    `;
    const lastCount = existing?.[0]?.mc ?? 0;
    if (messages.length < lastCount + 4) return;

    const auth = await getVertexTokenAndProject();
    if (!auth) return;

    const summary = await summarizeMessages(auth.token, auth.projectId, messages);
    if (!summary) return;

    const embedding = await embedText(auth.token, auth.projectId, summary);

    await gcpSql.begin(async (sql) => {
      await sql`
        DELETE FROM agent_memories
        WHERE business_id = ${businessId}
          AND user_id = ${userId}
          AND session_id = ${sessionId}
          AND metadata->>'source' = 'session_summary'
      `;
      await sql`
        INSERT INTO agent_memories (business_id, user_id, session_id, role, content, embedding, metadata)
        VALUES (
          ${businessId}, ${userId}, ${sessionId}, ${'system'}, ${summary},
          ${toVectorLiteral(embedding)},
          ${JSON.stringify({ source: 'session_summary', message_count: messages.length })}
        )
      `;
    });
  } catch (err) {
    console.error('[semanticMemory] ingestSessionSummary gagal:', err instanceof Error ? err.message : err);
  }
}

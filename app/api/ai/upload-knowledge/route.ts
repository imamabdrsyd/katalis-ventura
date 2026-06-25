import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getVertexTokenAndProject } from '@/lib/ai/vertexAuth';
import { insertKnowledgeChunk } from '@/lib/ai/knowledge';

// Vertex AI models
const GEMINI_MODEL = 'gemini-3.5-flash';
const EMBEDDING_MODEL = 'text-embedding-004';

// Helper for chunking text. Paragraf yang sendirian sudah melebihi maxChars
// (mis. CSV tanpa baris kosong jadi satu "paragraf" raksasa) dipotong lagi
// per baris agar tidak ada chunk yang jauh melebihi maxChars.
function splitOversizedParagraph(p: string, maxChars: number): string[] {
  if (p.length <= maxChars) return [p];

  const lines = p.split('\n');
  const subChunks: string[] = [];
  let current = '';
  for (const line of lines) {
    if (current.length + line.length + 1 > maxChars) {
      if (current) subChunks.push(current);
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current) subChunks.push(current);
  return subChunks;
}

function chunkText(text: string, maxChars: number = 1000): string[] {
  const paragraphs = text.split(/\n\s*\n/).flatMap(p => splitOversizedParagraph(p, maxChars));
  const chunks: string[] = [];
  let currentChunk = '';

  for (const p of paragraphs) {
    if (currentChunk.length + p.length > maxChars) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = p;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + p;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

// Function to extract text using Gemini
async function extractTextWithGemini(
  token: string,
  projectId: string,
  mimeType: string,
  base64Data: string
): Promise<string> {
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${GEMINI_MODEL}:generateContent`;
  
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          { text: "Extract all the text content from this document accurately. Do not summarize, just extract the raw text." }
        ]
      }
    ]
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Gemini extraction error:', errorBody);
    let errMsg = errorBody;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error && parsed.error.message) errMsg = parsed.error.message;
    } catch { /* ignore */ }
    throw new Error(`Gagal mengekstrak teks dengan Gemini: ${errMsg}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Function to get embeddings
async function getEmbeddings(
  token: string,
  projectId: string,
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${EMBEDDING_MODEL}:predict`;
  
  const payload = {
    instances: texts.map(t => ({ content: t })),
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Embedding error:', errorBody);
    let errMsg = errorBody;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error && parsed.error.message) errMsg = parsed.error.message;
    } catch { /* ignore */ }
    throw new Error(`Gagal melakukan embedding teks: ${errMsg}`);
  }

  const data = await res.json();
  return data.predictions.map((p: any) => p.embeddings.values);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const businessId = formData.get('businessId') as string;

    if (!file || !businessId) {
      return NextResponse.json({ error: 'File atau businessId hilang' }, { status: 400 });
    }

    const auth = await getVertexTokenAndProject();
    if (!auth) {
      return NextResponse.json({ error: 'Vertex AI tidak dikonfigurasi' }, { status: 503 });
    }

    let extractedText = '';

    // If text or CSV, read directly. If PDF, use Gemini to parse.
    if (file.type === 'application/pdf') {
      const buffer = await file.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString('base64');
      extractedText = await extractTextWithGemini(auth.token, auth.projectId, file.type, base64Data);
    } else {
      extractedText = await file.text();
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ error: 'Dokumen kosong atau tidak terbaca' }, { status: 400 });
    }

    // Chunking text
    const chunks = chunkText(extractedText, 1000);
    
    // Process in batches of 10 to avoid payload limits
    const batchSize = 10;
    let savedChunksCount = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchChunks = chunks.slice(i, i + batchSize);
      const embeddings = await getEmbeddings(auth.token, auth.projectId, batchChunks);

      for (let j = 0; j < batchChunks.length; j++) {
        await insertKnowledgeChunk({
          business_id: businessId,
          source_type: file.name,
          chunk_content: batchChunks[j],
          embedding: embeddings[j],
          metadata: { uploaded_by: user.id, file_type: file.type }
        });
        savedChunksCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Berhasil mengunggah dokumen: ${file.name}`,
      chunks_processed: savedChunksCount 
    });

  } catch (error: any) {
    console.error('[upload-knowledge] error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

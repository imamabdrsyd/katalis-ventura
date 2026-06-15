import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import {
  AIProviderRequestError,
  streamTextGeminiVertex,
  PROVIDER_LABELS,
  MODEL_LABELS,
  type AIMessage,
  type StreamResult,
} from '@/lib/ai/provider';

/**
 * Chat general-purpose untuk halaman Agentic Workspace (/agent).
 *
 * Berbeda dari /api/ai/chat (asisten keuangan AXION yang di-constrain ke data bisnis):
 * route ini PURE pass-through ke LLM provider — bisa terima topik apapun, tidak
 * fetch konteks transaksi/akun, tidak butuh role bisnis. Hanya butuh user login.
 */

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1).max(8000),
    })
  ).min(1).max(30),
});

// System prompt terbuka — bukan asisten keuangan. Bebas topik, jawab Bahasa Indonesia
// kecuali user pakai bahasa lain.
const SYSTEM_PROMPT = `Kamu adalah AXION Agent, asisten AI serbaguna yang membantu pengguna dengan topik apa pun.
Jawab dengan jelas, akurat, dan ringkas. Gunakan Bahasa Indonesia kecuali pengguna menggunakan bahasa lain.
Kamu boleh membahas topik apa saja — tidak terbatas pada keuangan atau akuntansi.`;

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }

  const aiMessages = parsed.data.messages.map(m => ({ role: m.role, content: m.content })) as AIMessage[];

  // Provider khusus agent = Vertex (Gemini Vertex) — keputusan produk.
  let result: StreamResult | null;
  try {
    result = await streamTextGeminiVertex(SYSTEM_PROMPT, aiMessages, {
      temperature: 0.7,
      maxTokens: 2048,
    });
  } catch (error) {
    if (error instanceof AIProviderRequestError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('[api/agent/chat] Provider error:', error);
    return NextResponse.json({ error: 'AI tidak tersedia saat ini. Coba lagi nanti.' }, { status: 503 });
  }

  if (!result) {
    return NextResponse.json({ error: 'AI tidak tersedia saat ini. Coba lagi nanti.' }, { status: 503 });
  }

  const providerLabel = PROVIDER_LABELS[result.provider];
  const modelLabel = MODEL_LABELS[result.model] ?? result.model;

  const encoder = new TextEncoder();
  const sseStream = new ReadableStream({
    async start(controller) {
      const reader = result.stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: value.text, kind: value.kind })}\n\n`)
            );
          }
        }
      } finally {
        reader.releaseLock();
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new NextResponse(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-AI-Provider': providerLabel,
      'X-AI-Model': modelLabel,
    },
  });
}

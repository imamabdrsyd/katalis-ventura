/**
 * /api/ai/agent-query — Agentic loop dengan tool calling (Vertex / Gemini provider).
 *
 * Alur:
 * 1. Terima pesan user + business_id
 * 2. Kirim ke Gemini Vertex dengan 4 tool definitions
 * 3. Kalau Gemini balas dengan function_call → eksekusi tool handler (DB query)
 * 4. Kirim hasil tool kembali ke Gemini → Gemini formulasi jawaban final
 * 5. Return: { answer, navigate?, model }
 *
 * navigate: kalau agent memanggil navigate_to → client melakukan router.push
 * Tool calling max 3 iterasi (cegah loop tak terbatas).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, getAuthenticatedUser, getBusinessRoleForUser } from '@/lib/supabase-server';
import { buildFinancialContext } from '@/lib/ai/financialContext';
import { CHAT_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { TOOL_DEFINITIONS, executeTool, type NavigateAction } from '@/lib/ai/agentTools';
import { getVertexTokenAndProject } from '@/lib/ai/vertexAuth';
import type { Transaction, Account } from '@/types';

const bodySchema = z.object({
  business_id: z.string().uuid(),
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .max(10)
    .optional()
    .default([]),
});

const GEMINI_VERTEX_MODEL = 'gemini-2.5-flash';
const MAX_TOOL_ITERATIONS = 3;

const AGENT_SYSTEM_PROMPT =
  CHAT_SYSTEM_PROMPT +
  `

KEMAMPUAN TAMBAHAN (Tool Calling):
Kamu punya akses ke 4 tools untuk mengambil data real-time dari database bisnis:
- query_transactions: ambil & filter transaksi
- get_financial_summary: hitung P&L untuk periode tertentu
- get_contacts: daftar kontak + statistik per kontak
- navigate_to: arahkan user ke halaman/fitur tertentu di AXION

KAPAN PAKAI TOOL:
- Gunakan query_transactions saat user tanya detail transaksi spesifik yang tidak ada di konteks (mis. "transaksi dari Dila", "CAPEX bulan Maret", "5 transaksi terbesar").
- Gunakan get_financial_summary saat butuh P&L periode yang tidak ada di snapshot 6 bulan (mis. "revenue Q1", "laba tahun lalu").
- Gunakan get_contacts saat user tanya kontak/customer/vendor spesifik.
- Gunakan navigate_to saat user minta MELIHAT/MEMBUKA halaman atau data tertentu (kata kunci: "lihat", "buka", "tampilkan", "cek di halaman", "pergi ke"). JANGAN gunakan navigate_to untuk menjawab pertanyaan analitik — gunakan tool data dulu, jawab, BARU tawarkan navigate kalau relevan.
- Kalau data sudah ada di konteks keuangan yang dikirim, JANGAN panggil tool — jawab langsung dari konteks.

PENTING: Gunakan tool hanya jika benar-benar butuh data yang tidak ada. Jangan overuse — satu tool call per pertanyaan sudah cukup di kebanyakan kasus.`;

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  const { business_id, message, history } = parsed.data;

  const supabase = await createServerClient();
  const role = await getBusinessRoleForUser(supabase, user.id, business_id);
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Fetch business context (paralel)
  const [{ data: business }, { data: accounts }, { data: transactions }] = await Promise.all([
    supabase.from('businesses').select('business_name, business_sector').eq('id', business_id).single(),
    supabase.from('accounts').select('*').eq('business_id', business_id),
    supabase
      .from('transactions')
      .select(`*, debit_account:accounts!transactions_debit_account_id_fkey(*), credit_account:accounts!transactions_credit_account_id_fkey(*), journal_lines(*, account:accounts(*))`)
      .eq('business_id', business_id)
      .is('deleted_at', null)
      .or('status.is.null,status.eq.posted')
      .order('date', { ascending: false })
      .limit(3000),
  ]);

  const financialContext = buildFinancialContext(
    business?.business_name ?? 'Bisnis',
    business?.business_sector ?? '',
    (transactions ?? []) as unknown as Transaction[],
    (accounts ?? []) as unknown as Account[],
    new Date()
  );

  // Auth untuk Vertex AI
  const auth = await getVertexTokenAndProject();
  if (!auth) {
    return NextResponse.json({ error: 'Vertex AI tidak dikonfigurasi.' }, { status: 503 });
  }
  const { token, projectId } = auth;

  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${GEMINI_VERTEX_MODEL}:generateContent`;

  // Bangun conversation: history + pesan user baru (dengan konteks keuangan di-inject)
  type GeminiPart = { text: string };
  type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };
  type FunctionCallPart = { functionCall: { name: string; args: Record<string, unknown> } };
  type FunctionResponsePart = { functionResponse: { name: string; response: { content: unknown } } };

  const contents: GeminiContent[] = [
    // History sebelumnya
    ...history.map(m => ({
      role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: m.content }],
    })),
    // Pesan user terbaru — inject financial context
    {
      role: 'user' as const,
      parts: [{ text: `${financialContext}\n\n${message}` }],
    },
  ];

  // Agentic loop: max MAX_TOOL_ITERATIONS
  let navigateAction: NavigateAction | null = null;
  let finalAnswer = '';

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const reqBody = {
      system_instruction: { parts: [{ text: AGENT_SYSTEM_PROMPT }] },
      contents,
      tools: [{ function_declarations: TOOL_DEFINITIONS }],
      tool_config: { function_calling_config: { mode: 'AUTO' } },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    };

    let geminiRes: Response;
    try {
      geminiRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(reqBody),
      });
    } catch (err) {
      console.error('[agent-query] fetch error:', err);
      return NextResponse.json({ error: 'Tidak dapat terhubung ke Vertex AI.' }, { status: 503 });
    }

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      console.error('[agent-query] Gemini error:', geminiRes.status, detail);
      return NextResponse.json({ error: `Vertex AI error: ${geminiRes.status}` }, { status: 502 });
    }

    const geminiJson = await geminiRes.json() as {
      candidates?: Array<{
        content: {
          role: string;
          parts: Array<GeminiPart | FunctionCallPart>;
        };
        finishReason?: string;
      }>;
    };

    const candidate = geminiJson.candidates?.[0];
    if (!candidate) {
      return NextResponse.json({ error: 'Tidak ada respons dari Gemini.' }, { status: 502 });
    }

    const parts = candidate.content.parts;

    // Cek apakah ada function_call di response
    const functionCallParts = parts.filter(
      (p): p is FunctionCallPart => 'functionCall' in p
    );

    if (functionCallParts.length === 0) {
      // Tidak ada tool call → ini jawaban final
      finalAnswer = parts
        .filter((p): p is GeminiPart => 'text' in p)
        .map(p => p.text)
        .join('');
      break;
    }

    // Eksekusi semua tool calls (bisa lebih dari satu dalam satu respons)
    const toolResponseParts: FunctionResponsePart[] = [];

    // Tambah model response ke history dulu
    contents.push({
      role: 'model',
      parts: parts as GeminiPart[],
    });

    for (const fc of functionCallParts) {
      const { name, args } = fc.functionCall;
      const result = await executeTool(name, args as Record<string, unknown>, business_id);

      // Simpan navigate_to action untuk dikirim ke client
      if (name === 'navigate_to' && result.data) {
        navigateAction = result.data as NavigateAction;
      }

      toolResponseParts.push({
        functionResponse: {
          name,
          response: {
            content: result.error
              ? { error: result.error }
              : result.data,
          },
        },
      });
    }

    // Tambah hasil tool ke conversation
    contents.push({
      role: 'user',
      parts: toolResponseParts as unknown as GeminiPart[],
    });
  }

  return NextResponse.json({
    answer: finalAnswer || 'Maaf, tidak bisa menghasilkan jawaban.',
    navigate: navigateAction,
    model: `${GEMINI_VERTEX_MODEL}-vertex`,
  });
}

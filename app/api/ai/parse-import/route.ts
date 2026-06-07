import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, getAuthenticatedUser, getBusinessRoleForUser } from '@/lib/supabase-server';
import { isManagerRole } from '@/lib/roles';
import { IMPORT_PARSE_PROMPT } from '@/lib/ai/prompts';
import { generateTextGeminiVertex, generateTextClaude } from '@/lib/ai/provider';

const bodySchema = z.object({
  business_id: z.string().uuid(),
  provider: z.enum(['gemini-vertex', 'claude']).default('gemini-vertex'),
  // Raw rows dari file (key = header asli). Cap 200 baris per request.
  rows: z.array(z.record(z.string(), z.any())).min(1).max(200),
  // Konteks tambahan opsional (mis. jawaban user atas pertanyaan follow-up sebelumnya).
  clarifications: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
});

const VALID_CATEGORIES = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

type ParsedTx = {
  name: string;
  description: string;
  amount: number;
  date: string;
  category: string;
};

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

  const { business_id, provider, rows, clarifications } = parsed.data;

  const supabase = await createServerClient();
  const role = await getBusinessRoleForUser(supabase, user.id, business_id);
  if (!role || !isManagerRole(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Susun pesan: data mentah + (opsional) jawaban klarifikasi user.
  let userContent = `DATA MENTAH:\n${JSON.stringify(rows)}`;
  if (clarifications && clarifications.length > 0) {
    const qa = clarifications.map((c) => `T: ${c.question}\nJ: ${c.answer}`).join('\n');
    userContent += `\n\nKLARIFIKASI DARI USER (pakai untuk finalisasi, JANGAN tanya lagi hal yang sudah dijawab):\n${qa}`;
  }

  const messages = [{ role: 'user' as const, content: userContent }];

  // Provider Vertex saja — full LLM. Claude kalau dipilih & tersedia, else Gemini Vertex.
  const aiResult =
    provider === 'claude'
      ? await generateTextClaude(IMPORT_PARSE_PROMPT, messages, { temperature: 0, maxTokens: 8192 })
      : await generateTextGeminiVertex(IMPORT_PARSE_PROMPT, messages, { temperature: 0, maxTokens: 8192 });

  if (!aiResult) {
    return NextResponse.json({ error: 'LLM tidak tersedia. Pastikan Vertex AI dikonfigurasi.' }, { status: 503 });
  }

  try {
    const clean = aiResult.text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const obj = JSON.parse(clean) as {
      transactions?: unknown[];
      questions?: unknown[];
      summary?: string;
    };

    const transactions: ParsedTx[] = (obj.transactions ?? [])
      .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
      .map((t) => ({
        name: String(t.name ?? '').trim(),
        description: String(t.description ?? '').trim(),
        amount: typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount).replace(/[^\d.-]/g, '')),
        date: String(t.date ?? '').trim(),
        category: String(t.category ?? '').toUpperCase().trim(),
      }))
      .filter(
        (t) =>
          t.name &&
          Number.isFinite(t.amount) &&
          t.amount > 0 &&
          /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
          VALID_CATEGORIES.includes(t.category)
      );

    const questions: string[] = (obj.questions ?? [])
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      .slice(0, 2);

    return NextResponse.json({
      transactions,
      questions,
      summary: typeof obj.summary === 'string' ? obj.summary : '',
      source: aiResult.provider,
    });
  } catch (err) {
    console.warn('[ai/parse-import] JSON parse error:', err);
    return NextResponse.json({ error: 'Gagal membaca hasil LLM. Coba lagi.' }, { status: 502 });
  }
}

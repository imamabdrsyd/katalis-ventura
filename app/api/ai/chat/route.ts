import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, getAuthenticatedUser, getBusinessRoleForUser } from '@/lib/supabase-server';
import { buildFinancialContext } from '@/lib/ai/financialContext';
import { CHAT_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { routeIntent } from '@/lib/ai/intent';
import { executeTool } from '@/lib/ai/agentTools';
import {
  AIProviderRequestError,
  streamText,
  streamTextClaude,
  streamTextGeminiVertex,
  PROVIDER_LABELS,
  MODEL_LABELS,
} from '@/lib/ai/provider';
import type { Transaction, Account } from '@/types';

const bodySchema = z.object({
  business_id: z.string().uuid(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1).max(4000),
    })
  ).min(1).max(20),
  provider: z.enum(['auto', 'claude', 'gemini-vertex']).optional().default('auto'),
});

const SYSTEM_PROMPT = CHAT_SYSTEM_PROMPT;

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

  const { business_id, messages, provider } = parsed.data;
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';

  const supabase = await createServerClient();
  const role = await getBusinessRoleForUser(supabase, user.id, business_id);
  if (!role) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch konteks keuangan dasar + konteks kepemilikan hanya bila pertanyaannya relevan.
  const route = routeIntent(lastUserMsg);
  
  const [
    { data: business },
    { data: accounts },
    { data: transactions },
    businessInfoResult,
  ] = await Promise.all([
    supabase
      .from('businesses')
      .select('business_name, business_sector')
      .eq('id', business_id)
      .single(),
    supabase
      .from('accounts')
      .select('*')
      .eq('business_id', business_id),
    supabase
      .from('transactions')
      .select(`
        *,
        debit_account:accounts!transactions_debit_account_id_fkey(*),
        credit_account:accounts!transactions_credit_account_id_fkey(*),
        journal_lines(*, account:accounts(*))
      `)
      .eq('business_id', business_id)
      .is('deleted_at', null)
      .or('status.is.null,status.eq.posted')
      .order('date', { ascending: false })
      .limit(3000),
    route.needsBusinessInfo
      ? executeTool('get_business_info', {}, business_id, user.id)
      : Promise.resolve(null),
  ]);

  const financialContext = buildFinancialContext(
    business?.business_name ?? 'Bisnis',
    business?.business_sector ?? '',
    (transactions ?? []) as unknown as Transaction[],
    (accounts ?? []) as unknown as Account[],
    new Date()
  );
  const businessInfoContext = businessInfoResult?.data
    ? `\n\nINFORMASI BISNIS REAL-TIME:
${JSON.stringify(businessInfoResult.data)}

ATURAN INTERPRETASI:
- Bedakan creator terdaftar, anggota + role, dan indikasi pemilik dari cap table pembukuan.
- Jangan menyebut siapa pun sebagai pemilik legal hanya dari data ini.
- Cap table AXION berasal dari akun EQUITY bertanda is_stock, bukan bukti saham/legal formal.`
    : '';

  // Inject konteks keuangan dan, bila relevan, konteks bisnis ke pesan pertama user.
  const aiMessages = messages.map(m => ({ role: m.role, content: m.content })) as import('@/lib/ai/provider').AIMessage[];
  if (aiMessages[0]?.role === 'user') {
    aiMessages[0].content = `${financialContext}${businessInfoContext}\n\n${aiMessages[0].content}`;
  }

  const preferReasoning = route.needsReasoning;

  let result: import('@/lib/ai/provider').StreamResult | null;
  try {
    if (provider === 'claude') {
      result = await streamTextClaude(SYSTEM_PROMPT, aiMessages, { maxTokens: 4096 });
    } else if (provider === 'gemini-vertex') {
      result = await streamTextGeminiVertex(SYSTEM_PROMPT, aiMessages, {
        temperature: 0.7,
        maxTokens: 2048,
      });
    } else {
      result = await streamText(SYSTEM_PROMPT, aiMessages, {
        temperature: 0.7,
        maxTokens: preferReasoning ? 3072 : 2048,
        preferReasoning,
      });
    }
  } catch (error) {
    if (error instanceof AIProviderRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error('[api/ai/chat] Provider error:', error);
    return NextResponse.json({ error: 'AI tidak tersedia saat ini. Coba lagi nanti.' }, { status: 503 });
  }

  if (!result) {
    return NextResponse.json({ error: 'AI tidak tersedia saat ini. Coba lagi nanti.' }, { status: 503 });
  }

  // Kirim provider/model info di header supaya client bisa tampilkan di UI
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

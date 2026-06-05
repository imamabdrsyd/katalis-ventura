import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, getAuthenticatedUser, getBusinessRoleForUser } from '@/lib/supabase-server';
import { isManagerRole } from '@/lib/roles';
import { smartResolveTransaction } from '@/lib/import/smartResolver';
import { parseTransactionMessage } from '@/lib/telegram/parser';
import { PARSE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { generateText } from '@/lib/ai/provider';
import type { Account, TransactionCategory } from '@/types';

const bodySchema = z.object({
  business_id: z.string().uuid(),
  text: z.string().min(2).max(500),
});

type ParsedDraft = {
  name: string;
  amount: number;
  date: string; // ISO YYYY-MM-DD
  category: TransactionCategory;
  description: string;
  debit_account_id: string;
  credit_account_id: string;
  debit_account_code: string;
  credit_account_code: string;
  confidence: 'high' | 'medium' | 'low';
};

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

  const { business_id, text } = parsed.data;

  const supabase = await createServerClient();
  const role = await getBusinessRoleForUser(supabase, user.id, business_id);
  if (!role) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Hanya manager yang boleh input transaksi (investor read-only)
  if (!isManagerRole(role)) {
    return NextResponse.json({ error: 'Hanya manager yang bisa input transaksi' }, { status: 403 });
  }

  const { data: accountsData } = await supabase
    .from('accounts')
    .select('*')
    .eq('business_id', business_id)
    .eq('is_active', true);
  const accounts = (accountsData ?? []) as unknown as Account[];

  // 1. Extract name + amount + date + category_hint.
  // Primary: AI provider chain (Gemini → Groq fallback).
  // Fallback akhir: parser regex — AI = enhancement, bukan dependency.
  let extracted: { name: string; amount: number; date: string | null; category_hint: string | null } | null = null;
  let source: 'ai' | 'rule_based' = 'rule_based';
  let aiProvider: string | null = null;

  const aiResult = await generateText(PARSE_SYSTEM_PROMPT, [{ role: 'user', content: text }], { temperature: 0 });
  if (aiResult) {
    try {
      const clean = aiResult.text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      const g = JSON.parse(clean) as { name?: string; amount?: number; date?: string | null; category_hint?: string | null };
      const gName = (g.name ?? '').trim();
      const gAmount = Number(g.amount ?? 0);
      if (gName && Number.isFinite(gAmount) && gAmount > 0) {
        extracted = { name: gName, amount: gAmount, date: g.date ?? null, category_hint: g.category_hint ?? null };
        source = 'ai';
        aiProvider = aiResult.provider;
      }
    } catch {
      console.warn('[ai/parse-transaction] AI JSON parse failed, fallback rule-based');
    }
  }

  // Fallback rule-based kalau AI tidak menghasilkan
  if (!extracted) {
    const rb = parseTransactionMessage(text);
    if (rb) {
      extracted = { name: rb.name, amount: rb.amount, date: null, category_hint: rb.category };
    }
  }

  if (!extracted) {
    return NextResponse.json(
      { error: 'Tidak bisa mendeteksi nama atau nominal. Coba mis. "bayar listrik 500rb"' },
      { status: 422 }
    );
  }

  const { name, amount } = extracted;

  // 2. Resolve kategori + akun debit/kredit pakai engine rule-based yang sudah ada
  const resolved = smartResolveTransaction(name, accounts, extracted.category_hint ?? undefined);

  const today = new Date().toISOString().split('T')[0];
  const date = extracted.date && /^\d{4}-\d{2}-\d{2}$/.test(extracted.date) ? extracted.date : today;

  const draft: ParsedDraft = {
    name: resolved.name || name,
    amount,
    date,
    category: resolved.category,
    description: name,
    debit_account_id: resolved.debit_account_id,
    credit_account_id: resolved.credit_account_id,
    debit_account_code: resolved.debit_account_code,
    credit_account_code: resolved.credit_account_code,
    confidence: resolved.confidence,
  };

  return NextResponse.json({ data: draft, source, provider: aiProvider });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, getAuthenticatedUser, getBusinessRoleForUser } from '@/lib/supabase-server';
import { isManagerRole } from '@/lib/roles';
import { smartResolveTransaction } from '@/lib/import/smartResolver';
import { extractTransactionFromText, resolveTransactionDate } from '@/lib/ai/parseTransaction';
import type { Account, TransactionCategory } from '@/types';

const bodySchema = z.object({
  business_id: z.string().uuid(),
  text: z.string().min(2).max(500),
  // Hint kategori yang dibawa dari turn sebelumnya (saat user melengkapi nominal).
  category_hint: z.string().nullish(),
  pending_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  // Pilihan model dari selector FAB. 'gemini-vertex'/'claude' → parse pakai Vertex
  // (lebih pintar), selainnya → chain gratis. Default 'auto'.
  provider: z.enum(['auto', 'gemini-vertex', 'claude']).optional(),
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

  const { business_id, text, category_hint: carriedHint, pending_date: carriedDate, provider } = parsed.data;
  const preferVertex = provider === 'gemini-vertex' || provider === 'claude';

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

  // 1. Extract name + amount + date + category_hint via shared helper
  //    (AI provider chain → fallback regex). Sama dgn yg dipakai Telegram bot.
  const extractResult = await extractTransactionFromText(text, { preferVertex });
  if (!extractResult) {
    return NextResponse.json(
      { error: 'Tidak bisa mendeteksi transaksi. Coba mis. "bayar listrik 500rb"' },
      { status: 422 }
    );
  }

  const { extracted, source, provider: aiProvider, model: aiModel } = extractResult;
  const { name, amount } = extracted;

  // Nama transaksi jelas tapi nominal belum disebut → balik tanya ke user.
  // Frontend menyimpan konteks (name + category_hint) lalu menggabungkan nominal
  // dari jawaban berikutnya tanpa parse ulang.
  if (extractResult.status === 'needs_amount') {
    return NextResponse.json({
      status: 'needs_amount',
      pending: { name, category_hint: extracted.category_hint, date: extracted.date },
      message: `Oke, **${name}**. Berapa nominalnya?`,
      source,
      provider: aiProvider,
      model: aiModel,
    });
  }

  // 2. Resolve kategori + akun debit/kredit pakai engine rule-based yang sudah ada.
  //    Hint dari turn ini diprioritaskan, lalu hint yang dibawa dari turn "needs_amount".
  const resolved = smartResolveTransaction(
    name,
    accounts,
    extracted.category_hint ?? carriedHint ?? undefined
  );

  const today = new Date().toISOString().split('T')[0];
  const date = resolveTransactionDate(extracted.date, carriedDate, today);

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

  return NextResponse.json({ data: draft, source, provider: aiProvider, model: aiModel });
}

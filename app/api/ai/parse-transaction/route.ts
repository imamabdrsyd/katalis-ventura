import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, getAuthenticatedUser, getBusinessRoleForUser } from '@/lib/supabase-server';
import { isManagerRole } from '@/lib/roles';
import { smartResolveTransaction } from '@/lib/import/smartResolver';
import { parseTransactionMessage } from '@/lib/telegram/parser';
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

const PARSE_PROMPT = `Kamu adalah parser transaksi keuangan untuk aplikasi akuntansi UKM Indonesia.
Ekstrak SATU transaksi dari kalimat user. Return JSON SAJA, tanpa teks lain.

Schema:
{
  "name": "deskripsi singkat transaksi (nama vendor/keperluan, mis. 'Bayar listrik', 'Jual kopi ke Budi')",
  "amount": number (nominal dalam Rupiah, angka bulat tanpa titik/koma),
  "date": "YYYY-MM-DD atau null kalau tidak disebut",
  "category_hint": "EARN/OPEX/VAR/CAPEX/TAX/FIN — tebakan kategori, atau null"
}

Aturan amount (PENTING, format Indonesia):
- "500rb", "500k", "500ribu" → 500000
- "1.5jt", "1,5jt", "1.5juta" → 1500000
- "2jt" → 2000000
- "150.000" (titik = ribuan) → 150000
- "150000" → 150000

Aturan kategori (hint saja, boleh null kalau ragu):
- EARN: terima uang/penjualan/pendapatan ("jual", "terima", "dapat bayaran")
- OPEX: beban operasional ("bayar listrik/gaji/sewa/wifi/internet")
- VAR: beli bahan baku/stok/persediaan
- CAPEX: beli aset tetap (mesin, peralatan, kendaraan)
- TAX: bayar pajak
- FIN: pinjaman/modal/cicilan/prive

Aturan tanggal:
- "kemarin", "hari ini", "tadi" → null (sistem isi default hari ini)
- "tanggal 5", "5 mei" → konversi ke ISO tahun berjalan
- Kalau tidak disebut → null

Contoh:
Input: "bayar listrik 500rb"
Output: {"name":"Bayar listrik","amount":500000,"date":null,"category_hint":"OPEX"}

Input: "jual kopi ke pak budi 2.5jt"
Output: {"name":"Jual kopi ke Pak Budi","amount":2500000,"date":null,"category_hint":"EARN"}`;

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
  //    Primary: Gemini (lebih pintar untuk natural language).
  //    Fallback: parser regex (parseTransactionMessage) — dipakai kalau Gemini
  //    quota habis / error / API key kosong. AI = enhancement, bukan dependency.
  let extracted: { name: string; amount: number; date: string | null; category_hint: string | null } | null = null;
  let source: 'gemini' | 'rule_based' = 'rule_based';

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: PARSE_PROMPT }] },
            contents: [{ parts: [{ text }] }],
            generationConfig: { temperature: 0, responseMimeType: 'application/json' },
          }),
        }
      );
      if (res.ok) {
        const json = await res.json();
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const clean = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
        const g = JSON.parse(clean) as { name?: string; amount?: number; date?: string | null; category_hint?: string | null };
        const gName = (g.name ?? '').trim();
        const gAmount = Number(g.amount ?? 0);
        if (gName && Number.isFinite(gAmount) && gAmount > 0) {
          extracted = { name: gName, amount: gAmount, date: g.date ?? null, category_hint: g.category_hint ?? null };
          source = 'gemini';
        }
      } else {
        // 429 quota / 5xx → fallback diam-diam ke rule-based
        console.warn('[ai/parse-transaction] Gemini unavailable, fallback rule-based:', res.status);
      }
    } catch (err) {
      console.warn('[ai/parse-transaction] Gemini error, fallback rule-based:', err);
    }
  }

  // Fallback rule-based kalau Gemini tidak menghasilkan
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

  return NextResponse.json({ data: draft, source });
}
